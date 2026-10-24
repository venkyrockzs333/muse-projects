// Pure, allocation-free helpers. Kept dependency-free so the movement
// math can be unit-tested without Three.js or a browser.
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
// Shortest-arc angle lerp factor: returns the new angle after moving
// `cur` toward `target` by at most `rate * dt` in angular speed terms
// when used with exp smoothing, use smoothAngle below instead.
export function smoothAngle(cur, target, dt, k) {
  let d = target - cur;
  d = Math.atan2(Math.sin(d), Math.cos(d));
  return cur + d * (1 - Math.exp(-k * dt));
}
export function expBlend(dt, k) { return 1 - Math.exp(-k * dt); }
// Input: raw x/y in [-1,1]. Dead-zone remap + clamp to unit circle so
// diagonal input never moves faster than straight input.
export function normalizeInput(x, y, dead = 0.18) {
  const len = Math.hypot(x, y);
  if (len <= dead) return { x: 0, y: 0, mag: 0 };
  const mag = Math.min(1, (len - dead) / (1 - dead));
  // Divide by the true length (not a clamped length): a diagonal
  // (1,1) input must come out at length 1, not sqrt(2).
  return { x: (x / len) * mag, y: (y / len) * mag, mag };
}
// Velocity step: exponential approach to desired velocity. Frame-rate
// independent because the blend factor is derived from dt, not frames.
export function stepVelocity(vx, vz, dx, dz, dt, accel, brake) {
  const hasInput = dx !== 0 || dz !== 0;
  const k = hasInput ? accel : brake;
  const b = expBlend(dt, k);
  return [vx + (dx - vx) * b, vz + (dz - vz) * b];
}
// Simple performance monitor: ring buffer of frame times.
export class PerfMonitor {
  constructor(size = 240) {
    this.buf = new Float32Array(size);
    this.i = 0; this.n = 0; this.dropped = 0;
    this.checkAt = performance.now() + 2500;
    this.avg = 16;
  }
  sample(dtMs) {
    this.buf[this.i] = dtMs; this.i = (this.i + 1) % this.buf.length;
    if (this.n < this.buf.length) this.n++;
    if (dtMs > 33.3) this.dropped++;
  }
  stats() {
    if (!this.n) return { median: 0, p95: 0, avg: 0, dropped: this.dropped, fps: 0 };
    const arr = Array.from(this.buf.slice(0, this.n)).sort((a, b) => a - b);
    const median = arr[Math.floor(arr.length / 2)];
    const p95 = arr[Math.floor(arr.length * 0.95)] || arr[arr.length - 1];
    const avg = arr.reduce((s, v) => s + v, 0) / arr.length;
    return { median, p95, avg, dropped: this.dropped, fps: avg > 0 ? 1000 / avg : 0 };
  }
  // Returns true when a sustained slow window just ended.
  slowWindow(now) {
    if (now < this.checkAt) return false;
    this.checkAt = now + 2500;
    const s = this.stats();
    this.avg = s.avg;
    return s.avg > 24;
  }
}
