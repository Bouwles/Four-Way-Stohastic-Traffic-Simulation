/**
 * Green-time optimisation.
 * Objective: J = α·W̄ + β·Qmax + γ·σW
 */

import { runSimulation, DIRS } from './queueModel.js';
import { makeRngs } from '../utils/randomSeed.js';

export function calculateObjective(metrics, alpha, beta, gamma) {
  return alpha * metrics.meanWaitTime
       + beta  * metrics.maxQueueLength
       + gamma * metrics.fairnessSD;
}

/**
 * Method 1: Grid Search.
 * Tries every (gN,gS,gE,gW) combo that sums to budget, in gridStep increments.
 */
export function optimiseGreenTimesGridSearch(params, seed = 42) {
  const { cycleLength, yellowDuration, allRedDuration, minGreen, maxGreen,
          gridStep = 5, alpha, beta, gamma } = params;
  const lostTime = 4 * (yellowDuration + allRedDuration);
  const budget   = cycleLength - lostTime;
  const lo = minGreen;
  const step = gridStep;

  let bestJ     = Infinity;
  let bestGreen = [budget / 4, budget / 4, budget / 4, budget / 4];

  for (let gN = lo; gN <= Math.min(maxGreen, budget - 3 * lo); gN += step) {
    for (let gS = lo; gS <= Math.min(maxGreen, budget - gN - 2 * lo); gS += step) {
      for (let gE = lo; gE <= Math.min(maxGreen, budget - gN - gS - lo); gE += step) {
        const gW = budget - gN - gS - gE;
        if (gW < lo || gW > maxGreen) continue;
        const green = [gN, gS, gE, gW];
        const rngs  = makeRngs(seed);
        const m     = runSimulation(params, green, rngs, false);
        const J     = calculateObjective(m, alpha, beta, gamma);
        if (J < bestJ) { bestJ = J; bestGreen = green; }
      }
    }
  }
  return { greenTimes: bestGreen, objectiveValue: bestJ };
}

/**
 * Method 2: Adaptive Queue-Weighted Allocation (per-cycle).
 * weight_i = queue_i + k·λ_i
 * g_i = gmin + (weight_i / Σw) × remaining_budget
 */
export function adaptiveQueueWeightedGreenTimes(queueSnapshot, arrivalRates, params) {
  const { cycleLength, yellowDuration, allRedDuration, minGreen, maxGreen } = params;
  const lostTime = 4 * (yellowDuration + allRedDuration);
  const budget    = cycleLength - lostTime;
  const k = 2;

  const weights = queueSnapshot.map((q, i) => Math.max(q + k * arrivalRates[i], 0.01));
  const wSum    = weights.reduce((a, b) => a + b, 0);
  const spare   = budget - 4 * minGreen;

  let greens = weights.map(w => minGreen + (w / wSum) * spare);
  greens = greens.map(g => Math.min(maxGreen, Math.max(minGreen, g)));

  // Re-normalise so sum == budget exactly
  const s = greens.reduce((a, b) => a + b, 0);
  return greens.map(g => (g / s) * budget);
}
