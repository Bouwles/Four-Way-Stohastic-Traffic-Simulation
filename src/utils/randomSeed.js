import { createSeededRng } from '../simulation/poisson.js';

export function makeRngs(seed) {
  return {
    N: createSeededRng(seed ^ 0x1a2b3c),
    S: createSeededRng(seed ^ 0x4d5e6f),
    E: createSeededRng(seed ^ 0x7a8b9c),
    W: createSeededRng(seed ^ 0xdeadbe),
  };
}

export function makeRng(seed) {
  return createSeededRng(seed);
}
