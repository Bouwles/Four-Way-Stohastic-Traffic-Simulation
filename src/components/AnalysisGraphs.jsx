import { useRef } from 'react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine, ErrorBar, Cell,
} from 'recharts';
import { downloadChartPng } from '../utils/chartPng.js';
import { LOADS, PATTERN_NAMES, PATTERN_LABELS } from '../model/constants.js';

const EQUAL_COLOR = '#6c7dc4';
const OPT_COLOR = '#00e676';
const AXIS = { fill: '#9aa3bd', fontSize: 11 };
const TOOLTIP = { background: '#161b2c', border: '1px solid #2c3350', color: '#e8ecf7', fontSize: 12 };

/** Chart shell: title, axis-unit caption, and a PNG download button. */
export function ChartCard({ title, caption, children, filename }) {
  const ref = useRef(null);
  return (
    <div className="graph-card" ref={ref}>
      <div className="graph-head">
        <div className="graph-title">{title}</div>
        {filename && (
          <button
            type="button"
            className="btn btn-export-sm"
            onClick={() => downloadChartPng(ref.current, filename).catch(e => alert(e.message))}
          >
            PNG
          </button>
        )}
      </div>
      {children}
      {caption && <div className="graph-caption">{caption}</div>}
    </div>
  );
}

const shortLabel = (s) => `${s.pattern.slice(0, 3)} ρ=${s.rho.toFixed(2)}`;

/** Graph 1 — calibration score J(k) against k. */
export function CalibrationChart({ calibration }) {
  const data = calibration.rows.map(r => ({ k: r.k, J: +r.J.toFixed(5) }));
  const best = calibration.rows.reduce((a, b) => (b.J < a.J ? b : a));
  return (
    <ChartCard
      title="Calibration score J(k) against the smoothing horizon k"
      caption={`J(k) = 0.7·mean(W_O/W_E) + 0.2·mean(Qmax_O/Qmax_E) + 0.1·mean(F_O/F_E), dimensionless. Minimum at k = ${best.k} s, J = ${best.J.toFixed(4)}. ${calibration.trials} paired trials per training scenario at ρ = 0.75.`}
      filename="calibration_J_of_k.png"
    >
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={data} margin={{ top: 10, right: 24, bottom: 28, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#252b42" />
          <XAxis
            dataKey="k" type="number" domain={['dataMin', 'dataMax']} tick={AXIS}
            label={{ value: 'Smoothing horizon k (seconds)', position: 'insideBottom', offset: -16, fill: AXIS.fill, fontSize: 12 }}
          />
          <YAxis
            tick={AXIS} domain={['auto', 'auto']}
            label={{ value: 'Calibration score J(k) (dimensionless)', angle: -90, position: 'insideLeft', offset: 4, fill: AXIS.fill, fontSize: 12 }}
          />
          <Tooltip contentStyle={TOOLTIP} formatter={v => [v, 'J(k)']} labelFormatter={v => `k = ${v} s`} />
          <ReferenceLine x={best.k} stroke="#ffab40" strokeDasharray="4 4"
            label={{ value: `best k = ${best.k} s`, fill: '#ffab40', fontSize: 11, position: 'top' }} />
          <Line type="monotone" dataKey="J" stroke={OPT_COLOR} strokeWidth={2} dot={{ r: 3 }} name="J(k)" />
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

/** Graph 2 — mean reduction across the nine scenarios with 95% paired CIs. */
export function ImprovementChart({ scenarios }) {
  const data = scenarios.map(s => ({
    name: shortLabel(s),
    label: s.label,
    reduction: +s.reductionStats.mean.toFixed(3),
    error: [
      +(s.reductionStats.mean - s.reductionStats.lower).toFixed(3),
      +(s.reductionStats.upper - s.reductionStats.mean).toFixed(3),
    ],
  }));
  return (
    <ChartCard
      title="Optimized system improvement with 95% paired confidence intervals"
      caption={`Mean of the per-trial percentage reductions r_j = 100(W_E − W_O)/W_E, with 95% Student t intervals on ${scenarios[0]?.trials ?? 0} paired trials (n − 1 degrees of freedom). Bars above the 0% line mean the Optimized System waited less.`}
      filename="scenario_improvement_ci.png"
    >
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} margin={{ top: 10, right: 24, bottom: 46, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#252b42" />
          <XAxis dataKey="name" tick={{ ...AXIS, fontSize: 10 }} interval={0} angle={-28} textAnchor="end" height={60}
            label={{ value: 'Scenario (traffic pattern and load ρ)', position: 'insideBottom', offset: -34, fill: AXIS.fill, fontSize: 12 }} />
          <YAxis tick={AXIS}
            label={{ value: 'Mean waiting-time reduction (%)', angle: -90, position: 'insideLeft', offset: 4, fill: AXIS.fill, fontSize: 12 }} />
          <Tooltip contentStyle={TOOLTIP}
            formatter={(v, n, p) => [`${v}%`, p?.payload?.label ?? 'reduction']} />
          <ReferenceLine y={0} stroke="#8892b0" />
          <Bar dataKey="reduction" name="Mean reduction (%)" radius={[3, 3, 0, 0]}>
            {data.map((d, i) => <Cell key={i} fill={d.reduction >= 0 ? OPT_COLOR : '#ff5370'} />)}
            <ErrorBar dataKey="error" width={5} strokeWidth={1.6} stroke="#e8ecf7" direction="y" />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

/** Graph 3 — heatmap of mean percentage reduction against load and asymmetry. */
export function ReductionHeatmap({ scenarios }) {
  const byId = new Map(scenarios.map(s => [`${s.pattern}-${s.rho}`, s]));
  const values = scenarios.map(s => s.reductionStats.mean);
  const lo = Math.min(0, ...values);
  const hi = Math.max(...values);

  const cellW = 132;
  const cellH = 62;
  const left = 150;
  const top = 52;
  const width = left + cellW * LOADS.length + 24;
  const height = top + cellH * PATTERN_NAMES.length + 46;

  const colour = (v) => {
    const t = hi === lo ? 1 : (v - lo) / (hi - lo);
    // dark blue (low) → green (high)
    const r = Math.round(20 + 10 * t);
    const g = Math.round(35 + 195 * t);
    const b = Math.round(80 - 40 * t);
    return `rgb(${r},${g},${b})`;
  };

  return (
    <ChartCard
      title="Mean waiting-time reduction by traffic load and directional asymmetry"
      caption="Cell values are the mean percentage reduction in vehicle-weighted mean waiting time, Optimized versus Equal-Time. Rows are the directional asymmetry A of the arrival rates; columns are the traffic load ρ (dimensionless)."
      filename="reduction_heatmap.png"
    >
      <div style={{ overflowX: 'auto' }}>
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img"
          aria-label="Heatmap of mean percentage reduction against traffic load and asymmetry">
          <rect x="0" y="0" width={width} height={height} fill="#0f1320" />
          {LOADS.map((rho, c) => (
            <text key={rho} x={left + cellW * c + cellW / 2} y={top - 16} fill={AXIS.fill}
              fontSize="12" textAnchor="middle">ρ = {rho.toFixed(2)}</text>
          ))}
          <text x={left + (cellW * LOADS.length) / 2} y={height - 12} fill={AXIS.fill} fontSize="12"
            textAnchor="middle">Traffic load ρ (fraction of capacity)</text>
          {PATTERN_NAMES.map((pattern, r) => {
            const sample = byId.get(`${pattern}-${LOADS[0]}`);
            return (
              <g key={pattern}>
                <text x={left - 12} y={top + cellH * r + cellH / 2 - 4} fill="#e8ecf7" fontSize="12" textAnchor="end">
                  {PATTERN_LABELS[pattern]}
                </text>
                <text x={left - 12} y={top + cellH * r + cellH / 2 + 12} fill={AXIS.fill} fontSize="10.5" textAnchor="end">
                  A = {(sample?.asymmetry ?? 0).toFixed(3)}
                </text>
                {LOADS.map((rho, c) => {
                  const s = byId.get(`${pattern}-${rho}`);
                  const v = s ? s.reductionStats.mean : Number.NaN;
                  return (
                    <g key={rho}>
                      <rect x={left + cellW * c + 3} y={top + cellH * r + 3}
                        width={cellW - 6} height={cellH - 6} rx="6"
                        fill={Number.isFinite(v) ? colour(v) : '#222'} />
                      <text x={left + cellW * c + cellW / 2} y={top + cellH * r + cellH / 2 + 5}
                        fill="#08160c" fontSize="15" fontWeight="700" textAnchor="middle">
                        {Number.isFinite(v) ? `${v.toFixed(1)}%` : '—'}
                      </text>
                    </g>
                  );
                })}
              </g>
            );
          })}
        </svg>
      </div>
    </ChartCard>
  );
}

/** Graph 4 — representative total-queue comparison. */
export function RepresentativeQueueChart({ representative }) {
  const data = representative.series;
  return (
    <ChartCard
      title={`Total queue against time — ${PATTERN_LABELS[representative.pattern]}, ρ = ${representative.rho.toFixed(2)}, seed ${representative.seed}`}
      caption={`Sum of the four queues for a single paired run on identical arrivals (k = ${representative.k} s). Vehicles stop arriving at T = 3600 s; the signals keep running until every queue is empty.`}
      filename="representative_queue_history.png"
    >
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={data} margin={{ top: 10, right: 24, bottom: 28, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#252b42" />
          <XAxis dataKey="t" type="number" domain={[0, 'dataMax']} tick={AXIS}
            label={{ value: 'Time (seconds)', position: 'insideBottom', offset: -16, fill: AXIS.fill, fontSize: 12 }} />
          <YAxis tick={AXIS}
            label={{ value: 'Total queue (vehicles)', angle: -90, position: 'insideLeft', offset: 4, fill: AXIS.fill, fontSize: 12 }} />
          <Tooltip contentStyle={TOOLTIP} labelFormatter={v => `t = ${v} s`} />
          <Legend wrapperStyle={{ color: '#aab', fontSize: 12 }} />
          <ReferenceLine x={3600} stroke="#ffab40" strokeDasharray="4 4"
            label={{ value: 'arrivals stop (T)', fill: '#ffab40', fontSize: 11, position: 'insideTopRight' }} />
          <Line type="monotone" dataKey="equalTotal" name="Equal-Time System" stroke={EQUAL_COLOR} dot={false} strokeWidth={1.6} />
          <Line type="monotone" dataKey="optimizedTotal" name="Optimized System" stroke={OPT_COLOR} dot={false} strokeWidth={1.6} />
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

/** Graph 5 — histogram of the paired waiting-time differences. */
export function DifferenceHistogram({ scenario, bins = 20 }) {
  const diffs = scenario.diffStats.diffs;
  const lo = Math.min(...diffs);
  const hi = Math.max(...diffs);
  const step = (hi - lo) / bins || 1;
  const buckets = Array.from({ length: bins }, (_, i) => ({
    centre: +(lo + step * (i + 0.5)).toFixed(2),
    range: `${(lo + i * step).toFixed(0)}…${(lo + (i + 1) * step).toFixed(0)}`,
    count: 0,
  }));
  diffs.forEach(d => {
    const idx = Math.min(bins - 1, Math.max(0, Math.floor((d - lo) / step)));
    buckets[idx].count += 1;
  });

  return (
    <ChartCard
      title={`Distribution of paired waiting-time differences — ${scenario.label}`}
      caption={`d_j = W_Equal,j − W_Optimized,j for each of the ${scenario.trials} paired trials. Mean d = ${scenario.diffStats.mean.toFixed(1)} s, 95% CI [${scenario.diffStats.lower.toFixed(1)}, ${scenario.diffStats.upper.toFixed(1)}] s. Positive values mean the Optimized System waited less on that trial's traffic.`}
      filename="paired_difference_histogram.png"
    >
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={buckets} margin={{ top: 10, right: 24, bottom: 34, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#252b42" />
          <XAxis dataKey="centre" tick={{ ...AXIS, fontSize: 10 }} interval={Math.ceil(bins / 10) - 1}
            label={{ value: 'Paired difference dⱼ (seconds)', position: 'insideBottom', offset: -20, fill: AXIS.fill, fontSize: 12 }} />
          <YAxis tick={AXIS} allowDecimals={false}
            label={{ value: 'Number of trials', angle: -90, position: 'insideLeft', offset: 4, fill: AXIS.fill, fontSize: 12 }} />
          <Tooltip contentStyle={TOOLTIP}
            formatter={(v) => [v, 'trials']} labelFormatter={(v, p) => `d ≈ ${v} s (${p?.[0]?.payload?.range ?? ''})`} />
          <ReferenceLine x={0} stroke="#ff5370" />
          <Bar dataKey="count" name="Trials" fill={OPT_COLOR} radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
