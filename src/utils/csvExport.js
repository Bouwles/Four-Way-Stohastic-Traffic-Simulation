/**
 * CSV builders and browser download helper.
 *
 * Every export carries the scenario parameters (traffic pattern, load ρ,
 * arrival rates, seeds, k, Δt) alongside the numbers so a downloaded file is
 * self-describing.
 */

const DIR_KEYS = ['N', 'S', 'E', 'W'];

function escapeCell(value) {
  if (value === null || value === undefined) return '';
  const s = typeof value === 'number' ? formatNumber(value) : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function formatNumber(n) {
  if (!Number.isFinite(n)) return '';
  if (Number.isInteger(n)) return String(n);
  return n.toPrecision(10).replace(/0+$/, '').replace(/\.$/, '');
}

/** Build a CSV string from column definitions and rows. */
export function buildCSV(columns, rows) {
  const lines = [columns.join(',')];
  for (const row of rows) lines.push(columns.map(c => escapeCell(row[c])).join(','));
  return lines.join('\n');
}

export function downloadCSV(filename, csv) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ── Raw paired trials ───────────────────────────────────────────────────────
export const RAW_TRIAL_COLUMNS = [
  'scenario', 'pattern', 'rho', 'asymmetry', 'k', 'dt',
  'lambda_N', 'lambda_S', 'lambda_E', 'lambda_W',
  'seedBase', 'trial', 'seed', 'totalArrivals',
  'equalWait_s', 'optimizedWait_s', 'difference_s', 'reduction_pct',
  'equalMaxQueue', 'optimizedMaxQueue', 'equalFairness_s', 'optimizedFairness_s',
  'equalClearance_s', 'optimizedClearance_s',
  'optimizedGreen_N', 'optimizedGreen_S', 'optimizedGreen_E', 'optimizedGreen_W',
];

export function rawTrialRows(scenarios) {
  const rows = [];
  for (const s of scenarios) {
    for (const r of s.rows) {
      rows.push({
        scenario: s.label,
        pattern: s.pattern,
        rho: s.rho,
        asymmetry: s.asymmetry,
        k: s.k,
        dt: s.dt,
        lambda_N: s.lambdas[0], lambda_S: s.lambdas[1],
        lambda_E: s.lambdas[2], lambda_W: s.lambdas[3],
        seedBase: s.seedBase,
        trial: r.trial,
        seed: r.seed,
        totalArrivals: r.totalArrivals,
        equalWait_s: r.equalWait,
        optimizedWait_s: r.optimizedWait,
        difference_s: r.difference,
        reduction_pct: r.reduction,
        equalMaxQueue: r.equalMaxQueue,
        optimizedMaxQueue: r.optimizedMaxQueue,
        equalFairness_s: r.equalFairness,
        optimizedFairness_s: r.optimizedFairness,
        equalClearance_s: r.equalClearance,
        optimizedClearance_s: r.optimizedClearance,
        optimizedGreen_N: r.optimizedGreen[0], optimizedGreen_S: r.optimizedGreen[1],
        optimizedGreen_E: r.optimizedGreen[2], optimizedGreen_W: r.optimizedGreen[3],
      });
    }
  }
  return rows;
}

export function rawTrialsCSV(scenarios) {
  return buildCSV(RAW_TRIAL_COLUMNS, rawTrialRows(scenarios));
}

// ── Scenario summaries ──────────────────────────────────────────────────────
export const SCENARIO_SUMMARY_COLUMNS = [
  'scenario', 'pattern', 'rho', 'asymmetry', 'trials', 'k', 'dt',
  'lambda_N', 'lambda_S', 'lambda_E', 'lambda_W', 'seedBase',
  'equalWait_s', 'optimizedWait_s',
  'meanDifference_s', 'diffCI_lower_s', 'diffCI_upper_s',
  'meanReduction_pct', 'reductionCI_lower_pct', 'reductionCI_upper_pct',
  'tCritical', 'tStatistic', 'pValue',
  'equalMaxQueue', 'optimizedMaxQueue',
  'equalFairness_s', 'optimizedFairness_s',
  'equalClearance_s', 'optimizedClearance_s',
  ...DIR_KEYS.map(d => `equalWait_${d}_s`),
  ...DIR_KEYS.map(d => `optimizedWait_${d}_s`),
];

export function scenarioSummaryRows(scenarios) {
  return scenarios.map(s => {
    const row = {
      scenario: s.label,
      pattern: s.pattern,
      rho: s.rho,
      asymmetry: s.asymmetry,
      trials: s.trials,
      k: s.k,
      dt: s.dt,
      lambda_N: s.lambdas[0], lambda_S: s.lambdas[1],
      lambda_E: s.lambdas[2], lambda_W: s.lambdas[3],
      seedBase: s.seedBase,
      equalWait_s: s.equal.meanWait,
      optimizedWait_s: s.optimized.meanWait,
      meanDifference_s: s.diffStats.mean,
      diffCI_lower_s: s.diffStats.lower,
      diffCI_upper_s: s.diffStats.upper,
      meanReduction_pct: s.reductionStats.mean,
      reductionCI_lower_pct: s.reductionStats.lower,
      reductionCI_upper_pct: s.reductionStats.upper,
      tCritical: s.diffStats.tCritical,
      tStatistic: s.diffStats.tStat,
      pValue: s.diffStats.pValue,
      equalMaxQueue: s.equal.maxQueue,
      optimizedMaxQueue: s.optimized.maxQueue,
      equalFairness_s: s.equal.fairness,
      optimizedFairness_s: s.optimized.fairness,
      equalClearance_s: s.equal.clearanceTime,
      optimizedClearance_s: s.optimized.clearanceTime,
    };
    DIR_KEYS.forEach((d, i) => {
      row[`equalWait_${d}_s`] = s.equal.roadMeanWait[i];
      row[`optimizedWait_${d}_s`] = s.optimized.roadMeanWait[i];
    });
    return row;
  });
}

export function scenarioSummaryCSV(scenarios) {
  return buildCSV(SCENARIO_SUMMARY_COLUMNS, scenarioSummaryRows(scenarios));
}

// ── Calibration ─────────────────────────────────────────────────────────────
export const CALIBRATION_COLUMNS = [
  'k', 'trialsPerScenario', 'scenario', 'pattern', 'rho', 'seedBase',
  'equalWait_s', 'optimizedWait_s', 'waitRatio',
  'equalMaxQueue', 'optimizedMaxQueue', 'maxQueueRatio',
  'equalFairness_s', 'optimizedFairness_s', 'fairnessRatio',
  'meanWaitRatio', 'meanMaxQueueRatio', 'meanFairnessRatio', 'J',
];

export function calibrationRows(calibration) {
  const rows = [];
  for (const r of calibration.rows) {
    for (const s of r.perScenario) {
      rows.push({
        k: r.k,
        trialsPerScenario: calibration.trials,
        scenario: `${s.pattern}, rho=${s.rho}`,
        pattern: s.pattern,
        rho: s.rho,
        seedBase: s.seedBase,
        equalWait_s: s.equalWait,
        optimizedWait_s: s.optimizedWait,
        waitRatio: s.waitRatio,
        equalMaxQueue: s.equalMaxQueue,
        optimizedMaxQueue: s.optimizedMaxQueue,
        maxQueueRatio: s.maxQueueRatio,
        equalFairness_s: s.equalFairness,
        optimizedFairness_s: s.optimizedFairness,
        fairnessRatio: s.fairnessRatio,
        meanWaitRatio: r.waitRatio,
        meanMaxQueueRatio: r.maxQueueRatio,
        meanFairnessRatio: r.fairnessRatio,
        J: r.J,
      });
    }
  }
  return rows;
}

export function calibrationCSV(calibration) {
  return buildCSV(CALIBRATION_COLUMNS, calibrationRows(calibration));
}

// ── Time-step sensitivity ───────────────────────────────────────────────────
export const TIMESTEP_COLUMNS = [
  'dt_s', 'pattern', 'rho', 'trials', 'seedBase', 'k',
  'equalWait_s', 'optimizedWait_s', 'reduction_pct',
  'reductionCI_lower_pct', 'reductionCI_upper_pct',
  'equalMaxQueue', 'optimizedMaxQueue',
];

export function timeStepRows(sensitivity) {
  return sensitivity.rows.map(r => ({
    dt_s: r.dt,
    pattern: sensitivity.scenario.pattern,
    rho: sensitivity.scenario.rho,
    trials: r.trials,
    seedBase: r.seedBase,
    k: sensitivity.k,
    equalWait_s: r.equalWait,
    optimizedWait_s: r.optimizedWait,
    reduction_pct: r.reduction,
    reductionCI_lower_pct: r.reductionLower,
    reductionCI_upper_pct: r.reductionUpper,
    equalMaxQueue: r.equalMaxQueue,
    optimizedMaxQueue: r.optimizedMaxQueue,
  }));
}

export function timeStepCSV(sensitivity) {
  return buildCSV(TIMESTEP_COLUMNS, timeStepRows(sensitivity));
}

// ── Representative queue history ────────────────────────────────────────────
export const QUEUE_HISTORY_COLUMNS = [
  'pattern', 'rho', 'seed', 'k', 'dt', 'system', 'time_s',
  'queue_N', 'queue_S', 'queue_E', 'queue_W', 'totalQueue',
  'activeDirection', 'cycle', 'green_N', 'green_S', 'green_E', 'green_W',
];

export function queueHistoryRows(representative) {
  const rows = [];
  const push = (system, run) => {
    for (const h of run.history) {
      rows.push({
        pattern: representative.pattern,
        rho: representative.rho,
        seed: representative.seed,
        k: representative.k,
        dt: run.dt,
        system,
        time_s: h.t,
        queue_N: h.qN, queue_S: h.qS, queue_E: h.qE, queue_W: h.qW,
        totalQueue: h.total,
        activeDirection: h.activeDir ?? '',
        cycle: h.cycle,
        green_N: h.gN, green_S: h.gS, green_E: h.gE, green_W: h.gW,
      });
    }
  };
  push('Equal-Time System', representative.equal);
  push('Optimized System', representative.optimized);
  return rows;
}

export function queueHistoryCSV(representative) {
  return buildCSV(QUEUE_HISTORY_COLUMNS, queueHistoryRows(representative));
}
