// Two stylized human characters, built as a proper joint hierarchy
// (hips -> spine -> chest -> neck -> head; shoulders -> arms;
// hips -> thighs -> shins -> feet) so every pose is a joint pose,
// not a mesh swap. Animation is a state machine with pose blending:
// each frame computes a target pose for the current state and eases
// every joint toward it, so walk -> stop -> sit -> dance never snaps.
//
// Why procedural here, honestly: the free licensed GLBs checked in
// Phase 1b (Soldier: Idle/Walk/Run only; Xbot: robot; CesiumMan: no
// animations) cannot deliver a male+female couple with sit, dance and
// look-at-photo clips. These characters do, in one consistent style,
// at a fraction of the draw / download cost. If the owner later
// supplies a Mixamo / Ready Player Me pair, only this file's builder
// needs to change — the state names (idle/walk/run/sit/dance/look)
// are the public interface main.js uses.
import * as THREE from 'three';
import { clamp, smoothAngle } from './lib.js';

function mat(color, rough = 0.75) {
  return new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0.05 });
}
function capsule(r, len, material) {
  const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 4, 12), material);
  m.castShadow = false;
  return m;
}
function limb(parent, x, y, z, r, len, material) {
  const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g);
  const m = capsule(r, len, material); m.position.y = -len / 2; g.add(m);
  return g;
}

export class Human {
  constructor(opts) {
    const o = Object.assign({
      skin: 0xe8b48c, hair: 0x2b1d16, hairStyle: 'short',
      top: 0x7a1f2b, bottom: 0x2e2a26, shoes: 0x1d1712,
      height: 1.72, female: false, name: 'person',
    }, opts);
    this.name = o.name; this.female = o.female;
    this.root = new THREE.Group();
    this.root.scale.setScalar(o.height / 1.72);
    const skin = mat(o.skin), top = mat(o.top, 0.85), bottom = mat(o.bottom, 0.85),
      shoe = mat(o.shoes, 0.6), hairM = mat(o.hair, 0.95);
    // Hips / pelvis
    this.hips = new THREE.Group(); this.hips.position.y = 0.90; this.root.add(this.hips);
    const pelvis = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 12), bottom);
    pelvis.scale.set(1.15, 0.7, 0.8); this.hips.add(pelvis);
    // Spine -> chest
    this.spine = new THREE.Group(); this.spine.position.y = 0.08; this.hips.add(this.spine);
    const torso = capsule(0.155, 0.32, top); torso.position.y = 0.24; this.spine.add(torso);
    if (o.female) {
      const skirt = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.24, 0.28, 16), top);
      skirt.position.y = -0.02; this.spine.add(skirt);
    }
    this.chest = new THREE.Group(); this.chest.position.y = 0.42; this.spine.add(this.chest);
    // Neck + head
    this.neck = new THREE.Group(); this.neck.position.y = 0.14; this.chest.add(this.neck);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.125, 20, 16), skin);
    head.scale.set(0.92, 1.08, 0.95); head.position.y = 0.14; this.neck.add(head);
    // Face: eyes + brows (simple, readable at gallery distance)
    const eyeM = mat(0x1a1210, 0.4);
    for (const s of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.016, 8, 8), eyeM);
      eye.position.set(s * 0.048, 0.15, 0.115); this.neck.add(eye);
    }
    // Hair
    if (o.hairStyle === 'long') {
      const hair = new THREE.Mesh(new THREE.SphereGeometry(0.135, 16, 12), hairM);
      hair.scale.set(1.0, 1.15, 1.0); hair.position.set(0, 0.17, -0.025); this.neck.add(hair);
      const tail = capsule(0.055, 0.3, hairM); tail.position.set(0, -0.05, -0.14); tail.rotation.x = 0.15; this.neck.add(tail);
    } else if (o.hairStyle === 'bun') {
      const hair = new THREE.Mesh(new THREE.SphereGeometry(0.132, 16, 12), hairM);
      hair.scale.set(1.0, 1.05, 1.0); hair.position.set(0, 0.18, -0.015); this.neck.add(hair);
      const bun = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 10), hairM);
      bun.position.set(0, 0.24, -0.13); this.neck.add(bun);
    } else {
      const hair = new THREE.Mesh(new THREE.SphereGeometry(0.13, 16, 12), hairM);
      hair.scale.set(1.0, 0.85, 1.0); hair.position.set(0, 0.185, -0.01); this.neck.add(hair);
    }
    // Arms
    this.armL = this._arm(-1, skin, top); this.armR = this._arm(1, skin, top);
    // Legs
    this.legL = this._leg(-1, bottom, shoe); this.legR = this._leg(1, bottom, shoe);
    // Blob contact shadow (cheap, always correct — no shadow-map cost)
    const shadowTex = (() => {
      const c = document.createElement('canvas'); c.width = c.height = 128;
      const g = c.getContext('2d');
      const gr = g.createRadialGradient(64, 64, 4, 64, 64, 62);
      gr.addColorStop(0, 'rgba(0,0,0,0.45)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
      const t = new THREE.CanvasTexture(c); return t;
    })();
    this.shadow = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 1.0),
      new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }));
    this.shadow.rotation.x = -Math.PI / 2; this.shadow.position.y = 0.02;
    // Joint registry for pose blending
    this.j = {
      hips: this.hips, spine: this.spine, chest: this.chest, neck: this.neck,
      shoulderL: this.armL.shoulder, elbowL: this.armL.elbow,
      shoulderR: this.armR.shoulder, elbowR: this.armR.elbow,
      hipL: this.legL.hip, kneeL: this.legL.knee, footL: this.legL.foot,
      hipR: this.legR.hip, kneeR: this.legR.knee, footR: this.legR.foot,
    };
    this.state = 'idle'; this.speed = 0; this.phase = 0;
    this.yaw = 0; this.lookTarget = null; this.danceT = 0; this.t = Math.random() * 10;
    this._pose = {}; // current eased pose values
    for (const k of Object.keys(this.j)) this._pose[k] = { x: 0, y: 0, z: 0 };
  }
  _arm(side, skin, top) {
    const shoulder = new THREE.Group(); shoulder.position.set(side * 0.21, 0.02, 0); this.chest.add(shoulder);
    const upper = capsule(0.05, 0.24, top); upper.position.y = -0.14; shoulder.add(upper);
    const elbow = new THREE.Group(); elbow.position.y = -0.28; shoulder.add(elbow);
    const fore = capsule(0.042, 0.22, skin); fore.position.y = -0.13; elbow.add(fore);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), skin);
    hand.position.y = -0.28; elbow.add(hand);
    return { shoulder, elbow };
  }
  _leg(side, bottom, shoe) {
    const hip = new THREE.Group(); hip.position.set(side * 0.1, -0.02, 0); this.hips.add(hip);
    const thigh = capsule(0.07, 0.34, bottom); thigh.position.y = -0.21; hip.add(thigh);
    const knee = new THREE.Group(); knee.position.y = -0.42; hip.add(knee);
    const shin = capsule(0.055, 0.34, bottom); shin.position.y = -0.21; knee.add(shin);
    const foot = new THREE.Group(); foot.position.y = -0.42; knee.add(foot);
    const shoeM = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.07, 0.24), shoe);
    shoeM.position.set(0, -0.02, 0.05); foot.add(shoeM);
    return { hip, knee, foot };
  }
  setState(s) { if (s !== this.state) { this.state = s; if (s === 'dance') this.danceT = 0; } }
  face(targetYaw, dt, k = 8) {
    this.yaw = smoothAngle(this.yaw, targetYaw, dt, k);
    this.root.rotation.y = this.yaw;
  }
  // Pose helpers: P is a map joint -> {x,y,z} in radians.
  _applyPose(P, dt, rate) {
    const b = 1 - Math.exp(-rate * dt);
    for (const k of Object.keys(P)) {
      const cur = this._pose[k], tgt = P[k];
      cur.x += (tgt.x - cur.x) * b; cur.y += (tgt.y - cur.y) * b; cur.z += (tgt.z - cur.z) * b;
      const j = this.j[k]; j.rotation.set(cur.x, cur.y, cur.z);
    }
  }
  update(dt, opts = {}) {
    this.t += dt;
    const t = this.t;
    const speed = this.speed;
    // Walk phase advances with actual speed — stride stays synced, no foot slide illusion from a fixed loop.
    if (speed > 0.05) {
      const prevPhase = this.phase;
      this.phase += dt * (2.2 + speed * 1.9);
      if (opts.onStep) {
        if (Math.floor(this.phase / Math.PI) !== Math.floor(prevPhase / Math.PI)) opts.onStep();
      }
    }
    const ph = this.phase;
    const sw = Math.sin(ph), sw2 = Math.sin(ph + Math.PI);
    const amp = clamp(speed / 3.2, 0, 1) * 0.75;
    const bob = speed > 0.05 ? Math.abs(Math.cos(ph)) * 0.035 * clamp(speed / 2.5, 0, 1) : 0;
    const breathe = Math.sin(t * 1.7) * 0.02;
    const P = {};
    const base = (x = 0, y = 0, z = 0) => ({ x, y, z });
    P.hips = base(0, 0, Math.sin(t * 0.5) * 0.02);
    P.spine = base(0.03 + breathe, 0, Math.sin(t * 0.5) * 0.02);
    P.chest = base(0, Math.sin(t * 0.4) * 0.03, 0);
    P.neck = base(0, 0, 0);
    P.shoulderL = base(0, 0, 0.12); P.shoulderR = base(0, 0, -0.12);
    P.elbowL = base(-0.25, 0, 0); P.elbowR = base(-0.25, 0, 0);
    P.hipL = base(0, 0, 0); P.hipR = base(0, 0, 0);
    P.kneeL = base(0, 0, 0); P.kneeR = base(0, 0, 0);
    P.footL = base(0, 0, 0); P.footR = base(0, 0, 0);
    let rate = 10;
    if (this.state === 'walk' || this.state === 'run') {
      P.hipL.x = sw * amp; P.hipR.x = sw2 * amp;
      // Knee bends only on the back-to-front pass, never pops at extremes.
      P.kneeL.x = Math.max(0, -Math.sin(ph - 0.6)) * amp * 1.4;
      P.kneeR.x = Math.max(0, -Math.sin(ph + Math.PI - 0.6)) * amp * 1.4;
      P.footL.x = -(P.hipL.x + P.kneeL.x) * 0.7;
      P.footR.x = -(P.hipR.x + P.kneeR.x) * 0.7;
      P.shoulderL.x = sw2 * amp * 0.8; P.shoulderR.x = sw * amp * 0.8;
      P.elbowL.x = -0.35 - Math.max(0, sw2) * 0.3; P.elbowR.x = -0.35 - Math.max(0, sw) * 0.3;
      P.spine.x = 0.06; P.chest.y = Math.sin(ph) * 0.04;
      rate = 14;
    } else if (this.state === 'sit') {
      P.hipL.x = -1.45; P.hipR.x = -1.45;
      P.kneeL.x = 1.35; P.kneeR.x = 1.35;
      P.footL.x = 0.1; P.footR.x = 0.1;
      P.spine.x = -0.05; P.shoulderL.x = -0.2; P.shoulderR.x = -0.2;
      P.elbowL.x = -0.5; P.elbowR.x = -0.5;
      rate = 6;
    } else if (this.state === 'dance') {
      this.danceT += dt;
      const d = this.danceT, beat = d * 2.1; // ~120 bpm sway
      const sway = Math.sin(beat) * 0.35, sway2 = Math.sin(beat + Math.PI) * 0.35;
      P.hips.z = Math.sin(beat) * 0.08;
      P.spine.x = 0.05; P.spine.z = Math.sin(beat) * 0.06;
      P.chest.y = Math.sin(beat * 0.5) * 0.15;
      P.shoulderL.x = -0.6 + Math.sin(beat) * 0.4; P.shoulderR.x = -0.6 + Math.sin(beat + Math.PI) * 0.4;
      P.shoulderL.z = 0.5 + Math.sin(beat) * 0.3; P.shoulderR.z = -0.5 - Math.sin(beat) * 0.3;
      P.elbowL.x = -0.5; P.elbowR.x = -0.5;
      P.hipL.x = sway * 0.4; P.hipR.x = sway2 * 0.4;
      P.kneeL.x = Math.max(0, Math.sin(beat)) * 0.35; P.kneeR.x = Math.max(0, Math.sin(beat + Math.PI)) * 0.35;
      P.neck.y = Math.sin(d * 0.8) * 0.15;
      rate = 8;
    } else if (this.state === 'look') {
      P.spine.x = 0.08; P.neck.x = -0.05;
      rate = 6;
    }
    // Look target overrides head only — body stays in its state pose.
    if (this.lookTarget) {
      const dx = this.lookTarget.x - this.root.position.x;
      const dz = this.lookTarget.z - this.root.position.z;
      const worldYaw = Math.atan2(dx, dz);
      let rel = worldYaw - this.yaw;
      rel = Math.atan2(Math.sin(rel), Math.cos(rel));
      P.neck.y = clamp(rel, -0.7, 0.7);
      P.neck.x = -0.08;
    }
    this._applyPose(P, dt, rate);
    this.root.position.y = bob;
    this.shadow.position.set(this.root.position.x, 0.02, this.root.position.z);
  }
}
