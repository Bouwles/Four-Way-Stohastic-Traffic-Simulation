/**
 * Discrete-time queue simulation of one four-way intersection.
 *
 * Queue evolution (per road i, per step of length Δt):
 *
 *   Q_i(t + Δt) = max(0, Q_i(t) + A_i(t) − D_i(t))
 *
 * Waiting time is measured as a numerically integrated queue area
 *
 *   queueArea_i = Σ Q_i(t) Δt          (units: vehicle·seconds)
 *
 * and the headline metric is the vehicle-weighted mean waiting time
 *
 *   W = ( Σ_i queueArea_i ) / ( Σ_i N_i )
 *
 * i.e. total vehicle-seconds of delay divided by the total number of vehicles.
 * It is NOT the unweighted average of the four road means.
 *
 * Departures use a deterministic fractional service accumulator, so no random
 * rounding of μΔt is involved and a seed always reproduces a run exactly:
 *
 *   serviceCredit_i += μΔt
 *   departures      = min(Q_i, floor(serviceCredit_i))
 *
 * The credit resets when the road loses green or when its queue empties.
 *
 * Vehicles stop arriving at T, but the signals keep cycling until every queue
 * is empty, so every completed trial satisfies  total served = total arrivals.
 */

import { DIRS, MODEL, greenBudget } from './constants.js';
import { equalGreenTimes, adaptiveQueueWeightedGreenTimes, validateGreenTimes } from './policies.js';

const GREEN = 0;
const YELLOW = 1;
const ALL_RED = 2;

/** Phase order N → S → E → W, each green followed by its yellow and all-red. */
function buildPhases(green, model) {
  const phases = [];
  for (let i = 0; i < 4; i++) {
    phases.push({ type: GREEN, road: i, duration: green[i] });
    phases.push({ type: YELLOW, road: i, duration: model.yellow });
    phases.push({ type: ALL_RED, road: i, duration: model.allRed });
  }
  return phases;
}

/** Population standard deviation — the fairness statistic F. */
function populationSD(values) {
  const n = values.length;
  if (n === 0) return 0;
  const m = values.reduce((a, b) => a + b, 0) / n;
  return Math.sqrt(values.reduce((s, x) => s + (x - m) ** 2, 0) / n);
}

/**
 * Run one trial.
 *
 * @param {object}   opts
 * @param {object}   opts.arrivals        { N: number[], S: [], E: [], W: [] } arrival timestamps
 * @param {number[]} opts.lambdas         arrival rates [N, S, E, W] (veh/s)
 * @param {'equal'|'adaptive'} opts.policy
 * @param {number}   [opts.k]             smoothing horizon (s), adaptive policy only
 * @param {object}   [opts.model]         model parameters (defaults to MODEL)
 * @param {number}   [opts.dt]            time-step override (for sensitivity runs)
 * @param {boolean}  [opts.collectHistory]
 * @param {number}   [opts.historyStride] record every n-th step
 */
export function simulateTrial({
  arrivals,
  lambdas,
  policy,
  k = 0,
  model = MODEL,
  dt = model.dt,
  collectHistory = false,
  historyStride = 4,
}) {
  const { mu, maxRuntime } = model;
  const arrivalTimes = DIRS.map(d => arrivals[d]);
  const arrivalCount = arrivalTimes.map(a => a.length);

  const queue = [0, 0, 0, 0];
  const credit = [0, 0, 0, 0];
  const area = [0, 0, 0, 0];
  const maxQueue = [0, 0, 0, 0];
  const served = [0, 0, 0, 0];
  const pointer = [0, 0, 0, 0];

  const nextGreen = () =>
    policy === 'equal'
      ? equalGreenTimes(model)
      : adaptiveQueueWeightedGreenTimes(queue, lambdas, k, model);

  // A phase can only end on a step boundary, so every phase duration is rounded
  // up to a whole number of steps. Equal-Time greens (25 s) and the yellow and
  // all-red times are exact multiples of every Δt used here, so only the
  // fractional adaptive greens are affected; the time-step sensitivity study
  // quantifies how much this discretisation matters.
  const quantise = d => Math.max(dt, Math.ceil(d / dt - 1e-9) * dt);
  const cumulativeEnds = (start, list) => {
    const ends = [];
    let acc = start;
    for (const p of list) { acc += quantise(p.duration); ends.push(acc); }
    return ends;
  };

  let green = nextGreen();
  validateGreenTimes(green, model);
  let phases = buildPhases(green, model);
  let cycleStart = 0;
  let phaseEnds = cumulativeEnds(cycleStart, phases);
  let phaseIndex = 0;

  const history = collectHistory ? [] : null;
  let cycle = 0;
  let step = 0;
  let t = 0;
  let clearanceTime;

  for (;;) {
    // advance the signal to the phase containing t; a completed cycle
    // triggers re-allocation of the green times
    while (t >= phaseEnds[phaseIndex] - 1e-9) {
      phaseIndex += 1;
      if (phaseIndex >= phases.length) {
        phaseIndex = 0;
        cycle += 1;
        cycleStart = phaseEnds[phaseEnds.length - 1];
        green = nextGreen();
        validateGreenTimes(green, model);
        phases = buildPhases(green, model);
        phaseEnds = cumulativeEnds(cycleStart, phases);
      }
    }
    const phase = phases[phaseIndex];
    const activeRoad = phase.type === GREEN ? phase.road : -1;

    if (collectHistory && step % historyStride === 0) {
      history.push({
        t: +t.toFixed(3),
        qN: queue[0], qS: queue[1], qE: queue[2], qW: queue[3],
        total: queue[0] + queue[1] + queue[2] + queue[3],
        activeDir: activeRoad >= 0 ? DIRS[activeRoad] : null,
        cycle,
        gN: green[0], gS: green[1], gE: green[2], gW: green[3],
      });
    }

    // 1. queue area uses the state Q_i(t) at the beginning of the step
    for (let i = 0; i < 4; i++) area[i] += queue[i] * dt;

    // 2. departures D_i(t) — only the road holding green is served
    for (let i = 0; i < 4; i++) {
      if (i === activeRoad && queue[i] > 0) {
        credit[i] += mu * dt;
        const departures = Math.min(queue[i], Math.floor(credit[i]));
        queue[i] -= departures;
        credit[i] -= departures;
        served[i] += departures;
        if (queue[i] === 0) credit[i] = 0; // queue emptied ⇒ reset credit
      } else {
        credit[i] = 0; // not green ⇒ reset credit
      }
    }

    // 3. arrivals A_i(t) landing in [t, t + Δt)
    const tNext = t + dt;
    for (let i = 0; i < 4; i++) {
      const times = arrivalTimes[i];
      while (pointer[i] < arrivalCount[i] && times[pointer[i]] < tNext) {
        queue[i] += 1;
        pointer[i] += 1;
      }
      if (queue[i] > maxQueue[i]) maxQueue[i] = queue[i];
    }

    t = tNext;
    step += 1;

    const allArrived = pointer[0] === arrivalCount[0] && pointer[1] === arrivalCount[1]
      && pointer[2] === arrivalCount[2] && pointer[3] === arrivalCount[3];
    const allEmpty = queue[0] === 0 && queue[1] === 0 && queue[2] === 0 && queue[3] === 0;
    // Once every arrival has been consumed and every queue is empty the trial is
    // over: no further vehicles can appear after the arrival horizon T.
    if (allArrived && allEmpty) {
      clearanceTime = t;
      break;
    }

    if (t > maxRuntime) {
      throw new Error(
        `Queues failed to clear within the ${maxRuntime}s safety limit ` +
        `(remaining: N=${queue[0]} S=${queue[1]} E=${queue[2]} W=${queue[3]}). ` +
        'Demand probably exceeds the intersection capacity.',
      );
    }
  }

  const totalArrivals = arrivalCount.reduce((a, b) => a + b, 0);
  const totalServed = served.reduce((a, b) => a + b, 0);
  if (totalServed !== totalArrivals) {
    throw new Error(`Trial ended with ${totalServed} served but ${totalArrivals} arrivals`);
  }

  const roadMeanWait = area.map((a, i) => (arrivalCount[i] > 0 ? a / arrivalCount[i] : 0));

  return {
    // W = Σ queueArea / Σ N  (vehicle-weighted, not the mean of the four means)
    meanWait: totalArrivals > 0 ? area.reduce((a, b) => a + b, 0) / totalArrivals : 0,
    roadMeanWait,
    queueArea: area.slice(),
    maxQueuePerRoad: maxQueue.slice(),
    maxQueue: Math.max(...maxQueue),
    arrivalsPerRoad: arrivalCount.slice(),
    totalArrivals,
    servedPerRoad: served.slice(),
    totalServed,
    clearanceTime,
    cycles: cycle,
    greenTimes: green.slice(),
    // F = population SD of the four road mean waiting times
    fairness: populationSD(roadMeanWait),
    history,
    dt,
    greenBudget: greenBudget(model),
  };
}
