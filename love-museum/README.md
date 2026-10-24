# Our Museum — cinematic rebuild (v2)

Three.js + GSAP + Vite. No backend. A complete rebuild of the original
love-museum project (the original zip is untouched — this is a separate
folder, so rollback is just using the original again).

## What changed, and why

**Lighting / white-out (fixed at the pipeline level)**
- Walls are warm mid-tones (`#4a3d31` gradient), floors dark polished
  stone — never white. Hemisphere light dropped to 0.35.
- ACES tone mapping, exposure 1.1, sRGB output. Warm spotlights over
  exhibits (physical falloff) instead of a flat ambient wash.
- Bloom threshold raised to 0.85, strength 0.32, so only gold / lamp
  highlights bloom. Bloom is the first thing adaptive quality turns off.

**Characters**
- The free licensed GLBs checked (Soldier: Idle/Walk/Run only;
  Xbot: robot; CesiumMan: no animations) cannot deliver a male+female
  couple with sit, dance and look-at-photo clips, so v2 uses two
  consistent stylized human characters built as a joint hierarchy
  (hips → spine → chest → neck → head; shoulders → arms; hips →
  thighs → shins → feet) in `src/character.js`.
- Animation is a state machine (idle / walk / run / sit / dance /
  look) with pose blending — no clip snapping. Walk phase advances
  with actual speed, so stride stays synced. Feet are kept roughly
  flat via foot-pitch compensation; contact shadows are cheap blob
  shadows, not shadow-map cost for every character.
- If you later supply a Mixamo / Ready Player Me pair, only
  `src/character.js` needs to change — the state names are the
  interface `main.js` uses.

**Joystick / movement / camera**
- Floating joystick: created where the finger lands on the left half,
  separate pointerId from drag-to-look, pointercancel /
  lostpointercapture / blur / tab-hide all reset it instantly, no
  tween holding stale input. Dead-zone 0.18, remapped, unit-circle
  clamped (diagonal = straight speed).
- One RAF loop, dt clamped to 0.05 s, exponential velocity blending
  (accel 11.5, brake 15.5), camera-relative movement, walk 2.05 m/s,
  run 3.15 m/s (Shift, or joystick pushed past 0.88).
- Third-person camera: exponential follow smoothing, wall clamping,
  exhibit-focus transitions that ease back to follow. Calm-camera
  toggle (🧘) halves look sensitivity.
- Collision: axis-separated sliding against courtyard / gallery /
  doorway rectangles + push-out circles for bench and plinth.
  No per-triangle tests.

**Architecture**
- Courtyard + facade + heart-lock doors, gallery hall (10 × 32 m)
  with columns and gold skirting, side-wall frames, a large focal
  frame on the far wall, a dedication placard, and a bench seating
  area at the far end. Clear walking paths, no floating clutter.

**Loading / errors**
- Photos load with per-photo fallbacks: a failed photo becomes a
  "Your photo here" placeholder and never blocks Start. A 10 s hard
  fallback also guarantees Start enables. WebGL failure shows a
  reload screen instead of a blank page.

**Performance (honest)**
- Target: 60 FPS on capable hardware, with graceful degradation —
  it is NOT claimed for every device, and no real-phone measurement
  was available in the build environment (see TESTING below).
- Adaptive quality steps down in order: bloom off → pixel ratio
  down → shadows off + petals to 40, only when average frame time
  stays above 24 ms over a 2.5 s window. Movement is never slowed
  to hit a frame target.
- No allocations in hot loops (reused vectors / matrices), one
  InstancedMesh for petals, DPR capped at 1.5, `?low` forces the
  low tier, `?debug` shows median / p95 frame time, dropped frames
  and quality level.

## Personalise — edit only `src/config.js`

Names, passcode, hint, placard text, photos, bubble lines, music.
Photos go in `public/photos/` (WebP/JPG, ≤1280 px, ~150 KB) and are
referenced as `photos/x.webp`. Music goes in `public/audio/` and is
set as `music: 'audio/song.mp3'` (starts after the Start tap).
Current content is still the original placeholders (Venky / "Your
Love", passcode `1234`, CC0 car photos) — replace before gifting.

## Run / build / deploy

    npm ci
    npm run dev       # local preview
    npm run build     # -> dist/

Deploy: upload the contents of `dist/` to GitHub Pages. `base: './'`
makes it work in a sub-folder such as `/museum/`. Do not publish the
raw source directory as the site.

## Controls

- Mobile: floating joystick (left half) to walk, drag (right half) to
  look, tap a frame / placard / bench / door to interact.
- Desktop: WASD or arrows, Shift to run, drag to look, E to interact
  with the nearest exhibit, Esc to close the viewer.
- Near a frame: 🖼️ View appears. Near the bench: 🪑 Sit together.
  Inside: 💃 Dance with me (partner must be within 3.5 m).

## Files

- `src/main.js` — orchestration, story, one RAF loop
- `src/character.js` — human characters + animation state machine
- `src/input.js` — keyboard, floating joystick, look drag
- `src/world.js` — collision zones + third-person camera
- `src/museum.js` — architecture, frames, lights layout, petals
- `src/audio.js` — music, synthesized footsteps, UI blip
- `src/lib.js` — pure movement / performance helpers (testable)
- `src/config.js` — all personal content (only file to edit)

## Known limits / unverified

- Characters are stylized procedural humans, not photorealistic
  scanned humans (see Characters above).
- 60 FPS was not measured on a real phone in this environment;
  `?debug` on a real device is the measurement to run before
  claiming it. Test: joystick in all directions, release/cancel
  while dragging, walls/doorways, lock modal, sit/dance, photo
  viewing, portrait → landscape, tab-hide and return.
