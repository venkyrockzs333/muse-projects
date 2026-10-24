// VN Museum — expanded cinematic world.
// Lighting philosophy (pipeline, not brightness stacking):
//  - walls are warm mid-tones, never white; floors are dark polished stone
//  - hemisphere fill is controlled, lights are layered (base / architectural
//    / exhibit / follow-spot / accent) — see main.js for the light rig
//  - bloom threshold is high so only gold / lamp highlights bloom
//  - materials are MeshStandardMaterial (PBR) with calibrated roughness:
//    marble is matte stone (rough ~0.3, metal 0.05), never chrome;
//    painted walls are matte (rough ~0.9); only handles, sign lettering
//    and trim use brushed metal. Glass is restrained and transparent,
//    not a mirror.
// Shared geometries: one unit box and one column cylinder are reused
// for all architectural boxes/columns, keeping draw-call and geometry
// count down instead of allocating a new geometry per box.
import * as THREE from 'three';

const UNIT_BOX = new THREE.BoxGeometry(1, 1, 1);
const COLUMN_GEO = new THREE.CylinderGeometry(0.32, 0.38, 1, 16);

function canvasTex(w, h, draw, srgb = true) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
function std(color, rough = 0.8, metal = 0.05) {
  return new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal });
}
function box(parent, w, h, d, material, x, y, z) {
  const m = new THREE.Mesh(UNIT_BOX, material);
  m.scale.set(w, h, d); m.position.set(x, y, z); parent.add(m); return m;
}
function column(parent, x, z, h, material, yBase = 0) {
  const m = new THREE.Mesh(COLUMN_GEO, material);
  m.scale.y = h; m.position.set(x, yBase + h / 2, z); parent.add(m); return m;
}
function placeholderTex(i, caption) {
  return canvasTex(512, 384, (g, w, h) => {
    g.fillStyle = '#2b2118'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#c9993f'; g.lineWidth = 6; g.strokeRect(18, 18, w - 36, h - 36);
    g.fillStyle = '#e8dcc4'; g.font = 'italic 30px Georgia'; g.textAlign = 'center';
    g.fillText('Your photo here', w / 2, h / 2 - 10);
    g.font = '18px Georgia'; g.fillStyle = '#b8a888';
    g.fillText(caption || '', w / 2, h / 2 + 28);
    void i;
  });
}

// --- 3D block lettering for "VN MUSEUM" ---
// Each letter is drawn as line segments on a 1.0 x 1.4 grid and rendered
// as real gold boxes with depth — actual geometry, not an HTML label,
// not a texture pretending to be a sign. Readable from the spawn point.
const LETTERS = {
  V: [[0, 1.4, 0.5, 0], [0.5, 0, 1, 1.4]],
  N: [[0, 0, 0, 1.4], [0, 1.4, 1, 0], [1, 0, 1, 1.4]],
  M: [[0, 0, 0, 1.4], [0, 1.4, 0.5, 0.7], [0.5, 0.7, 1, 1.4], [1, 0, 1, 1.4]],
  U: [[0, 1.4, 0, 0.35], [0, 0.35, 1, 0.35], [1, 0.35, 1, 1.4]],
  S: [[0.15, 1.4, 0.85, 1.4], [0.15, 1.4, 0.15, 0.7], [0.15, 0.7, 0.85, 0.7], [0.85, 0.7, 0.85, 0], [0.15, 0, 0.85, 0]],
  E: [[0, 0, 0, 1.4], [0, 1.4, 0.9, 1.4], [0, 0.7, 0.7, 0.7], [0, 0, 0.9, 0]],
  ' ': [],
};
const LETTER_W = { V: 0.85, N: 0.85, M: 1.0, U: 0.85, S: 0.85, E: 0.85, ' ': 0.5 };
function buildSign(parent, material, cx, cy, cz) {
  const group = new THREE.Group(); group.position.set(cx, cy, cz); parent.add(group);
  const text = 'VN MUSEUM';
  const gap = 0.22, scale = 0.95;
  let total = 0;
  for (const ch of text) total += (LETTER_W[ch] || 0.85) * scale + gap;
  total -= gap;
  let x = -total / 2;
  for (const ch of text) {
    const w = (LETTER_W[ch] || 0.85) * scale;
    for (const [x1, y1, x2, y2] of (LETTERS[ch] || [])) {
      const sx1 = x1 * scale, sy1 = (y1 - 0.7) * scale, sx2 = x2 * scale, sy2 = (y2 - 0.7) * scale;
      const dx = sx2 - sx1, dy = sy2 - sy1, len = Math.hypot(dx, dy);
      if (len < 0.01) continue;
      const m = new THREE.Mesh(UNIT_BOX, material);
      m.scale.set(len, 0.16, 0.28);
      m.position.set(x + (sx1 + sx2) / 2, (sy1 + sy2) / 2, 0);
      m.rotation.z = Math.atan2(dy, dx);
      group.add(m);
    }
    x += w + gap;
  }
  return group;
}

export function buildMuseum(scene, config, photoTextures) {
  const pickables = [];
  const frames = [];
  const group = new THREE.Group(); scene.add(group);

  // Shared PBR materials (calibrated, reused everywhere).
  const stone = std(0x8a7a66, 0.85);          // honed stone facade
  const marble = std(0xb8a88e, 0.32, 0.05);   // warm marble, matte — never chrome
  const marbleDark = std(0x5c5145, 0.4, 0.05);
  const gold = std(0xc9993f, 0.35, 0.8);      // brushed champagne gold (trim/sign/handles only)
  const goldBright = std(0xd4af6a, 0.3, 0.85);
  const darkWood = std(0x4a2f1d, 0.7);
  const wallMat = std(0x4a3d31, 0.9);         // warm mid-tone painted wall
  const wallTex = canvasTex(8, 256, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, '#5a4a3a'); gr.addColorStop(0.7, '#4a3d31'); gr.addColorStop(1, '#33291f');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  });
  wallTex.wrapS = wallTex.wrapT = THREE.RepeatWrapping;
  const wallMatT = new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.9 });
  const glassMat = new THREE.MeshStandardMaterial({ color: 0xbcd2dd, roughness: 0.08, metalness: 0.1, transparent: true, opacity: 0.28 });
  const fixtureMat = new THREE.MeshBasicMaterial({ color: 0xffd9a0 });

  // ---- exterior plaza (x -12..12, z 1.2..24) ----
  const plazaTex = canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = '#3d352c'; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 3;
    for (let i = 0; i <= 8; i++) { g.beginPath(); g.moveTo(i * 64, 0); g.lineTo(i * 64, h); g.stroke(); g.beginPath(); g.moveTo(0, i * 64); g.lineTo(w, i * 64); g.stroke(); }
  });
  plazaTex.wrapS = plazaTex.wrapT = THREE.RepeatWrapping; plazaTex.repeat.set(6, 6);
  const plaza = new THREE.Mesh(new THREE.PlaneGeometry(24, 22.8), new THREE.MeshStandardMaterial({ map: plazaTex, roughness: 0.9 }));
  plaza.rotation.x = -Math.PI / 2; plaza.position.set(0, 0, 12.6); group.add(plaza);
  const carpet = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 20), std(0x5e1420, 0.95));
  carpet.rotation.x = -Math.PI / 2; carpet.position.set(0, 0.01, 11); group.add(carpet);
  // Forecourt columns + planters (collision circles for these are in world.js).
  for (const x of [-4, 4]) column(group, x, 8, 5.5, stone);
  for (const x of [-10, 10]) {
    box(group, 1.4, 0.7, 1.4, marbleDark, x, 0.35, 18);
    const bush = new THREE.Mesh(new THREE.SphereGeometry(0.65, 12, 10), std(0x2e4a2a, 0.95));
    bush.position.set(x, 0.95, 18); group.add(bush);
  }

  // ---- grand facade (z 0.9, thickness 0.6, x -12..12, height 7) ----
  // Real opening: doorway x -1.6..1.6, height 4.4. Segments are solid
  // geometry around it — the doorway is a gap, not a painted texture.
  box(group, 7.5, 7, 0.6, stone, -8.25, 3.5, 0.9);   // left wing
  box(group, 7.5, 7, 0.6, stone, 8.25, 3.5, 0.9);    // right wing
  box(group, 2.9, 7, 0.6, stone, -3.05, 3.5, 0.9);  // left of doorway
  box(group, 2.9, 7, 0.6, stone, 3.05, 3.5, 0.9);   // right of doorway
  box(group, 3.2, 2.6, 0.6, stone, 0, 5.7, 0.9);    // lintel above doorway
  box(group, 24, 0.35, 0.65, gold, 0, 6.85, 0.9);   // gold cornice
  // Glass panels beside the doorway (visual glass, framed in gold).
  for (const x of [-3.05, 3.05]) {
    box(group, 1.9, 2.9, 0.06, glassMat, x, 2.3, 1.24);
    box(group, 2.1, 0.12, 0.1, gold, x, 3.8, 1.24);
    box(group, 2.1, 0.12, 0.1, gold, x, 0.8, 1.24);
  }
  // Doorframe + columns flanking the doorway.
  box(group, 0.3, 4.4, 0.7, gold, -1.75, 2.2, 0.9);
  box(group, 0.3, 4.4, 0.7, gold, 1.75, 2.2, 0.9);
  box(group, 3.9, 0.3, 0.7, gold, 0, 4.55, 0.9);
  for (const x of [-2.3, 2.3]) {
    column(group, x, 1.5, 7, marble);
    box(group, 0.9, 0.25, 0.9, gold, x, 6.9, 1.5);
    box(group, 0.9, 0.35, 0.9, marbleDark, x, 0.17, 1.5);
  }
  // VN MUSEUM sign: gold 3D lettering on a dark stone plaque, plaza side.
  box(group, 10.5, 1.9, 0.25, marbleDark, 0, 5.7, 1.32);
  const sign = buildSign(group, goldBright, 0, 5.7, 1.55);
  // Heart lock (kept from the base: tapping the door before unlocking
  // opens the passcode modal; after unlocking the doors are automatic).
  const heartShape = new THREE.Shape();
  heartShape.moveTo(0, 0.5); heartShape.bezierCurveTo(0, 0.8, -0.5, 0.8, -0.5, 0.5);
  heartShape.bezierCurveTo(-0.5, 0.2, 0, -0.1, 0, -0.4); heartShape.bezierCurveTo(0, -0.1, 0.5, 0.2, 0.5, 0.5);
  heartShape.bezierCurveTo(0.5, 0.8, 0, 0.8, 0, 0.5);
  const lock = new THREE.Mesh(new THREE.ExtrudeGeometry(heartShape, { depth: 0.08, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, bevelSegments: 2 }), gold);
  lock.position.set(0, 4.15, 1.28); lock.scale.setScalar(0.85); group.add(lock);

  // ---- double doors (real panels, hinge pivots, glass, handles) ----
  function makeDoor(side) {
    // Real door frame: two stiles + top rail + solid lower panel, with a
    // genuine glass opening between them — not a solid slab with glass
    // hidden inside it. Every frame piece is pickable (type 'door') so
    // tapping any part of a locked door opens the passcode modal.
    const pivot = new THREE.Group(); pivot.position.set(side * 1.6, 0, 0.9); group.add(pivot);
    const cx = -side * 0.8; // panel centre, toward the doorway centre
    const parts = [
      box(pivot, 0.18, 4.4, 0.12, darkWood, -side * 0.09, 2.2, 0),   // hinge stile
      box(pivot, 0.18, 4.4, 0.12, darkWood, -side * 1.51, 2.2, 0),  // centre stile
      box(pivot, 1.6, 0.2, 0.12, darkWood, cx, 4.3, 0),            // top rail
      box(pivot, 1.6, 1.4, 0.12, darkWood, cx, 0.7, 0),            // solid lower panel
      box(pivot, 1.24, 2.8, 0.04, glassMat, cx, 2.8, 0),           // glass opening
    ];
    for (const p of parts) { p.userData.type = 'door'; pickables.push(p); }
    const handle = new THREE.Mesh(new THREE.SphereGeometry(0.08, 12, 10), gold);
    handle.position.set(-side * 1.35, 2.2, 0.14); pivot.add(handle);
    const handleBar = new THREE.Mesh(UNIT_BOX, gold);
    handleBar.scale.set(0.06, 0.7, 0.06); handleBar.position.set(-side * 1.35, 2.2, 0.1); pivot.add(handleBar);
    return pivot;
  }
  const doorL = makeDoor(-1), doorR = makeDoor(1);

  // ---- interior floors / ceilings ----
  const floorTex = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#241e18'; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(201,153,63,0.25)'; g.lineWidth = 2; g.strokeRect(4, 4, w - 8, h - 8);
  });
  floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping; floorTex.repeat.set(4, 8);
  function floorPlane(w, d, x, z, mat) {
    const f = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat);
    f.rotation.x = -Math.PI / 2; f.position.set(x, 0, z); group.add(f); return f;
  }
  const interiorFloorMat = new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.35, metalness: 0.15 });
  floorPlane(18, 31.4, 0, -16.3, interiorFloorMat);            // lobby + central hall
  floorPlane(9, 16, -13.5, -20, interiorFloorMat);             // west gallery
  floorPlane(9, 16, 13.5, -20, interiorFloorMat);              // east gallery
  const ceilMat = std(0x17120e, 1);
  function ceilPlane(w, d, x, z, y) {
    const c = new THREE.Mesh(new THREE.PlaneGeometry(w, d), ceilMat);
    c.rotation.x = Math.PI / 2; c.position.set(x, y, z); group.add(c); return c;
  }
  ceilPlane(18, 11.4, 0, -6.3, 7);    // lobby ceiling (high)
  ceilPlane(18, 20, 0, -22, 6);       // central ceiling
  ceilPlane(9, 16, -13.5, -20, 4.5);  // west gallery ceiling
  ceilPlane(9, 16, 13.5, -20, 4.5);   // east gallery ceiling
  // Ceiling beams + gold skirting (architectural rhythm).
  for (const z of [-6, -12, -18, -26]) box(group, 18, 0.3, 0.4, gold, 0, z <= -12 ? 5.85 : 6.85, z);
  for (const x of [-8.9, 8.9]) box(group, 0.15, 0.4, 31.4, gold, x, 0.2, -16.3);

  // ---- interior walls (boxes with real openings) ----
  function wallX(cx, y, z, h, len) { return box(group, 0.4, h, len, wallMatT, cx, y, z); }
  function wallZ(x, y, cz, h, len) { return box(group, len, h, 0.4, wallMatT, x, y, cz); }
  // Lobby side walls (height 7).
  wallX(-9.2, 3.5, -6.3, 7, 11.4); wallX(9.2, 3.5, -6.3, 7, 11.4);
  // Central side walls with side-gallery openings (opening z -22..-19, height 3.2).
  for (const sx of [-1, 1]) {
    const cx = sx * 9.2;
    wallX(cx, 3, -30, 6, 4);        // far segment z -32..-28
    wallX(cx, 3, -25, 6, 6);        // z -28..-22
    wallX(cx, 3, -15.5, 6, 7);      // z -19..-12
    box(group, 0.4, 1.3, 3, wallMatT, cx, 3.85, -20.5); // lintel above opening
  }
  wallZ(0, 3, -32.2, 6, 18); // far wall
  // Side gallery outer / back / front walls (height 4.5).
  for (const sx of [-1, 1]) {
    const ox = sx * 18.2, cx = sx * 13.5;
    wallX(ox, 2.25, -20, 4.5, 16);
    wallZ(cx, 2.25, -28.2, 4.5, 9);
    wallZ(cx, 2.25, -11.8, 4.5, 9);
  }
  // Columns: lobby + central (matching world.js obstacle circles).
  for (const [x, z, h] of [[-6, -6, 7], [6, -6, 7], [-6, -20, 6], [6, -20, 6]]) {
    column(group, x, z, h, marble);
    box(group, 0.8, 0.15, 0.8, gold, x, h - 0.08, z);
  }
  // Recessed ceiling fixtures (visual only; the actual lights are in main.js).
  function fixture(x, y, z) {
    const f = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 0.06, 12), fixtureMat);
    f.position.set(x, y, z); group.add(f);
  }
  for (const [x, z, y] of [[-4, -4, 6.9], [4, -4, 6.9], [-4, -10, 6.9], [4, -10, 6.9], [-4, -16, 5.9], [4, -16, 5.9], [-4, -24, 5.9], [4, -24, 5.9], [-13.5, -16, 4.4], [-13.5, -24, 4.4], [13.5, -16, 4.4], [13.5, -24, 4.4], [-3, 6, 5.4], [3, 6, 5.4]]) fixture(x, y, z);
  // Wall sconces (warm, restrained).
  for (const [x, z, ry] of [[-8.9, -9, 0], [8.9, -9, 0], [-8.9, -27, 0], [8.9, -27, 0]]) {
    const s = box(group, 0.12, 0.5, 0.25, gold, x, 2.8, z); void s; void ry;
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.5), fixtureMat);
    glow.position.set(x + (x < 0 ? 0.08 : -0.08), 2.8, z); glow.rotation.y = x < 0 ? Math.PI / 2 : -Math.PI / 2; group.add(glow);
  }

  // ---- display plinths (display zones) ----
  function plinth(x, z, w = 1.2) {
    box(group, w, 1.0, w, marble, x, 0.5, z);
    box(group, w + 0.2, 0.12, w + 0.2, marbleDark, x, 1.06, z);
    const art = new THREE.Mesh(new THREE.SphereGeometry(0.32, 16, 12), gold);
    art.position.set(x, 1.45, z); group.add(art);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 0.3, 10), marbleDark);
    stem.position.set(x, 1.22, z); group.add(stem);
  }
  plinth(-4, -14); plinth(4, -14); plinth(-13.5, -20, 1.0); plinth(13.5, -20, 1.0);

  // ---- photo frames (preserved exhibits, redistributed) ----
  const frameMat = std(0x1a140e, 0.5, 0.3);
  const matteMat = std(0xe8dfca, 0.9);
  function addFrame(photo, x, z, ry, w, h, isFocal = false) {
    const g = new THREE.Group(); g.position.set(x, 2.4, z); g.rotation.y = ry; group.add(g);
    const frame = box(g, w + 0.24, h + 0.24, 0.08, frameMat, 0, 0, 0);
    const matte = box(g, w + 0.06, h + 0.06, 0.02, matteMat, 0, 0, 0.05);
    const tex = photoTextures[photo.i] || placeholderTex(photo.i, photo.caption);
    const pic = new THREE.Mesh(new THREE.PlaneGeometry(w, h),
      new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6 }));
    pic.position.z = 0.07; g.add(pic);
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(w + 0.8, h + 0.8),
      new THREE.MeshBasicMaterial({ color: 0xffc070, transparent: true, opacity: 0.08, depthWrite: false, blending: THREE.AdditiveBlending }));
    glow.position.z = -0.05; g.add(glow);
    pic.userData = { type: 'photo', i: photo.i }; frame.userData = pic.userData; matte.userData = pic.userData;
    pickables.push(pic, frame, matte);
    frames.push({ mesh: pic, photo, pos: new THREE.Vector3(x, 2.4, z), isFocal, group: g });
    return g;
  }
  const photos = config.photos.map((p, i) => ({ ...p, i }));
  if (photos[1]) addFrame(photos[1], -8.92, -6, Math.PI / 2, 2.0, 1.5);
  if (photos[2]) addFrame(photos[2], 8.92, -6, -Math.PI / 2, 2.0, 1.5);
  if (photos[3]) addFrame(photos[3], -8.92, -18, Math.PI / 2, 2.0, 1.5);
  if (photos[4]) addFrame(photos[4], 8.92, -18, -Math.PI / 2, 2.0, 1.5);
  if (photos[5]) addFrame(photos[5], -17.92, -20, Math.PI / 2, 2.2, 1.6);
  if (photos[6]) addFrame(photos[6], 17.92, -20, -Math.PI / 2, 2.2, 1.6);
  if (photos[0]) addFrame(photos[0], 0, -31.9, 0, 3.0, 2.1, true);
  if (photos[7]) addFrame(photos[7], -3.2, -31.9, 0, 1.8, 1.35);

  // ---- placard (lobby, inside, faces the entrance) ----
  const placardTex = canvasTex(512, 640, (g, w, h) => {
    g.fillStyle = '#f2ead6'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#c9993f'; g.lineWidth = 4; g.strokeRect(16, 16, w - 32, h - 32);
    g.fillStyle = '#6b5a44'; g.font = '16px Georgia'; g.textAlign = 'center';
    g.fillText(config.placard.heading, w / 2, 70);
    g.fillStyle = '#2b2118'; g.font = 'italic 30px Georgia';
    g.fillText(config.placard.to, w / 2, 130);
    g.font = '20px Georgia'; let y = 190;
    for (const line of config.placard.body) { g.fillText(line, w / 2, y); y += 34; }
    g.fillStyle = '#8a6a2a'; g.font = 'italic 22px Georgia';
    g.fillText(config.placard.signoff, w / 2, h - 60);
  });
  const placard = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.9),
    new THREE.MeshStandardMaterial({ map: placardTex, roughness: 0.8 }));
  placard.position.set(3.4, 2.2, -2.2); placard.rotation.y = 0; group.add(placard);
  placard.userData = { type: 'placard' }; pickables.push(placard);

  // ---- bench (dedication seating, central hall) ----
  const bench = new THREE.Group(); bench.position.set(0, 0, -24.5); group.add(bench);
  const benchWood = std(0x6b4a2a, 0.7);
  box(bench, 2.6, 0.12, 0.7, benchWood, 0, 0.48, 0);
  box(bench, 2.6, 0.9, 0.1, benchWood, 0, 0.95, -0.32);
  for (const x of [-1.1, 1.1]) { box(bench, 0.1, 0.48, 0.6, std(0x241d16, 0.6, 0.4), x, 0.24, 0); }
  bench.traverse((o) => { if (o.isMesh) o.userData = { type: 'bench' }; });
  pickables.push(...bench.children.filter((o) => o.isMesh));

  // ---- petals (single InstancedMesh, updated in main) ----
  const petalTex = canvasTex(64, 64, (g) => {
    g.fillStyle = '#ffb9c8'; g.beginPath(); g.ellipse(32, 32, 26, 16, 0.6, 0, Math.PI * 2); g.fill();
  });
  const PMAX = 140;
  const petals = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.16, 0.16),
    new THREE.MeshBasicMaterial({ map: petalTex, transparent: true, depthWrite: false, side: THREE.DoubleSide, alphaTest: 0.05 }), PMAX);
  petals.frustumCulled = false; scene.add(petals);
  const pData = [];
  for (let i = 0; i < PMAX; i++) pData.push({ x: (Math.random() - 0.5) * 10, y: Math.random() * 5, z: 6 - Math.random() * 30, s: 0.5 + Math.random(), r: Math.random() * 6, rs: (Math.random() - 0.5) * 2, ph: Math.random() * 6 });
  return { pickables, frames, bench, doorL, doorR, lock, petals, pData, placard, group, sign };
}
export { placeholderTex };
