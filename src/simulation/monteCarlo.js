/**
 * Monte Carlo trials.
 * CI: mean ± 1.96 × SD / √n  (95%)
 */

import { simulateEqualTimeSystem, simulateOptimisedSystem } from './trafficLightSystems.js';
import { calculateConfidenceInterval, calculatePercentageImprovement } from '../utils/statistics.js';

export function runMonteCarlo(params, trials, onProgress) {
  const equalWaits   = [], optWaits   = [];
  const equalMaxQ    = [], optMaxQ    = [];
  const equalThru    = [], optThru    = [];
  const equalFair    = [], optFair    = [];
  const equalLeft    = [], optLeft    = [];
  const equalTrials  = [], optTrials  = [];

  const baseSeed = params.seed ?? 42;

  for (let i = 0; i < trials; i++) {
    const seed = baseSeed + i * 31337;
    const eq  = simulateEqualTimeSystem(params, seed, false);
    const opt = simulateOptimisedSystem(params, seed, false);

    equalWaits.push(eq.meanWaitTime);   optWaits.push(opt.meanWaitTime);
    equalMaxQ.push(eq.maxQueueLength);  optMaxQ.push(opt.maxQueueLength);
    equalThru.push(eq.throughput);      optThru.push(opt.throughput);
    equalFair.push(eq.fairnessSD);      optFair.push(opt.fairnessSD);
    equalLeft.push(eq.carsLeft);        optLeft.push(opt.carsLeft);

    equalTrials.push({
      trial: i + 1,
      meanWait: +eq.meanWaitTime.toFixed(2),
      maxQueue: eq.maxQueueLength,
      throughput: +eq.throughput.toFixed(4),
      carsLeft: eq.carsLeft,
      fairnessSD: +eq.fairnessSD.toFixed(2),
    });
    optTrials.push({
      trial: i + 1,
      meanWait: +opt.meanWaitTime.toFixed(2),
      maxQueue: opt.maxQueueLength,
      throughput: +opt.throughput.toFixed(4),
      carsLeft: opt.carsLeft,
      fairnessSD: +opt.fairnessSD.toFixed(2),
    });

    if (onProgress) onProgress(i + 1, trials);
  }

  const eCI = calculateConfidenceInterval(equalWaits);
  const oCI = calculateConfidenceInterval(optWaits);

  return {
    trials,
    equal: {
      waitCI: eCI,
      maxQueueCI: calculateConfidenceInterval(equalMaxQ),
      throughputCI: calculateConfidenceInterval(equalThru),
      fairnessCI: calculateConfidenceInterval(equalFair),
      carsLeftCI: calculateConfidenceInterval(equalLeft),
      trialData: equalTrials,
    },
    optimised: {
      waitCI: oCI,
      maxQueueCI: calculateConfidenceInterval(optMaxQ),
      throughputCI: calculateConfidenceInterval(optThru),
      fairnessCI: calculateConfidenceInterval(optFair),
      carsLeftCI: calculateConfidenceInterval(optLeft),
      trialData: optTrials,
    },
    improvement: {
      meanWait: calculatePercentageImprovement(eCI.mean, oCI.mean),
      maxQueue: calculatePercentageImprovement(
        calculateConfidenceInterval(equalMaxQ).mean,
        calculateConfidenceInterval(optMaxQ).mean,
      ),
      throughput: calculatePercentageImprovement(
        calculateConfidenceInterval(equalThru).mean,
        calculateConfidenceInterval(optThru).mean,
      ) * -1, // higher throughput is better
    },
    rawEqual: equalWaits,
    rawOpt: optWaits,
  };
}
