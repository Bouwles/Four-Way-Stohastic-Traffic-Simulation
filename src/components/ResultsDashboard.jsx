import { DIRS, greenBudget } from '../model/constants.js';
import { downloadCSV, queueHistoryCSV } from '../utils/csvExport.js';

const fmt = (v, d = 2) => (Number.isFinite(v) ? v.toFixed(d) : '—');

/** Single paired run: both systems on one identical set of arrivals. */
export default function ResultsDashboard({ result }) {
  if (!result) {
    return <div className="tables-placeholder" role="status">Press Run Simulation to simulate one seed.</div>;
  }
  const { equal, optimized, lambdas, seed, k } = result;
  const reduction = equal.meanWait === 0
    ? 0
    : (100 * (equal.meanWait - optimized.meanWait)) / equal.meanWait;

  return (
    <div className="results-dashboard">
      <div className="result-card">
        <div className="result-card-title">
          Single paired run — seed {seed}, k = {k} s, identical arrivals for both systems
        </div>
        <div className="metrics-grid">
          <MetricPair label="Vehicle-weighted mean waiting time W"
            eq={`${fmt(equal.meanWait)} s`} opt={`${fmt(optimized.meanWait)} s`} imp={reduction} />
          <MetricPair label="Maximum queue"
            eq={`${equal.maxQueue} veh`} opt={`${optimized.maxQueue} veh`}
            imp={equal.maxQueue ? (100 * (equal.maxQueue - optimized.maxQueue)) / equal.maxQueue : 0} />
          <MetricPair label="Fairness F (population SD)"
            eq={`${fmt(equal.fairness)} s`} opt={`${fmt(optimized.fairness)} s`}
            imp={equal.fairness ? (100 * (equal.fairness - optimized.fairness)) / equal.fairness : 0} />
          <MetricPair label="Queue-clearance time"
            eq={`${fmt(equal.clearanceTime, 1)} s`} opt={`${fmt(optimized.clearanceTime, 1)} s`}
            imp={equal.clearanceTime ? (100 * (equal.clearanceTime - optimized.clearanceTime)) / equal.clearanceTime : 0} />
          <MetricPair label="Total arrivals" eq={equal.totalArrivals} opt={optimized.totalArrivals} />
          <MetricPair label="Total served" eq={equal.totalServed} opt={optimized.totalServed} />
        </div>
        <p className="note small">
          Both systems served every vehicle that arrived ({equal.totalServed} = {equal.totalArrivals}),
          so the waiting-time comparison covers the whole demand rather than a truncated run.
        </p>
      </div>

      <div className="table-section">
        <div className="table-header">
          <span className="table-title">Per-road results and final green split</span>
          <button type="button" className="btn btn-export-sm"
            onClick={() => downloadCSV(`queue_history_seed${seed}.csv`, queueHistoryCSV({
              pattern: 'custom', rho: '', seed, k, equal, optimized,
            }))}>
            Queue history CSV
          </button>
        </div>
        <div className="table-scroll">
          <table className="ia-table">
            <caption className="sr-only">Per-road arrivals, waits, maximum queues and green times for one paired run</caption>
            <thead>
              <tr>
                <th>Road</th><th>λ (veh/s)</th><th>Arrivals</th>
                <th>Equal W<sub>i</sub> (s)</th><th>Optimized W<sub>i</sub> (s)</th>
                <th>Equal max queue</th><th>Optimized max queue</th>
                <th>Equal green (s)</th><th>Optimized final green (s)</th>
              </tr>
            </thead>
            <tbody>
              {DIRS.map((d, i) => (
                <tr key={d}>
                  <td>{d}</td>
                  <td>{lambdas[i].toFixed(5)}</td>
                  <td>{equal.arrivalsPerRoad[i]}</td>
                  <td>{fmt(equal.roadMeanWait[i], 1)}</td>
                  <td>{fmt(optimized.roadMeanWait[i], 1)}</td>
                  <td>{equal.maxQueuePerRoad[i]}</td>
                  <td>{optimized.maxQueuePerRoad[i]}</td>
                  <td>{fmt(equal.greenTimes[i], 1)}</td>
                  <td>{fmt(optimized.greenTimes[i], 1)}</td>
                </tr>
              ))}
              <tr className="row-total">
                <td>Σ</td>
                <td>{lambdas.reduce((a, b) => a + b, 0).toFixed(5)}</td>
                <td>{equal.totalArrivals}</td>
                <td colSpan={4}>W is the vehicle-weighted mean, not the mean of these four columns</td>
                <td>{fmt(equal.greenTimes.reduce((a, b) => a + b, 0), 1)}</td>
                <td>{fmt(optimized.greenTimes.reduce((a, b) => a + b, 0), 1)}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="note small">
          Both green splits sum to the budget G = {greenBudget()} s, and every optimized green stays
          inside the allowed range.
        </p>
      </div>
    </div>
  );
}

function MetricPair({ label, eq, opt, imp }) {
  return (
    <div className="metric-pair">
      <div className="mp-label">{label}</div>
      <div className="mp-values">
        <div className="mp-eq"><span className="sys-badge eq">Equal</span> {eq}</div>
        <div className="mp-opt"><span className="sys-badge opt">Optimized</span> {opt}</div>
        {imp !== undefined && Number.isFinite(imp) && (
          <div className={`mp-imp ${imp > 0 ? 'good' : imp < 0 ? 'bad' : ''}`}>
            {imp > 0 ? '▼ ' : imp < 0 ? '▲ ' : ''}{Math.abs(imp).toFixed(2)}%
          </div>
        )}
      </div>
    </div>
  );
}
