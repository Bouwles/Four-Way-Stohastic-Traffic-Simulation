/**
 * Green-time allocation policies.
 *
 *   Equal-Time System  — every road gets g_i = G/4 in every cycle.
 *   Optimized System   — "adaptive queue-weighted policy": at the start of every
 *                        complete cycle the green split is recomputed from
 *                          w_i = Q_i + k λ_i
 *                        where k (seconds) converts an arrival rate into the
 *                        number of vehicles expected in the next k seconds.
 *
 * Both policies must satisfy g_min ≤ g_i ≤ g_max and Σ g_i = G.
 */

import { MODEL, greenBudget } from './constants.js';

const TOLERANCE = 1e-6;

/** Equal-Time System: g_i = G/4. */
export function equalGreenTimes(model = MODEL) {
  const g = greenBudget(model) / 4;
  return [g, g, g, g];
}

/**
 * Iterative bounded allocation.
 *
 *  1. give every road its minimum g_min,
 *  2. share the remainder G − 4g_min in proportion to the weights,
 *  3. any road that would exceed g_max is fixed at g_max,
 *  4. its unused budget is redistributed among the uncapped roads,
 *  5. repeat until the whole budget is allocated.
 *
 * Clamping and then rescaling all four values is deliberately NOT used, because
 * rescaling can push a clamped road back outside [g_min, g_max].
 */
export function allocateBounded(weights, model = MODEL) {
  const G = greenBudget(model);
  const { minGreen, maxGreen } = model;
  const n = weights.length;

  if (minGreen * n > G + TOLERANCE) {
    throw new Error(`Green budget ${G}s cannot cover ${n} × g_min = ${minGreen * n}s`);
  }
  if (maxGreen * n < G - TOLERANCE) {
    throw new Error(`Green budget ${G}s exceeds ${n} × g_max = ${maxGreen * n}s`);
  }

  const green = new Array(n).fill(minGreen);
  let free = weights.map((_, i) => i);
  let budget = G - n * minGreen;

  const totalWeight = weights.reduce((a, b) => a + b, 0);
  // All weights zero (e.g. k = 0 on an empty intersection) ⇒ equal split.
  const w = totalWeight > 0 ? weights : weights.map(() => 1);

  for (let guard = 0; guard <= n; guard++) {
    if (free.length === 0) break;
    const sumW = free.reduce((a, i) => a + w[i], 0);
    const stillFree = [];
    let capped = false;

    for (const i of free) {
      const share = sumW > 0 ? w[i] / sumW : 1 / free.length;
      const value = minGreen + budget * share;
      if (value > maxGreen + TOLERANCE) {
        green[i] = maxGreen;
        budget -= maxGreen - minGreen;
        capped = true;
      } else {
        stillFree.push(i);
      }
    }

    if (!capped) {
      const finalSum = stillFree.reduce((a, i) => a + w[i], 0);
      for (const i of stillFree) {
        const share = finalSum > 0 ? w[i] / finalSum : 1 / stillFree.length;
        green[i] = minGreen + budget * share;
      }
      break;
    }
    free = stillFree;
  }

  validateGreenTimes(green, model);
  return green;
}

/** w_i = Q_i + k λ_i, then iterative bounded allocation. */
export function adaptiveQueueWeightedGreenTimes(queues, lambdas, k, model = MODEL) {
  const weights = queues.map((q, i) => Math.max(0, q + k * lambdas[i]));
  return allocateBounded(weights, model);
}

/** Throws a clear error if the budget or the bounds are violated. */
export function validateGreenTimes(green, model = MODEL) {
  const G = greenBudget(model);
  const sum = green.reduce((a, b) => a + b, 0);
  green.forEach((g, i) => {
    if (!Number.isFinite(g)) {
      throw new Error(`Green time for road ${i} is not finite: ${g}`);
    }
    if (g < model.minGreen - TOLERANCE || g > model.maxGreen + TOLERANCE) {
      throw new Error(
        `Green time ${g.toFixed(6)}s for road ${i} violates bounds [${model.minGreen}, ${model.maxGreen}]`,
      );
    }
  });
  if (Math.abs(sum - G) > 1e-6) {
    throw new Error(`Green times sum to ${sum.toFixed(6)}s, expected budget ${G}s`);
  }
  return true;
}
