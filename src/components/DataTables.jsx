import { buildComparisonTable, buildGreenTimeTable } from '../simulation/metrics.js';
import { exportMonteCarloResults, exportSummaryTable, exportTimeSeries } from '../utils/csvExport.js';

export default function DataTables({ params, equalResult, optResult, mcResults, equalTimeSeries, optTimeSeries }) {
  if (!equalResult && !optResult && !mcResults) {
    return <div className="tables-placeholder">Run simulation to see data tables.</div>;
  }

  const compTable = equalResult && optResult ? buildComparisonTable(equalResult, optResult) : null;
  const greenTable = equalResult && optResult ? buildGreenTimeTable(equalResult, optResult, params) : null;

  return (
    <div className="data-tables">
      <h3 className="section-title">Data Tables</h3>

      {/* Input parameters */}
      <TableSection title="Table 1 — Input Parameters">
        <table className="ia-table">
          <thead><tr><th>Parameter</th><th>Value</th><th>Unit</th></tr></thead>
          <tbody>
            <tr><td>λN</td><td>{params.lambdas.N}</td><td>cars/s</td></tr>
            <tr><td>λS</td><td>{params.lambdas.S}</td><td>cars/s</td></tr>
            <tr><td>λE</td><td>{params.lambdas.E}</td><td>cars/s</td></tr>
            <tr><td>λW</td><td>{params.lambdas.W}</td><td>cars/s</td></tr>
            <tr><td>Duration</td><td>{params.duration}</td><td>s</td></tr>
            <tr><td>Cycle Length</td><td>{params.cycleLength}</td><td>s</td></tr>
            <tr><td>Service Rate μ</td><td>{params.mu}</td><td>cars/s</td></tr>
            <tr><td>Min Green</td><td>{params.minGreen}</td><td>s</td></tr>
            <tr><td>Max Green</td><td>{params.maxGreen}</td><td>s</td></tr>
            <tr><td>Yellow Duration</td><td>{params.yellowDuration}</td><td>s</td></tr>
            <tr><td>All-Red Duration</td><td>{params.allRedDuration}</td><td>s</td></tr>
            <tr><td>Optimisation Method</td><td>{params.optimisationMethod}</td><td>—</td></tr>
            <tr><td>α</td><td>{params.alpha}</td><td>—</td></tr>
            <tr><td>β</td><td>{params.beta}</td><td>—</td></tr>
            <tr><td>γ</td><td>{params.gamma}</td><td>—</td></tr>
          </tbody>
        </table>
      </TableSection>

      {/* Comparison */}
      {compTable && (
        <TableSection title="Table 4 — System Comparison"
          onExport={() => exportSummaryTable(compTable.map(r => ({
            metric: r.metric, equal: r.equal?.toFixed(3), opt: r.opt?.toFixed(3),
            diff: r.diff?.toFixed(3), improvement: r.improvement?.toFixed(2),
          })))}>
          <table className="ia-table">
            <thead>
              <tr><th>Metric</th><th>Equal-Time</th><th>Optimised</th><th>Difference</th><th>Improvement %</th></tr>
            </thead>
            <tbody>
              {compTable.map(r => (
                <tr key={r.metric}>
                  <td>{r.metric}</td>
                  <td>{r.equal?.toFixed(3)}</td>
                  <td>{r.opt?.toFixed(3)}</td>
                  <td className={r.diff < 0 ? 'good' : 'bad'}>{r.diff?.toFixed(3)}</td>
                  <td className={r.improvement > 0 ? 'good' : r.improvement < 0 ? 'bad' : ''}>
                    {r.improvement?.toFixed(2)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableSection>
      )}

      {/* Green time allocation */}
      {greenTable && (
        <TableSection title="Table 5 — Green Time Allocation">
          <table className="ia-table">
            <thead>
              <tr><th>Dir</th><th>Equal Green (s)</th><th>Opt Green (s)</th><th>λ (cars/s)</th><th>Mean Queue</th></tr>
            </thead>
            <tbody>
              {greenTable.map(r => (
                <tr key={r.direction}>
                  <td>{r.direction}</td><td>{r.equalGreen}</td><td>{r.optGreen}</td>
                  <td>{r.lambda}</td><td>{r.meanQueue}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableSection>
      )}

      {/* Monte Carlo */}
      {mcResults && (
        <TableSection title="Table 2 & 3 — Monte Carlo Trials"
          onExport={() => exportMonteCarloResults(mcResults)}>
          <MCTable label="Equal-Time" data={mcResults.equal} ci={mcResults.equal.waitCI} />
          <MCTable label="Optimised"  data={mcResults.optimised} ci={mcResults.optimised.waitCI} />
          <MCImprovementCard mcResults={mcResults} />
        </TableSection>
      )}

      {/* Export time series */}
      {(equalTimeSeries || optTimeSeries) && (
        <div className="export-row">
          {equalTimeSeries && (
            <button className="btn btn-export" onClick={() => exportTimeSeries(equalTimeSeries, 'equal')}>
              Export Equal-Time CSV
            </button>
          )}
          {optTimeSeries && (
            <button className="btn btn-export" onClick={() => exportTimeSeries(optTimeSeries, 'optimised')}>
              Export Optimised CSV
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function TableSection({ title, children, onExport }) {
  return (
    <div className="table-section">
      <div className="table-header">
        <span className="table-title">{title}</span>
        {onExport && (
          <button className="btn btn-export-sm" onClick={onExport}>Export CSV</button>
        )}
      </div>
      {children}
    </div>
  );
}

function MCTable({ label, data, ci }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div className="mc-label">{label} System</div>
      <div className="mc-summary">
        <Stat label="Mean Wait" value={`${ci.mean.toFixed(2)} s`} />
        <Stat label="SD" value={`${ci.sd.toFixed(2)} s`} />
        <Stat label="95% CI" value={`[${ci.lower.toFixed(2)}, ${ci.upper.toFixed(2)}]`} />
        <Stat label="Mean MaxQ" value={data.maxQueueCI.mean.toFixed(1)} />
        <Stat label="Mean Thru" value={`${data.throughputCI.mean.toFixed(4)} c/s`} />
      </div>
      <table className="ia-table" style={{ marginTop: 8 }}>
        <thead>
          <tr><th>Trial</th><th>Mean Wait (s)</th><th>Max Queue</th><th>Throughput</th><th>Cars Left</th><th>Fairness SD</th></tr>
        </thead>
        <tbody>
          {data.trialData.map(r => (
            <tr key={r.trial}>
              <td>{r.trial}</td><td>{r.meanWait}</td><td>{r.maxQueue}</td>
              <td>{r.throughput}</td><td>{r.carsLeft}</td><td>{r.fairnessSD}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MCImprovementCard({ mcResults }) {
  const imp = mcResults.improvement;
  return (
    <div className="improvement-card">
      <div className="improvement-title">Percentage Improvement (Optimised vs Equal-Time)</div>
      <div className="improvement-grid">
        <ImpBadge label="Mean Wait" value={imp.meanWait} />
        <ImpBadge label="Max Queue" value={imp.maxQueue} />
        <ImpBadge label="Throughput" value={imp.throughput} />
      </div>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="stat-chip">
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value}</span>
    </div>
  );
}

function ImpBadge({ label, value }) {
  const isGood = value > 0;
  return (
    <div className={`imp-badge ${isGood ? 'good' : 'bad'}`}>
      <div className="imp-label">{label}</div>
      <div className="imp-val">{isGood ? '▼ ' : '▲ '}{Math.abs(value).toFixed(2)}%</div>
    </div>
  );
}
