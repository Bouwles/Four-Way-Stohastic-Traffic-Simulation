import { useState, useCallback, useRef, useEffect } from 'react';
import IntersectionCanvas from './components/IntersectionCanvas.jsx';
import ControlPanel from './components/ControlPanel.jsx';
import ResultsDashboard from './components/ResultsDashboard.jsx';
import GraphPanel from './components/GraphPanel.jsx';
import DataTables from './components/DataTables.jsx';
import { simulateEqualTimeSystem, simulateOptimisedSystem } from './simulation/trafficLightSystems.js';
import { runMonteCarlo } from './simulation/monteCarlo.js';
import './App.css';

const DEFAULT_PARAMS = {
  duration: 600, dt: 0.5, speed: 4, seed: 42,
  lambdas: { N: 0.1, S: 0.1, E: 0.1, W: 0.1 },
  cycleLength: 120, yellowDuration: 3, allRedDuration: 2,
  minGreen: 10, maxGreen: 80, mu: 0.5,
  optimisationMethod: 'adaptive',
  alpha: 1.0, beta: 0.3, gamma: 0.5, gridStep: 5, mcTrials: 20,
};

const TABS = ['Results', 'Graphs', 'Data Tables'];
const DEFAULT_CANVAS_H = 400;

export default function App() {
  const [params, setParams]       = useState(DEFAULT_PARAMS);
  const [tab, setTab]             = useState('Results');
  const [running, setRunning]     = useState(false);
  const [mcRunning, setMcRunning] = useState(false);

  const [equalResult, setEqualResult]         = useState(null);
  const [optResult, setOptResult]             = useState(null);
  const [equalTimeSeries, setEqualTimeSeries] = useState(null);
  const [optTimeSeries, setOptTimeSeries]     = useState(null);
  const [mcResults, setMcResults]             = useState(null);

  const [visState, setVisState]             = useState(null);
  const [activeDir, setActiveDir]           = useState(null);
  const [lightStates, setLightStates]       = useState({ N:'red', S:'red', E:'red', W:'red' });
  const [queueLengths, setQueueLengths]     = useState({ N:0, S:0, E:0, W:0 });
  const [greenCountdown, setGreenCountdown] = useState(0);
  const [cycleNum, setCycleNum]             = useState(0);

  // ── Drag-resize state ──────────────────────────────────────────────────────
  const [canvasHeight, setCanvasHeight] = useState(DEFAULT_CANVAS_H);
  const dragging    = useRef(false);
  const dragStartY  = useRef(0);
  const dragStartH  = useRef(DEFAULT_CANVAS_H);

  useEffect(() => {
    const onMove = (e) => {
      if (!dragging.current) return;
      const delta = e.clientY - dragStartY.current;
      const newH = Math.min(Math.max(dragStartH.current + delta, 160), window.innerHeight * 0.80);
      setCanvasHeight(newH);
    };
    const onUp = () => {
      if (!dragging.current) return;
      dragging.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
  }, []);

  const onResizeHandleDown = useCallback((e) => {
    e.preventDefault();
    dragging.current = true;
    dragStartY.current = e.clientY;
    dragStartH.current = canvasHeight;
    document.body.style.cursor = 'ns-resize';
    document.body.style.userSelect = 'none';
  }, [canvasHeight]);

  // ── Simulation replay ──────────────────────────────────────────────────────
  const replayRef = useRef(null);
  const frameRef  = useRef(0);

  const stopReplay = useCallback(() => {
    if (replayRef.current) clearInterval(replayRef.current);
    replayRef.current = null;
  }, []);

  const startReplay = useCallback((ts) => {
    stopReplay();
    frameRef.current = 0;
    if (!ts?.length) return;
    const spd = params.speed || 4;
    const interval = Math.max(16, Math.round(1000 / (60 * spd)));
    replayRef.current = setInterval(() => {
      const i = frameRef.current;
      if (i >= ts.length) { stopReplay(); return; }
      const f = ts[i];
      setQueueLengths({ N: f.qN, S: f.qS, E: f.qE, W: f.qW });
      setActiveDir(f.activeDir);
      setCycleNum(f.cycleNum);
      const ls = { N:'red', S:'red', E:'red', W:'red' };
      if (f.activeDir) ls[f.activeDir] = 'green';
      setLightStates(ls);
      frameRef.current++;
    }, interval);
  }, [params.speed, stopReplay]);

  const handleRun = useCallback(() => {
    if (running || mcRunning) return;
    stopReplay(); setRunning(true); setMcResults(null);
    setTimeout(() => {
      try {
        const eq  = simulateEqualTimeSystem(params, params.seed, true);
        const opt = simulateOptimisedSystem(params, params.seed, true);
        setEqualResult(eq); setOptResult(opt);
        setEqualTimeSeries(eq.timeSeries); setOptTimeSeries(opt.timeSeries);
        setVisState({ running: true });
        startReplay(opt.timeSeries);
        setTab('Results');
      } catch (e) { console.error(e); } finally { setRunning(false); }
    }, 10);
  }, [params, running, mcRunning, startReplay, stopReplay]);

  const handleReset = useCallback(() => {
    stopReplay();
    setEqualResult(null); setOptResult(null);
    setEqualTimeSeries(null); setOptTimeSeries(null);
    setMcResults(null); setVisState(null); setActiveDir(null);
    setLightStates({ N:'red', S:'red', E:'red', W:'red' });
    setQueueLengths({ N:0, S:0, E:0, W:0 });
    setCycleNum(0);
  }, [stopReplay]);

  const handleRunMC = useCallback(() => {
    if (running || mcRunning) return;
    stopReplay(); setMcRunning(true);
    setTimeout(() => {
      try {
        const mc = runMonteCarlo(params, params.mcTrials);
        setMcResults(mc); setTab('Results');
      } catch (e) { console.error(e); } finally { setMcRunning(false); }
    }, 10);
  }, [params, running, mcRunning, stopReplay]);

  // ── Cmd+R shortcut ─────────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'r') {
        e.preventDefault();
        handleRun();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [handleRun]);

  useEffect(() => () => stopReplay(), [stopReplay]);

  const isActive = !!visState || !!mcResults;
  const dirColors = { N:'#00e5ff', S:'#ff4081', E:'#76ff03', W:'#ffab40' };

  return (
    <div className="app">
      {/* ── Header ── */}
      <header className="app-header">
        <div className="header-status">
          <div className={`status-dot ${isActive ? 'active' : ''}`} />
          <span className="status-label">
            {running ? 'Running simulation…' : mcRunning ? 'Monte Carlo running…' : isActive ? 'Simulation complete' : 'Ready  ·  ⌘R to run'}
          </span>
          {activeDir && (
            <div className="dir-indicators">
              {['N','S','E','W'].map(d => (
                <div key={d} className={`dir-dot ${d === activeDir ? 'green' : ''}`}
                  style={d === activeDir ? { background: dirColors[d], boxShadow: `0 0 4px ${dirColors[d]}` } : {}} />
              ))}
            </div>
          )}
        </div>
        <span className="byline">Made by Paul Nercessian</span>
      </header>

      {/* ── Body ── */}
      <div className="app-body">
        <aside className="sidebar">
          <ControlPanel
            params={params} setParams={setParams}
            onRun={handleRun} onReset={handleReset} onRunMC={handleRunMC}
            running={running} mcRunning={mcRunning}
          />
        </aside>

        <main className="main-content">
          {/* 3D Canvas — resizable */}
          <div className="canvas-wrapper" style={{ flex: `0 0 ${canvasHeight}px` }}>
            <div className="canvas-status-bar">
              <span className="canvas-status-text">
                {visState ? 'Optimised system replay  ·  drag to orbit  ·  scroll to zoom' : 'Idle  ·  drag to orbit  ·  scroll to zoom'}
              </span>
              {cycleNum > 0 && <span className="canvas-cycle-badge">Cycle {cycleNum}</span>}
            </div>
            <IntersectionCanvas
              simState={visState} activeDir={activeDir}
              lightStates={lightStates} queueLengths={queueLengths}
              greenCountdown={greenCountdown} cycleNum={cycleNum}
              speed={params.speed}
            />
          </div>

          {/* ── Resize handle ── */}
          <div className="resize-handle" onMouseDown={onResizeHandleDown}>
            <div className="resize-grip" />
          </div>

          {/* Tab bar */}
          <div className="tabs">
            {TABS.map(t => (
              <button key={t} className={`tab-btn ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
                {t}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="tab-content">
            {tab === 'Results'     && <ResultsDashboard equalResult={equalResult} optResult={optResult} mcResults={mcResults} />}
            {tab === 'Graphs'      && <GraphPanel equalTimeSeries={equalTimeSeries} optTimeSeries={optTimeSeries} mcResults={mcResults} equalResult={equalResult} optResult={optResult} />}
            {tab === 'Data Tables' && <DataTables params={params} equalResult={equalResult} optResult={optResult} mcResults={mcResults} equalTimeSeries={equalTimeSeries} optTimeSeries={optTimeSeries} />}
          </div>
        </main>
      </div>
    </div>
  );
}
