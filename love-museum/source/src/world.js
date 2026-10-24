// Collision + camera helpers. Collision uses simple, visible geometry:
// two rectangles (courtyard + gallery) joined by a doorway corridor,
// plus push-out circles for benches / pedestals. No per-triangle tests.
import * as THREE from 'three';
import { clamp, smoothAngle } from './lib.js';

// Walkable zones (x, z). Gallery is z -32..-0.6, courtyard z 1.2..14.
const GALLERY = { x0: -4.6, x1: 4.6, z0: -31.4, z1: -0.6 };
const COURT = { x0: -9, x1: 9, z0: 1.2, z1: 14 };
const DOOR = { x0: -1.1, x1: 1.1, z0: -0.6, z1: 1.2 };
export const OBSTACLES = [
  // bench in the dedication area (radius keeps characters off the seat mesh)
  { x: 0, z: -24.5, r: 1.5 },
  // focal pedestal / dedication plinth
  { x: 0, z: -30.2, r: 1.2 },
];
function inRect(x, z, r) {
  return x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1;
}
export function isWalkable(x, z, unlocked) {
  if (inRect(x, z, GALLERY)) return true;
  if (inRect(x, z, COURT)) return true;
  if (unlocked && inRect(x, z, DOOR)) return true;
  return false;
}
// Resolve a proposed move axis-by-axis (slide along walls), then push
// out of obstacle circles. Returns into `out` (a THREE.Vector3, y ignored).
export function resolveMove(prev, next, unlocked, out) {
  let x = prev.x, z = prev.z;
  if (isWalkable(next.x, z, unlocked)) x = next.x;
  if (isWalkable(x, next.z, unlocked)) z = next.z;
  for (const o of OBSTACLES) {
    const dx = x - o.x, dz = z - o.z, d2 = dx * dx + dz * dz;
    if (d2 < o.r * o.r && d2 > 1e-6) {
      const d = Math.sqrt(d2);
      x = o.x + (dx / d) * o.r; z = o.z + (dz / d) * o.r;
    }
  }
  // If the push-out landed outside a zone, fall back to previous spot.
  if (!isWalkable(x, z, unlocked)) { x = prev.x; z = prev.z; }
  out.set(x, 0, z);
  return out;
}

// Third-person camera: exponential (frame-rate independent) smoothing,
// clamped so it never goes through gallery walls, with a focus mode
// for exhibit viewing that eases back to follow mode afterwards.
export class ThirdPersonCamera {
  constructor(camera) {
    this.camera = camera;
    this.yaw = Math.PI; this.pitch = 0.22; this.dist = 4.8;
    this.pos = new THREE.Vector3(0, 3, 14);
    this.look = new THREE.Vector3(0, 1.6, 0);
    this.focus = null; // {pos, look, t}
    this.calm = false;
  }
  setFocus(pos, look) { this.focus = { pos: pos.clone(), look: look.clone(), t: 0 }; }
  clearFocus() { this.focus = null; }
  update(dt, targetPos, inside) {
    const sens = this.calm ? 0.5 : 1;
    void sens;
    if (this.focus) {
      const b = 1 - Math.exp(-4 * dt);
      this.pos.lerp(this.focus.pos, b);
      this.look.lerp(this.focus.look, b);
      this.camera.position.copy(this.pos);
      this.camera.lookAt(this.look);
      return;
    }
    const cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
    const desired = new THREE.Vector3(
      targetPos.x + Math.sin(this.yaw) * cp * this.dist,
      targetPos.y + 1.35 + sp * this.dist,
      targetPos.z + Math.cos(this.yaw) * cp * this.dist
    );
    // Keep the camera out of walls: clamp inside the current zone.
    if (inside) {
      desired.x = clamp(desired.x, GALLERY.x0 + 0.35, GALLERY.x1 - 0.35);
      desired.z = clamp(desired.z, GALLERY.z0 + 0.4, GALLERY.z1 + 0.4);
      desired.y = Math.min(desired.y, 4.6);
      // Don't let the camera sit behind the far wall when the player
      // is near a side wall: pull it forward instead of clipping.
      if (desired.z > -0.75 && Math.abs(targetPos.x) > 1.4 && targetPos.z < -0.5) desired.z = -0.75;
    } else {
      desired.x = clamp(desired.x, COURT.x0 - 2, COURT.x1 + 2);
      desired.z = clamp(desired.z, COURT.z0 - 2, COURT.z1 + 4);
    }
    desired.y = Math.max(desired.y, 0.6);
    const bp = 1 - Math.exp(-7.5 * dt);
    const bl = 1 - Math.exp(-9.5 * dt);
    this.pos.lerp(desired, bp);
    this.look.lerp(new THREE.Vector3(targetPos.x, targetPos.y + 1.15, targetPos.z), bl);
    this.camera.position.copy(this.pos);
    this.camera.lookAt(this.look);
  }
  applyLook(dx, dy, sensitivity = 0.0055) {
    this.yaw -= dx * sensitivity;
    this.pitch = clamp(this.pitch + dy * sensitivity * 0.8, -0.15, 0.9);
  }
  // Facing direction for camera-relative movement: yaw of camera.
  get yawAngle() { return this.yaw; }
}
export { smoothAngle };
