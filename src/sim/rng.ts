/**
 * Deterministic PRNG. All stochastic seed steps MUST go through this.
 * Sampling uses integer arithmetic; the only float is the [0,1) helper
 * for non-money draws, and even that is derived from a uint32.
 */

export class Rng {
  private s: number;

  constructor(seed: number) {
    if (!Number.isInteger(seed)) {
      throw new Error(`RNG seed must be an integer, got ${seed}`);
    }
    this.s = seed >>> 0;
    if (this.s === 0) this.s = 0x9e3779b9;
  }

  /** xorshift32 */
  uint32(): number {
    let x = this.s;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    this.s = x >>> 0;
    return this.s;
  }

  /** Inclusive integer range. */
  int(min: number, max: number): number {
    if (!Number.isInteger(min) || !Number.isInteger(max) || max < min) {
      throw new Error(`invalid int range [${min}, ${max}]`);
    }
    const span = max - min + 1;
    return min + (this.uint32() % span);
  }

  /** True with probability pBps / 10000. */
  bool(pBps: number): boolean {
    if (!Number.isInteger(pBps) || pBps < 0 || pBps > 10000) {
      throw new Error(`pBps must be integer 0..10000, got ${pBps}`);
    }
    return this.uint32() % 10000 < pBps;
  }

  pick<T>(arr: readonly T[]): T {
    if (arr.length === 0) throw new Error("pick() on empty array");
    return arr[this.uint32() % arr.length] as T;
  }

  /** Integer weights. */
  weighted<T>(items: readonly (readonly [T, number])[]): T {
    let total = 0;
    for (const [, w] of items) {
      if (!Number.isInteger(w) || w < 0) throw new Error(`bad weight ${w}`);
      total += w;
    }
    if (total <= 0) throw new Error("weighted() total weight must be > 0");
    let ticket = this.uint32() % total;
    for (const [item, w] of items) {
      if (ticket < w) return item;
      ticket -= w;
    }
    return items[items.length - 1]![0];
  }

  shuffle<T>(arr: T[]): T[] {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = this.uint32() % (i + 1);
      const tmp = a[i]!;
      a[i] = a[j]!;
      a[j] = tmp;
    }
    return a;
  }

  /** Zero-padded sequential-looking id with a random-looking suffix from this stream. */
  hex(n = 8): string {
    let out = "";
    while (out.length < n) {
      out += this.uint32().toString(16).padStart(8, "0");
    }
    return out.slice(0, n);
  }
}

export function pad(n: number, width: number): string {
  return n.toString().padStart(width, "0");
}
