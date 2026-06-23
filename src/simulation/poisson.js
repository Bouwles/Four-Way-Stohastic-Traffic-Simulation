// Poisson arrival process: P(X=k) = e^(-λt)(λt)^k / k!
// Inter-arrival times: T ~ Exponential(λ), f(t) = λe^(-λt)

/**
 * Seeded LCG random number generator.
 * Returns a function that produces uniform [0,1) values deterministically.
 */
export function createSeededRng(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/**
 * Exponential random variate via inverse-CDF: T = -ln(U)/λ
 * Models inter-arrival time between consecutive vehicles.
 */
export function exponentialRandom(lambda, rng) {
  const u = rng();
  return -Math.log(1 - u + 1e-12) / lambda;
}

/**
 * Poisson random variate via Knuth algorithm.
 * Returns number of arrivals in time interval t given rate lambda.
 * P(X=k) = e^(-λt)(λt)^k / k!
 */
export function poissonRandom(lambda, t, rng) {
  const L = Math.exp(-lambda * t);
  let k = 0;
  let p = 1;
  do {
    k++;
    p *= rng();
  } while (p > L);
  return k - 1;
}

/**
 * Poisson PMF: probability of exactly k arrivals.
 */
export function poissonPMF(k, lambda, t) {
  const lt = lambda * t;
  let logP = -lt + k * Math.log(lt + 1e-300);
  for (let i = 1; i <= k; i++) logP -= Math.log(i);
  return Math.exp(logP);
}

/**
 * Generate all inter-arrival events up to duration T.
 * Returns array of arrival timestamps for one direction.
 */
export function generateArrivalTimes(lambda, duration, rng) {
  const arrivals = [];
  let t = exponentialRandom(lambda, rng);
  while (t <= duration) {
    arrivals.push(t);
    t += exponentialRandom(lambda, rng);
  }
  return arrivals;
}
