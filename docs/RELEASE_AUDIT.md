# GrabShift 1.0 release audit

Validated on 2026-10-07 in Linux with Node.js 24.19.0, npm 11.9.0, and headless Chromium. CI is configured for Node 22 LTS. Browser automation uses an existing system Chromium executable via `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`.

## Completed checks

| Check | Result |
| --- | --- |
| Clean source copy without dependencies or build output | Created outside the working repository |
| `npm install` in that clean copy | Passed; committed lockfile content unchanged |
| `npm run dev` in the clean copy | Started by the Playwright web-server fixture; actual game loaded and played |
| `npm run typecheck` | Passed |
| `npm test` | 12 passed; 0 failed; 0 skipped |
| `npm run build` | Passed, including license notices in `dist/` |
| `npm run test:e2e` in clean-copy CI mode | 5 passed; 0 failed; no retry required |
| `npm run test:production` | Passed against built assets served at `/grabshift/` |
| `npm audit` | 0 known vulnerabilities at validation time |
| `git diff --check` | Passed |
| Source review | No required files missing, temporary files, or detected secret-shaped content |

Physics tests exercise upright stability, force-driven movement for both players, grounded jump gating, independent grip/release, self-grab exclusion, closest-target selection, opponent grabs and momentum transfer, every grabbable arena object type, swinging, scoring, simultaneous falls, and first-to-three/rematch state.

The stress pass runs 10,000 fixed simulation steps with seeded player inputs and checks finite body positions/velocities and bounded object/constraint counts. A separate test rebuilds the arena 100 times and checks object counts and collision-group separation. Disposing a simulation leaves zero bodies and constraints.

Browser tests use real keyboard events for both players, grip toggles, natural approach to an arena crate, jumping, pause/resume, controls navigation, settings persistence, focus-loss pause, resizing, complete match progression, rematch, and return to menu. Round elimination fixtures move bodies below the loss boundary to test scoring reliably; separate gameplay tests exercise unmodified movement. The production smoke test verifies relative asset paths, startup/countdown, keyboard play, pause, resizing, menu, license files, absence of the development inspection hook, and no browser console errors.

## Dedicated polish pass

- Replaced fragile passive knees with a force-based grounded balance spring.
- Kept balance active while carrying objects and retained a full grounded jump when gripping.
- Reduced ragdoll air drag so throws retain momentum.
- Switched the primitive-only scene to Canvas2D and disabled frame-delta smoothing after detecting incorrect countdown speed with software WebGL.
- Observed approximately 60 FPS in a 1280 × 720 automated gameplay capture on this machine. This is a sample, not a performance guarantee across hardware.
- Added original menu illustration, circle/diamond identity marks, expressive faces, grip rings, restrained impact flashes/particles, render-only impact compression, camera shake, procedural sound, and reduced-motion options.
- Inspected menu, controls, and gameplay screenshots. `screenshot.png` is an actual keyboard-driven gameplay capture with both players gripping the suspended crate.

## Dedicated release/debug pass

- Fixed accessible button names so decorative arrows are hidden from assistive technology.
- Kept range-input keyboard controls independent of gameplay key interception.
- Removed a hard-coded rope collision group that could overlap player groups after repeated resets.
- Verified production excludes the development hook and defaults to no physics debug rendering.
- Made CI a required job dependency of the Pages build/deploy workflow.
- Included runtime dependency MIT notices in both source and static output.
- Verified source ZIP structure and exclusion rules before delivery.

## Scope and remaining limits

One arena, two local keyboard players, no online multiplayer, AI, gamepads, or touch controls. Keyboard hardware may ghost simultaneous keys. Chromium was tested; other browser engines were not independently release-tested. Physics tests and automated play supplement, but do not replace, extended human balance testing. The GitHub Actions workflows are provided and their underlying commands passed locally; remote CI execution and GitHub Pages publication were not performed.
