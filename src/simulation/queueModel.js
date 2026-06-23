/**
 * Core stochastic queue simulation.
 * Q_i(t+Δt) = max(0, Q_i(t) + A_i(t) - D_i(t))
 * D_i(t) = min(Q_i(t), μΔt)  during green phase
 */

import { generateArrivalTimes } from './poisson.js';

export const DIRS = ['N', 'S', 'E', 'W'];

/**
 * Run one simulation trial.
 * @param {object} params
 * @param {number[]} greenTimes - [gN, gS, gE, gW], static or initial
 * @param {object} rngs - { N, S, E, W } seeded RNGs
 * @param {boolean} collectTimeSeries
 * @param {Function|null} adaptiveFn - if set, called each cycle start:
 *   adaptiveFn(queueSnapshot, lambdas) → new greenTimes array
 * @returns {object} metrics + optional timeSeries
 */
export function runSimulation(params, greenTimes, rngs, collectTimeSeries = false, adaptiveFn = null) {
  const { duration, dt, mu, yellowDuration, allRedDuration, lambdas } = params;

  const arrivalQueues = {};
  const arrivalPointers = {};
  DIRS.forEach(d => {
    arrivalQueues[d] = generateArrivalTimes(lambdas[d], duration, rngs[d]);
    arrivalPointers[d] = 0;
  });

  const queues   = { N: 0, S: 0, E: 0, W: 0 };
  const totalWait = { N: 0, S: 0, E: 0, W: 0 };
  const maxQ      = { N: 0, S: 0, E: 0, W: 0 };
  const served    = { N: 0, S: 0, E: 0, W: 0 };
  const waitSum   = { N: 0, S: 0, E: 0, W: 0 };

  let curGreen = [...greenTimes];

  function buildPhases(gt) {
    const phases = [];
    DIRS.forEach((d, i) => {
      phases.push({ dir: d, type: 'green',  duration: Math.max(gt[i], 0.5) });
      phases.push({ dir: d, type: 'yellow', duration: yellowDuration });
      phases.push({ dir: d, type: 'red',    duration: allRedDuration });
    });
    return phases;
  }

  let phases = buildPhases(curGreen);
  let phaseIdx = 0;
  let phaseLeft = phases[0].duration;
  let cycleNum  = 0;
  const timeSeries = collectTimeSeries ? [] : null;
  const steps = Math.ceil(duration / dt);
  const rngN = rngs.N;

  for (let step = 0; step < steps; step++) {
    const t = step * dt;
    const cur = phases[phaseIdx];
    const activeDir = cur.type === 'green' ? cur.dir : null;

    // Arrivals in [t, t+dt)
    DIRS.forEach(d => {
      const arr = arrivalQueues[d];
      while (arrivalPointers[d] < arr.length && arr[arrivalPointers[d]] < t + dt) {
        queues[d]++;
        arrivalPointers[d]++;
      }
    });

    // Departures + waiting accumulation
    DIRS.forEach(d => {
      const q = queues[d];
      let dep = 0;
      if (d === activeDir && q > 0) {
        const raw = mu * dt;
        const whole = Math.floor(raw);
        dep = Math.min(q, whole + (rngN() < (raw - whole) ? 1 : 0));
      }
      waitSum[d]    += q * dt;
      totalWait[d]  += q * dt;
      queues[d]      = Math.max(0, q - dep);
      served[d]     += dep;
      if (queues[d] > maxQ[d]) maxQ[d] = queues[d];
    });

    // Advance phase
    phaseLeft -= dt;
    if (phaseLeft <= 1e-9) {
      phaseIdx++;
      if (phaseIdx >= phases.length) {
        phaseIdx = 0;
        cycleNum++;
        if (adaptiveFn) {
          const snap = DIRS.map(d => queues[d]);
          const rates = DIRS.map(d => lambdas[d]);
          curGreen = adaptiveFn(snap, rates);
        }
        phases = buildPhases(curGreen);
      }
      phaseLeft = phases[phaseIdx].duration;
    }

    if (collectTimeSeries && step % 5 === 0) {
      timeSeries.push({
        t: +t.toFixed(2),
        qN: queues.N, qS: queues.S, qE: queues.E, qW: queues.W,
        activeDir, cycleNum,
        gN: curGreen[0], gS: curGreen[1], gE: curGreen[2], gW: curGreen[3],
      });
    }
  }

  const dirMeanWait = {};
  DIRS.forEach(d => {
    dirMeanWait[d] = arrivalPointers[d] > 0 ? waitSum[d] / arrivalPointers[d] : 0;
  });
  const mw = DIRS.map(d => dirMeanWait[d]);
  const globalMeanWait = mw.reduce((a, b) => a + b, 0) / 4;
  const fairnessSD = Math.sqrt(mw.reduce((s, x) => s + (x - globalMeanWait) ** 2, 0) / 4);
  const totalServed = DIRS.reduce((s, d) => s + served[d], 0);

  return {
    meanWaitTime: globalMeanWait,
    dirMeanWait,
    maxQueueLength: Math.max(...DIRS.map(d => maxQ[d])),
    maxQueuePerDir: { ...maxQ },
    avgQueuePerDir: Object.fromEntries(DIRS.map(d => [d, totalWait[d] / duration])),
    totalServed,
    carsLeft: DIRS.reduce((s, d) => s + queues[d], 0),
    throughput: totalServed / duration,
    fairnessSD,
    servedPerDir: { ...served },
    timeSeries,
    greenTimes: [...curGreen],
  };
}
