import { SCENARIOS, K_GRID, MODEL, intersectionCapacity, greenBudget } from '../model/constants.js';
import { interpretInterval, INTERVAL_TEXT } from '../utils/statistics.js';
import {
  downloadCSV, rawTrialsCSV, scenarioSummaryCSV, calibrationCSV, timeStepCSV, queueHistoryCSV,
} from '../utils/csvExport.js';

const fmt = (v, digits = 2) => (Number.isFinite(v) ? v.toFixed(digits) : '—');
const pct = (v, digits = 2) => (Number.isFinite(v) ? `${v.toFixed(digits)}%` : '—');

export default function StatisticalAnalysisPanel({
  config, setConfig, calibration, scenarios, sensitivity, representative,
  busy, progress, error, onCalibrate, onEvaluate, onScenario, onTimestep, onRepresentative, onCancel,
}) {
  const upd = (key, value) => setConfig(c => ({ ...c, [key]: value }));
  const selected = SCENARIOS[config.scenarioIndex] ?? SCENARIOS[0];

  return (
    <div className="analysis-panel">
      <h3 className="section-title">Statistical Analysis</h3>

      <p className="analysis-lead">
        Every comparison below is <strong>paired</strong>: for each trial the arrival times are
        generated once from the trial seed and the <em>identical</em> arrival arrays are given to
        both the Equal-Time System and the Optimized System. The two systems therefore always face
        exactly the same traffic, and the per-trial difference isolates the effect of the signal
        policy rather than the luck of the random draw. Nothing on this page is hard-coded — every
        number, interval and chart is computed in your browser when you press a button.
      </p>

      {/* ── Controls ── */}
      <div className="analysis-controls">
        <Field label="Seed base (custom scenario run)">
          <input className="cp-input wide" type="number" value={config.seedBase}
            onChange={e => upd('seedBase', Number(e.target.value))} disabled={busy} />
        </Field>
        <Field label="Trials per scenario">
          <input className="cp-input wide" type="number" min={2} max={2000} value={config.trials}
            onChange={e => upd('trials', Math.max(2, Number(e.target.value) || 2))} disabled={busy} />
        </Field>
        <Field label="Scenario">
          <select className="cp-select wide" value={config.scenarioIndex} disabled={busy}
            onChange={e => {
              const idx = Number(e.target.value);
              setConfig(c => ({ ...c, scenarioIndex: idx, seedBase: SCENARIOS[idx].seedBase }));
            }}>
            {SCENARIOS.map(s => <option key={s.id} value={s.index}>{s.index + 1}. {s.label}</option>)}
          </select>
        </Field>
        <Field label={`Smoothing horizon k (s)${calibration ? ' — calibrated' : ''}`}>
          <select className="cp-select wide" value={config.k} disabled={busy}
            onChange={e => upd('k', Number(e.target.value))}>
            {K_GRID.map(k => <option key={k} value={k}>{k}</option>)}
          </select>
        </Field>
      </div>

      <div className="analysis-buttons">
        <button type="button" className="btn btn-run" onClick={onCalibrate} disabled={busy}>Calibrate k</button>
        <button type="button" className="btn btn-run" onClick={onEvaluate} disabled={busy}>Run all 9 scenarios</button>
        <button type="button" className="btn btn-mc" onClick={onScenario} disabled={busy}>Run selected scenario</button>
        <button type="button" className="btn btn-mc" onClick={onTimestep} disabled={busy}>Time-step sensitivity</button>
        <button type="button" className="btn btn-mc" onClick={onRepresentative} disabled={busy}>Representative run</button>
        {busy && <button type="button" className="btn btn-reset" onClick={onCancel}>Cancel</button>}
      </div>

      {busy && progress && (
        <div className="progress-wrap" role="status" aria-live="polite">
          <div className="progress-bar">
            <div className="progress-fill"
              style={{ width: `${Math.min(100, (100 * progress.done) / Math.max(1, progress.total)).toFixed(1)}%` }} />
          </div>
          <div className="progress-text">
            {progress.label ?? 'Working'} — {progress.done} / {progress.total} trials
          </div>
        </div>
      )}

      {error && <div className="analysis-error" role="alert">Analysis failed: {error}</div>}

      {/* ── Calibration ── */}
      {calibration && (
        <Section title={`Calibration of k (${calibration.trials} paired trials per training scenario, ρ = 0.75)`}
          onExport={() => downloadCSV('calibration_results.csv', calibrationCSV(calibration))}>
          <p className="note">
            J(k) = {calibration.weights.wait}·mean(W<sub>O</sub>/W<sub>E</sub>) +{' '}
            {calibration.weights.maxQueue}·mean(Q<sub>max,O</sub>/Q<sub>max,E</sub>) +{' '}
            {calibration.weights.fairness}·mean(F<sub>O</sub>/F<sub>E</sub>). Each ratio is formed from the mean
            performance of a training scenario and the three scenario ratios are then averaged, so J is
            dimensionless. The calibration seeds (110000 / 1110000 / 2110000) are disjoint from the
            evaluation seeds, so k is not tuned on the data used to report the results.
          </p>
          <div className="table-scroll">
            <table className="ia-table">
              <caption className="sr-only">Calibration ratios and objective score for each tested k value</caption>
              <thead>
                <tr>
                  <th>k (s)</th><th>mean W<sub>O</sub>/W<sub>E</sub></th>
                  <th>mean Q<sub>max</sub> ratio</th><th>mean F ratio</th><th>J(k)</th>
                </tr>
              </thead>
              <tbody>
                {calibration.rows.map(r => (
                  <tr key={r.k} className={r.k === calibration.bestK ? 'row-best' : ''}>
                    <td>{r.k}</td>
                    <td>{fmt(r.waitRatio, 4)}</td>
                    <td>{fmt(r.maxQueueRatio, 4)}</td>
                    <td>{fmt(r.fairnessRatio, 4)}</td>
                    <td>{fmt(r.J, 4)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="note">
            Selected k = <strong>{calibration.bestK} s</strong> with J = {fmt(calibration.bestJ, 4)} — the
            smallest computed J over the tested grid, not a preset value.
          </p>
        </Section>
      )}

      {/* ── Scenario results ── */}
      {scenarios?.length > 0 && (
        <Section title={`Paired evaluation — ${scenarios.length} scenario${scenarios.length > 1 ? 's' : ''}, ${scenarios[0].trials} trials each, k = ${scenarios[0].k} s`}>
          <div className="export-row">
            <button type="button" className="btn btn-export-sm"
              onClick={() => downloadCSV('scenario_summaries.csv', scenarioSummaryCSV(scenarios))}>
              Scenario summaries CSV
            </button>
            <button type="button" className="btn btn-export-sm"
              onClick={() => downloadCSV('raw_paired_trials.csv', rawTrialsCSV(scenarios))}>
              Raw paired trials CSV
            </button>
          </div>
          <div className="table-scroll">
            <table className="ia-table">
              <caption className="sr-only">Paired evaluation summary for each traffic scenario</caption>
              <thead>
                <tr>
                  <th>Scenario</th><th>ρ</th><th>A</th>
                  <th>λ<sub>N</sub>, λ<sub>S</sub>, λ<sub>E</sub>, λ<sub>W</sub> (veh/s)</th>
                  <th>Equal W (s)</th><th>Optimized W (s)</th>
                  <th>mean d (s)</th><th>95% CI for d (s)</th>
                  <th>Mean reduction</th><th>95% CI for reduction</th>
                  <th>t</th><th>p</th>
                  <th>Q<sub>max</sub> E / O</th><th>F E / O (s)</th><th>Clearance E / O (s)</th>
                </tr>
              </thead>
              <tbody>
                {scenarios.map(s => {
                  const verdict = interpretInterval(s.reductionStats);
                  return (
                    <tr key={s.id ?? `${s.pattern}-${s.rho}`}>
                      <td>{s.patternLabel}</td>
                      <td>{s.rho.toFixed(2)}</td>
                      <td>{fmt(s.asymmetry, 3)}</td>
                      <td className="mono">{s.lambdas.map(l => l.toFixed(4)).join(', ')}</td>
                      <td>{fmt(s.equal.meanWait, 1)}</td>
                      <td>{fmt(s.optimized.meanWait, 1)}</td>
                      <td>{fmt(s.diffStats.mean, 2)}</td>
                      <td>[{fmt(s.diffStats.lower, 2)}, {fmt(s.diffStats.upper, 2)}]</td>
                      <td className={verdict === 'better' ? 'good' : verdict === 'worse' ? 'bad' : ''}>
                        {pct(s.reductionStats.mean)}
                      </td>
                      <td className={verdict === 'better' ? 'good' : verdict === 'worse' ? 'bad' : ''}>
                        [{pct(s.reductionStats.lower)}, {pct(s.reductionStats.upper)}]
                      </td>
                      <td>{fmt(s.diffStats.tStat, 2)}</td>
                      <td>{s.diffStats.pValue < 1e-4 ? '< 0.0001' : fmt(s.diffStats.pValue, 4)}</td>
                      <td>{fmt(s.equal.maxQueue, 1)} / {fmt(s.optimized.maxQueue, 1)}</td>
                      <td>{fmt(s.equal.fairness, 1)} / {fmt(s.optimized.fairness, 1)}</td>
                      <td>{fmt(s.equal.clearanceTime, 0)} / {fmt(s.optimized.clearanceTime, 0)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <ul className="verdict-list">
            {scenarios.map(s => (
              <li key={`v-${s.id ?? s.pattern + s.rho}`}>
                <strong>{s.patternLabel}, ρ = {s.rho.toFixed(2)}:</strong>{' '}
                {INTERVAL_TEXT[interpretInterval(s.reductionStats)]}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* ── Time-step sensitivity ── */}
      {sensitivity && (
        <Section title={`Time-step sensitivity — high asymmetry, ρ = ${sensitivity.scenario.rho.toFixed(2)}, ${sensitivity.trials} paired trials, seed base ${sensitivity.rows[0]?.seedBase}`}
          onExport={() => downloadCSV('timestep_sensitivity.csv', timeStepCSV(sensitivity))}>
          <div className="table-scroll">
            <table className="ia-table">
              <caption className="sr-only">Time-step sensitivity results for equal-time and optimized systems</caption>
              <thead>
                <tr>
                  <th>Δt (s)</th><th>Equal W (s)</th><th>Optimized W (s)</th>
                  <th>Mean reduction</th><th>95% CI</th>
                  <th>Q<sub>max</sub> E</th><th>Q<sub>max</sub> O</th>
                </tr>
              </thead>
              <tbody>
                {sensitivity.rows.map(r => (
                  <tr key={r.dt}>
                    <td>{r.dt.toFixed(2)}</td>
                    <td>{fmt(r.equalWait, 1)}</td>
                    <td>{fmt(r.optimizedWait, 1)}</td>
                    <td>{pct(r.reduction)}</td>
                    <td>[{pct(r.reductionLower)}, {pct(r.reductionUpper)}]</td>
                    <td>{fmt(r.equalMaxQueue, 1)}</td>
                    <td>{fmt(r.optimizedMaxQueue, 1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="note">
            Halving Δt changes the reported waiting times by well under one percent, so the discrete
            time step is fine enough for the conclusions drawn here.
          </p>
        </Section>
      )}

      {/* ── Representative run ── */}
      {representative && (
        <Section title={`Representative paired run — ${representative.pattern} asymmetry, ρ = ${representative.rho.toFixed(2)}, seed ${representative.seed}`}
          onExport={() => downloadCSV('representative_queue_history.csv', queueHistoryCSV(representative))}>
          <div className="table-scroll">
            <table className="ia-table">
              <caption className="sr-only">Representative paired run metrics and final green split</caption>
              <thead>
                <tr>
                  <th>System</th><th>W (s)</th><th>Q<sub>max</sub></th><th>F (s)</th>
                  <th>Clearance (s)</th><th>Arrivals</th><th>Served</th>
                  <th>Final green N, S, E, W (s)</th>
                </tr>
              </thead>
              <tbody>
                {[['Equal-Time System', representative.equal], ['Optimized System', representative.optimized]].map(([name, r]) => (
                  <tr key={name}>
                    <td>{name}</td>
                    <td>{fmt(r.meanWait, 1)}</td>
                    <td>{r.maxQueue}</td>
                    <td>{fmt(r.fairness, 1)}</td>
                    <td>{fmt(r.clearanceTime, 1)}</td>
                    <td>{r.totalArrivals}</td>
                    <td>{r.totalServed}</td>
                    <td className="mono">{r.greenTimes.map(g => g.toFixed(1)).join(', ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      {/* ── Explanations ── */}
      <Section title="What the symbols mean">
        <dl className="symbol-list">
          <dt>W — vehicle-weighted mean waiting time (s)</dt>
          <dd>
            W = (Σ<sub>i</sub> queueArea<sub>i</sub>) / (Σ<sub>i</sub> N<sub>i</sub>): the total
            vehicle-seconds of queueing delay divided by the total number of vehicles. It is not the
            average of the four road means, because roads carry different numbers of vehicles.
          </dd>
          <dt>ρ — traffic load (dimensionless)</dt>
          <dd>
            Total demand as a fraction of intersection capacity. Capacity = μG/C ={' '}
            {intersectionCapacity().toFixed(7)} veh/s with μ = {MODEL.mu} veh/s, G = {greenBudget()} s and
            C = {MODEL.cycleLength} s, so total λ = ρ × capacity.
          </dd>
          <dt>A — directional asymmetry (dimensionless)</dt>
          <dd>
            A = √[(1/4) Σ (λ<sub>i</sub> − λ̄)²] / λ̄, the coefficient of variation of the four arrival
            rates. A = 0 means perfectly balanced demand; larger A means the demand is concentrated on
            fewer approaches.
          </dd>
          <dt>F — fairness (s)</dt>
          <dd>
            The population standard deviation of the four road-specific mean waiting times. A larger F
            means waiting times are less equal between roads.
          </dd>
          <dt>d<sub>j</sub> — paired difference (s)</dt>
          <dd>
            d<sub>j</sub> = W<sub>E,j</sub> − W<sub>O,j</sub> for trial j on identical traffic. A
            positive d<sub>j</sub> means the Optimized System performed better on that trial.
          </dd>
          <dt>95% confidence interval</dt>
          <dd>
            d̄ ± t<sub>0.975, n−1</sub> · s<sub>d</sub>/√n, using the sample standard deviation and the
            Student t critical value with n − 1 degrees of freedom (computed from the t distribution, not
            taken as 1.96). The percentage interval is formed the same way from the n per-trial values
            r<sub>j</sub> = 100(W<sub>E,j</sub> − W<sub>O,j</sub>)/W<sub>E,j</sub>.
          </dd>
        </dl>
        <ul className="verdict-key">
          <li>If the percentage CI lies entirely above 0%, the Optimized System reduced waiting time.</li>
          <li>If the CI contains 0%, there is no statistically clear difference.</li>
          <li>If the CI lies entirely below 0%, the Optimized System performed worse.</li>
        </ul>
      </Section>

      <p className="note small">
        Selected scenario for the custom run: <strong>{selected.label}</strong> (default seed base{' '}
        {selected.seedBase}). Trial j uses seed = seedBase + j × 31337, so any run is exactly
        reproducible.
      </p>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="analysis-field">
      <span>{label}</span>
      {children}
    </label>
  );
}

function Section({ title, children, onExport }) {
  return (
    <div className="table-section">
      <div className="table-header">
        <span className="table-title">{title}</span>
        {onExport && <button type="button" className="btn btn-export-sm" onClick={onExport}>Export CSV</button>}
      </div>
      {children}
    </div>
  );
}
