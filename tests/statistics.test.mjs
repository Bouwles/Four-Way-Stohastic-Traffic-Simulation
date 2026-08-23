import test from 'node:test';
import assert from 'node:assert/strict';

import {
  mean, sampleSD, populationSD, tCritical, studentTTwoSidedP,
  tIntervalStats, pairedStats, percentageReductions, interpretInterval,
} from '../src/utils/statistics.js';

test('sample and population standard deviations use the right divisor', () => {
  const v = [2, 4, 4, 4, 5, 5, 7, 9];
  assert.equal(mean(v), 5);
  assert.ok(Math.abs(populationSD(v) - 2) < 1e-12);
  assert.ok(Math.abs(sampleSD(v) - Math.sqrt(32 / 7)) < 1e-12);
});

test('Student t critical values match published tables and are not 1.96', () => {
  const table = [[1, 12.706], [9, 2.262], [29, 2.045], [60, 2.000], [249, 1.9695]];
  for (const [df, expected] of table) {
    assert.ok(Math.abs(tCritical(df) - expected) < 0.002, `df=${df}: ${tCritical(df)}`);
  }
  assert.ok(tCritical(9) > 1.96 + 0.2, 'small samples must use a wider critical value than 1.96');
  assert.ok(tCritical(249) > 1.96, 't critical always exceeds the normal value');
});

test('two-sided p-values behave correctly', () => {
  assert.ok(Math.abs(studentTTwoSidedP(0, 10) - 1) < 1e-12);
  assert.ok(studentTTwoSidedP(2.228, 10) > 0.049 && studentTTwoSidedP(2.228, 10) < 0.051);
  assert.ok(studentTTwoSidedP(50, 249) < 1e-30);
});

test('the confidence interval is mean ± t * s/sqrt(n)', () => {
  const values = Array.from({ length: 40 }, (_, i) => Math.sin(i) * 3 + 10);
  const stats = tIntervalStats(values);
  const half = tCritical(stats.df) * (stats.sd / Math.sqrt(stats.n));
  assert.ok(Math.abs((stats.upper - stats.lower) / 2 - half) < 1e-12);
  assert.equal(stats.df, values.length - 1);
  assert.ok(Math.abs(stats.tCritical - tCritical(values.length - 1)) < 1e-12);
});

test('paired statistics use the differences, not the two samples separately', () => {
  const equal = [100, 102, 98, 101, 99];
  const optimized = [90, 93, 88, 92, 89];
  const paired = pairedStats(equal, optimized);
  assert.deepEqual(paired.diffs, [10, 9, 10, 9, 10]);
  assert.ok(Math.abs(paired.mean - 9.6) < 1e-12);
  assert.ok(Math.abs(paired.sd - sampleSD([10, 9, 10, 9, 10])) < 1e-12);
  assert.ok(paired.lower > 0 && paired.upper > paired.lower);
  assert.throws(() => pairedStats([1, 2], [1]), /same length/);
});

test('percentage reductions are computed per trial', () => {
  const r = percentageReductions([100, 200], [50, 150]);
  assert.deepEqual(r, [50, 25]);
  // the mean of the per-trial reductions is not the reduction of the means
  assert.notEqual(mean(r), (100 * (150 - 100)) / 150);
});

test('interval interpretation follows the stated rules', () => {
  assert.equal(interpretInterval({ lower: 2, upper: 5 }), 'better');
  assert.equal(interpretInterval({ lower: -1, upper: 5 }), 'inconclusive');
  assert.equal(interpretInterval({ lower: -5, upper: -1 }), 'worse');
  assert.equal(interpretInterval({ lower: Number.NaN, upper: 1 }), 'unavailable');
});
