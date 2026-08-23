import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { SCENARIOS, DEFAULT_K, TIMESTEP_GRID } from '../src/model/constants.js';
import {
  runPairedScenario, runCalibration, runTimeStepSensitivity, runRepresentative,
} from '../src/model/evaluation.js';
import {
  RAW_TRIAL_COLUMNS, SCENARIO_SUMMARY_COLUMNS, CALIBRATION_COLUMNS,
  TIMESTEP_COLUMNS, QUEUE_HISTORY_COLUMNS,
  rawTrialsCSV, scenarioSummaryCSV, calibrationCSV, timeStepCSV, queueHistoryCSV,
} from '../src/utils/csvExport.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Split one CSV line, honouring quoted fields that contain commas. */
function splitCsvLine(line) {
  return line.match(/("([^"]|"")*"|[^,]*)(,|$)/g).slice(0, -1).map(s => s.replace(/,$/, ''));
}

/** Recursively assert that no reported number is NaN or infinite. */
function assertAllFinite(value, path = 'root', seen = new WeakSet()) {
  if (typeof value === 'number') {
    assert.ok(Number.isFinite(value), `${path} is ${value}`);
    return;
  }
  if (value === null || typeof value !== 'object' || seen.has(value)) return;
  seen.add(value);
  if (Array.isArray(value)) {
    value.forEach((v, i) => assertAllFinite(v, `${path}[${i}]`, seen));
    return;
  }
  for (const [key, v] of Object.entries(value)) assertAllFinite(v, `${path}.${key}`, seen);
}

test('a paired scenario produces finite statistics and a t-based interval', () => {
  const s = SCENARIOS[8];
  const res = runPairedScenario({
    pattern: s.pattern, rho: s.rho, seedBase: s.seedBase, trials: 12, k: DEFAULT_K,
  });
  assertAllFinite({ ...res, rows: res.rows.slice(0, 3) }, 'scenario');
  assert.equal(res.rows.length, 12);
  assert.equal(res.diffStats.n, 12);
  assert.equal(res.diffStats.df, 11);
  assert.ok(res.diffStats.lower < res.diffStats.mean && res.diffStats.mean < res.diffStats.upper);
  assert.ok(res.reductionStats.lower > 0, 'high asymmetry at rho=0.90 should clearly favour the Optimized System');
  // every row's arrivals were served by both systems
  for (const row of res.rows) {
    assert.ok(Number.isFinite(row.equalWait) && Number.isFinite(row.optimizedWait));
    assert.ok(Math.abs(row.optimizedGreen.reduce((a, b) => a + b, 0) - 100) < 1e-9);
  }
});

test('the evaluation reproduces the expected scenario results', () => {
  // Loose tolerances: these are validation targets, not hard-coded outputs.
  const targets = [
    { i: 0, equal: 46.9, reduction: -0.3 },
    { i: 4, equal: 230.0, reduction: 75.8 },
    { i: 8, equal: 1104.4, reduction: 85.5 },
  ];
  for (const t of targets) {
    const s = SCENARIOS[t.i];
    const res = runPairedScenario({
      pattern: s.pattern, rho: s.rho, seedBase: s.seedBase, trials: 250, k: DEFAULT_K,
    });
    const equalErr = Math.abs(res.equal.meanWait - t.equal) / t.equal;
    assert.ok(equalErr < 0.01, `${s.label}: Equal W = ${res.equal.meanWait} vs ${t.equal}`);
    assert.ok(
      Math.abs(res.reductionStats.mean - t.reduction) < 1.5,
      `${s.label}: reduction = ${res.reductionStats.mean}% vs ${t.reduction}%`,
    );
  }
});

test('calibration selects the k with the smallest computed J', () => {
  const cal = runCalibration();
  assertAllFinite(cal.rows.map(r => ({ k: r.k, J: r.J })), 'calibration');
  const minimum = cal.rows.reduce((a, b) => (b.J < a.J ? b : a));
  assert.equal(cal.bestK, minimum.k);
  assert.equal(cal.bestJ, minimum.J);
  assert.equal(cal.bestK, 480, `calibration picked k = ${cal.bestK}`);
  assert.ok(Math.abs(cal.bestJ - 0.4123) < 0.01, `J(480) = ${cal.bestJ}`);
  const j720 = cal.rows.find(r => r.k === 720).J;
  assert.ok(Math.abs(j720 - 0.4150) < 0.01, `J(720) = ${j720}`);
});

test('time-step sensitivity stays within a fraction of a percent on the baseline', () => {
  const res = runTimeStepSensitivity({ k: DEFAULT_K, trials: 20 });
  assert.deepEqual(res.rows.map(r => r.dt), TIMESTEP_GRID);
  const equalWaits = res.rows.map(r => r.equalWait);
  const spread = (Math.max(...equalWaits) - Math.min(...equalWaits)) / Math.min(...equalWaits);
  assert.ok(spread < 0.01, `Equal-Time W varied by ${(spread * 100).toFixed(2)}% across time steps`);
  assertAllFinite(res.rows, 'timestep');
});

test('CSV exports contain every required column', () => {
  const s = SCENARIOS[8];
  const scenario = runPairedScenario({
    pattern: s.pattern, rho: s.rho, seedBase: s.seedBase, trials: 4, k: DEFAULT_K,
  });
  scenario.label = s.label;
  scenario.id = s.id;
  const calibration = runCalibration({ kGrid: [0, 480], trials: 2 });
  const sensitivity = runTimeStepSensitivity({ k: DEFAULT_K, trials: 2, grid: [1.0] });
  const representative = runRepresentative({ k: DEFAULT_K });

  const checks = [
    [rawTrialsCSV([scenario]), RAW_TRIAL_COLUMNS],
    [scenarioSummaryCSV([scenario]), SCENARIO_SUMMARY_COLUMNS],
    [calibrationCSV(calibration), CALIBRATION_COLUMNS],
    [timeStepCSV(sensitivity), TIMESTEP_COLUMNS],
    [queueHistoryCSV(representative), QUEUE_HISTORY_COLUMNS],
  ];
  for (const [csv, columns] of checks) {
    const lines = csv.split('\n');
    assert.deepEqual(lines[0].split(','), columns);
    assert.ok(lines.length > 1, 'CSV has no data rows');
    for (const line of lines.slice(1, 5)) {
      assert.equal(splitCsvLine(line).length, columns.length);
      assert.ok(!/NaN|Infinity/.test(line), `CSV contains a non-finite value: ${line}`);
    }
  }
});

test('the representative run pairs both systems on one seed and keeps its history', () => {
  const rep = runRepresentative({ k: DEFAULT_K });
  assert.equal(rep.seed, 42);
  assert.equal(rep.pattern, 'High');
  assert.equal(rep.rho, 0.9);
  assert.equal(rep.equal.totalArrivals, rep.optimized.totalArrivals);
  assert.ok(rep.series.length > 100);
  assert.ok(rep.series.every(p => Number.isFinite(p.equalTotal) && Number.isFinite(p.optimizedTotal)));
});

test('the project is configured for GitHub Pages', () => {
  const viteConfig = readFileSync(join(ROOT, 'vite.config.js'), 'utf8');
  assert.match(viteConfig, /base:\s*'\/Four-Way-Stohastic-Traffic-Simulation\/'/);
  assert.ok(existsSync(join(ROOT, 'public/.nojekyll')), 'public/.nojekyll is required for Pages');
  const workflow = readFileSync(join(ROOT, '.github/workflows/deploy.yml'), 'utf8');
  assert.match(workflow, /npm run build/);
  assert.match(workflow, /publish_dir:\s*\.\/dist/);
  // no backend: nothing may be fetched from a server at runtime
  const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
  assert.ok(!pkg.dependencies.express && !pkg.dependencies.axios);
});
