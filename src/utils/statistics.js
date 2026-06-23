export function mean(arr) {
  if (!arr.length) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

export function stddev(arr) {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  return Math.sqrt(arr.reduce((s, x) => s + (x - m) ** 2, 0) / (arr.length - 1));
}

export function maxOf(arr) {
  return arr.length ? Math.max(...arr) : 0;
}

// 95% CI: mean ± 1.96 * SD / sqrt(n)
export function calculateConfidenceInterval(arr) {
  const m = mean(arr);
  const s = stddev(arr);
  const half = 1.96 * s / Math.sqrt(Math.max(arr.length, 1));
  return { mean: m, lower: m - half, upper: m + half, sd: s };
}

export function calculatePercentageImprovement(baseline, optimised) {
  if (baseline === 0) return 0;
  return ((baseline - optimised) / baseline) * 100;
}
