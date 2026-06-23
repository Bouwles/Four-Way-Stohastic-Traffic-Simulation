import { DIRS } from './queueModel.js';
import { calculatePercentageImprovement } from '../utils/statistics.js';

export function buildComparisonTable(equalMetrics, optMetrics) {
  const rows = [
    { metric: 'Mean Waiting Time (s)', equal: equalMetrics.meanWaitTime, opt: optMetrics.meanWaitTime },
    { metric: 'Max Queue Length (cars)', equal: equalMetrics.maxQueueLength, opt: optMetrics.maxQueueLength },
    { metric: 'Total Served (cars)', equal: equalMetrics.totalServed, opt: optMetrics.totalServed },
    { metric: 'Throughput (cars/s)', equal: equalMetrics.throughput, opt: optMetrics.throughput },
    { metric: 'Cars Left in Queue', equal: equalMetrics.carsLeft, opt: optMetrics.carsLeft },
    { metric: 'Fairness SD (s)', equal: equalMetrics.fairnessSD, opt: optMetrics.fairnessSD },
  ];
  return rows.map(r => ({
    ...r,
    diff: r.opt - r.equal,
    improvement: calculatePercentageImprovement(r.equal, r.opt),
  }));
}

export function buildGreenTimeTable(equalMetrics, optMetrics, params) {
  const eq = (params.cycleLength - 4 * (params.yellowDuration + params.allRedDuration)) / 4;
  return DIRS.map((d, i) => ({
    direction: d,
    equalGreen: eq.toFixed(1),
    optGreen: optMetrics.greenTimes[i]?.toFixed(1) ?? '-',
    lambda: params.lambdas[d],
    meanQueue: optMetrics.avgQueuePerDir[d]?.toFixed(2) ?? '-',
  }));
}
