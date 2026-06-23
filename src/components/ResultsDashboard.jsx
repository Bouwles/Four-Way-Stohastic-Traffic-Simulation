import { calculatePercentageImprovement } from '../utils/statistics.js';

export default function ResultsDashboard({ equalResult, optResult, mcResults }) {
  if (!equalResult && !optResult && !mcResults) return null;

  return (
    <div className="results-dashboard">
      {equalResult && optResult && <SingleRunSummary equal={equalResult} opt={optResult} />}
      {mcResults && <MCResultsSummary mc={mcResults} />}
    </div>
  );
}

function SingleRunSummary({ equal, opt }) {
  const impWait = calculatePercentageImprovement(equal.meanWaitTime, opt.meanWaitTime);
  const impMaxQ = calculatePercentageImprovement(equal.maxQueueLength, opt.maxQueueLength);

  return (
    <div className="result-card">
      <div className="result-card-title">Single Run Results</div>
      <div className="metrics-grid">
        <MetricPair label="Mean Waiting Time"
          eq={`${equal.meanWaitTime.toFixed(2)} s`}
          opt={`${opt.meanWaitTime.toFixed(2)} s`}
          imp={impWait} />
        <MetricPair label="Max Queue Length"
          eq={`${equal.maxQueueLength} cars`}
          opt={`${opt.maxQueueLength} cars`}
          imp={impMaxQ} />
        <MetricPair label="Total Served"
          eq={equal.totalServed}
          opt={opt.totalServed}
          imp={calculatePercentageImprovement(equal.totalServed, opt.totalServed) * -1} />
        <MetricPair label="Throughput (c/s)"
          eq={equal.throughput.toFixed(4)}
          opt={opt.throughput.toFixed(4)}
          imp={calculatePercentageImprovement(equal.throughput, opt.throughput) * -1} />
        <MetricPair label="Cars Left in Queue"
          eq={equal.carsLeft}
          opt={opt.carsLeft}
          imp={calculatePercentageImprovement(equal.carsLeft, opt.carsLeft)} />
        <MetricPair label="Fairness SD (s)"
          eq={equal.fairnessSD.toFixed(3)}
          opt={opt.fairnessSD.toFixed(3)}
          imp={calculatePercentageImprovement(equal.fairnessSD, opt.fairnessSD)} />
      </div>
    </div>
  );
}

function MCResultsSummary({ mc }) {
  const { equal: eq, optimised: opt, improvement: imp } = mc;
  return (
    <div className="result-card">
      <div className="result-card-title">Monte Carlo Summary ({mc.trials} trials)</div>
      <div className="mc-compare-grid">
        <MCSystemCard label="Equal-Time System" ci={eq.waitCI} maxQCI={eq.maxQueueCI} thruCI={eq.throughputCI} color="#6c7dc4" />
        <div className="mc-arrow">→</div>
        <MCSystemCard label="Optimised System"  ci={opt.waitCI} maxQCI={opt.maxQueueCI} thruCI={opt.throughputCI} color="#00e676" />
      </div>
      <div className="imp-row">
        <ImpStat label="Wait Time Improvement" value={imp.meanWait} />
        <ImpStat label="Max Queue Improvement" value={imp.maxQueue} />
      </div>
    </div>
  );
}

function MetricPair({ label, eq, opt, imp }) {
  return (
    <div className="metric-pair">
      <div className="mp-label">{label}</div>
      <div className="mp-values">
        <div className="mp-eq"><span className="sys-badge eq">Eq</span> {eq}</div>
        <div className="mp-opt"><span className="sys-badge opt">Opt</span> {opt}</div>
        {imp !== undefined && (
          <div className={`mp-imp ${imp > 0 ? 'good' : imp < 0 ? 'bad' : ''}`}>
            {imp > 0 ? '▼ ' : '▲ '}{Math.abs(imp).toFixed(2)}%
          </div>
        )}
      </div>
    </div>
  );
}

function MCSystemCard({ label, ci, maxQCI, thruCI, color }) {
  return (
    <div className="mc-sys-card" style={{ borderColor: color + '66' }}>
      <div className="mc-sys-label" style={{ color }}>{label}</div>
      <div className="mc-sys-stat"><span>Mean Wait</span><strong>{ci.mean.toFixed(2)} s</strong></div>
      <div className="mc-sys-stat"><span>SD</span><strong>{ci.sd.toFixed(2)} s</strong></div>
      <div className="mc-sys-stat"><span>95% CI</span><strong>[{ci.lower.toFixed(2)}, {ci.upper.toFixed(2)}]</strong></div>
      <div className="mc-sys-stat"><span>Mean Max Queue</span><strong>{maxQCI.mean.toFixed(1)}</strong></div>
      <div className="mc-sys-stat"><span>Mean Throughput</span><strong>{thruCI.mean.toFixed(4)} c/s</strong></div>
    </div>
  );
}

function ImpStat({ label, value }) {
  const good = value > 0;
  return (
    <div className={`imp-stat ${good ? 'good' : 'bad'}`}>
      <span>{label}</span>
      <strong>{good ? '▼ ' : '▲ '}{Math.abs(value).toFixed(2)}%</strong>
    </div>
  );
}
