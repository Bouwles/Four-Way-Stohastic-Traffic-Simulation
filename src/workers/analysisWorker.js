/**
 * Web Worker running the heavy statistical analyses off the main thread so the
 * page stays responsive during 250-trial evaluations.
 *
 * Cancellation is handled by the main thread terminating the worker.
 */

import {
  runAllScenarios, runCalibration, runTimeStepSensitivity, runRepresentative, runPairedScenario,
} from '../model/evaluation.js';
import { DEFAULT_K } from '../model/constants.js';

const PROGRESS_INTERVAL_MS = 80;
let lastProgress = 0;

function progress(done, total, label) {
  const now = Date.now();
  if (now - lastProgress < PROGRESS_INTERVAL_MS && done < total) return;
  lastProgress = now;
  self.postMessage({ type: 'progress', done, total, label });
}

self.onmessage = (event) => {
  const { id, task, payload = {} } = event.data;
  const k = payload.k ?? DEFAULT_K;
  try {
    let result;
    switch (task) {
      case 'calibrate':
        result = runCalibration({ trials: payload.trials, onProgress: progress });
        break;
      case 'evaluate':
        result = runAllScenarios({ trials: payload.trials, k, onProgress: progress });
        break;
      case 'scenario':
        result = runPairedScenario({
          pattern: payload.pattern,
          rho: payload.rho,
          seedBase: payload.seedBase,
          trials: payload.trials,
          k,
          onProgress: progress,
        });
        break;
      case 'timestep':
        result = runTimeStepSensitivity({ k, trials: payload.trials, onProgress: progress });
        break;
      case 'representative':
        // history is kept: the queue-history graph and CSV both need it
        result = runRepresentative({ k, ...payload.overrides });
        break;
      default:
        throw new Error(`Unknown analysis task: ${task}`);
    }
    self.postMessage({ type: 'done', id, task, result });
  } catch (error) {
    self.postMessage({ type: 'error', id, task, message: error?.message ?? String(error) });
  }
};
