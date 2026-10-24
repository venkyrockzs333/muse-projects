// Cinematic museum world. The lighting fix, in one place:
//  - walls are warm mid-tones, never white; floors are dark polished stone
//  - hemisphere light is low (0.35) and warm/cool balanced
//  - light comes from warm spotlights over exhibits, not a flat ambient wash
//  - bloom threshold is high (0.85) so only gold / lamp highlights bloom
//  - materials are MeshStandardMaterial (PBR), roughness varied, no
//    emissive white planes. Previous build: white walls + bloom 0.55 /
//    threshold 0.82 + hemi 0.55 + point lights washing everything out.
import * as THREE from 'three';

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
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  m.position.set(x, y, z); parent.add(m); return m;
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

export function buildMuseum(scene, config, photoTextures) {
  const pickables = [];
  const frames = []; // {mesh, photo, pos, caption, isFocal}
  const group = new THREE.Group(); scene.add(group);

  // ---- ground / courtyard (outside, z 1.2..14) ----
  const groundTex = canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = '#3d352c'; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 3;
    for (let i = 0; i <= 8; i++) { g.beginPath(); g.moveTo(i * 64, 0); g.lineTo(i * 64, h); g.stroke(); g.beginPath(); g.moveTo(0, i * 64); g.lineTo(w, i * 64); g.stroke(); }
  });
  groundTex.wrapS = groundTex.wrapT = THREE.RepeatWrapping; groundTex.repeat.set(4, 3);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(24, 18), std(0xffffff, 0.9));
  ground.material.map = groundTex; ground.rotation.x = -Math.PI / 2; ground.position.set(0, 0, 7); group.add(ground);
  const carpet = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 12), std(0x5e1420, 0.95));
  carpet.rotation.x = -Math.PI / 2; carpet.position.set(0, 0.01, 7); group.add(carpet);

  // ---- facade + doors ----
  const stone = std(0x8a7a66, 0.85);
  const gold = std(0xc9993f, 0.35, 0.8);
  const darkWood = std(0x4a2f1d, 0.7);
  box(group, 11, 6.5, 0.6, stone, 0, 3.25, 0.9);
  // gold frieze band
  box(group, 11, 0.35, 0.65, gold, 0, 5.6, 0.9);
  const friezeTex = canvasTex(1024, 64, (g, w, h) => {
    g.fillStyle = '#1d1712'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#e6c27a'; g.font = '28px Georgia'; g.textAlign = 'center';
    g.fillText('·  OUR  MUSEUM  ·', w / 2, 42);
  });
  const frieze = new THREE.Mesh(new THREE.PlaneGeometry(8, 0.5),
    new THREE.MeshBasicMaterial({ map: friezeTex }));
  frieze.position.set(0, 4.9, 0.58); group.add(frieze);
  // doors (pivot at hinge edge)
  function makeDoor(side) {
    const pivot = new THREE.Group(); pivot.position.set(side * 0.8, 0, 0.9); group.add(pivot);
    const door = box(pivot, 1.55, 4.4, 0.12, darkWood, -side * 0.775, 2.2, 0);
    door.userData.type = 'door';
    const handle = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), gold);
    handle.position.set(-side * 0.6, 2.2, 0.12); pivot.add(handle);
    pickables.push(door);
    return pivot;
  }
  const doorL = makeDoor(-1), doorR = makeDoor(1);
  // heart lock above the door
  const heartShape = new THREE.Shape();
  heartShape.moveTo(0, 0.5); heartShape.bezierCurveTo(0, 0.8, -0.5, 0.8, -0.5, 0.5);
  heartShape.bezierCurveTo(-0.5, 0.2, 0, -0.1, 0, -0.4); heartShape.bezierCurveTo(0, -0.1, 0.5, 0.2, 0.5, 0.5);
  heartShape.bezierCurveTo(0.5, 0.8, 0, 0.8, 0, 0.5);
  const lock = new THREE.Mesh(new THREE.ExtrudeGeometry(heartShape, { depth: 0.08, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, bevelSegments: 2 }), gold);
  lock.position.set(0, 4.6, 0.62); lock.scale.setScalar(1.1); group.add(lock);

  // ---- gallery shell (z -32..0, x -5..5, height 5) ----
  const wallMat = std(0x4a3d31, 0.9);
  const wallTex = canvasTex(8, 256, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, '#5a4a3a'); gr.addColorStop(0.7, '#4a3d31'); gr.addColorStop(1, '#33291f');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  });
  wallTex.wrapS = wallTex.wrapT = THREE.RepeatWrapping;
  const wallMatT = new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.9 });
  const gallery = new THREE.Group(); group.add(gallery);
  const floorTex = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#241e18'; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(201,153,63,0.25)'; g.lineWidth = 2; g.strokeRect(4, 4, w - 8, h - 8);
  });
  floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping; floorTex.repeat.set(2, 8);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(10, 32), new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.35, metalness: 0.15 }));
  floor.rotation.x = -Math.PI / 2; floor.position.set(0, 0, -16); gallery.add(floor);
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(10, 32), std(0x17120e, 1));
  ceil.rotation.x = Math.PI / 2; ceil.position.set(0, 5, -16); gallery.add(ceil);
  const mkWall = (w, h, x, y, z, ry) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), wallMatT);
    m.position.set(x, y, z); m.rotation.y = ry; gallery.add(m); return m;
  };
  mkWall(10, 5, 0, 2.5, -32, 0);
  mkWall(32, 5, -5, 2.5, -16, Math.PI / 2);
  mkWall(32, 5, 5, 2.5, -16, -Math.PI / 2);
  // entrance inner wall with doorway gap: two segments + lintel
  mkWall(3.9, 5, -3.05, 2.5, -0.6, Math.PI);
  mkWall(3.9, 5, 3.05, 2.5, -0.6, Math.PI);
  mkWall(2.2, 0.6, 0, 4.7, -0.6, Math.PI);
  // gold skirting + columns (architectural rhythm, not clutter)
  for (const x of [-4.9, 4.9]) box(gallery, 0.15, 0.4, 32, gold, x, 0.2, -16);
  for (const z of [-8, -16, -24]) {
    for (const x of [-4.6, 4.6]) {
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 5, 12), std(0x6b5a44, 0.7));
      col.position.set(x, 2.5, z); gallery.add(col);
      const cap = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.15, 0.6), gold);
      cap.position.set(x, 4.9, z); gallery.add(cap);
    }
  }
  // ---- photo frames ----
  const frameMat = std(0x1a140e, 0.5, 0.3);
  const matteMat = std(0xe8dfca, 0.9);
  function addFrame(photo, x, z, ry, w, h, isFocal = false) {
    const g = new THREE.Group(); g.position.set(x, 2.4, z); g.rotation.y = ry; gallery.add(g);
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
  // Side walls: 3 left, 3 right (photos 1..6), focal = photo 0, dedication photo = photo 7 on the end wall side
  const leftZ = [-6, -13, -20], rightZ = [-9.5, -16.5, -23.5];
  leftZ.forEach((z, k) => { if (photos[k + 1]) addFrame(photos[k + 1], -4.92, z, Math.PI / 2, 2.0, 1.5); });
  rightZ.forEach((z, k) => { if (photos[k + 4]) addFrame(photos[k + 4], 4.92, z, -Math.PI / 2, 2.0, 1.5); });
  if (photos[0]) addFrame(photos[0], 0, -31.9, 0, 3.0, 2.1, true);
  if (photos[7]) addFrame(photos[7], -3.2, -31.9, 0, 1.8, 1.35);
  // ---- placard (entrance, inside) ----
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
  placard.position.set(3.4, 2.2, -2.2); placard.rotation.y = 0; gallery.add(placard); // faces +z, toward visitors entering
  placard.userData = { type: 'placard' }; pickables.push(placard);
  // ---- bench (dedication seating) ----
  const bench = new THREE.Group(); bench.position.set(0, 0, -24.5); gallery.add(bench);
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
  return { pickables, frames, bench, doorL, doorR, lock, petals, pData, placard, group };
}
export { placeholderTex };
