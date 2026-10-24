// VN Museum — collision + camera.
// Zones (x, z), all in metres, matching the geometry in museum.js:
//   PLAZA    x -12..12,  z  1.2..24   (exterior forecourt)
//   INTERIOR x  -9..9,   z -32..-0.6  (grand lobby z -12..-0.6 + central hall z -32..-12, open plan)
//   WEST     x -18..-9,  z -28..-12   (side gallery, opening at z -22..-19 in the x=-9 wall)
//   EAST     x   9..18,  z -28..-12   (side gallery, opening at z -22..-19 in the x=+9 wall)
//   DOOR     x  -1.5..1.5, z -0.6..1.2 (entrance corridor — only when unlocked AND doors open)
//
// Side-gallery walls are enforced by gate checks in resolveMove: a move
// that crosses x=-9 or x=+9 inside the side-gallery z-range is blocked
// unless z is inside the real opening. This keeps the collision passage
// exactly aligned with the opening in the geometry — no invisible
// barrier across an open doorway, and no walking through a solid wall.
import * as THREE from 'three';
import { clamp, smoothAngle } from './lib.js';

export const PLAZA = { x0: -12, x1: 12, z0: 1.2, z1: 24, ceil: 99 };
export const INTERIOR = { x0: -9, x1: 9, z0: -32, z1: -0.6, ceil: 7 };
export const WEST = { x0: -18, x1: -9, z0: -28, z1: -12, ceil: 4.5 };
export const EAST = { x0: 9, x1: 18, z0: -28, z1: -12, ceil: 4.5 };
export const DOOR = { x0: -1.5, x1: 1.5, z0: -0.6, z1: 1.2 };
export const WEST_OPEN = { z0: -22, z1: -19 };
export const EAST_OPEN = { z0: -22, z1: -19 };

export const OBSTACLES = [
  { x: 0, z: -24.5, r: 1.5 },
  { x: 0, z: -30.2, r: 1.2 },
  { x: -4, z: -14, r: 0.85 },
  { x: 4, z: -14, r: 0.85 },
  { x: -6, z: -6, r: 0.5 },
  { x: 6, z: -6, r: 0.5 },
  { x: -6, z: -20, r: 0.5 },
  { x: 6, z: -20, r: 0.5 },
  { x: -13.5, z: -20, r: 0.75 },
  { x: 13.5, z: -20, r: 0.75 },
  { x: -4, z: 8, r: 0.5 },
  { x: 4, z: 8, r: 0.5 },
  { x: -10, z: 18, r: 0.9 },
  { x: 10, z: 18, r: 0.9 },
];

function inRect(x, z, r) {
  return x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1;
}
export function zoneFor(x, z) {
  if (inRect(x, z, WEST)) return WEST;
  if (inRect(x, z, EAST)) return EAST;
  if (inRect(x, z, INTERIOR)) return INTERIOR;
  if (inRect(x, z, PLAZA)) return PLAZA;
  return null;
}
// doorOpen: 0 = closed, 1 = fully open. The entrance corridor is only
// walkable once the doors are more than half open, so the player never
// walks through a visibly closed door panel.
export function isWalkable(x, z, unlocked, doorOpen = 1) {
  if (inRect(x, z, INTERIOR)) return true;
  if (inRect(x, z, PLAZA)) return true;
  if (inRect(x, z, WEST)) return true;
  if (inRect(x, z, EAST)) return true;
  if (unlocked && doorOpen > 0.55 && inRect(x, z, DOOR)) return true;
  return false;
}
function crossesGate(prevX, nextX, wallX, z, open) {
  if (z < -28 || z > -12) return false;
  if (z >= open.z0 && z <= open.z1) return false;
  return (prevX < wallX && nextX >= wallX) || (prevX > wallX && nextX <= wallX);
}
export function resolveMove(prev, next, unlocked, out, doorOpen = 1) {
  let x = prev.x, z = prev.z;
  if (!crossesGate(prev.x, next.x, -9, prev.z, WEST_OPEN) && !crossesGate(prev.x, next.x, 9, prev.z, EAST_OPEN)) {
    if (isWalkable(next.x, z, unlocked, doorOpen)) x = next.x;
  }
  if (isWalkable(x, next.z, unlocked, doorOpen)) z = next.z;
  for (const o of OBSTACLES) {
    const dx = x - o.x, dz = z - o.z, d2 = dx * dx + dz * dz;
    if (d2 < o.r * o.r) {
      if (d2 > 1e-6) {
        const d = Math.sqrt(d2);
        x = o.x + (dx / d) * o.r; z = o.z + (dz / d) * o.r;
      } else {
        // Exactly on the centre (e.g. a teleport landing there): push
        // out toward the entrance side instead of staying trapped.
        x = o.x; z = o.z + o.r;
      }
    }
  }
  if (!isWalkable(x, z, unlocked, doorOpen)) { x = prev.x; z = prev.z; }
  out.set(x, 0, z);
  return out;
}

// Third-person camera: exponential smoothing, clamped to the player's
// current zone so it does not clip through gallery walls, with a focus
// mode for exhibit viewing that eases back to follow mode afterwards.
export class ThirdPersonCamera {
  constructor(camera) {
    this.camera = camera;
    this.yaw = Math.PI; this.pitch = 0.22; this.dist = 4.8;
    this.pos = new THREE.Vector3(0, 3, 14);
    this.look = new THREE.Vector3(0, 1.6, 0);
    this.focus = null;
    this.calm = false;
  }
  setFocus(pos, look) { this.focus = { pos: pos.clone(), look: look.clone(), t: 0 }; }
  clearFocus() { this.focus = null; }
  update(dt, targetPos, inside) {
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
    const zone = zoneFor(targetPos.x, targetPos.z);
    if (zone) {
      desired.x = clamp(desired.x, zone.x0 + 0.35, zone.x1 - 0.35);
      desired.z = clamp(desired.z, zone.z0 + 0.4, zone.z1 - 0.4);
      if (zone.ceil < 90) desired.y = Math.min(desired.y, zone.ceil - 0.4);
    } else {
      desired.x = clamp(desired.x, -18, 18);
      desired.z = clamp(desired.z, -32, 24);
    }
    desired.y = Math.max(desired.y, 0.6);
    const bp = 1 - Math.exp(-7.5 * dt);
    const bl = 1 - Math.exp(-9.5 * dt);
    this.pos.lerp(desired, bp);
    this.look.lerp(new THREE.Vector3(targetPos.x, targetPos.y + 1.15, targetPos.z), bl);
    this.camera.position.copy(this.pos);
    this.camera.lookAt(this.look);
    void inside;
  }
  applyLook(dx, dy, sensitivity = 0.0055) {
    this.yaw -= dx * sensitivity;
    this.pitch = clamp(this.pitch + dy * sensitivity * 0.8, -0.15, 0.9);
  }
  get yawAngle() { return this.yaw; }
}
export { smoothAngle };
