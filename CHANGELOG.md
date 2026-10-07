# Changelog

## 2.0.0 — 2026-10-07

- Added a Play Game setup dialog with local two-player and player-versus-bot modes, plus an inline difficulty selector.
- Added easy, medium, and hard bots with distinct combat reaction, hand-use, prediction, and release behavior.
- Bots use the same input and physics rules as human players; navigation handles crates, gap crossings, swinging, and bounded recovery attempts.
- Added bot-aware instructions, HUD and result labels; rematches/restarts retain difficulty, and returning to local play restores full P2 keyboard control.
- Extended keyboard focus handling to native dropdowns and preserved back navigation through setup and controls.
- Added deterministic AI fairness/traversal/combat/stress tests, browser coverage for every mode/difficulty, and a production solo-mode smoke test.
- Updated the source package, screenshot documentation, and release audit; existing CI/Pages workflows validate and package v2.

## 1.0.0 — 2026-10-07

- Local two-player, ten-body ragdoll fighting with independent left/right grips.
- Force-driven locomotion, grounded jumping, climbing, pendulum swinging, and momentum-preserving release.
- The Pit arena: split platforms, central fall zone, overhead bar, suspended crate/rope, loose crates, and wrecking ball.
- First-to-three matches, countdowns, draw handling, round slowdown, rematches, and pause on focus loss.
- Original vector art, distinct player markings, contextual grip effects, collision particles, impact flashes, subtle squash, camera shake, and synthesized sound.
- Keyboard-accessible menus, sound/volume/reduced-motion settings, and aspect-preserving desktop scaling.
- Fixed-step Matter.js simulation, development-only physics inspection, deterministic gameplay tests, browser regressions, and a built-site subpath smoke test.
- CI-gated GitHub Pages workflow, MIT licensing, runtime notices, and source documentation.
