/**
 * Fixed model parameters for the IB Mathematics AI HL Internal Assessment model.
 *
 * Every quantity used by the statistical analysis is derived from this object;
 * nothing about the reported results is hard-coded.
 */

export const DIRS = ['N', 'S', 'E', 'W'];

export const MODEL = {
  arrivalHorizon: 3600, // T   — vehicles stop arriving after this time (s)
  dt: 0.5,              // Δt  — simulation time step (s)
  cycleLength: 120,     // C   — signal cycle length (s)
  yellow: 3,            // y   — yellow time after every green (s)
  allRed: 2,            // r   — all-red time after every yellow (s)
  mu: 0.5,              // μ   — saturation service rate while green (veh/s)
  minGreen: 10,         // g_min (s)
  maxGreen: 80,         // g_max (s)
  // Signals keep running after T until all queues clear; this caps runaway runs.
  maxRuntime: 20 * 3600,
};

/** Usable green-time budget:  G = C − 4(y + r) */
export function greenBudget(model = MODEL) {
  return model.cycleLength - 4 * (model.yellow + model.allRed);
}

/** Intersection capacity:  capacity = μG / C  (veh/s) */
export function intersectionCapacity(model = MODEL) {
  return (model.mu * greenBudget(model)) / model.cycleLength;
}

/** Directional demand shares used by the three traffic patterns. */
export const PATTERNS = {
  Balanced: [0.25, 0.25, 0.25, 0.25],
  Moderate: [0.40, 0.25, 0.20, 0.15],
  High: [0.55, 0.25, 0.13, 0.07],
};

export const PATTERN_NAMES = ['Balanced', 'Moderate', 'High'];
export const PATTERN_LABELS = {
  Balanced: 'Balanced',
  Moderate: 'Moderate asymmetry',
  High: 'High asymmetry',
};

export const LOADS = [0.55, 0.75, 0.90];

/** λ_i = share_i × ρ × capacity */
export function lambdasFor(patternName, rho, model = MODEL) {
  const shares = PATTERNS[patternName];
  if (!shares) throw new Error(`Unknown traffic pattern: ${patternName}`);
  const totalLambda = rho * intersectionCapacity(model);
  return shares.map(s => s * totalLambda);
}

/**
 * Directional asymmetry (coefficient of variation of the arrival rates):
 *   A = sqrt[(1/4) Σ (λ_i − λ̄)²] / λ̄
 */
export function directionalAsymmetry(lambdas) {
  const m = lambdas.reduce((a, b) => a + b, 0) / lambdas.length;
  if (m === 0) return 0;
  const variance = lambdas.reduce((s, x) => s + (x - m) ** 2, 0) / lambdas.length;
  return Math.sqrt(variance) / m;
}

/** Default calibrated smoothing horizon k (s). Overwritten by calibration mode. */
export const DEFAULT_K = 480;

/** k values tested by the calibration mode. */
export const K_GRID = [0, 5, 10, 20, 40, 80, 120, 180, 240, 360, 480, 720, 960, 1440];

/** The nine evaluation scenarios, in the required order. */
export const SCENARIOS = PATTERN_NAMES.flatMap(pattern =>
  LOADS.map(rho => ({ pattern, rho })),
).map((s, i) => ({
  index: i,
  id: `${s.pattern}-${s.rho}`,
  pattern: s.pattern,
  rho: s.rho,
  label: `${PATTERN_LABELS[s.pattern]}, ρ = ${s.rho.toFixed(2)}`,
  // Scenario i uses seedBase = 10,000,000 + i × 1,000,000
  seedBase: 10_000_000 + i * 1_000_000,
  lambdas: lambdasFor(s.pattern, s.rho),
}));

/** Calibration training scenarios: ρ = 0.75 only, separate seed bases. */
export const CALIBRATION_SCENARIOS = [
  { pattern: 'Balanced', rho: 0.75, seedBase: 110_000 },
  { pattern: 'Moderate', rho: 0.75, seedBase: 1_110_000 },
  { pattern: 'High', rho: 0.75, seedBase: 2_110_000 },
].map(s => ({ ...s, id: `${s.pattern}-${s.rho}`, lambdas: lambdasFor(s.pattern, s.rho) }));

export const CALIBRATION_TRIALS = 60;
export const EVALUATION_TRIALS = 250;

/** Time-step sensitivity study. */
export const TIMESTEP_GRID = [1.0, 0.5, 0.25];
export const TIMESTEP_SEED_BASE = 77_000_000;
export const TIMESTEP_TRIALS = 80;
export const TIMESTEP_SCENARIO = { pattern: 'High', rho: 0.90 };

/** Representative single run used for the queue-history graph. */
export const REPRESENTATIVE = { pattern: 'High', rho: 0.90, seed: 42 };

/** Trial j of a scenario uses seed = seedBase + j × 31337. */
export const TRIAL_SEED_STRIDE = 31337;

export function trialSeed(seedBase, j) {
  return seedBase + j * TRIAL_SEED_STRIDE;
}
