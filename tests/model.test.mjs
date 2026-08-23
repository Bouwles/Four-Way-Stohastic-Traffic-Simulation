import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DIRS, MODEL, K_GRID, SCENARIOS, CALIBRATION_SCENARIOS, LOADS, PATTERNS,
  greenBudget, intersectionCapacity, lambdasFor, directionalAsymmetry, trialSeed,
} from '../src/model/constants.js';
import { createLcg, directionSeed, createDirectionRngs, DIRECTION_SEED_OFFSETS } from '../src/model/rng.js';
import { generateArrivals, generateArrivalTimes, exponentialInterarrival } from '../src/model/arrivals.js';
import { equalGreenTimes, adaptiveQueueWeightedGreenTimes, allocateBounded } from '../src/model/policies.js';
import { simulateTrial } from '../src/model/engine.js';
import { runPairedTrial } from '../src/model/evaluation.js';

const finite = (x) => Number.isFinite(x);

test('fixed model parameters give G = 100 s and the stated capacity', () => {
  assert.equal(greenBudget(), 100);
  assert.equal(MODEL.cycleLength - 4 * (MODEL.yellow + MODEL.allRed), 100);
  assert.ok(Math.abs(intersectionCapacity() - 0.4166667) < 1e-6);
});

test('LCG reproduces the specified recurrence and never degenerates on a zero seed', () => {
  const rng = createLcg(1);
  const expected = ((1664525 * 1 + 1013904223) >>> 0) / 2 ** 32;
  assert.equal(rng(), expected);

  const zero = createLcg(0);
  const one = createLcg(1);
  assert.equal(zero(), one()); // seed 0 is replaced by 1

  const a = createLcg(12345);
  const b = createLcg(12345);
  for (let i = 0; i < 100; i++) assert.equal(a(), b()); // same seed ⇒ same stream
  const first = createLcg(7)();
  assert.ok(first >= 0 && first < 1);
});

test('direction streams use the required XOR offsets and differ from each other', () => {
  assert.deepEqual(DIRECTION_SEED_OFFSETS, {
    N: 0x1a2b3c, S: 0x4d5e6f, E: 0x7a8b9c, W: 0xdeadbe,
  });
  const seed = 10_000_000;
  for (const d of DIRS) {
    assert.equal(directionSeed(seed, d), (seed ^ DIRECTION_SEED_OFFSETS[d]) >>> 0);
  }
  const rngs = createDirectionRngs(seed);
  const firsts = DIRS.map(d => rngs[d]());
  assert.equal(new Set(firsts).size, 4);
});

test('exponential interarrival times follow -ln(1-U)/lambda', () => {
  assert.ok(Math.abs(exponentialInterarrival(0.5, 0) - 0) < 1e-12);
  assert.ok(Math.abs(exponentialInterarrival(0.25, 0.5) - (-Math.log(0.5) / 0.25)) < 1e-12);
  const times = generateArrivalTimes(0.1, 3600, createLcg(42));
  assert.ok(times.length > 0);
  assert.ok(times.every((t, i) => t > 0 && t <= 3600 && (i === 0 || t > times[i - 1])));
});

test('the same seed always produces identical arrival arrays', () => {
  const lambdas = lambdasFor('High', 0.9);
  const a = generateArrivals(lambdas, 12345);
  const b = generateArrivals(lambdas, 12345);
  const c = generateArrivals(lambdas, 12346);
  for (const d of DIRS) assert.deepEqual(a[d], b[d]);
  assert.notDeepEqual(a.N, c.N);
});

test('a paired trial feeds the identical arrival arrays to both systems', () => {
  const lambdas = lambdasFor('Moderate', 0.75);
  const seed = trialSeed(14_000_000, 3);
  const { arrivals, equal, optimized } = runPairedTrial({ lambdas, seed, k: 480 });
  const expected = generateArrivals(lambdas, seed);
  for (const d of DIRS) assert.deepEqual(arrivals[d], expected[d]);
  assert.deepEqual(equal.arrivalsPerRoad, optimized.arrivalsPerRoad);
  assert.equal(equal.totalArrivals, optimized.totalArrivals);
});

test('the Equal-Time System always gives every road exactly 25 s of green', () => {
  assert.deepEqual(equalGreenTimes(), [25, 25, 25, 25]);
  const lambdas = lambdasFor('High', 0.9);
  const arrivals = generateArrivals(lambdas, 4242);
  const run = simulateTrial({ arrivals, lambdas, policy: 'equal' });
  assert.deepEqual(run.greenTimes, [25, 25, 25, 25]);
});

test('optimized green times always sum to 100 s and stay within [10, 80]', () => {
  const cases = [
    [[0, 0, 0, 0], [0, 0, 0, 0]],            // all weights zero ⇒ equal split
    [[0, 0, 0, 0], lambdasFor('High', 0.9)],
    [[500, 0, 0, 0], lambdasFor('High', 0.9)],
    [[0, 0, 0, 900], lambdasFor('Balanced', 0.55)],
    [[3, 7, 11, 2], lambdasFor('Moderate', 0.75)],
  ];
  for (const k of K_GRID) {
    for (const [queues, lambdas] of cases) {
      const green = adaptiveQueueWeightedGreenTimes(queues, lambdas, k);
      const sum = green.reduce((a, b) => a + b, 0);
      assert.ok(Math.abs(sum - 100) < 1e-9, `sum ${sum} for k=${k}`);
      for (const g of green) {
        assert.ok(g >= MODEL.minGreen - 1e-9 && g <= MODEL.maxGreen + 1e-9, `g=${g}`);
      }
    }
  }
  assert.deepEqual(adaptiveQueueWeightedGreenTimes([0, 0, 0, 0], [0, 0, 0, 0], 480), [25, 25, 25, 25]);
});

test('bounded allocation caps at g_max and redistributes instead of rescaling', () => {
  // A budget that forces a cap: with these bounds one road would otherwise take everything.
  const model = { ...MODEL, minGreen: 10, maxGreen: 40 };
  const green = allocateBounded([1000, 1, 1, 1], model);
  assert.ok(Math.abs(green.reduce((a, b) => a + b, 0) - 100) < 1e-9);
  assert.equal(green[0], 40);
  for (const g of green) assert.ok(g >= 10 - 1e-9 && g <= 40 + 1e-9);
});

test('invalid green allocations raise a clear error', () => {
  assert.throws(() => allocateBounded([1, 1, 1, 1], { ...MODEL, minGreen: 30 }), /g_min/);
  assert.throws(() => allocateBounded([1, 1, 1, 1], { ...MODEL, maxGreen: 20 }), /g_max/);
});

test('every trial ends with empty queues and serves every vehicle', () => {
  for (const policy of ['equal', 'adaptive']) {
    for (const scenario of [SCENARIOS[0], SCENARIOS[4], SCENARIOS[8]]) {
      const arrivals = generateArrivals(scenario.lambdas, trialSeed(scenario.seedBase, 1));
      const run = simulateTrial({ arrivals, lambdas: scenario.lambdas, policy, k: 480 });
      assert.equal(run.totalServed, run.totalArrivals);
      assert.deepEqual(run.servedPerRoad, run.arrivalsPerRoad);
      assert.ok(run.clearanceTime > 0 && finite(run.clearanceTime));
    }
  }
});

test('W is the total queue area divided by the total arrivals, not the mean of road means', () => {
  const lambdas = lambdasFor('High', 0.9);
  const arrivals = generateArrivals(lambdas, 999);
  const run = simulateTrial({ arrivals, lambdas, policy: 'equal' });
  const totalArea = run.queueArea.reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(run.meanWait - totalArea / run.totalArrivals) < 1e-9);

  const unweighted = run.roadMeanWait.reduce((a, b) => a + b, 0) / 4;
  assert.ok(Math.abs(run.meanWait - unweighted) > 1, 'asymmetric demand must separate the two definitions');
});

test('fairness F is the population standard deviation of the four road means', () => {
  const lambdas = lambdasFor('Moderate', 0.75);
  const arrivals = generateArrivals(lambdas, 2024);
  const run = simulateTrial({ arrivals, lambdas, policy: 'adaptive', k: 480 });
  const m = run.roadMeanWait.reduce((a, b) => a + b, 0) / 4;
  const pop = Math.sqrt(run.roadMeanWait.reduce((s, x) => s + (x - m) ** 2, 0) / 4);
  const sample = Math.sqrt(run.roadMeanWait.reduce((s, x) => s + (x - m) ** 2, 0) / 3);
  assert.ok(Math.abs(run.fairness - pop) < 1e-12);
  assert.ok(Math.abs(run.fairness - sample) > 1e-6);
});

test('a fixed seed and k reproduce identical results', () => {
  const lambdas = lambdasFor('High', 0.75);
  const a = runPairedTrial({ lambdas, seed: 555, k: 480 });
  const b = runPairedTrial({ lambdas, seed: 555, k: 480 });
  assert.equal(a.equal.meanWait, b.equal.meanWait);
  assert.equal(a.optimized.meanWait, b.optimized.meanWait);
  const other = runPairedTrial({ lambdas, seed: 555, k: 40 });
  assert.notEqual(a.optimized.meanWait, other.optimized.meanWait);
});

test('an unclearable demand raises the safety-limit error instead of looping forever', () => {
  const model = { ...MODEL, maxRuntime: 5000 };
  const lambdas = [5, 5, 5, 5]; // far beyond capacity
  const arrivals = generateArrivals(lambdas, 1, model);
  assert.throws(
    () => simulateTrial({ arrivals, lambdas, policy: 'equal', model }),
    /failed to clear/,
  );
});

test('scenario definitions match the specified order, seeds and asymmetries', () => {
  assert.equal(SCENARIOS.length, 9);
  SCENARIOS.forEach((s, i) => {
    assert.equal(s.index, i);
    assert.equal(s.seedBase, 10_000_000 + i * 1_000_000);
    assert.equal(s.rho, LOADS[i % 3]);
  });
  assert.equal(trialSeed(10_000_000, 0), 10_000_000);
  assert.equal(trialSeed(10_000_000, 2), 10_000_000 + 2 * 31337);

  const expectedA = { Balanced: 0.0, Moderate: 0.374, High: 0.740 };
  for (const pattern of Object.keys(PATTERNS)) {
    const A = directionalAsymmetry(lambdasFor(pattern, 0.75));
    assert.ok(Math.abs(A - expectedA[pattern]) < 0.001, `${pattern}: A = ${A}`);
  }
});

test('calibration seeds are disjoint from the evaluation seeds', () => {
  const evaluationSeeds = new Set();
  for (const s of SCENARIOS) {
    for (let j = 0; j < 250; j++) evaluationSeeds.add(trialSeed(s.seedBase, j));
  }
  for (const s of CALIBRATION_SCENARIOS) {
    for (let j = 0; j < 60; j++) {
      assert.ok(!evaluationSeeds.has(trialSeed(s.seedBase, j)), 'calibration seed reused in evaluation');
    }
    assert.equal(s.rho, 0.75);
  }
  assert.deepEqual(CALIBRATION_SCENARIOS.map(s => s.seedBase), [110_000, 1_110_000, 2_110_000]);
});
