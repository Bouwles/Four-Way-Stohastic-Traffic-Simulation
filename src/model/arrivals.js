/**
 * Poisson arrival process.
 *
 * Vehicles arrive on road i as a Poisson process of rate λ_i, generated through
 * its exponential interarrival times using the inverse-CDF method:
 *
 *   A_i = −ln(1 − U) / λ_i ,   U ~ Uniform[0,1)
 *
 * Arrival times are accumulated until t ≤ T (the arrival horizon).
 */

import { DIRS, MODEL } from './constants.js';
import { createDirectionRngs } from './rng.js';

/** Exponential interarrival gap from a uniform variate. */
export function exponentialInterarrival(lambda, u) {
  return -Math.log(1 - u) / lambda;
}

/** Arrival timestamps for one road, in increasing order. */
export function generateArrivalTimes(lambda, horizon, rng) {
  const times = [];
  if (!(lambda > 0)) return times;
  let t = 0;
  for (;;) {
    t += exponentialInterarrival(lambda, rng());
    if (!(t <= horizon)) return times;
    times.push(t);
  }
}

/**
 * Arrival arrays for all four roads from one trial seed.
 * The returned object is handed unchanged to BOTH signal systems so that a
 * paired trial compares them on identical traffic.
 *
 * @param {number[]} lambdas ordered [N, S, E, W]
 */
export function generateArrivals(lambdas, seed, model = MODEL) {
  const rngs = createDirectionRngs(seed);
  const arrivals = {};
  DIRS.forEach((d, i) => {
    arrivals[d] = generateArrivalTimes(lambdas[i], model.arrivalHorizon, rngs[d]);
  });
  return arrivals;
}
