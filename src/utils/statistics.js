/**
 * Statistics helpers.
 *
 * The paired design compares the two systems on identical traffic, so every
 * interval and test here is built from the per-trial differences
 *   d_j = W_Equal,j − W_Optimized,j
 * and uses the Student t critical value with n − 1 degrees of freedom
 * (never a fixed 1.96).
 */

export function mean(values) {
  if (!values.length) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/** Sample standard deviation, divisor n − 1. */
export function sampleSD(values) {
  const n = values.length;
  if (n < 2) return 0;
  const m = mean(values);
  return Math.sqrt(values.reduce((s, x) => s + (x - m) ** 2, 0) / (n - 1));
}

/** Population standard deviation, divisor n — used for the fairness statistic F. */
export function populationSD(values) {
  const n = values.length;
  if (n === 0) return 0;
  const m = mean(values);
  return Math.sqrt(values.reduce((s, x) => s + (x - m) ** 2, 0) / n);
}

// ── Regularised incomplete beta function (Lentz continued fraction) ──────────
const SQRT_2PI = Math.sqrt(2 * Math.PI);

function logGamma(x) {
  const c = [
    76.18009172947146, -86.50532032941678, 24.01409824083091,
    -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5,
  ];
  let y = x;
  let tmp = x + 5.5;
  tmp -= (x + 0.5) * Math.log(tmp);
  let ser = 1.0000000001900149;
  for (let j = 0; j < 6; j++) ser += c[j] / ++y;
  return -tmp + Math.log((SQRT_2PI * ser) / x);
}

function betaContinuedFraction(a, b, x) {
  const FPMIN = 1e-300;
  const qab = a + b;
  const qap = a + 1;
  const qam = a - 1;
  let c = 1;
  let d = 1 - (qab * x) / qap;
  if (Math.abs(d) < FPMIN) d = FPMIN;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= 300; m++) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    h *= d * c;
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < 3e-16) break;
  }
  return h;
}

/** I_x(a, b) */
export function incompleteBeta(a, b, x) {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const front = Math.exp(
    logGamma(a + b) - logGamma(a) - logGamma(b) + a * Math.log(x) + b * Math.log(1 - x),
  );
  if (x < (a + 1) / (a + b + 2)) return (front * betaContinuedFraction(a, b, x)) / a;
  return 1 - (front * betaContinuedFraction(b, a, 1 - x)) / b;
}

/** Two-sided tail probability P(|T_ν| ≥ |t|). */
export function studentTTwoSidedP(t, df) {
  if (df <= 0) return Number.NaN;
  if (!Number.isFinite(t)) return 0;
  const x = df / (df + t * t);
  return incompleteBeta(df / 2, 0.5, x);
}

/**
 * Student t critical value t_(1−α/2, ν), found by bisection on the two-sided
 * tail probability. No table lookup and no normal approximation.
 */
export function tCritical(df, confidence = 0.95) {
  if (df <= 0) return Number.NaN;
  const alpha = 1 - confidence;
  let lo = 0;
  let hi = 1000;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    if (studentTTwoSidedP(mid, df) > alpha) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/**
 * One-sample t interval and test for a set of values (used on the paired
 * differences d_j and on the per-trial percentage reductions r_j).
 */
export function tIntervalStats(values, confidence = 0.95) {
  const n = values.length;
  const m = mean(values);
  const sd = sampleSD(values);
  const df = n - 1;
  const se = n > 0 ? sd / Math.sqrt(n) : 0;
  const tCrit = df > 0 ? tCritical(df, confidence) : Number.NaN;
  const half = df > 0 ? tCrit * se : Number.NaN;
  const tStat = se > 0 ? m / se : (m === 0 ? 0 : Number.POSITIVE_INFINITY * Math.sign(m));
  return {
    n,
    mean: m,
    sd,
    se,
    df,
    tCritical: tCrit,
    lower: m - half,
    upper: m + half,
    tStat,
    pValue: df > 0 ? studentTTwoSidedP(tStat, df) : Number.NaN,
  };
}

/**
 * Paired analysis of two matched samples.
 * d_j = equal_j − optimized_j  (positive ⇒ the Optimized System did better)
 */
export function pairedStats(equalValues, optimizedValues, confidence = 0.95) {
  if (equalValues.length !== optimizedValues.length) {
    throw new Error('Paired samples must have the same length');
  }
  const diffs = equalValues.map((e, i) => e - optimizedValues[i]);
  return { ...tIntervalStats(diffs, confidence), diffs };
}

/** Per-trial percentage reduction r_j = 100(W_E − W_O)/W_E. */
export function percentageReductions(equalValues, optimizedValues) {
  return equalValues.map((e, i) => (e === 0 ? 0 : (100 * (e - optimizedValues[i])) / e));
}

/** Interpretation of a percentage-reduction confidence interval. */
export function interpretInterval({ lower, upper }) {
  if (!Number.isFinite(lower) || !Number.isFinite(upper)) return 'unavailable';
  if (lower > 0) return 'better';
  if (upper < 0) return 'worse';
  return 'inconclusive';
}

export const INTERVAL_TEXT = {
  better:
    'The 95% interval lies entirely above 0%, so the Optimized System reduced waiting time.',
  inconclusive:
    'The 95% interval contains 0%, so there is no statistically clear difference between the systems.',
  worse:
    'The 95% interval lies entirely below 0%, so the Optimized System performed worse.',
  unavailable: 'Not enough trials to form an interval.',
};
