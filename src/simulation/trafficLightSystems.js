/**
 * Two traffic light systems:
 *   System A - Equal-Time: fixed equal green per direction
 *   System B - Optimised: grid search or adaptive queue-weighted
 */

import { runSimulation, DIRS } from './queueModel.js';
import { makeRngs } from '../utils/randomSeed.js';
import { optimiseGreenTimesGridSearch, adaptiveQueueWeightedGreenTimes } from './optimisation.js';

/**
 * System A: Equal-time baseline.
 * Each direction: g = (cycleLength - lostTime) / 4
 */
export function simulateEqualTimeSystem(params, seed = 42, collectTimeSeries = false) {
  const { cycleLength, yellowDuration, allRedDuration } = params;
  const lostTime = 4 * (yellowDuration + allRedDuration);
  const g = (cycleLength - lostTime) / 4;
  const greenTimes = [g, g, g, g];
  const rngs = makeRngs(seed);
  return { ...runSimulation(params, greenTimes, rngs, collectTimeSeries), system: 'equal' };
}

/**
 * System B: Optimised.
 * method: 'grid' | 'adaptive'
 */
export function simulateOptimisedSystem(params, seed = 42, collectTimeSeries = false) {
  const { optimisationMethod = 'adaptive' } = params;

  if (optimisationMethod === 'grid') {
    const { greenTimes } = optimiseGreenTimesGridSearch(params, seed);
    const rngs = makeRngs(seed + 1);
    return { ...runSimulation(params, greenTimes, rngs, collectTimeSeries), system: 'optimised' };
  }

  // Adaptive: re-allocate each cycle
  const initGreen = equalInitialGreen(params);
  const rngs = makeRngs(seed);
  const adaptiveFn = (queueSnap, rates) =>
    adaptiveQueueWeightedGreenTimes(queueSnap, rates, params);
  return {
    ...runSimulation(params, initGreen, rngs, collectTimeSeries, adaptiveFn),
    system: 'optimised',
  };
}

function equalInitialGreen(params) {
  const { cycleLength, yellowDuration, allRedDuration } = params;
  const budget = cycleLength - 4 * (yellowDuration + allRedDuration);
  const g = budget / 4;
  return [g, g, g, g];
}
