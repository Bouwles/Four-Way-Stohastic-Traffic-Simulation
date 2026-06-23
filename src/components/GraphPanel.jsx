import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ReferenceLine,
} from 'recharts';

const DIR_COLOR = { N: '#00e5ff', S: '#ff4081', E: '#76ff03', W: '#ffab40' };

export default function GraphPanel({ equalTimeSeries, optTimeSeries, mcResults, equalResult, optResult }) {
  return (
    <div className="graph-panel">
      <h3 className="section-title">Graphs & Analysis</h3>

      {(equalTimeSeries || optTimeSeries) && (
        <GraphCard title="Queue Length vs Time — Equal-Time System">
          <QueueChart data={equalTimeSeries} />
        </GraphCard>
      )}

      {optTimeSeries && (
        <GraphCard title="Queue Length vs Time — Optimised System">
          <QueueChart data={optTimeSeries} />
        </GraphCard>
      )}

      {equalResult && optResult && (
        <>
          <GraphCard title="Mean Waiting Time Comparison">
            <WaitCompareChart equal={equalResult} opt={optResult} />
          </GraphCard>

          <GraphCard title="Green Time Allocation">
            <GreenTimeChart equal={equalResult} opt={optResult} />
          </GraphCard>

          <GraphCard title="Per-Direction Metrics">
            <DirMetricsChart equal={equalResult} opt={optResult} />
          </GraphCard>
        </>
      )}

      {mcResults && (
        <>
          <GraphCard title="Monte Carlo: Waiting Time Distribution">
            <MCHistogram rawEqual={mcResults.rawEqual} rawOpt={mcResults.rawOpt} />
          </GraphCard>

          <GraphCard title="Monte Carlo: Trial-by-Trial Comparison">
            <MCTrialChart mcResults={mcResults} />
          </GraphCard>
        </>
      )}
    </div>
  );
}

function GraphCard({ title, children }) {
  return (
    <div className="graph-card">
      <div className="graph-title">{title}</div>
      {children}
    </div>
  );
}

function QueueChart({ data }) {
  if (!data || !data.length) return <NoData />;
  const sampled = data.filter((_, i) => i % Math.max(1, Math.floor(data.length / 200)) === 0);
  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={sampled} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#2a2f45" />
        <XAxis dataKey="t" tick={{ fill: '#888', fontSize: 11 }} label={{ value: 'Time (s)', position: 'insideBottom', fill: '#888', fontSize: 11 }} />
        <YAxis tick={{ fill: '#888', fontSize: 11 }} label={{ value: 'Queue', angle: -90, position: 'insideLeft', fill: '#888', fontSize: 11 }} />
        <Tooltip contentStyle={{ background: '#1a1f2e', border: '1px solid #333', color: '#fff' }} />
        <Legend wrapperStyle={{ color: '#aaa', fontSize: 12 }} />
        {['N','S','E','W'].map(d => (
          <Line key={d} type="monotone" dataKey={`q${d}`} stroke={DIR_COLOR[d]} dot={false} strokeWidth={1.5} name={`Queue ${d}`} />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

function WaitCompareChart({ equal, opt }) {
  const data = ['N','S','E','W'].map(d => ({
    dir: d,
    'Equal-Time': +equal.dirMeanWait[d].toFixed(2),
    'Optimised':  +opt.dirMeanWait[d].toFixed(2),
  }));
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#2a2f45" />
        <XAxis dataKey="dir" tick={{ fill: '#888', fontSize: 12 }} />
        <YAxis tick={{ fill: '#888', fontSize: 11 }} label={{ value: 'Wait (s)', angle: -90, position: 'insideLeft', fill: '#888', fontSize: 11 }} />
        <Tooltip contentStyle={{ background: '#1a1f2e', border: '1px solid #333', color: '#fff' }} />
        <Legend wrapperStyle={{ color: '#aaa', fontSize: 12 }} />
        <Bar dataKey="Equal-Time" fill="#6c7dc4" radius={[4,4,0,0]} />
        <Bar dataKey="Optimised"  fill="#00e676" radius={[4,4,0,0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function GreenTimeChart({ equal, opt }) {
  const eqG = equal.greenTimes || [25,25,25,25];
  const opG = opt.greenTimes   || [25,25,25,25];
  const data = ['N','S','E','W'].map((d, i) => ({
    dir: d,
    'Equal-Time': +eqG[i].toFixed(1),
    'Optimised':  +opG[i].toFixed(1),
  }));
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#2a2f45" />
        <XAxis dataKey="dir" tick={{ fill: '#888', fontSize: 12 }} />
        <YAxis tick={{ fill: '#888', fontSize: 11 }} label={{ value: 'Green (s)', angle: -90, position: 'insideLeft', fill: '#888', fontSize: 11 }} />
        <Tooltip contentStyle={{ background: '#1a1f2e', border: '1px solid #333', color: '#fff' }} />
        <Legend wrapperStyle={{ color: '#aaa', fontSize: 12 }} />
        <Bar dataKey="Equal-Time" fill="#6c7dc4" radius={[4,4,0,0]} />
        <Bar dataKey="Optimised"  fill="#00e676" radius={[4,4,0,0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function DirMetricsChart({ equal, opt }) {
  const data = ['N','S','E','W'].map(d => ({
    dir: d,
    'Eq MaxQueue': equal.maxQueuePerDir[d] || 0,
    'Opt MaxQueue': opt.maxQueuePerDir[d]  || 0,
  }));
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#2a2f45" />
        <XAxis dataKey="dir" tick={{ fill: '#888', fontSize: 12 }} />
        <YAxis tick={{ fill: '#888', fontSize: 11 }} label={{ value: 'Max Queue', angle: -90, position: 'insideLeft', fill: '#888', fontSize: 11 }} />
        <Tooltip contentStyle={{ background: '#1a1f2e', border: '1px solid #333', color: '#fff' }} />
        <Legend wrapperStyle={{ color: '#aaa', fontSize: 12 }} />
        <Bar dataKey="Eq MaxQueue"  fill="#6c7dc4" radius={[4,4,0,0]} />
        <Bar dataKey="Opt MaxQueue" fill="#00e676" radius={[4,4,0,0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function MCHistogram({ rawEqual, rawOpt }) {
  if (!rawEqual || !rawOpt) return <NoData />;
  const all = [...rawEqual, ...rawOpt];
  const lo = Math.floor(Math.min(...all));
  const hi = Math.ceil(Math.max(...all));
  const bins = 15;
  const step = (hi - lo) / bins || 1;
  const buckets = Array.from({ length: bins }, (_, i) => ({
    label: `${(lo + i * step).toFixed(0)}`,
    Equal: 0, Optimised: 0,
  }));
  rawEqual.forEach(v => { const idx = Math.min(Math.floor((v - lo) / step), bins - 1); buckets[idx].Equal++; });
  rawOpt.forEach(v   => { const idx = Math.min(Math.floor((v - lo) / step), bins - 1); buckets[idx].Optimised++; });
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={buckets} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#2a2f45" />
        <XAxis dataKey="label" tick={{ fill: '#888', fontSize: 10 }} label={{ value: 'Mean Wait (s)', position: 'insideBottom', fill: '#888', fontSize: 11 }} />
        <YAxis tick={{ fill: '#888', fontSize: 11 }} label={{ value: 'Count', angle: -90, position: 'insideLeft', fill: '#888', fontSize: 11 }} />
        <Tooltip contentStyle={{ background: '#1a1f2e', border: '1px solid #333', color: '#fff' }} />
        <Legend wrapperStyle={{ color: '#aaa', fontSize: 12 }} />
        <Bar dataKey="Equal"     fill="#6c7dc4" radius={[3,3,0,0]} />
        <Bar dataKey="Optimised" fill="#00e676" radius={[3,3,0,0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function MCTrialChart({ mcResults }) {
  const data = mcResults.equal.trialData.map((eq, i) => ({
    trial: eq.trial,
    'Equal-Time': eq.meanWait,
    'Optimised': mcResults.optimised.trialData[i].meanWait,
  }));
  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#2a2f45" />
        <XAxis dataKey="trial" tick={{ fill: '#888', fontSize: 11 }} label={{ value: 'Trial #', position: 'insideBottom', fill: '#888', fontSize: 11 }} />
        <YAxis tick={{ fill: '#888', fontSize: 11 }} label={{ value: 'Mean Wait (s)', angle: -90, position: 'insideLeft', fill: '#888', fontSize: 11 }} />
        <Tooltip contentStyle={{ background: '#1a1f2e', border: '1px solid #333', color: '#fff' }} />
        <Legend wrapperStyle={{ color: '#aaa', fontSize: 12 }} />
        <Line type="monotone" dataKey="Equal-Time" stroke="#6c7dc4" dot={false} strokeWidth={2} />
        <Line type="monotone" dataKey="Optimised"  stroke="#00e676" dot={false} strokeWidth={2} />
      </LineChart>
    </ResponsiveContainer>
  );
}

function NoData() {
  return <div style={{ color: '#555', textAlign: 'center', padding: 40 }}>Run simulation first</div>;
}
