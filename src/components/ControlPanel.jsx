import { useState } from 'react';
import {
  DIRS, MODEL, K_GRID, PATTERN_NAMES, PATTERN_LABELS, LOADS,
  greenBudget, intersectionCapacity, lambdasFor, directionalAsymmetry,
} from '../model/constants.js';

const DIR_COLOR = { N: '#00e5ff', S: '#ff4081', E: '#76ff03', W: '#ffab40' };
const DIR_LABEL = { N: 'North λ', S: 'South λ', E: 'East λ', W: 'West λ' };

export default function ControlPanel({ live, setLive, onRun, onReset, running, busy }) {
  const [showInfo, setShowInfo] = useState(false);
  const upd = (key, value) => setLive(l => ({ ...l, [key]: value }));
  const updLambda = (d, v) => setLive(l => ({ ...l, lambdas: { ...l.lambdas, [d]: v } }));

  const applyScenario = (pattern, rho) => {
    const arr = lambdasFor(pattern, rho);
    setLive(l => ({ ...l, lambdas: Object.fromEntries(DIRS.map((d, i) => [d, arr[i]])) }));
  };

  const lambdaArray = DIRS.map(d => live.lambdas[d]);
  const totalLambda = lambdaArray.reduce((a, b) => a + b, 0);
  const capacity = intersectionCapacity();

  return (
    <div className="control-panel">
      <div className="cp-section">
        <div className="cp-section-label">Scenario (traffic pattern × load ρ)</div>
        <div className="preset-grid">
          {PATTERN_NAMES.map(pattern => LOADS.map(rho => (
            <button key={`${pattern}-${rho}`} type="button" className="preset-btn"
              title={`${PATTERN_LABELS[pattern]}, ρ = ${rho}`}
              onClick={() => applyScenario(pattern, rho)}>
              {pattern.slice(0, 3)} {rho.toFixed(2)}
            </button>
          )))}
        </div>
        <div className="cp-readout">
          Σλ = {totalLambda.toFixed(4)} veh/s &nbsp;·&nbsp; ρ = {(totalLambda / capacity).toFixed(3)}
          &nbsp;·&nbsp; A = {directionalAsymmetry(lambdaArray).toFixed(3)}
        </div>
      </div>

      <div className="cp-section">
        <div className="cp-section-label">Arrival rates λ (veh/s)</div>
        {DIRS.map(d => (
          <Slider key={d} id={`lambda-${d}`} label={DIR_LABEL[d]} labelColor={DIR_COLOR[d]}
            min={0.005} max={0.25} step={0.00125}
            value={live.lambdas[d]} decimals={5}
            onChange={v => updLambda(d, v)} />
        ))}
      </div>

      <div className="cp-section">
        <div className="cp-section-label">Run settings</div>
        <Row id="random-seed" label="Random seed">
          <input id="random-seed" type="number" className="cp-input" value={live.seed}
            onChange={e => upd('seed', Number(e.target.value))} />
        </Row>
        <Row id="smoothing-k" label="Smoothing horizon k (s)">
          <select id="smoothing-k" className="cp-select" value={live.k} onChange={e => upd('k', Number(e.target.value))}>
            {K_GRID.map(k => <option key={k} value={k}>{k}</option>)}
          </select>
        </Row>
        <Slider id="replay-speed" label="Replay speed" unit="×" min={1} max={30} step={1}
          value={live.speed} decimals={0} onChange={v => upd('speed', v)} />
      </div>

      <div className="cp-section">
        <div className="cp-section-label">Fixed model parameters</div>
        <ul className="cp-facts">
          <li><span>Arrival horizon T</span><strong>{MODEL.arrivalHorizon} s</strong></li>
          <li><span>Time step Δt</span><strong>{MODEL.dt} s</strong></li>
          <li><span>Cycle length C</span><strong>{MODEL.cycleLength} s</strong></li>
          <li><span>Yellow y / all-red r</span><strong>{MODEL.yellow} s / {MODEL.allRed} s</strong></li>
          <li><span>Green budget G = C − 4(y + r)</span><strong>{greenBudget()} s</strong></li>
          <li><span>Service rate μ</span><strong>{MODEL.mu} veh/s</strong></li>
          <li><span>g<sub>min</sub> / g<sub>max</sub></span><strong>{MODEL.minGreen} s / {MODEL.maxGreen} s</strong></li>
          <li><span>Capacity μG/C</span><strong>{capacity.toFixed(7)} veh/s</strong></li>
        </ul>
      </div>

      <div className="cp-info-section">
        <button type="button" className="cp-info-toggle" onClick={() => setShowInfo(v => !v)} aria-expanded={showInfo}>
          <span>About this simulation</span>
          <span style={{ fontSize: 10, opacity: 0.5, marginLeft: 'auto' }}>{showInfo ? '▲' : '▼'}</span>
        </button>
        {showInfo && (
          <div className="cp-info-body">
            <p>
              A four-way intersection is simulated to test whether an adaptive queue-weighted signal
              policy reduces waiting time compared with an equal-time signal plan.
            </p>
            <p>
              Vehicles arrive on each approach as a Poisson process of rate λ. The gaps between
              arrivals are exponential and are generated from a seeded generator, so the same seed
              always reproduces exactly the same traffic.
            </p>
            <p>
              The <strong>Equal-Time System</strong> gives every road G/4 = {greenBudget() / 4} s of green in
              every cycle. The <strong>Optimized System</strong> (the adaptive queue-weighted policy)
              re-splits the same {greenBudget()} s budget at the start of every cycle using
              w<sub>i</sub> = Q<sub>i</sub> + kλ<sub>i</sub>, subject to
              {' '}{MODEL.minGreen} s ≤ g<sub>i</sub> ≤ {MODEL.maxGreen} s.
            </p>
            <p>
              Press Run to simulate one seed and replay the Optimized System on the 3D intersection.
              The Statistical Analysis tab repeats the comparison over many paired trials and reports
              95% confidence intervals.
            </p>
            <p>
              Built for an IB Mathematics: Applications and Interpretation HL Internal Assessment.
              It is a simplified educational model, not a traffic-engineering control system.
            </p>
          </div>
        )}
      </div>

      <div className="cp-actions">
        <button type="button" className="btn btn-run" onClick={onRun} disabled={running || busy}>
          {running ? 'Running…' : 'Run Simulation'}
        </button>
        <button type="button" className="btn btn-reset" onClick={onReset} disabled={running}>Reset</button>
      </div>
    </div>
  );
}

function Slider({ id, label, min, max, step, value, onChange, unit, labelColor, decimals = 3 }) {
  const pct = `${(((value - min) / (max - min)) * 100).toFixed(1)}%`;
  return (
    <div className="cp-row">
      <label htmlFor={id} style={labelColor ? { color: labelColor } : {}}>{label}</label>
      <div className="slider-group">
        <input id={id} type="range" min={min} max={max} step={step} value={value} className="cp-slider"
          style={{ background: `linear-gradient(to right, #0a84ff ${pct}, rgba(255,255,255,0.14) ${pct})` }}
          onChange={e => onChange(parseFloat(e.target.value))} />
        <span className="slider-val">{value.toFixed(decimals)}{unit || ''}</span>
      </div>
    </div>
  );
}

function Row({ id, label, children }) {
  return (
    <div className="cp-row">
      <label htmlFor={id}>{label}</label>
      {children}
    </div>
  );
}
