/**
 * Deterministic validation run.
 *
 *   npm run validate
 *
 * Runs the real calibration, the nine-scenario paired evaluation and the
 * time-step sensitivity study with the same code the browser uses, then prints
 * every computed value next to the Internal Assessment's validation targets.
 * Nothing here is hard-coded into the application — the targets exist only in
 * this report so that differences are visible instead of hidden.
 */

import {
  SCENARIOS, DEFAULT_K, EVALUATION_TRIALS, TIMESTEP_TRIALS,
  intersectionCapacity, greenBudget, directionalAsymmetry,
} from '../src/model/constants.js';
import { runAllScenarios, runCalibration, runTimeStepSensitivity } from '../src/model/evaluation.js';

const SCENARIO_TARGETS = [
  { equal: 46.9, optimized: 47.0, reduction: -0.3, ci: [-0.6, 0.1] },
  { equal: 56.0, optimized: 54.2, reduction: 3.0, ci: [2.6, 3.4] },
  { equal: 90.4, optimized: 78.3, reduction: 12.5, ci: [11.7, 13.4] },
  { equal: 59.9, optimized: 45.7, reduction: 21.7, ci: [20.3, 23.0] },
  { equal: 230.0, optimized: 53.6, reduction: 75.8, ci: [75.3, 76.4] },
  { equal: 421.3, optimized: 92.7, reduction: 78.1, ci: [77.7, 78.4] },
  { equal: 304.4, optimized: 42.9, reduction: 85.1, ci: [84.7, 85.6] },
  { equal: 747.2, optimized: 59.0, reduction: 92.1, ci: [92.0, 92.2] },
  { equal: 1104.4, optimized: 161.7, reduction: 85.5, ci: [85.2, 85.8] },
];

const TIMESTEP_TARGETS = {
  1: { equal: 1100.4, optimized: 157.0, reduction: 85.84 },
  0.5: { equal: 1101.0, optimized: 161.6, reduction: 85.43 },
  0.25: { equal: 1101.3, optimized: 164.6, reduction: 85.16 },
};

const CALIBRATION_TARGETS = { bestK: 480, J480: 0.4123, J720: 0.4150 };

const pad = (v, n) => String(v).padStart(n);
const pct = (a, b) => (b === 0 ? 0 : (100 * (a - b)) / b);

console.log('Four-Way Stochastic Traffic Simulation — validation run');
console.log(`green budget G = ${greenBudget()} s, capacity = ${intersectionCapacity().toFixed(7)} veh/s\n`);

// ── Scenario definitions ────────────────────────────────────────────────────
console.log('Scenarios');
for (const s of SCENARIOS) {
  console.log(
    `  ${s.index + 1}. ${s.label.padEnd(30)} seedBase ${pad(s.seedBase, 9)}` +
    `  λ = [${s.lambdas.map(l => l.toFixed(5)).join(', ')}]  A = ${directionalAsymmetry(s.lambdas).toFixed(3)}`,
  );
}

// ── Calibration ─────────────────────────────────────────────────────────────
console.log('\nCalibration of k');
const calibration = runCalibration();
console.log('       k    W ratio   Qmax ratio     F ratio        J(k)');
for (const r of calibration.rows) {
  const marker = r.k === calibration.bestK ? '  ← minimum' : '';
  console.log(
    `  ${pad(r.k, 6)}   ${r.waitRatio.toFixed(4)}       ${r.maxQueueRatio.toFixed(4)}      ` +
    `${r.fairnessRatio.toFixed(4)}      ${r.J.toFixed(4)}${marker}`,
  );
}
const j480 = calibration.rows.find(r => r.k === 480)?.J;
const j720 = calibration.rows.find(r => r.k === 720)?.J;
console.log(
  `  selected k = ${calibration.bestK} s (target ${CALIBRATION_TARGETS.bestK}), ` +
  `J(480) = ${j480.toFixed(4)} (target ${CALIBRATION_TARGETS.J480}), ` +
  `J(720) = ${j720.toFixed(4)} (target ${CALIBRATION_TARGETS.J720})`,
);

const k = calibration.bestK;

// ── Nine-scenario evaluation ────────────────────────────────────────────────
console.log(`\nPaired evaluation — ${EVALUATION_TRIALS} trials per scenario, k = ${k} s`);
console.log('  scenario                          Equal W  (target)   Opt W  (target)   reduction 95% CI            (target)');
const scenarios = runAllScenarios({ trials: EVALUATION_TRIALS, k });
let worstEqual = 0;
let worstReduction = 0;
scenarios.forEach((s, i) => {
  const t = SCENARIO_TARGETS[i];
  worstEqual = Math.max(worstEqual, Math.abs(pct(s.equal.meanWait, t.equal)));
  worstReduction = Math.max(worstReduction, Math.abs(s.reductionStats.mean - t.reduction));
  console.log(
    `  ${s.label.padEnd(30)} ${pad(s.equal.meanWait.toFixed(1), 8)} ${pad(`(${t.equal})`, 9)}` +
    ` ${pad(s.optimized.meanWait.toFixed(1), 7)} ${pad(`(${t.optimized})`, 8)}` +
    ` ${pad(`${s.reductionStats.mean.toFixed(2)}%`, 8)}` +
    ` [${s.reductionStats.lower.toFixed(2)}%, ${s.reductionStats.upper.toFixed(2)}%]` +
    ` ${pad(`(${t.reduction}% [${t.ci[0]}%, ${t.ci[1]}%])`, 26)}`,
  );
});
console.log(`  largest Equal-Time deviation: ${worstEqual.toFixed(2)}%`);
console.log(`  largest reduction deviation:  ${worstReduction.toFixed(2)} percentage points`);

// ── Invariants ──────────────────────────────────────────────────────────────
console.log('\nInvariant checks');
let failures = 0;
const check = (label, ok) => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}`);
  if (!ok) failures += 1;
};
const allRows = scenarios.flatMap(s => s.rows);
check('every optimized green split sums to 100 s',
  allRows.every(r => Math.abs(r.optimizedGreen.reduce((a, b) => a + b, 0) - 100) < 1e-9));
check('every optimized green stays within [10, 80] s',
  allRows.every(r => r.optimizedGreen.every(g => g >= 10 - 1e-9 && g <= 80 + 1e-9)));
check('no NaN or infinite value in any reported statistic',
  scenarios.every(s => [s.equal.meanWait, s.optimized.meanWait, s.diffStats.mean, s.diffStats.lower,
    s.diffStats.upper, s.reductionStats.mean, s.reductionStats.lower, s.reductionStats.upper,
    s.diffStats.tCritical, s.diffStats.pValue].every(Number.isFinite)));
check('all confidence intervals use a Student t critical value above 1.96',
  scenarios.every(s => s.diffStats.tCritical > 1.96 && s.diffStats.df === s.trials - 1));
check(`calibration selected k = ${CALIBRATION_TARGETS.bestK}`, calibration.bestK === CALIBRATION_TARGETS.bestK);

// ── Time-step sensitivity ───────────────────────────────────────────────────
console.log(`\nTime-step sensitivity — high asymmetry, ρ = 0.90, ${TIMESTEP_TRIALS} paired trials`);
console.log('      Δt   Equal W  (target)    Opt W  (target)   reduction  (target)');
const sensitivity = runTimeStepSensitivity({ k });
for (const r of sensitivity.rows) {
  const t = TIMESTEP_TARGETS[r.dt];
  console.log(
    `  ${pad(r.dt.toFixed(2), 6)} ${pad(r.equalWait.toFixed(1), 9)} ${pad(`(${t.equal})`, 9)}` +
    ` ${pad(r.optimizedWait.toFixed(1), 8)} ${pad(`(${t.optimized})`, 8)}` +
    ` ${pad(`${r.reduction.toFixed(2)}%`, 11)} ${pad(`(${t.reduction}%)`, 9)}`,
  );
}

console.log(`\n${failures === 0 ? 'All invariant checks passed.' : `${failures} invariant check(s) failed.`}`);
process.exit(failures === 0 ? 0 : 1);
