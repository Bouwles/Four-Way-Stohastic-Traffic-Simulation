/**
 * Paired evaluation, calibration of k, and time-step sensitivity.
 *
 * Every paired trial generates ONE set of arrival arrays and feeds the exact
 * same arrays to the Equal-Time System and to the Optimized System, so the two
 * systems always face identical traffic and the difference d_j isolates the
 * effect of the policy rather than the effect of the random draw.
 */

import {
  MODEL, SCENARIOS, CALIBRATION_SCENARIOS, CALIBRATION_TRIALS, EVALUATION_TRIALS,
  K_GRID, TIMESTEP_GRID, TIMESTEP_SEED_BASE, TIMESTEP_TRIALS, TIMESTEP_SCENARIO,
  REPRESENTATIVE, PATTERN_LABELS, lambdasFor, directionalAsymmetry, trialSeed, DIRS,
} from './constants.js';
import { generateArrivals } from './arrivals.js';
import { simulateTrial } from './engine.js';
import { mean, pairedStats, tIntervalStats, percentageReductions } from '../utils/statistics.js';

/** One paired trial: identical arrivals, two policies. */
export function runPairedTrial({ lambdas, seed, k, model = MODEL, dt = model.dt, collectHistory = false }) {
  const arrivals = generateArrivals(lambdas, seed, model);
  const equal = simulateTrial({ arrivals, lambdas, policy: 'equal', model, dt, collectHistory });
  const optimized = simulateTrial({ arrivals, lambdas, policy: 'adaptive', k, model, dt, collectHistory });
  return { seed, arrivals, equal, optimized };
}

function summariseRuns(runs) {
  return {
    meanWait: mean(runs.map(r => r.meanWait)),
    maxQueue: mean(runs.map(r => r.maxQueue)),
    fairness: mean(runs.map(r => r.fairness)),
    clearanceTime: mean(runs.map(r => r.clearanceTime)),
    roadMeanWait: [0, 1, 2, 3].map(i => mean(runs.map(r => r.roadMeanWait[i]))),
    totalArrivals: mean(runs.map(r => r.totalArrivals)),
    totalServed: mean(runs.map(r => r.totalServed)),
  };
}

/**
 * Run `trials` paired trials for one scenario and produce the full statistics.
 */
export function runPairedScenario({
  pattern, rho, seedBase, trials, k, model = MODEL, dt = model.dt, onProgress, shouldCancel,
}) {
  const lambdas = lambdasFor(pattern, rho, model);
  const equalRuns = [];
  const optimizedRuns = [];
  const rows = [];

  for (let j = 0; j < trials; j++) {
    if (shouldCancel && shouldCancel()) return null;
    const seed = trialSeed(seedBase, j);
    const { equal, optimized } = runPairedTrial({ lambdas, seed, k, model, dt });
    equalRuns.push(equal);
    optimizedRuns.push(optimized);
    rows.push({
      trial: j,
      seed,
      equalWait: equal.meanWait,
      optimizedWait: optimized.meanWait,
      difference: equal.meanWait - optimized.meanWait,
      reduction: equal.meanWait === 0
        ? 0
        : (100 * (equal.meanWait - optimized.meanWait)) / equal.meanWait,
      equalMaxQueue: equal.maxQueue,
      optimizedMaxQueue: optimized.maxQueue,
      equalFairness: equal.fairness,
      optimizedFairness: optimized.fairness,
      equalClearance: equal.clearanceTime,
      optimizedClearance: optimized.clearanceTime,
      totalArrivals: equal.totalArrivals,
      optimizedGreen: optimized.greenTimes,
    });
    if (onProgress) onProgress(j + 1, trials);
  }

  const equalWaits = equalRuns.map(r => r.meanWait);
  const optimizedWaits = optimizedRuns.map(r => r.meanWait);
  const diffStats = pairedStats(equalWaits, optimizedWaits);
  const reductions = percentageReductions(equalWaits, optimizedWaits);
  const reductionStats = tIntervalStats(reductions);

  return {
    pattern,
    patternLabel: PATTERN_LABELS[pattern] ?? pattern,
    rho,
    seedBase,
    trials,
    k,
    dt,
    lambdas,
    asymmetry: directionalAsymmetry(lambdas),
    equal: summariseRuns(equalRuns),
    optimized: summariseRuns(optimizedRuns),
    diffStats,
    reductionStats,
    reductions,
    equalWaits,
    optimizedWaits,
    rows,
  };
}

/** All nine evaluation scenarios, in the required order. */
export function runAllScenarios({ trials = EVALUATION_TRIALS, k, model = MODEL, onProgress, shouldCancel } = {}) {
  const results = [];
  const total = SCENARIOS.length * trials;
  let done = 0;
  for (const scenario of SCENARIOS) {
    const res = runPairedScenario({
      pattern: scenario.pattern,
      rho: scenario.rho,
      seedBase: scenario.seedBase,
      trials,
      k,
      model,
      shouldCancel,
      onProgress: () => {
        done += 1;
        if (onProgress) onProgress(done, total, scenario.label);
      },
    });
    if (res === null) return null;
    results.push({ ...res, index: scenario.index, label: scenario.label, id: scenario.id });
  }
  return results;
}

/**
 * Calibration of k.
 *
 *   J(k) = 0.7 · mean(W_O / W_E) + 0.2 · mean(Qmax_O / Qmax_E) + 0.1 · mean(F_O / F_E)
 *
 * Each ratio is formed from the mean performance of a training scenario, and
 * the three scenario ratios are then averaged. The ratios are dimensionless, so
 * the three components can be combined without unit mismatch.
 *
 * The winning k is whichever tested value minimises the computed J — it is not
 * assumed in advance.
 */
export const CALIBRATION_WEIGHTS = { wait: 0.7, maxQueue: 0.2, fairness: 0.1 };

export function runCalibration({
  kGrid = K_GRID, trials = CALIBRATION_TRIALS, model = MODEL, onProgress, shouldCancel,
} = {}) {
  const rows = [];
  const total = kGrid.length * CALIBRATION_SCENARIOS.length * trials;
  let done = 0;

  for (const k of kGrid) {
    const perScenario = [];
    for (const scenario of CALIBRATION_SCENARIOS) {
      const lambdas = lambdasFor(scenario.pattern, scenario.rho, model);
      const equalRuns = [];
      const optimizedRuns = [];
      for (let j = 0; j < trials; j++) {
        if (shouldCancel && shouldCancel()) return null;
        const seed = trialSeed(scenario.seedBase, j);
        const { equal, optimized } = runPairedTrial({ lambdas, seed, k, model });
        equalRuns.push(equal);
        optimizedRuns.push(optimized);
        done += 1;
        if (onProgress) onProgress(done, total, `k = ${k}, ${scenario.pattern}`);
      }
      const e = summariseRuns(equalRuns);
      const o = summariseRuns(optimizedRuns);
      perScenario.push({
        pattern: scenario.pattern,
        rho: scenario.rho,
        seedBase: scenario.seedBase,
        equalWait: e.meanWait,
        optimizedWait: o.meanWait,
        equalMaxQueue: e.maxQueue,
        optimizedMaxQueue: o.maxQueue,
        equalFairness: e.fairness,
        optimizedFairness: o.fairness,
        waitRatio: safeRatio(o.meanWait, e.meanWait),
        maxQueueRatio: safeRatio(o.maxQueue, e.maxQueue),
        fairnessRatio: safeRatio(o.fairness, e.fairness),
      });
    }
    const waitRatio = mean(perScenario.map(s => s.waitRatio));
    const maxQueueRatio = mean(perScenario.map(s => s.maxQueueRatio));
    const fairnessRatio = mean(perScenario.map(s => s.fairnessRatio));
    const J = CALIBRATION_WEIGHTS.wait * waitRatio
      + CALIBRATION_WEIGHTS.maxQueue * maxQueueRatio
      + CALIBRATION_WEIGHTS.fairness * fairnessRatio;
    rows.push({ k, waitRatio, maxQueueRatio, fairnessRatio, J, perScenario });
  }

  const best = rows.reduce((a, b) => (b.J < a.J ? b : a));
  return { rows, bestK: best.k, bestJ: best.J, trials, weights: CALIBRATION_WEIGHTS };
}

function safeRatio(numerator, denominator) {
  if (denominator === 0) return numerator === 0 ? 1 : Number.POSITIVE_INFINITY;
  return numerator / denominator;
}

/** Time-step sensitivity: high asymmetry, ρ = 0.90, one shared seed base. */
export function runTimeStepSensitivity({
  k, trials = TIMESTEP_TRIALS, grid = TIMESTEP_GRID, model = MODEL, onProgress, shouldCancel,
} = {}) {
  const rows = [];
  const total = grid.length * trials;
  let done = 0;
  for (const dt of grid) {
    const res = runPairedScenario({
      pattern: TIMESTEP_SCENARIO.pattern,
      rho: TIMESTEP_SCENARIO.rho,
      seedBase: TIMESTEP_SEED_BASE,
      trials,
      k,
      model,
      dt,
      shouldCancel,
      onProgress: () => {
        done += 1;
        if (onProgress) onProgress(done, total, `Δt = ${dt}s`);
      },
    });
    if (res === null) return null;
    rows.push({
      dt,
      trials,
      seedBase: TIMESTEP_SEED_BASE,
      equalWait: res.equal.meanWait,
      optimizedWait: res.optimized.meanWait,
      reduction: res.reductionStats.mean,
      reductionLower: res.reductionStats.lower,
      reductionUpper: res.reductionStats.upper,
      equalMaxQueue: res.equal.maxQueue,
      optimizedMaxQueue: res.optimized.maxQueue,
    });
  }
  return { rows, scenario: TIMESTEP_SCENARIO, k, trials };
}

/**
 * Representative single paired run (default: seed 42, high asymmetry, ρ = 0.90)
 * used for the total-queue comparison graph and its CSV export.
 */
export function runRepresentative({ k, model = MODEL, ...overrides } = {}) {
  const cfg = { ...REPRESENTATIVE, ...overrides };
  const lambdas = lambdasFor(cfg.pattern, cfg.rho, model);
  const arrivals = generateArrivals(lambdas, cfg.seed, model);
  const equal = simulateTrial({ arrivals, lambdas, policy: 'equal', model, collectHistory: true, historyStride: 20 });
  const optimized = simulateTrial({ arrivals, lambdas, policy: 'adaptive', k, model, collectHistory: true, historyStride: 20 });

  // Merge both histories onto a common time axis for plotting.
  const byTime = new Map();
  equal.history.forEach(h => byTime.set(h.t, { t: h.t, equalTotal: h.total }));
  optimized.history.forEach(h => {
    const row = byTime.get(h.t) ?? { t: h.t };
    row.optimizedTotal = h.total;
    byTime.set(h.t, row);
  });
  const series = [...byTime.values()].sort((a, b) => a.t - b.t)
    .map(r => ({ equalTotal: 0, optimizedTotal: 0, ...r }));

  return { ...cfg, k, lambdas, asymmetry: directionalAsymmetry(lambdas), equal, optimized, series, dirs: DIRS };
}
