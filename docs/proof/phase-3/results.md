# Phase 3 verification record

Date: 2026-11-20 (Asia/Ho_Chi_Minh)  
Machine: MacBook Pro (macOS), Node.js 26.0.0

## Automated checks (`npm run verify`)

- `node tools/cp0/hello-headless.mjs`: passed (`{"status":"ready","project":"dao-den-long","mode":"headless","runtime":"Node.js 26.0.0"}`).
- `npm run build`: passed syntax checks across `src/sim.mjs`, `src/headless.mjs`, `src/web/game.mjs`, and `tools/verify.mjs`.
- `npm test`: **35/35 passed**, 0 failed. Includes:
  - All retained Phase 1–2 behavior (movement, pickups, pulse, dash, pause, drifters, wind, charms, shade spawn, safe zones).
  - Phase 2 audit regression fixes: ballistic launch pad landing on Night 2 (`[51.614, 0, 6.619]`) and Night 3 (`Y=6` center disc), Night 3 cliff blocking vs 30° ramp ascent, Night 2 unrailed bridge crossing/falling, Night 3 respawn at `[0, 6, 0]` with full 90-tick post-respawn invulnerability, active mote cap excluding picked-up dropped motes, and defensive scenario recoil initialization.
  - Phase 3 Contract v1.2 rules: exact 1/60 fuel decay, `lantern_out`, 5-mote relight, refuel (ignoring full lanterns and restoring safe zone past fuel 30), dynamic capacity up to 20, `drain` + `+15` pulse bonus, dawn survival (`>= 60%`) with exact bonus score `sum(50 + floor(fuel)) + 50 * flames`, dawn loss (`< 60%`), and `no_flames` precedence on the final tick.
  - Headless CLI (`src/headless.mjs`) validation for exit codes `1` (bad flags), `2` (missing/malformed scenario JSON), and byte-for-byte determinism.
- Determinism: `phase3-fuel-drain.json` run twice with `--seed 303`; outputs are byte-for-byte identical.
- Full Night 3 v1.2 performance: 18,000 ticks (300 simulated seconds) completed in **63 ms** (`0.063 s`) wall time, well under the 30 s budget; no-input fixture ended cleanly with `lost/dawn`.
- CI & Harness: `.github/workflows/ci.yml` runs CP0 smoke, build, test, and `npm run verify` on every push/tag; `.githooks/pre-commit` enforces `npm run build && npm test` locally; `.agents/skills/verify-and-proof/SKILL.md` documents the repeatable proof workflow.

## Browser acceptance & current visual limitation

- Prior Phase 3 live Chrome smoke check confirmed Menu, Night 1 Intro, Settings (`ddl.colorblind` persisted in `localStorage`), active Night 1 HUD (04:00, 3 Flames, 0/5 lamps, 10 mote slots, L1–L5 fuel bars), and ~119 FPS in an unconstrained window.
- Subsequent visual fixes (exact `0.15 + 0.55*(lit/total)` environment light, hiding safe-zone ring when `fuel < 30`, removing railings from the Night 2 unrailed bridge, adding `|dy| <= 1.5` to `[E]` prompt, fixing `colors.teal` and colorblind `⚠` positioning) were verified by code review and syntax checks.
- **Not yet re-captured in headless/automated browser**: Automated Chrome DevTools connection failed in this environment (`DevToolsActivePort` not enabled in local Chrome), so fresh 1280×720 screenshots and a controlled sustained 1280×720 average-FPS log are **not claimed** here and should be captured locally before Phase 4 / video demo.

## Artifacts

- [`fuel-drain.jsonl`](fuel-drain.jsonl): 3-second deterministic weak-lantern/drain fixture (Contract v1.2).
- [`night3-performance-v12.jsonl`](night3-performance-v12.jsonl): complete 300-second Night 3 performance run (18,000 ticks in 63 ms).
- [`night2-launch-pad.jsonl`](night2-launch-pad.jsonl): deterministic Night 2 launch pad + charm trajectory proving ballistic arc and Island 2 landing at `[51.614, 0, 6.619]`.
- Scenarios: `tests/scenarios/phase3-fuel-drain.json`, `tests/scenarios/night3-performance.json`, `tests/scenarios/night2-charm-pad.json`.

## Known external limitation

Hidden grader scenarios are unavailable. No claim is made about them; all local checks and `npm run verify` are green.
