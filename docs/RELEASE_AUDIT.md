# GrabShift 2.0 release audit

Validated on 2026-10-07 in Linux with Node.js 22.23.3 and 24.19.0, npm 11.9.0, and headless Chromium 151. CI now validates Node 22 and 24; Pages builds with Node 22 LTS. Browser automation uses an existing system Chromium executable via `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`.

## Completed checks

| Check | Result |
| --- | --- |
| Clean source copy without dependencies or build output | Created outside the working repository |
| `npm install` in that clean copy | Passed; committed lockfile content unchanged |
| `npm run dev` in the clean copy | Started successfully; browser entered a Medium bot match and verified autonomous movement without console errors |
| `npm run typecheck` | Passed, including in the clean copy |
| `npm test` | 22 passed; 0 failed; 0 skipped, including in the clean copy |
| `npm run build` | Passed, including license notices in `dist/`, including in the clean copy |
| `npm run test:e2e` | 10 passed; 0 failed; no retry required |
| `npm run test:production` | Passed against built assets served at `/grabshift/`, including in the clean copy |
| `npm audit` | 0 known vulnerabilities at validation time |
| `git diff --check` | Passed |
| Source release | ZIP integrity, required files, root folder, version, and exclusion rules checked |

## Physics and bot validation

Existing physics tests cover upright stability, both players' force-driven movement, grounded jump gating, independent grip/release, self-grab exclusion, closest-target selection, opponent grabs and momentum transfer, every grabbable arena object type, swinging, scoring, simultaneous falls, and first-to-three/rematch state.

Ten additional bot tests verify legal input-only decisions without physics mutation, difficulty-dependent reaction times, identical body statistics, deterministic seeded behavior, autonomous traversal and environmental/opponent grips at all three difficulties, releases, controlled momentum-preserving throws that cross the loss boundary, and reset behavior. Combat and movement use the same forces, grab radius, and jump restrictions as a human player.

The combined stress tests run 28,000 fixed simulation steps: 10,000 with seeded player inputs and 6,000 per bot difficulty against an active opponent. They check finite body positions/velocities and bounded constraint counts across repeated rounds. A separate test rebuilds the arena 100 times and checks object counts and collision-group separation. Disposing a simulation leaves zero bodies and constraints.

## Browser and production validation

Five existing local multiplayer browser tests still pass. Five additional tests cover mode selection with keyboard and mouse, conditional difficulty selection, selection persistence, responsive layout, all three bot difficulties, autonomous movement and jumping, human movement, and exclusion of player-two keyboard input in solo mode. Bot decisions stop during countdown and pause. Full match fixtures verify human and bot winner messages, scoring, round resets, rematch/restart difficulty retention, and switching back to local multiplayer without a leftover bot.

Round elimination fixtures move bodies below the loss boundary to test scoring reliably; separate gameplay tests exercise unmodified movement. The production smoke test verifies relative asset paths, startup/countdown, local keyboard play, pause, resizing, menus, license files, absence of the development inspection hook, and a Hard bot moving without keyboard input. Browser checks monitor console/page errors.

## Dedicated v2 tuning and release passes

- Tuned shared navigation to clear crates, brake onto platforms, and cross the central gap even on Easy.
- Added landing targets and release/retry timing to prevent prolonged hanging beneath platforms.
- Differentiated combat through reaction speed, anticipation, grip timing, and recovery. Hard favors stable dragging near edges rather than constant jumping.
- Ran 24 additional seeded bot duels with alternating sides: Hard won 7/12 against Easy and 11/12 against Medium, with no timeouts or draws. This small automated sample is a tuning aid, not a guarantee of difficulty ordering for human players.
- Inspected setup, controls, and gameplay screenshots; the new setup screenshot is included in the README. Observed approximately 59 FPS in one automated gameplay sample, not a performance guarantee.
- Preserved native select keyboard navigation and verified focus/back/pause behavior.
- Verified a clean dependency installation, development startup, type checks, simulation tests, production build, and production browser smoke test.
- Retained CI-gated Pages deployment and the downloadable `grabshift-source` CI artifact containing `grabshift.zip`.

## Scope and remaining limits

One arena; local keyboard multiplayer and solo play with three heuristic bot difficulties. No online multiplayer, gamepads, or touch controls. Keyboard hardware may ghost simultaneous keys. Chromium was tested; other browser engines were not independently release-tested. Automated physics and browser tests supplement, but do not replace, extended human playtesting and balance feedback.

GitHub Actions workflow commands passed locally. Remote Actions status and Pages publication cannot be verified from this environment because GitHub API access is blocked; a successful push alone does not establish deployment success.

## CI compatibility correction

The original 19-test suite passed locally on Node 24 but failed on Node 22. Reproducing the failure showed the Medium bot had already crossed the arena and gripped its opponent before losing a fight roughly 21 seconds later. The assertion incorrectly classified any subsequent loss as failed navigation and assumed one full chaotic fight would have the same winner across JavaScript runtimes.

Traversal tests now end at engagement and still require jumping, environmental grips, releases, crossing the gap, and survival during approach. Three separate controlled scenarios exercise each difficulty's outward throw decision, real grip release, preserved velocity, and resulting boundary elimination. No gameplay rules or difficulty settings were changed, and no tests were skipped. The existing long-running combat stress coverage remains. Both Node 22 and 24 run the full CI workflow; only Node 22 uploads the source artifact to avoid matrix upload conflicts.

Correction validation: all 22 simulation tests passed on both runtimes. A separate clean source copy on Node 22.23.3 passed `npm ci`, type checking, all 22 simulation tests, the production build, all 10 browser tests in CI mode without retries, and the production subdirectory smoke test. Workflow YAML parsing and deployment dependency checks also passed.
