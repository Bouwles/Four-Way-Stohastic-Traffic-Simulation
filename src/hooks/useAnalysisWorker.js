import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Runs the analysis tasks in a Web Worker so the interface stays responsive.
 * "Cancel" terminates the worker; the next run spawns a fresh one.
 */
export function useAnalysisWorker() {
  const workerRef = useRef(null);
  const pendingRef = useRef(null);
  const idRef = useRef(0);
  const [progress, setProgress] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const disposeWorker = useCallback(() => {
    if (workerRef.current) {
      workerRef.current.terminate();
      workerRef.current = null;
    }
  }, []);

  useEffect(() => () => disposeWorker(), [disposeWorker]);

  const run = useCallback((task, payload = {}) => {
    if (pendingRef.current) return Promise.reject(new Error('An analysis is already running'));
    setError(null);
    setBusy(true);
    setProgress({ done: 0, total: 1, label: 'Starting…', task });

    if (!workerRef.current) {
      workerRef.current = new Worker(new URL('../workers/analysisWorker.js', import.meta.url), {
        type: 'module',
      });
      workerRef.current.onmessage = (event) => {
        const msg = event.data;
        if (msg.type === 'progress') {
          setProgress({ done: msg.done, total: msg.total, label: msg.label, task: pendingRef.current?.task });
          return;
        }
        const pending = pendingRef.current;
        pendingRef.current = null;
        setBusy(false);
        setProgress(null);
        if (!pending) return;
        if (msg.type === 'error') {
          setError(msg.message);
          pending.reject(new Error(msg.message));
        } else {
          pending.resolve(msg.result);
        }
      };
      workerRef.current.onerror = (event) => {
        const pending = pendingRef.current;
        pendingRef.current = null;
        setBusy(false);
        setProgress(null);
        const message = event.message || 'Analysis worker failed';
        setError(message);
        if (pending) pending.reject(new Error(message));
      };
    }

    const id = ++idRef.current;
    return new Promise((resolve, reject) => {
      pendingRef.current = { resolve, reject, task };
      workerRef.current.postMessage({ id, task, payload });
    });
  }, []);

  const cancel = useCallback(() => {
    const pending = pendingRef.current;
    pendingRef.current = null;
    disposeWorker();
    setBusy(false);
    setProgress(null);
    if (pending) pending.reject(new Error('cancelled'));
  }, [disposeWorker]);

  return { run, cancel, busy, progress, error };
}
