import { useState, useCallback, useRef, useEffect } from 'react';
import IntersectionCanvas from './components/IntersectionCanvas.jsx';
import ControlPanel from './components/ControlPanel.jsx';
import ResultsDashboard from './components/ResultsDashboard.jsx';
import GraphPanel from './components/GraphPanel.jsx';
import MathAnalysisPanel from './components/MathAnalysisPanel.jsx';
import StatisticalAnalysisPanel from './components/StatisticalAnalysisPanel.jsx';
import {
  CalibrationChart, ImprovementChart, ReductionHeatmap,
  RepresentativeQueueChart, DifferenceHistogram,
} from './components/AnalysisGraphs.jsx';
import { useAnalysisWorker } from './hooks/useAnalysisWorker.js';
import { runPairedTrial } from './model/evaluation.js';
import {
  DIRS, SCENARIOS, DEFAULT_K, EVALUATION_TRIALS, REPRESENTATIVE, lambdasFor,
} from './model/constants.js';
import './App.css';

const TABS = ['Live Run', 'Statistical Analysis', 'Graphs', 'Method'];
const DEFAULT_CANVAS_H = 400;
const DIR_COLORS = { N: '#00e5ff', S: '#ff4081', E: '#76ff03', W: '#ffab40' };

/** λ as a { N, S, E, W } object so the sliders can address each road by name. */
function lambdaObject(pattern, rho) {
  const arr = lambdasFor(pattern, rho);
  return Object.fromEntries(DIRS.map((d, i) => [d, arr[i]]));
}

const DEFAULT_LIVE = {
  lambdas: lambdaObject('High', 0.9),
  seed: 42,
  k: DEFAULT_K,
  speed: 8,
};

const DEFAULT_ANALYSIS = {
  trials: EVALUATION_TRIALS,
  k: DEFAULT_K,
  scenarioIndex: 8,
  seedBase: SCENARIOS[8].seedBase,
};

export default function App() {
  const [live, setLive] = useState(DEFAULT_LIVE);
  const [tab, setTab] = useState('Live Run');
  const [running, setRunning] = useState(false);
  const [liveError, setLiveError] = useState(null);

  const [liveResult, setLiveResult] = useState(null);

  // ── Statistical analysis state ──────────────────────────────────────────
  const [analysisConfig, setAnalysisConfig] = useState(DEFAULT_ANALYSIS);
  const [calibration, setCalibration] = useState(null);
  const [scenarios, setScenarios] = useState(null);
  const [sensitivity, setSensitivity] = useState(null);
  const [representative, setRepresentative] = useState(null);
  const { run, cancel, busy, progress, error: workerError } = useAnalysisWorker();

  // ── Animation state ─────────────────────────────────────────────────────
  const [visState, setVisState] = useState(null);
  const [activeDir, setActiveDir] = useState(null);
  const [lightStates, setLightStates] = useState({ N: 'red', S: 'red', E: 'red', W: 'red' });
  const [queueLengths, setQueueLengths] = useState({ N: 0, S: 0, E: 0, W: 0 });
  const [cycleNum, setCycleNum] = useState(0);

  // ── Drag-resize of the 3D canvas ────────────────────────────────────────
  const [canvasHeight, setCanvasHeight] = useState(DEFAULT_CANVAS_H);
  const dragging = useRef(false);
  const dragStartY = useRef(0);
  const dragStartH = useRef(DEFAULT_CANVAS_H);

  useEffect(() => {
    const onMove = (e) => {
      if (!dragging.current) return;
      const delta = e.clientY - dragStartY.current;
      setCanvasHeight(Math.min(Math.max(dragStartH.current + delta, 160), window.innerHeight * 0.8));
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

  // ── Replay of the Optimized System queue history ────────────────────────
  const replayRef = useRef(null);
  const frameRef = useRef(0);

  const stopReplay = useCallback(() => {
    if (replayRef.current) clearInterval(replayRef.current);
    replayRef.current = null;
  }, []);

  const startReplay = useCallback((history) => {
    stopReplay();
    frameRef.current = 0;
    if (!history?.length) return;
    const interval = Math.max(16, Math.round(1000 / (30 * (live.speed || 4))));
    replayRef.current = setInterval(() => {
      const i = frameRef.current;
      if (i >= history.length) { stopReplay(); return; }
      const f = history[i];
      setQueueLengths({ N: f.qN, S: f.qS, E: f.qE, W: f.qW });
      setActiveDir(f.activeDir);
      setCycleNum(f.cycle);
      const ls = { N: 'red', S: 'red', E: 'red', W: 'red' };
      if (f.activeDir) ls[f.activeDir] = 'green';
      setLightStates(ls);
      frameRef.current += 1;
    }, interval);
  }, [live.speed, stopReplay]);

  const handleRun = useCallback(() => {
    if (running || busy) return;
    stopReplay();
    setRunning(true);
    setLiveError(null);
    setTimeout(() => {
      try {
        const lambdas = DIRS.map(d => live.lambdas[d]);
        const { equal, optimized } = runPairedTrial({
          lambdas, seed: live.seed, k: live.k, collectHistory: true,
        });
        setLiveResult({ equal, optimized, lambdas, seed: live.seed, k: live.k });
        setVisState({ running: true });
        startReplay(optimized.history);
        setTab('Live Run');
      } catch (e) {
        setLiveError(e.message);
      } finally {
        setRunning(false);
      }
    }, 10);
  }, [live, running, busy, startReplay, stopReplay]);

  const handleReset = useCallback(() => {
    stopReplay();
    setLiveResult(null);
    setVisState(null);
    setActiveDir(null);
    setLiveError(null);
    setLightStates({ N: 'red', S: 'red', E: 'red', W: 'red' });
    setQueueLengths({ N: 0, S: 0, E: 0, W: 0 });
    setCycleNum(0);
  }, [stopReplay]);

  useEffect(() => () => stopReplay(), [stopReplay]);

  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'r') { e.preventDefault(); handleRun(); }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [handleRun]);

  // ── Analysis actions ────────────────────────────────────────────────────
  const swallowCancel = (e) => { if (e?.message !== 'cancelled') console.error(e); };

  const onCalibrate = useCallback(() => {
    run('calibrate', {})
      .then((res) => {
        setCalibration(res);
        // Adopt whichever k the calibration actually minimised.
        setAnalysisConfig(c => ({ ...c, k: res.bestK }));
        setLive(l => ({ ...l, k: res.bestK }));
        setTab('Statistical Analysis');
      })
      .catch(swallowCancel);
  }, [run]);

  const onEvaluate = useCallback(() => {
    run('evaluate', { trials: analysisConfig.trials, k: analysisConfig.k })
      .then(res => { setScenarios(res); setTab('Statistical Analysis'); })
      .catch(swallowCancel);
  }, [run, analysisConfig.trials, analysisConfig.k]);

  const onScenario = useCallback(() => {
    const s = SCENARIOS[analysisConfig.scenarioIndex];
    run('scenario', {
      pattern: s.pattern, rho: s.rho, seedBase: analysisConfig.seedBase,
      trials: analysisConfig.trials, k: analysisConfig.k,
    })
      .then(res => { setScenarios([{ ...res, id: `${s.id}-custom`, label: s.label }]); setTab('Statistical Analysis'); })
      .catch(swallowCancel);
  }, [run, analysisConfig]);

  const onTimestep = useCallback(() => {
    run('timestep', { k: analysisConfig.k })
      .then(res => { setSensitivity(res); setTab('Statistical Analysis'); })
      .catch(swallowCancel);
  }, [run, analysisConfig.k]);

  const onRepresentative = useCallback(() => {
    run('representative', { k: analysisConfig.k, overrides: REPRESENTATIVE })
      .then(res => { setRepresentative(res); setTab('Graphs'); })
      .catch(swallowCancel);
  }, [run, analysisConfig.k]);

  const isActive = !!visState || !!scenarios || !!calibration;
  const highLoadScenario = scenarios?.find(s => s.pattern === 'High' && s.rho === 0.9)
    ?? (scenarios?.length === 1 ? scenarios[0] : null);

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-status">
          <div className={`status-dot ${isActive ? 'active' : ''}`} />
          <span className="status-label">
            {running ? 'Running simulation…'
              : busy ? `Analysis running… ${progress ? `${progress.done}/${progress.total}` : ''}`
                : isActive ? 'Ready' : 'Ready  ·  ⌘R to run'}
          </span>
          {activeDir && (
            <div className="dir-indicators">
              {DIRS.map(d => (
                <div key={d} className={`dir-dot ${d === activeDir ? 'green' : ''}`}
                  style={d === activeDir ? { background: DIR_COLORS[d], boxShadow: `0 0 4px ${DIR_COLORS[d]}` } : {}} />
              ))}
            </div>
          )}
        </div>
        <span className="byline">Made by Paul Nercessian</span>
      </header>

      <div className="app-body">
        <aside className="sidebar">
          <ControlPanel
            live={live} setLive={setLive}
            onRun={handleRun} onReset={handleReset}
            running={running} busy={busy}
          />
        </aside>

        <main className="main-content">
          <div className="canvas-wrapper" style={{ flex: `0 0 ${canvasHeight}px` }}>
            <div className="canvas-status-bar">
              <span className="canvas-status-text">
                {visState
                  ? 'Optimized System replay  ·  drag to orbit  ·  scroll to zoom'
                  : 'Idle  ·  drag to orbit  ·  scroll to zoom'}
              </span>
              {cycleNum > 0 && <span className="canvas-cycle-badge">Cycle {cycleNum}</span>}
            </div>
            <IntersectionCanvas
              activeDir={activeDir}
              lightStates={lightStates} queueLengths={queueLengths}
              greenCountdown={0} cycleNum={cycleNum} speed={live.speed}
            />
          </div>

          <div className="resize-handle" onMouseDown={onResizeHandleDown}>
            <div className="resize-grip" />
          </div>

          <div className="tabs">
            {TABS.map(t => (
              <button key={t} className={`tab-btn ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
                {t}
              </button>
            ))}
          </div>

          <div className="tab-content">
            {tab === 'Live Run' && (
              <>
                {liveError && <div className="analysis-error">Simulation failed: {liveError}</div>}
                <ResultsDashboard result={liveResult} />
                <GraphPanel result={liveResult} />
              </>
            )}

            {tab === 'Statistical Analysis' && (
              <StatisticalAnalysisPanel
                config={analysisConfig} setConfig={setAnalysisConfig}
                calibration={calibration} scenarios={scenarios}
                sensitivity={sensitivity} representative={representative}
                busy={busy} progress={progress} error={workerError}
                onCalibrate={onCalibrate} onEvaluate={onEvaluate} onScenario={onScenario}
                onTimestep={onTimestep} onRepresentative={onRepresentative} onCancel={cancel}
              />
            )}

            {tab === 'Graphs' && (
              <div className="graph-panel">
                <h3 className="section-title">Graphs</h3>
                {!calibration && !scenarios && !representative && (
                  <p className="tables-placeholder">
                    Run the calibration, the nine-scenario evaluation and the representative run from
                    the Statistical Analysis tab; the graphs are drawn from those computed results.
                  </p>
                )}
                {calibration && <CalibrationChart calibration={calibration} />}
                {scenarios?.length > 0 && <ImprovementChart scenarios={scenarios} />}
                {scenarios?.length === 9 && <ReductionHeatmap scenarios={scenarios} />}
                {representative && <RepresentativeQueueChart representative={representative} />}
                {highLoadScenario && <DifferenceHistogram scenario={highLoadScenario} />}
              </div>
            )}

            {tab === 'Method' && <MathAnalysisPanel />}
          </div>
        </main>
      </div>
    </div>
  );
}
