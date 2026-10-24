# VN Museum — validation

Base: `love-museum-rebuild/` (untouched, rollback). New project:
`vn-museum/`. Build environment has Node + Vite but no browser /
WebGL / real phone, so live visual, joystick-touch and FPS checks
are honestly marked UNMEASURED below, not claimed.

## Build (pass)

    $ npm ci        # added 19 packages
    $ npm run build
    vite v8.3.5 building client environment for production...
    ✓ 27 modules transformed.
    dist/index.html                   2.85 kB │ gzip:   1.19 kB
    dist/assets/index-vm-LZPLk.css    6.99 kB │ gzip:   2.39 kB
    dist/assets/index-BwHRxe5M.js   700.85 kB │ gzip: 190.66 kB
    ✓ built in 725ms

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
  `toneMapping = ACESFilmicToneMapping`, exposure 1.05, fog
  30–85 m, camera far 120. Bloom threshold 0.85 / strength 0.32
  (unchanged, restrained).
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
| 8 | Floor/exhibits visible without whiteout | PASS (code) / UNMEASURED (live) | Warm mid-tone walls, dark floors, ACES 1.05, hemi 0.5, no flat wash; live brightness not measured here |
| 9 | Dark regions retain navigable detail | PASS (code) / UNMEASURED (live) | Hemisphere fill 0.5 + follow spot + zone spots; no region relies on a single light |
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
    dist/index.html, dist/assets/index-BwHRxe5M.js,
    dist/assets/index-vm-LZPLk.css, dist/photos/car1.webp … car8.webp

## What remains placeholder / unmeasured

- Personal content in `src/config.js` is still placeholder
  (Venky / "Your Love", passcode `1234`, CC0 car photos, no music).
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
