// Love Museum — rebuilt (v2).
// Single authoritative RAF loop. Input is collected by Input (pointer /
// keyboard), simulation (movement + partner + animation) runs on dt,
// rendering happens once per frame. dt is clamped to 0.05 s so a tab
// suspension can never teleport the character or explode the physics.
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { gsap } from 'gsap';
import { CONFIG } from './config.js';
import { Human } from './character.js';
import { Input } from './input.js';
import { ThirdPersonCamera, resolveMove } from './world.js';
import { PerfMonitor, clamp, stepVelocity } from './lib.js';
import { AudioMan } from './audio.js';
import { buildMuseum } from './museum.js';

const $ = (id) => document.getElementById(id);
const BASE = import.meta.env.BASE_URL;
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
const params = new URLSearchParams(location.search);
const debug = params.has('debug');
const weak = (navigator.hardwareConcurrency || 8) <= 4 || (navigator.deviceMemory || 8) <= 3 || params.has('low');

// ---------- renderer (exposure fix lives here) ----------
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas: $('c'), antialias: !weak, powerPreference: 'high-performance', alpha: false });
} catch (e) {
  $('glerr').classList.remove('hidden');
  throw e;
}
let dpr = Math.min(window.devicePixelRatio || 1, 1.5);
renderer.setPixelRatio(dpr);
renderer.setSize(innerWidth, innerHeight, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1; // measured: ACES + 1.1 keeps midtones readable without white-out
renderer.shadowMap.enabled = !weak;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
let running = true;
$('c').addEventListener('webglcontextlost', (e) => { e.preventDefault(); running = false; $('glerr').classList.remove('hidden'); }, false);
$('c').addEventListener('webglcontextrestored', () => location.reload(), false);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x17120e);
scene.fog = new THREE.Fog(0x17120e, 20, 55);
const camera = new THREE.PerspectiveCamera(isTouch ? 62 : 55, innerWidth / innerHeight, 0.1, 80);

// Post: bloom only on bright highlights (threshold 0.85, strength 0.32).
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth / 2, innerHeight / 2), 0.32, 0.5, 0.85);
composer.addPass(bloom);
composer.addPass(new OutputPass());
let qualityLevel = weak ? 1 : 0; // 0 full, 1 no bloom, 2 lower DPR, 3 no shadows + fewer petals
function applyQuality() {
  const useBloom = qualityLevel === 0;
  renderer.shadowMap.enabled = qualityLevel < 3 && !weak;
  scene.traverse((o) => { if (o.isLight && o.userData.keySpot) o.castShadow = qualityLevel < 3; });
}
function resize() {
  camera.aspect = innerWidth / innerHeight;
  camera.fov = (isTouch ? 62 : 55) + (camera.aspect < 0.7 ? 10 : 0);
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight, false);
  composer.setPixelRatio(dpr); composer.setSize(innerWidth, innerHeight);
  bloom.setSize(innerWidth / 2, innerHeight / 2);
}
addEventListener('resize', resize);

// ---------- lights (low ambient, warm spots — no flat wash) ----------
const hemi = new THREE.HemisphereLight(0xffe8c8, 0x1a1410, 0.35); scene.add(hemi);
const moon = new THREE.DirectionalLight(0x9fb4ff, 0.5); moon.position.set(-6, 12, 14); scene.add(moon);
const lampL = new THREE.PointLight(0xffc27a, 40, 14, 2); lampL.position.set(-3.2, 4.2, 2.5); scene.add(lampL);
const lampR = lampL.clone(); lampR.position.x = 3.2; scene.add(lampR);
const gallerySpots = [];
for (const [z, key] of [[-8, false], [-16, true], [-24, false]]) {
  const s = new THREE.SpotLight(0xffd9a0, 90, 18, 0.7, 0.6, 1.8);
  s.position.set(0, 4.8, z); s.target.position.set(0, 0, z); scene.add(s, s.target);
  s.userData.keySpot = key; s.castShadow = key; s.shadow.mapSize.set(1024, 1024); s.shadow.bias = -0.002;
  gallerySpots.push(s);
}

// ---------- loading (never stuck at 0%: failures become placeholders) ----------
let photoTextures = [];
let attempted = 0, total = CONFIG.photos.length, ready = false, built = false;
function setLoad(f) {
  const p = Math.round(f * 100);
  $('loadfill').style.width = p + '%';
  $('loadtxt').textContent = p >= 100 ? 'Ready 100%' : `Loading ${p}%`;
  if (p >= 100) $('startBtn').disabled = false;
}
function finishLoading() {
  if (ready) return; ready = true; setLoad(1); buildWorld();
}
const texLoader = new THREE.TextureLoader();
texLoader.setCrossOrigin('anonymous');
CONFIG.photos.forEach((p, i) => {
  if (!p.src) { photoTextures[i] = null; attempted++; setLoad(attempted / Math.max(1, total)); if (attempted >= total) finishLoading(); return; }
  texLoader.load(BASE + p.src,
    (t) => { t.colorSpace = THREE.SRGBColorSpace; photoTextures[i] = t; attempted++; setLoad(attempted / total); if (attempted >= total) finishLoading(); },
    undefined,
    () => { photoTextures[i] = null; attempted++; setLoad(attempted / total); if (attempted >= total) finishLoading(); });
});
setTimeout(finishLoading, 10000); // hard fallback: a slow / failed photo never blocks entry

// ---------- world, characters, input, camera, audio ----------
let world = null;
const me = new Human({ skin: 0xe0aa7e, hair: 0x241812, hairStyle: 'short', top: 0x7a1f2b, bottom: 0x2e2a26, shoes: 0x1d1712, female: false, name: 'me' });
const her = new Human({ skin: 0xf0c4a0, hair: 0x3a2318, hairStyle: 'long', top: 0x8a2f3d, bottom: 0x3a2430, shoes: 0x241a1a, female: true, name: 'her' });
me.root.position.set(0, 0, 9); her.root.position.set(1.3, 0, 9.6);
me.yaw = her.yaw = Math.PI; me.root.rotation.y = her.root.rotation.y = Math.PI;
scene.add(me.root, me.shadow, her.root, her.shadow);

const input = new Input($('joyBase'), $('joyKnob'));
const cam = new ThirdPersonCamera(camera);
cam.yaw = 0; cam.dist = isTouch ? 5.2 : 4.6;
const audio = new AudioMan();
const perf = new PerfMonitor();

let state = 'start', unlocked = false, cinematic = false, introT = 0;
let together = null; // null | 'sit' | 'dance'
let lockDismissedAt = 0, lastSay = 0, sayIdx = 0, nearestFrame = null;
let walkTarget = null, bubbleEl = null, bubbleUntil = 0;
const vel = new THREE.Vector3();
const prevPos = new THREE.Vector3(), nextPos = new THREE.Vector3(), resolved = new THREE.Vector3();
const tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3(), tmpC = new THREE.Vector3();
const marker = new THREE.Mesh(new THREE.RingGeometry(0.18, 0.26, 24),
  new THREE.MeshBasicMaterial({ color: 0xe6c27a, transparent: true, opacity: 0, depthWrite: false }));
marker.rotation.x = -Math.PI / 2; marker.position.y = 0.02; scene.add(marker);

function buildWorld() {
  if (built) return; built = true;
  world = buildMuseum(scene, CONFIG, photoTextures);
  const failed = photoTextures.filter((t) => t === null).length;
  if (failed > 0) { const el = $('loaderr'); el.textContent = `${failed} photo(s) could not load — placeholders are used instead.`; el.classList.remove('hidden'); }
  resize(); applyQuality();
}
function toast(msg, ms = 3000) {
  const t = $('hint-top'); t.textContent = msg; t.classList.add('on');
  clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('on'), ms);
}

// ---------- UI flows ----------
let skipBtn = null;
$('startBtn').addEventListener('click', () => {
  if (!ready) return;
  audio.init(CONFIG.music ? BASE + CONFIG.music : null);
  if (CONFIG.music) $('musicBtn').classList.remove('hidden');
  $('start').classList.add('fade'); setTimeout(() => $('start').classList.add('hidden'), 950);
  $('hud').classList.remove('hidden');
  if (!isTouch) $('joyBase').style.display = 'none';
  state = 'outside'; cinematic = true; introT = 0;
  cam.pos.set(0, 6, 20); cam.look.set(0, 3, 0);
  // Skip button for the intro sweep (optional cinematic, never forced)
  skipBtn = document.createElement('button'); skipBtn.className = 'pill'; skipBtn.textContent = 'Skip intro';
  skipBtn.style.cssText = 'position:fixed;left:50%;bottom:110px;transform:translateX(-50%);z-index:20;pointer-events:auto;';
  skipBtn.addEventListener('click', () => { cinematic = false; skipBtn.remove(); skipBtn = null; });
  document.body.appendChild(skipBtn);
  toast(isTouch ? 'Walk to the door · drag to look' : 'WASD / arrows to walk · drag to look', 4200);
});
$('musicBtn').addEventListener('click', () => { audio.setMuted(!audio.muted); $('musicBtn').style.opacity = audio.muted ? 0.5 : 1; });
$('muteBtn').addEventListener('click', () => {
  audio.setMuted(!audio.muted);
  $('muteBtn').textContent = audio.muted ? '🔇' : '🔊';
  $('musicBtn').style.opacity = audio.muted ? 0.5 : 1;
});
$('calmBtn').addEventListener('click', () => {
  cam.calm = !cam.calm;
  $('calmBtn').style.opacity = cam.calm ? 1 : 0.6;
  toast(cam.calm ? 'Calm camera on — gentler look movement' : 'Calm camera off', 2000);
});
function openLock() {
  if (state !== 'outside' || !$('lock').classList.contains('hidden')) return;
  $('lock').classList.remove('hidden'); $('lockCard').className = 'card'; $('code').value = '';
  setTimeout(() => $('code').focus({ preventScroll: true }), isTouch ? 250 : 50);
}
function closeLock() { $('code').blur(); $('lock').classList.add('hidden'); lockDismissedAt = performance.now(); setTimeout(resize, 300); }
$('lockCancel').addEventListener('click', closeLock);
$('lockCard').addEventListener('submit', (e) => {
  e.preventDefault();
  const v = $('code').value.trim();
  if (v.toLowerCase() === String(CONFIG.passcode).toLowerCase()) {
    $('code').blur(); $('lockCard').className = 'card ok';
    if (navigator.vibrate) navigator.vibrate([20, 40, 60]);
    setTimeout(() => { $('lock').classList.add('hidden'); resize(); unlockSequence(); }, reduced ? 200 : 1000);
  } else {
    const c = $('lockCard'); c.className = 'card'; void c.offsetWidth; c.className = 'card shake';
    if (navigator.vibrate) navigator.vibrate(120);
    $('hintTxt').textContent = CONFIG.hint; $('code').value = ''; $('code').focus({ preventScroll: true });
  }
});
function unlockSequence() {
  state = 'unlocking'; cinematic = true; walkTarget = null;
  audio.blip();
  gsap.to(world.doorL.rotation, { y: -1.9, duration: 1.6, ease: 'power2.inOut' });
  gsap.to(world.doorR.rotation, { y: 1.9, duration: 1.6, ease: 'power2.inOut' });
  const flash = $('flash');
  gsap.fromTo(flash, { opacity: 0 }, { opacity: 0.85, duration: 0.9, delay: 0.8, onComplete: () => gsap.to(flash, { opacity: 0, duration: 1.2 }) });
  setTimeout(() => {
    unlocked = true; state = 'outside'; cinematic = false;
    walkTarget = new THREE.Vector3(0, 0, -4);
    toast('The door is open — walk inside', 3000);
  }, 1900);
}
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function openPhoto(i) {
  const photo = CONFIG.photos[i];
  const f = world.frames.find((x) => x.photo.i === i);
  if (f) {
    const ry = f.group.rotation.y;
    const nx = Math.sin(ry), nz = Math.cos(ry);
    cam.setFocus(tmpA.set(f.pos.x + nx * 3.2, 2.2, f.pos.z + nz * 3.2), tmpB.set(f.pos.x, 2.2, f.pos.z));
    me.lookTarget = f.pos; her.lookTarget = f.pos;
  }
  $('viewerBody').innerHTML = photo.src
    ? `<img src="${BASE + photo.src}" alt=""><div class="cap">${esc(photo.caption || '')}</div>`
    : `<div class="cap">Your photo here — ${esc(photo.caption || '')}</div>`;
  $('viewer').classList.remove('hidden'); audio.blip();
}
function openPlacard() {
  $('viewerBody').innerHTML = `<div class="pl"><div class="eb">${esc(CONFIG.placard.heading)}</div><h3>${esc(CONFIG.placard.to)}</h3>${CONFIG.placard.body.map((p) => `<p>${esc(p)}</p>`).join('')}<div class="sig">${esc(CONFIG.placard.signoff)}</div></div>`;
  $('viewer').classList.remove('hidden'); audio.blip();
}
function closeViewer() {
  $('viewer').classList.add('hidden'); cam.clearFocus(); me.lookTarget = null; her.lookTarget = null;
}
$('viewerClose').addEventListener('click', closeViewer);
function sitTogether() {
  if (together === 'sit') {
    together = null; me.setState('idle'); her.setState('idle');
    $('sitBtn').textContent = '🪑 Sit together'; return;
  }
  together = 'sit'; me.setState('sit'); her.setState('sit');
  me.root.position.set(-0.55, 0, -24.5); her.root.position.set(0.55, 0, -24.5);
  me.yaw = her.yaw = 0; me.root.rotation.y = her.root.rotation.y = 0;
  vel.set(0, 0, 0); walkTarget = null;
  $('sitBtn').textContent = '🚶 Stand up'; audio.blip();
}
$('sitBtn').addEventListener('click', sitTogether);
function danceTogether() {
  if (together === 'dance') {
    together = null; me.setState('idle'); her.setState('idle');
    $('danceBtn').textContent = '💃 Dance with me'; return;
  }
  const d = me.root.position.distanceTo(her.root.position);
  if (d > 3.5) { toast('Walk a little closer to your partner first', 2500); return; }
  together = 'dance'; walkTarget = null; vel.set(0, 0, 0);
  me.setState('dance'); her.setState('dance');
  // Face each other (no snap: face() eases in update)
  tmpA.subVectors(her.root.position, me.root.position); me._danceYaw = Math.atan2(tmpA.x, tmpA.z);
  tmpA.subVectors(me.root.position, her.root.position); her._danceYaw = Math.atan2(tmpA.x, tmpA.z);
  $('danceBtn').textContent = '⏹ Stop dancing'; audio.blip();
}
$('danceBtn').addEventListener('click', danceTogether);
$('viewBtn').addEventListener('click', () => { if (nearestFrame) openPhoto(nearestFrame.photo.i); });

// ---------- tap / interact ----------
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
function onTap(x, y) {
  if (cinematic || (state !== 'outside' && state !== 'inside')) return;
  if (!$('viewer').classList.contains('hidden')) return;
  ndc.set((x / innerWidth) * 2 - 1, -(y / innerHeight) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const hit = ray.intersectObjects(world ? world.pickables : [], false)[0];
  if (hit && hit.distance < 14) {
    const t = hit.object.userData.type;
    if (t === 'door' && !unlocked) return openLock();
    if (t === 'photo') return openPhoto(hit.object.userData.i);
    if (t === 'placard') return openPlacard();
    if (t === 'bench') return sitTogether();
  }
  // Tap-to-walk on the ground (only if the tap was on the floor, not a frame)
  if (world) {
    const fh = ray.intersectObjects([world.group], true).find((h) => h.point.y < 0.1);
    if (fh && fh.point) {
      walkTarget = new THREE.Vector3(fh.point.x, 0, fh.point.z);
      marker.position.set(walkTarget.x, 0.02, walkTarget.z);
      marker.material.opacity = 0.9;
    }
  }
}
input.onTap = onTap;
input.onInteract = () => {
  if (nearestFrame) openPhoto(nearestFrame.photo.i);
  else if (!$('sitBtn').classList.contains('hidden')) sitTogether();
};
input.onEscape = closeViewer;

// ---------- movement ----------
const MOVE_ACCEL = 11.5, MOVE_BRAKE = 15.5, WALK_SPEED = 2.05, RUN_SPEED = 3.15;
function moveMe(dt) {
  if (!me) return;
  const canMove = !cinematic && state !== 'start' && state !== 'unlocking' && $('lock').classList.contains('hidden') && $('viewer').classList.contains('hidden') && together !== 'sit' && together !== 'dance';
  let ix = 0, iz = 0, mag = 0, running = false;
  if (canMove) {
    const n = input.moveVector(); ix = n.x; mag = n.mag; running = input.running();
    // forward = -input.y (push up = forward)
    const fwd = -n.y;
    const sin = Math.sin(cam.yaw), cos = Math.cos(cam.yaw);
    // camera forward (-sin, -cos), camera right (cos, -sin)
    const tx = (cos * ix + -sin * fwd);
    const tz = (-sin * ix + -cos * fwd);
    // input already normalized, so (tx, tz) length == mag
    const top = running && mag > 0.88 ? RUN_SPEED : WALK_SPEED;
    const dx = tx * top, dz = tz * top;
    const [vx, vz] = stepVelocity(vel.x, vel.z, mag > 0.025 ? dx : 0, mag > 0.025 ? dz : 0, dt, MOVE_ACCEL, MOVE_BRAKE);
    vel.set(vx, 0, vz);
    if (mag > 0.025) walkTarget = null;
  } else if (walkTarget && canMove) {
    // handled below (walkTarget is only set when canMove, kept for clarity)
  }
  if (walkTarget && canMove) {
    tmpA.subVectors(walkTarget, me.root.position); tmpA.y = 0;
    const dist = tmpA.length();
    if (dist < 0.12) { walkTarget = null; marker.material.opacity = 0; }
    else {
      const sp = Math.min(2.0, 0.75 + dist * 0.8);
      vel.set((tmpA.x / dist) * sp, 0, (tmpA.z / dist) * sp);
    }
  } else if (!canMove || (walkTarget === null && mag <= 0.025)) {
    // stepVelocity already brakes; if fully blocked, zero out
    if (!canMove) vel.multiplyScalar(Math.exp(-MOVE_BRAKE * dt));
  }
  const speed = Math.hypot(vel.x, vel.z);
  me.speed = speed;
  if (speed > 0.08 && together !== 'dance') {
    me.face(Math.atan2(vel.x, vel.z), dt, 8.5);
    me.setState(running && speed > 2.2 ? 'run' : 'walk');
  } else if (together === null) {
    me.setState('idle');
  }
  if (speed > 0.001) {
    prevPos.copy(me.root.position);
    nextPos.set(prevPos.x + vel.x * dt, 0, prevPos.z + vel.z * dt);
    resolveMove(prevPos, nextPos, unlocked, resolved);
    if (resolved.x === prevPos.x && Math.abs(nextPos.x - resolved.x) > 0.0001) vel.x = 0;
    if (resolved.z === prevPos.z && Math.abs(nextPos.z - resolved.z) > 0.0001) vel.z = 0;
    me.root.position.set(resolved.x, 0, resolved.z);
  }
  // State: inside vs outside by doorway crossing
  if (unlocked && me.root.position.z < -0.6) state = 'inside';
  else if (unlocked && me.root.position.z > 1.2) state = 'outside';
}
function moveHer(dt) {
  if (together === 'sit') { her.face(0, dt); return; }
  if (together === 'dance') { her.face(her._danceYaw || 0, dt, 6); me.face(me._danceYaw || 0, dt, 6); return; }
  // Goal: behind + to the side of the player
  const fy = Math.sin(me.yaw), fz = Math.cos(me.yaw);
  const goalX = me.root.position.x - fy * 0.9 + fz * 1.0;
  const goalZ = me.root.position.z - fz * 0.9 - fy * 1.0;
  tmpB.set(goalX - her.root.position.x, 0, goalZ - her.root.position.z);
  const d = tmpB.length();
  her.speed = 0;
  if (d > 0.35) {
    const sp = Math.min(2.55, d * 1.65);
    const step = Math.min(d, sp * dt);
    prevPos.copy(her.root.position);
    nextPos.set(prevPos.x + (tmpB.x / d) * step, 0, prevPos.z + (tmpB.z / d) * step);
    resolveMove(prevPos, nextPos, unlocked, resolved);
    her.root.position.set(resolved.x, 0, resolved.z);
    her.face(Math.atan2(tmpB.x, tmpB.z), dt, 5.5);
    her.speed = sp; her.setState(sp > 2.0 ? 'run' : 'walk');
  } else {
    her.face(me.yaw, dt, 3); her.setState('idle');
  }
}
function say(text, ms = 3800) {
  if (bubbleEl) bubbleEl.remove();
  bubbleEl = document.createElement('div'); bubbleEl.className = 'bubble'; bubbleEl.textContent = text;
  $('bubbles').appendChild(bubbleEl); bubbleUntil = performance.now() + ms;
}

// ---------- main loop ----------
const clock = new THREE.Clock();
const pm = new THREE.Matrix4(), pq = new THREE.Quaternion(), pe = new THREE.Euler(), ps = new THREE.Vector3(), pp = new THREE.Vector3();
let fpsTimer = 0;
function frame() {
  if (!running) return;
  requestAnimationFrame(frame);
  if (document.hidden) return;
  const dt = Math.min(clock.getDelta(), 0.05);
  const dtMs = dt * 1000;
  perf.sample(dtMs);
  const now = performance.now();
  // Adaptive quality: step down before input responsiveness suffers.
  if (perf.slowWindow(now) && qualityLevel < 3) {
    qualityLevel++;
    if (qualityLevel === 1) { /* bloom off handled in render */ }
    if (qualityLevel === 2) { dpr = Math.max(1, dpr - 0.25); renderer.setPixelRatio(dpr); resize(); }
    if (qualityLevel === 3 && world) world.petals.count = 40;
    applyQuality();
  }
  // Look input (frame-rate independent sensitivity is per-pixel, not per-frame)
  const look = input.consumeLook();
  const lookSens = (cam.calm ? 0.5 : 1) * (reduced ? 0.5 : 1) * 0.0055;
  if ((look.dx || look.dy) && !cinematic) cam.applyLook(look.dx, look.dy, lookSens);
  // Intro sweep
  if (cinematic && state === 'outside' && introT < 2.5) {
    introT += dt;
    if (input.moveVector().mag > 0.05 || introT >= 2.5) {
      cinematic = false; if (skipBtn) { skipBtn.remove(); skipBtn = null; }
    }
  }
  moveMe(dt);
  moveHer(dt);
  me.update(dt, { onStep: () => audio.footstep() });
  her.update(dt);
  // Lock proximity
  if (me && state === 'outside' && !unlocked) {
    const p = me.root.position;
    if (Math.abs(p.x) < 2.6 && p.z < 2.6 && p.z > 0.5 && now - lockDismissedAt > 2500) openLock();
  }
  // Proximity UI
  nearestFrame = null;
  if (world && state === 'inside' && !together) {
    const p = me.root.position;
    $('sitBtn').classList.toggle('hidden', p.distanceTo(world.bench.position) > 2.6);
    $('danceBtn').classList.remove('hidden');
    let best = 99;
    for (const f of world.frames) {
      const d = Math.hypot(p.x - f.pos.x, p.z - f.pos.z);
      if (d < 2.2 && d < best) { best = d; nearestFrame = f; }
    }
    $('viewBtn').classList.toggle('hidden', !nearestFrame);
    if (now - lastSay > 9000 && nearestFrame) {
      say(CONFIG.bubbles[sayIdx++ % CONFIG.bubbles.length]); lastSay = now;
    }
  } else {
    $('sitBtn').classList.add('hidden'); $('viewBtn').classList.add('hidden');
    if (state === 'inside') $('danceBtn').classList.remove('hidden'); else $('danceBtn').classList.add('hidden');
  }
  if (together === 'sit') $('sitBtn').classList.remove('hidden');
  // Marker fade
  if (marker.material.opacity > 0) marker.material.opacity = Math.max(0, marker.material.opacity - dt * 0.8);
  // Camera
  const inside = state === 'inside';
  if (cinematic && state === 'outside' && introT < 2.5) {
    // Sweep: from wide facade view toward the player
    const t = clamp(introT / 2.5, 0, 1);
    cam.pos.lerp(tmpA.set(me.root.position.x, 2.2, me.root.position.z + 5.2), 1 - Math.exp(-2 * dt));
    cam.look.lerp(tmpB.set(me.root.position.x, 1.6, me.root.position.z), 1 - Math.exp(-2 * dt));
    camera.position.copy(cam.pos); camera.lookAt(cam.look);
    void t;
  } else {
    cam.update(dt, me.root.position, inside);
  }
  // Petals (instanced, reused temps — no per-frame allocation)
  if (world) {
    const t = clock.elapsedTime;
    const cx = me.root.position.x, cz = me.root.position.z;
    const spd = reduced ? 0.3 : 1;
    for (let i = 0; i < world.petals.count; i++) {
      const d = world.pData[i];
      d.y -= dt * (0.25 + d.s * 0.3) * spd; d.r += dt * d.rs * spd;
      if (d.y < 0.05) { d.y = 4.6 + Math.random(); d.x = cx + (Math.random() - 0.5) * 10; d.z = cz + (Math.random() - 0.5) * 10; }
      if (Math.abs(d.x - cx) > 7) d.x = cx + (Math.random() - 0.5) * 10;
      if (Math.abs(d.z - cz) > 7) d.z = cz + (Math.random() - 0.5) * 10;
      pp.set(d.x + Math.sin(t * 0.8 + d.ph) * 0.4, d.y, d.z + Math.cos(t * 0.6 + d.ph) * 0.3);
      pe.set(d.r, d.r * 0.7, d.ph); pq.setFromEuler(pe); ps.setScalar(0.6 + d.s);
      pm.compose(pp, pq, ps); world.petals.setMatrixAt(i, pm);
    }
    world.petals.instanceMatrix.needsUpdate = true;
  }
  // Bubble positioning
  if (bubbleEl) {
    if (now > bubbleUntil) { bubbleEl.remove(); bubbleEl = null; }
    else {
      tmpC.copy(her.root.position); tmpC.y += 1.9; tmpC.project(camera);
      bubbleEl.style.left = clamp((tmpC.x + 1) / 2 * innerWidth, 110, innerWidth - 110) + 'px';
      bubbleEl.style.top = ((1 - tmpC.y) / 2 * innerHeight) + 'px';
      bubbleEl.style.display = tmpC.z < 1 ? '' : 'none';
    }
  }
  // FPS debug
  if (debug) {
    fpsTimer += dt;
    if (fpsTimer > 0.5) {
      fpsTimer = 0;
      const s = perf.stats();
      const el = $('fps'); el.classList.remove('hidden');
      el.textContent = `fps ${s.fps.toFixed(0)} · median ${s.median.toFixed(1)}ms · p95 ${s.p95.toFixed(1)}ms\n dropped ${s.dropped} · quality ${qualityLevel} · dpr ${dpr}`;
    }
  }
  if (qualityLevel === 0) composer.render(); else renderer.render(scene, camera);
}
resize();
frame();

// Test hooks (harmless in production; used by shoot/demo scripts)
window.__museum = {
  get state() { return state; }, get Q() { return { qualityLevel, dpr }; },
  go(x, z) { me.root.position.set(x, 0, z); her.root.position.set(x + 1, 0, z + 0.8); },
  setYaw(y, p) { cam.yaw = y; if (p !== undefined) cam.pitch = p; },
  photo: (i) => openPhoto(i), sit: sitTogether,
};
