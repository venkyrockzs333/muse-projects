# VN Museum — complete cinematic 3D overhaul

Three.js + Vite, no backend. This is an upgrade of the love-museum
rebuild (`love-museum-rebuild/`, left untouched as rollback), not a
from-scratch demo. Characters, joystick, photo exhibits, placard,
bench sit/dance, lock-door story, petals, adaptive quality and the
`?debug` FPS overlay are all preserved from that base.

## What changed

**Lighting (brighter overall, still not flat white)**
- ACES tone mapping, exposure 1.15, sRGB output, fog 30–85 m.
- Layered lights: stronger hemisphere fill (0.95, warm sky / lighter
  ground), brighter outdoor directional, warm forecourt lamps, one
  shadow-casting lobby key spot (1024), warm central spot, two
  warm-white sign spots, and 8 neutral-white exhibit zone spots
  (intensity 70, up from 45).
- Tasteful colour accents (not a rainbow wash): rose in the west
  gallery, teal in the east gallery, soft lavender in the lobby,
  plus matching rose/teal accent strips on the gallery walls.
  Warm light still dominates.
- Bloom stays restrained (threshold 0.80, strength 0.38) and is the
  first thing adaptive quality turns off. Walls and floors are
  lighter warm tones than before, so details read clearly, while
  ACES keeps highlights from blowing out into whiteout.

**Player-following spotlight**
- One SpotLight + one target, created once in `main.js` and reused
  every frame (never recreated). Position is above/behind the player,
  target is ~3.6 m ahead on the player's actual world yaw (not the
  camera alone), both smoothed exponentially. No shadow (selective
  shadows: only the lobby key spot casts) to keep frame cost down.

**Grand entrance + VN MUSEUM sign**
- Facade 24 m wide, 7 m high, with a real doorway opening
  (x −1.6…1.6, height 4.4) — solid segments, lintel, doorframe and
  gold cornice around it, not a painted wall. Columns, glass panels
  beside the doorway, forecourt with columns, planters and carpet.
- Sign: the exact text **VN MUSEUM** as real gold 3D block lettering
  (segment-built boxes with depth, on a dark stone plaque, lit by
  two warm-white spots), visible from the spawn point. No HTML label
  is used as signage.

**Real functional double doors**
- Two distinct panels (1.6 m each) with hinge pivots, stiles, top
  rail, solid lower panel, a genuine glass opening, and gold
  handles/bars. Hinge rotation is eased (exponential smoothing).
- Before unlocking, doors stay closed and tapping one opens the
  passcode modal (base story, passcode in `src/config.js`).
- After unlocking, doors open on approach from either side, stay
  open while either character is in the doorway or within 3.4 m,
  and close only when both are far and not in the doorway.
- Collision matches: the doorway corridor is walkable only when
  unlocked AND doors are more than half open, so the player never
  walks through a visibly closed panel. Tapping an unlocked door
  walks through it as a fallback.

**Expanded museum (all openings are real, all passages collide)**
- Exterior plaza: x −12…12, z 1.2…24.
- Grand lobby: x −9…9, z −12…−0.6, 7 m ceiling.
- Central hall: x −9…9, z −32…−12, 6 m ceiling, display plinths.
- West gallery: x −18…−9, z −28…−12, 4.5 m ceiling.
- East gallery: x 9…18, z −28…−12, 4.5 m ceiling.
- Side galleries connect through real 3 m openings at z −22…−19 in
  the shared walls, with lintels above. Collision gates in
  `src/world.js` enforce exactly those openings — no invisible
  barrier across an open doorway, no walking through a solid wall.
- No decorative dead-end doors, no endless empty corridors.

**Materials**
- Calibrated PBR: honed stone, warm marble (rough ~0.32, metal 0.05
  — never chrome), dark stone floors, painted walls (rough 0.9),
  wood, brushed champagne gold used only for trim/sign/handles,
  restrained transparent glass. Shared unit-box and column
  geometries are reused for all architecture.

**Characters / controls**
- Unchanged procedural characters (`src/character.js`) and floating
  joystick (`src/input.js`): walk/run/sit/dance/look state machine,
  gait synced to actual speed, body orientation follows movement,
  camera-relative movement, third-person camera now clamped to the
  player's current zone (plaza / interior / west / east).

**Performance**
- Target 60 FPS on capable hardware with graceful degradation
  (bloom off → DPR down → shadows off + petals 40, when average
  frame time stays above 24 ms over 2.5 s). This is NOT claimed for
  every device — no real-phone measurement was available in the
  build environment (see VALIDATION.md). Use `?debug` on a real
  device for median/p95 frame time before claiming 60 FPS.

## Personalise — edit only `src/config.js`

Names, passcode, hint, placard text, photos, bubble lines, music.
Current content is still the base placeholders (Venky / "Your Love",
passcode `1302`, CC0 car photos) — replace before gifting. Photos go
in `public/photos/` (WebP/JPG, ≤1280 px). Note for GitHub upload:
binary photos cannot be pushed via the Muse GitHub API path — they
need web-UI upload, as with the previous project.

## Run / build / deploy

    npm ci
    npm run dev       # local preview
    npm run build     # -> dist/

Deploy: upload the contents of `dist/` to GitHub Pages. `base: './'`
in `vite.config.js` makes it work in a sub-folder such as
`/muse-projects/vn-museum/` (or `/love-museum/`). Do not publish the
raw source directory as the site. `?low` forces the low tier,
`?debug` shows the FPS overlay.

## Controls

- Mobile: floating joystick (left half) to walk, drag (right half)
  to look, tap a frame / placard / bench / door to interact.
- Desktop: WASD or arrows, Shift to run, drag to look, E to interact
  with the nearest exhibit, Esc to close the viewer.
- Near a frame: 🖼️ View appears. Near the bench: 🪑 Sit together.
  Inside: 💃 Dance with me (partner must be within 3.5 m).
- **Kiss:** sit together on the bench first — a 💋 Kiss button then
  appears (and only then). Tap it and both characters lean toward
  each other, heads turn and meet, floating hearts appear during
  the ~2.2 s hold, then they ease back to the normal seated pose
  (total ~3.8 s). Standing up, dancing, or leaving the bench
  cancels it cleanly with no stuck pose. Tasteful lean-in only —
  no explicit content.

## Files

- `src/main.js` — orchestration, lighting rig, follow spotlight,
  auto double doors, kiss timeline + floating hearts, one RAF loop
- `src/museum.js` — VN Museum architecture, sign, doors, galleries,
  frames, fixtures, plinths, petals
- `src/world.js` — zones, side-gallery gates, door corridor,
  obstacle circles, zone-clamped third-person camera
- `src/character.js` — human characters + animation state machine
  (unchanged from base)
- `src/input.js` — keyboard, floating joystick, look drag
  (unchanged from base)
- `src/lib.js` — pure movement / performance helpers
- `src/config.js` — all personal content (only file to edit)
- `src/audio.js`, `src/style.css` — unchanged from base

## Known limits / unverified

- Characters are stylized procedural humans, not photorealistic
  scanned humans.
- 60 FPS was not measured on a real phone in this environment;
  `?debug` on a real device is the measurement to run before
  claiming it. Visual / joystick behaviour in a live browser was
  also not measured here (no browser/WebGL in the build
  environment) — see VALIDATION.md for exactly what was checked
  in Node versus what remains unmeasured.
