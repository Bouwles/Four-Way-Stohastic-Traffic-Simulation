import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { ChartCard } from './AnalysisGraphs.jsx';
import { DIRS, MODEL } from '../model/constants.js';

const DIR_COLOR = { N: '#00e5ff', S: '#ff4081', E: '#76ff03', W: '#ffab40' };
const AXIS = { fill: '#9aa3bd', fontSize: 11 };
const TOOLTIP = { background: '#161b2c', border: '1px solid #2c3350', color: '#e8ecf7', fontSize: 12 };

/** Charts for the single live paired run. */
export default function GraphPanel({ result }) {
  if (!result) return null;
  const { equal, optimized } = result;

  return (
    <div className="graph-panel">
      <ChartCard
        title="Queue length against time — Equal-Time System"
        caption="Queue on each approach road, in vehicles, against simulated time in seconds."
        filename="live_queues_equal.png"
      >
        <QueueChart data={equal.history} />
      </ChartCard>

      <ChartCard
        title="Queue length against time — Optimized System"
        caption="Same arrivals, same time axis, under the adaptive queue-weighted policy."
        filename="live_queues_optimized.png"
      >
        <QueueChart data={optimized.history} />
      </ChartCard>

      <ChartCard
        title="Mean waiting time by road"
        caption="Mean waiting time per road, in seconds. Roads carry different volumes, so these four means are not simply averaged to get W."
        filename="live_wait_by_road.png"
      >
        <RoadBarChart equal={equal.roadMeanWait} optimized={optimized.roadMeanWait} unit="Mean wait (s)" />
      </ChartCard>

      <ChartCard
        title="Green-time allocation in the final cycle"
        caption={`Green seconds per road out of the ${MODEL.cycleLength - 4 * (MODEL.yellow + MODEL.allRed)} s budget G.`}
        filename="live_green_allocation.png"
      >
        <RoadBarChart equal={equal.greenTimes} optimized={optimized.greenTimes} unit="Green time (s)" />
      </ChartCard>
    </div>
  );
}

function QueueChart({ data }) {
  if (!data?.length) return <NoData />;
  const stride = Math.max(1, Math.floor(data.length / 400));
  const sampled = data.filter((_, i) => i % stride === 0);
  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={sampled} margin={{ top: 10, right: 24, bottom: 26, left: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#252b42" />
        <XAxis dataKey="t" type="number" domain={[0, 'dataMax']} tick={AXIS}
          label={{ value: 'Time (seconds)', position: 'insideBottom', offset: -14, fill: AXIS.fill, fontSize: 12 }} />
        <YAxis tick={AXIS}
          label={{ value: 'Queue (vehicles)', angle: -90, position: 'insideLeft', offset: 4, fill: AXIS.fill, fontSize: 12 }} />
        <Tooltip contentStyle={TOOLTIP} labelFormatter={v => `t = ${v} s`} />
        <Legend wrapperStyle={{ color: '#aab', fontSize: 12 }} />
        <ReferenceLine x={MODEL.arrivalHorizon} stroke="#ffab40" strokeDasharray="4 4"
          label={{ value: 'arrivals stop', fill: '#ffab40', fontSize: 11, position: 'insideTopRight' }} />
        {DIRS.map(d => (
          <Line key={d} type="monotone" dataKey={`q${d}`} stroke={DIR_COLOR[d]} dot={false}
            strokeWidth={1.4} name={`Queue ${d}`} />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

function RoadBarChart({ equal, optimized, unit }) {
  const data = DIRS.map((d, i) => ({
    road: d,
    'Equal-Time System': +equal[i].toFixed(2),
    'Optimized System': +optimized[i].toFixed(2),
  }));
  return (
    <ResponsiveContainer width="100%" height={230}>
      <BarChart data={data} margin={{ top: 10, right: 24, bottom: 26, left: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#252b42" />
        <XAxis dataKey="road" tick={{ ...AXIS, fontSize: 12 }}
          label={{ value: 'Approach road', position: 'insideBottom', offset: -14, fill: AXIS.fill, fontSize: 12 }} />
        <YAxis tick={AXIS}
          label={{ value: unit, angle: -90, position: 'insideLeft', offset: 4, fill: AXIS.fill, fontSize: 12 }} />
        <Tooltip contentStyle={TOOLTIP} />
        <Legend wrapperStyle={{ color: '#aab', fontSize: 12 }} />
        <Bar dataKey="Equal-Time System" fill="#6c7dc4" radius={[4, 4, 0, 0]} />
        <Bar dataKey="Optimized System" fill="#00e676" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function NoData() {
  return <div className="tables-placeholder">Run the simulation first.</div>;
}
