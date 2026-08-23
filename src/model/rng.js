/**
 * Seeded pseudo-random numbers.
 *
 * 32-bit linear congruential generator:
 *   state = (1664525 × state + 1013904223) mod 2^32
 *   U     = state / 2^32
 *
 * A zero seed is replaced by 1 so the stream never degenerates.
 */

import { DIRS } from './constants.js';

export const LCG_MULTIPLIER = 1664525;
export const LCG_INCREMENT = 1013904223;
export const LCG_MODULUS = 4294967296; // 2^32

/** Per-direction seed offsets: each road gets its own deterministic stream. */
export const DIRECTION_SEED_OFFSETS = {
  N: 0x1a2b3c,
  S: 0x4d5e6f,
  E: 0x7a8b9c,
  W: 0xdeadbe,
};

export function createLcg(seed) {
  let state = seed >>> 0;
  if (state === 0) state = 1;
  return function next() {
    state = (Math.imul(LCG_MULTIPLIER, state) + LCG_INCREMENT) >>> 0;
    return state / LCG_MODULUS;
  };
}

/** Direction stream seed: seed XOR offset, wrapped to 32 unsigned bits. */
export function directionSeed(seed, dir) {
  const offset = DIRECTION_SEED_OFFSETS[dir];
  if (offset === undefined) throw new Error(`Unknown direction: ${dir}`);
  return ((seed >>> 0) ^ offset) >>> 0;
}

/** One independent LCG stream per road, all derived from a single trial seed. */
export function createDirectionRngs(seed) {
  const rngs = {};
  for (const d of DIRS) rngs[d] = createLcg(directionSeed(seed, d));
  return rngs;
}
