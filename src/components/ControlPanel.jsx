import { useState } from 'react';

const DIR_COLOR = { N:'#00e5ff', S:'#ff4081', E:'#76ff03', W:'#ffab40' };
const DIR_LABEL = { N:'North λ', S:'South λ', E:'East λ', W:'West λ' };

const PRESETS = {
  'Balanced':       { N:0.10, S:0.10, E:0.10, W:0.10 },
  'Morning Rush':   { N:0.25, S:0.25, E:0.05, W:0.05 },
  'Evening Rush':   { N:0.08, S:0.08, E:0.25, W:0.25 },
  'Extreme':        { N:0.40, S:0.05, E:0.05, W:0.05 },
  'Uneven':         { N:0.18, S:0.07, E:0.22, W:0.13 },
};

export default function ControlPanel({ params, setParams, onRun, onReset, onRunMC, running, mcRunning }) {
  const [showInfo, setShowInfo] = useState(false);
  const upd  = (k, v) => setParams(p => ({ ...p, [k]: v }));
  const updL = (d, v) => setParams(p => ({ ...p, lambdas: { ...p.lambdas, [d]: v } }));

  return (
    <div className="control-panel">

      {/* Presets */}
      <div className="cp-section">
        <div className="cp-section-label">Scenario</div>
        <div className="preset-grid">
          {Object.entries(PRESETS).map(([name, l]) => (
            <button key={name} className="preset-btn"
              onClick={() => setParams(p => ({ ...p, lambdas: { ...l } }))}>
              {name}
            </button>
          ))}
        </div>
      </div>

      {/* Arrival rates */}
      <div className="cp-section">
        <div className="cp-section-label">Arrival Rates (cars/s)</div>
        {['N','S','E','W'].map(d => (
          <Slider key={d}
            label={DIR_LABEL[d]} labelColor={DIR_COLOR[d]}
            min={0.01} max={0.5} step={0.01}
            value={params.lambdas[d]}
            onChange={v => updL(d, v)} />
        ))}
      </div>

      {/* Signal timing */}
      <div className="cp-section">
        <div className="cp-section-label">Signal Timing</div>
        <Slider label="Cycle length" unit="s" min={40} max={300} step={5} value={params.cycleLength} onChange={v => upd('cycleLength', v)} />
        <Slider label="Min green" unit="s" min={5} max={40} step={1} value={params.minGreen} onChange={v => upd('minGreen', v)} />
        <Slider label="Max green" unit="s" min={20} max={120} step={1} value={params.maxGreen} onChange={v => upd('maxGreen', v)} />
        <Slider label="Yellow" unit="s" min={1} max={10} step={0.5} value={params.yellowDuration} onChange={v => upd('yellowDuration', v)} />
        <Slider label="All-red" unit="s" min={1} max={8} step={0.5} value={params.allRedDuration} onChange={v => upd('allRedDuration', v)} />
      </div>

      {/* Queue */}
      <div className="cp-section">
        <div className="cp-section-label">Queue Model</div>
        <Slider label="Service rate μ" unit="c/s" min={0.1} max={2} step={0.05} value={params.mu} onChange={v => upd('mu', v)} />
        <Slider label="Duration" unit="s" min={60} max={3600} step={60} value={params.duration} onChange={v => upd('duration', v)} />
        <Row label="Random seed">
          <input type="number" className="cp-input" value={params.seed} onChange={e => upd('seed', +e.target.value)} />
        </Row>
      </div>

      {/* Optimisation */}
      <div className="cp-section">
        <div className="cp-section-label">Optimisation</div>
        <Row label="Method">
          <select className="cp-select" value={params.optimisationMethod} onChange={e => upd('optimisationMethod', e.target.value)}>
            <option value="adaptive">Adaptive Queue-Weighted</option>
            <option value="grid">Grid Search</option>
          </select>
        </Row>
        <Slider label="α wait weight" min={0} max={2} step={0.1} value={params.alpha} onChange={v => upd('alpha', v)} />
        <Slider label="β queue weight" min={0} max={2} step={0.1} value={params.beta} onChange={v => upd('beta', v)} />
        <Slider label="γ fairness" min={0} max={2} step={0.1} value={params.gamma} onChange={v => upd('gamma', v)} />
        {params.optimisationMethod === 'grid' && (
          <Slider label="Grid step" unit="s" min={2} max={15} step={1} value={params.gridStep} onChange={v => upd('gridStep', v)} />
        )}
      </div>

      {/* Monte Carlo */}
      <div className="cp-section">
        <div className="cp-section-label">Monte Carlo</div>
        <Row label="Trials">
          <select className="cp-select" value={params.mcTrials} onChange={e => upd('mcTrials', +e.target.value)}>
            {[1,10,20,50,100].map(n => <option key={n} value={n}>{n} trials</option>)}
          </select>
        </Row>
        <div style={{ marginTop: 10 }}>
          <button className="btn btn-mc" onClick={onRunMC} disabled={mcRunning || running}>
            {mcRunning ? 'Running…' : `Run ${params.mcTrials} Trials`}
          </button>
        </div>
      </div>

      {/* Replay speed */}
      <div className="cp-section">
        <div className="cp-section-label">Replay</div>
        <Slider label="Speed" unit="×" min={1} max={20} step={1} value={params.speed} onChange={v => upd('speed', v)} />
      </div>


      {/* Info panel */}
      <div className="cp-info-section">
        <button
          className="cp-info-toggle"
          onClick={() => setShowInfo(v => !v)}
          aria-expanded={showInfo}
        >
          <span>About this simulation</span>
          <span style={{ fontSize: 10, opacity: 0.5, marginLeft: 'auto' }}>{showInfo ? '▲' : '▼'}</span>
        </button>
        {showInfo && (
          <div className="cp-info-body">
            <p>
              This app simulates traffic at a four-way intersection to investigate whether a mathematically
              optimised traffic light system can reduce waiting times compared to a standard equal-time system.
            </p>
            <p>
              Cars arrive at each approach road randomly. The arrival pattern follows a Poisson process,
              which is a well-established model for events that happen independently at a roughly constant
              average rate. The time between each arrival follows an exponential distribution.
            </p>
            <p>
              Two systems are compared side by side. The equal-time system gives every road the same
              amount of green light per cycle, ignoring how much traffic is actually waiting.
              The optimised system measures the queue at each approach at the start of every cycle
              and adjusts the green times to give more time to busier roads.
            </p>
            <p>
              The optimisation minimises a weighted objective combining average waiting time,
              the peak queue length, and a fairness penalty that stops one road from being
              neglected while others are favoured.
            </p>
            <p>
              Because arrivals are random, a single run may not tell the full story. The Monte Carlo
              section repeats the simulation many times with different random seeds and reports
              a 95% confidence interval so you can judge whether any improvement between the two
              systems is statistically meaningful or just down to chance.
            </p>
            <p>
              This simulation was built as part of an IBDP Mathematics AI Higher Level Internal Assessment,
              exploring stochastic modelling, queueing theory, and numerical optimisation.
            </p>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="cp-actions">
        <button className="btn btn-run" onClick={onRun} disabled={running || mcRunning}>
          {running ? 'Running…' : 'Run Simulation'}
        </button>
        <button className="btn btn-reset" onClick={onReset} disabled={running || mcRunning}>
          Reset
        </button>
      </div>
    </div>
  );
}

function Slider({ label, min, max, step, value, onChange, unit, labelColor }) {
  const pct = ((value - min) / (max - min) * 100).toFixed(1) + '%';
  return (
    <div className="cp-row">
      <label style={labelColor ? { color: labelColor } : {}}>{label}</label>
      <div className="slider-group">
        <input
          type="range" min={min} max={max} step={step} value={value}
          className="cp-slider"
          style={{ background: `linear-gradient(to right, #0a84ff ${pct}, rgba(255,255,255,0.14) ${pct})` }}
          onChange={e => onChange(parseFloat(e.target.value))}
        />
        <span className="slider-val">{value}{unit || ''}</span>
      </div>
    </div>
  );
}

function Row({ label, children }) {
  return (
    <div className="cp-row">
      <label>{label}</label>
      {children}
    </div>
  );
}
