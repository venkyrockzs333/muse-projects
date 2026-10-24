# VN Museum — validation

Base: `love-museum-rebuild/` (untouched, rollback). New project:
`vn-museum/`. Build environment has Node + Vite but no browser /
WebGL / real phone, so live visual, joystick-touch and FPS checks
are honestly marked UNMEASURED below, not claimed.

## Build (pass)

    $ npm run build   (node_modules already installed; npm ci was used for the original build)
    vite v8.3.5 building client environment for production...
    ✓ 27 modules transformed.
    dist/index.html                   2.91 kB │ gzip:   1.21 kB
    dist/assets/index-vm-LZPLk.css    6.99 kB │ gzip:   2.39 kB
    dist/assets/index-BCyctZGa.js   704.23 kB │ gzip: 191.67 kB
    ✓ built in 542ms

## New in this build: kiss, brighter lighting, passcode 1302

**Kiss animation (tasteful, adult couple, lean-in only)**
- Button: `💋 Kiss` in `index.html`, initially hidden; `main.js`
  toggles it with `toggle('hidden', together !== 'sit')`, and
  `together === 'sit'` is set only by `sitTogether()`, which seats
  both characters at once — so it cannot appear while walking,
  dancing, in the lock-door flow, or with only one character seated.
- Timeline (Node-checked, 18/18 checks in `/tmp/test-kiss-lighting.mjs`,
  script not shipped in the zip): lean-in eases 0→1 over 0.8 s,
  hold at 1 for 2.2 s (0.8→3.0 s), return eases 1→0 over 0.8 s,
  total 3.8 s. Pose is blended in `character.js` (spine/chest lean
  toward the partner, head turns toward the partner and tilts
  gently, arms slightly in) on top of the sit pose, so joints ease
  through the normal pose-blending rate — no snap, no explicit
  content, heads simply meet. Roots slide only ±0.17 m toward each
  other on the bench while seated.
- Hearts: 8 meshes sharing ONE geometry + ONE material, created
  once in `main.js`, visible only during the hold phase, floating
  above the bench; no per-frame object creation.
- Cancel: `cancelKiss()` is called from sit-toggle (stand up),
  dance start, and every frame where `together !== 'sit'`; the
  kiss amount then decays exponentially to 0, so no pose can stick.
  Movement while seated is already blocked (`canMove` excludes
  `together === 'sit'`), and dancing requires leaving the sit state.
- Live touch: UNMEASURED — no browser/WebGL/phone here, so the tap
  on a real device was not observed; do not claim live touch success.
  Code-level visibility, timing, cancel and pose checks pass.

**Brighter, more colourful lighting (no flat white)**
- Exposure 1.05 → 1.15, hemisphere 0.5 → 0.95 (ground 0x201812 →
  0x3a2c20), outdoor directional 0.55 → 0.85, forecourt lamps
  30 → 55, lobby key spot 110 → 160, central spot 90 → 140,
  sign spots 50 → 80, follow spot 85 → 110, exhibit spots 45 → 70.
- Three new tasteful accent point lights, created once: rose
  (west gallery), teal (east gallery), soft lavender (lobby), plus
  matching rose/teal accent strips on the gallery walls. Warm light
  still dominates; this is not a rainbow wash.
- Materials lifted in `museum.js`: walls 0x4a3d31 → 0x6b5a48,
  marble 0xb8a88e → 0xcabfa6, stone 0x8a7a66 → 0x9c8c78, floors
  #241e18 → #3a322a, ceiling #17120e → #2a231c, background/fog
  #17120e → #241c14. Bloom threshold 0.85 → 0.80, strength
  0.32 → 0.38. ACES tone mapping is retained, so highlights are
  still rolled off rather than blown to white; live brightness was
  not measured in a browser here (UNMEASURED live, as before).

**Door passcode: 1234 → 1302**
- Changed only in `src/config.js` (`passcode: '1302'`). The lock
  flow in `main.js` compares against `CONFIG.passcode`, so no UI
  code hardcodes the old value and no other file needed changing
  for the flow itself; the hint text is generic ("the day I
  proposed (DDMM)") and does not mention 1234. README and this
  file were updated to 1302. No other personal content was changed.

**Regression check for this build**
- `node --check` passes for all `src/*.js`; Vite build passes
  (above); kiss/lighting test script 18/18; original 23 collision
  checks are unchanged code paths (world.js untouched in this
  build) — sit/dance/joystick/doors/spotlight/exhibits code was
  not removed, only the kiss + lighting additions above.

- `node --check` passes for `src/main.js`, `src/museum.js`,
  `src/world.js`.
- Module imports resolve in Node: `museum.js` exports
  `buildMuseum` + `placeholderTex`, `character.js` exports `Human`,
  `input.js` exports `Input`.
- `vite.config.js` base is `'./'`, so `dist/` works under a GitHub
  Pages subfolder. No new dependencies were added
  (three ^0.186.1, gsap ^3.15.0, vite ^8.3.5 — same as base).
- No GitHub push and no repository-visibility change were made by
  this task (parent handles upload; binary photos cannot go via
  the Muse GitHub API path).

## Automated checks (pass, Node)

Collision / gate tests in a temporary script (23 cases, run from
the project so `three` resolves; script removed before zipping):

- PASS spawn plaza walkable; plaza far corner walkable.
- PASS lobby walkable; central hall walkable.
- PASS west gallery walkable; east gallery walkable.
- PASS facade wall blocked when locked, outside the doorway.
- PASS door corridor blocked when locked.
- PASS door corridor blocked when doors closed (open=0) and when
  only half open (open=0.5).
- PASS door corridor open when doors fully open (open=1).
- PASS walk through doorway when open; walk blocked at closed door.
- PASS side wall blocked at z=−15 crossing x=−9 and x=+9.
- PASS side opening allowed at z=−20.5 crossing x=−9 and x=+9.
- PASS bench obstacle push-out (including the degenerate
  exactly-on-centre case, pushed toward the entrance side).
- PASS zoneFor: west (−18…−9), east (9…18), interior (z −32…−0.6),
  plaza (z 1.2…24).
- PASS outside all zones is not walkable.

Static / code checks:

- PASS sign text: `src/museum.js` contains `VN MUSEUM` (3
  occurrences: comment, text constant, and the sign builder call)
  and a segment-built letter table for V, N, M, U, S, E + space.
- PASS follow spotlight: single `SpotLight` + single target created
  once in `main.js`, position/target smoothed with
  `1 − exp(−6·dt)`, direction from `me.yaw` (player world yaw),
  never recreated per frame (grep: one creation site, updates only
  copy into the reused vectors).
- PASS auto doors: `doorOpen`/`doorTarget` in `main.js`, hinge
  angles `doorL = +1.9·doorOpen`, `doorR = −1.9·doorOpen`,
  target = 1 only when unlocked and either character is in the
  doorway or within 3.4 m of the door centre; corridor walkable
  only when `doorOpen > 0.55`.
- PASS lighting pipeline: `outputColorSpace = SRGBColorSpace`,
  `toneMapping = ACESFilmicToneMapping`, exposure 1.15, fog
  30–85 m, camera far 120. Bloom threshold 0.80 / strength 0.38
  (restrained; brighter build, see new section above).
- PASS single animation loop: one `requestAnimationFrame(frame)`
  in `main.js`; no per-frame `new THREE.Light/Material/Geometry`
  in the hot loop (petals reuse matrix/quaternion/euler temps).
- PASS preserved features: `character.js`, `input.js`, `audio.js`,
  `lib.js`, `style.css` are byte-identical to the base; `config.js`
  differs only in `title: 'VN Museum'`; exhibits (8 photos),
  placard, bench, sit/dance, lock modal, petals, adaptive quality
  and `?debug` overlay code are all still present in `main.js`.

## Per-check table (task §10)

| # | Check | Result | Evidence |
|---|-------|--------|----------|
| 1 | VN MUSEUM sign visible, spelled correctly | PASS (code) / UNMEASURED (live view) | Segment letter table + `buildSign('VN MUSEUM')` on a plaque at (0, 5.7, 1.55), lit by two sign spots; no live-browser screenshot was possible here |
| 2 | Entrance recognisable from spawn | PASS (code) / UNMEASURED (live view) | 24 m facade, columns, gold cornice, sign above a 3.2 m doorway; spawn (0, 0, 9) faces −z toward it; intro sweep starts at (0, 6, 20) |
| 3 | Both door panels open correctly | PASS (code) / UNMEASURED (live) | Hinge pivots at x=±1.6, eased rotation ±1.9·doorOpen, coordinated by one `doorOpen` value; no scaling/dissolving |
| 4 | Walk through entrance without collision trap | PASS (Node) | Doorway tests above; partner also keeps doors open, so no lock-out behind the player |
| 5 | Museum visibly larger, connected galleries | PASS (code) / UNMEASURED (live) | Plaza 24×22.8 m + lobby + central hall (18×31.4 m) + two 9×16 m side galleries, vs base 10×32 m hall |
| 6 | Interior visible through open doorway | PASS (code) / UNMEASURED (live) | Doorway is a real gap in facade geometry (segments + lintel around it); doors are frame+glass, not solid slabs |
| 7 | Spotlight follows movement/turning smoothly | PASS (code) / UNMEASURED (live) | Smoothed position/target, player-yaw direction; works at speed 0 (target stays ahead) by construction |
| 8 | Floor/exhibits visible without whiteout | PASS (code) / UNMEASURED (live) | Lighter warm walls, mid-tone floors, ACES 1.15, hemi 0.95, no flat wash; live brightness not measured here |
| 9 | Dark regions retain navigable detail | PASS (code) / UNMEASURED (live) | Hemisphere fill 0.95 + follow spot + zone spots + colour accents; no region relies on a single light |
| 15 | Kiss button + animation + cancel | PASS (code) / UNMEASURED (live touch) | Button only when together==='sit'; lean 0.8 s / hold 2.2 s / return 0.8 s; hearts only in hold; cancel on stand/dance/leave-sit with decaying pose; no live touch observed here |
| 16 | Brighter, colourful lighting | PASS (code) / UNMEASURED (live) | Hemi/exposure/exhibit/spot values raised (see new section); rose/teal/lavender accents; ACES retained against whiteout; live look not measured here |
| 17 | Door passcode 1302 | PASS (code) / UNMEASURED (live) | `src/config.js` passcode '1302'; lock flow compares CONFIG.passcode; old 1234 absent from config; live unlock not observed here |
| 10 | Exhibit lighting creates depth, not uniform brightness | PASS (code) / UNMEASURED (live) | 8 neutral-white zone spots aimed at frames/zones, warm architectural spots separate; no uniform ambient wash |
| 11 | Character animation + joystick functional | PASS (code) / UNMEASURED (live touch) | `character.js`/`input.js` unchanged from base; gait synced to speed in that code; touch joystick cannot be exercised without a device here |
| 12 | No new console errors / broken asset references | PASS (build) / UNMEASURED (runtime console) | Vite build succeeds with no warnings shown; all photo paths are the base's `photos/car*.webp` (present in `public/` and `dist/`); runtime console was not observable here |
| 13 | Build succeeds | PASS | Vite 8.3.5 output above |
| 14 | Frame rate / frame time measured on target device | UNMEASURED | No real phone, browser or WebGL in this environment. Do NOT claim 60 FPS. Run on a real device with `?debug` (median/p95/dropped/quality) before claiming it. Adaptive quality is retained as the degradation path. |

## How to run

    npm ci
    npm run dev       # local preview (Vite, --host)
    npm run build     # -> dist/
    # or serve dist/ statically; base './' keeps asset paths relative

## File list (excluding node_modules)

    README.md
    VALIDATION.md
    index.html
    package.json
    package-lock.json
    vite.config.js
    src/audio.js, src/character.js, src/config.js, src/input.js,
    src/lib.js, src/main.js, src/museum.js, src/style.css,
    src/world.js
    public/photos/car1.webp … car8.webp
    dist/index.html, dist/assets/index-BCyctZGa.js,
    dist/assets/index-vm-LZPLk.css, dist/photos/car1.webp … car8.webp

## What remains placeholder / unmeasured

- Personal content in `src/config.js` is still placeholder
  (Venky / "Your Love", passcode `1302`, CC0 car photos, no music).
  Replace before gifting.
- Photos: the 8 WebP files are included in `dist/` and in this zip,
  but they cannot be pushed to GitHub via the Muse API path (text
  files only) — the parent upload must handle them via web UI, as
  with the previous project, or the live site will show
  "Your photo here" placeholders for missing photos.
- Live visual check, touch joystick, sit/dance in a real browser,
  and any FPS number: all UNMEASURED in this environment (see
  table). No FPS or photorealism claim is made.
- Regressions known: none found by the automated checks. One
  behaviour change is intentional: after unlocking, the entrance
  doors now close when both characters walk away (base doors stayed
  open forever); they reopen on approach from either side, and
  tapping an unlocked door walks through it as a fallback.
