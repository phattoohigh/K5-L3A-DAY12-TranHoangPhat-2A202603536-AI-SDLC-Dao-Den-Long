# Phase 2 verification record

Date: 2026-11-20 (Asia/Ho_Chi_Minh)

## Automated checks

- `npm run build`: passed (Node syntax checks for simulation, headless runner, and browser game).
- `npm test`: passed, 18 tests / 18 passed / 0 failed. Coverage includes standardized movement, motes, lanterns, pulse, shades, safety zones, fall/respawn, deterministic JSONL output, pause in headless mode, Night 2 launch pad and drifters, Night 3 wind, and charm behavior.
- Full Night 3 timer run: `node src/headless.mjs --night 3 --scenario tests/scenarios/night3-performance.json --ticks 21600 --snapshot-every 21600 --out docs/proof/phase-2/night3-performance.jsonl`; completed 21,600 ticks (360 simulated seconds) in 0.07 s wall time on this machine. The final state is `lost` / `dawn`, expected for the no-input performance fixture. This measures headless simulation only.
- Reproducible feature fixtures were generated for the Night 2 drifter and charm/pad cases. The Night 3 wind scenario is checked by the unit suite.
- Browser smoke check: menu, Night 1 intro, active game HUD rendered in Chrome; HUD reported 120 FPS during the observation. The browser viewport was not set to 1280×720 and this was not a sustained average-FPS measurement.

## Not verified / unavailable

- Phase 1 regression and hidden tests: unavailable because this checkout contains no Phase 1 game source and no `phase-1` Git tag. The three existing local commits are CP0 setup, not a Phase 1 baseline.
- The ticket's exact 1280×720 sustained 30 FPS target has not been measured.
- Browser pause/resume was not confirmed in the visual smoke check. Pause, cooldown, and wall-tick semantics are covered by headless unit tests; UI settings, campaign completion, exact pixel palette tolerance, audio mix, and all terrain/AI edge cases still need acceptance review.
- This is an implementation against the available Ticket-02 Contract v1.1 details. Compatibility with grader-only scenarios is unknown.

## Artifacts

- `night2-drifter.jsonl`
- `night2-charm-pad.jsonl`
- `night3-performance.jsonl`
- Repeatable scenarios and inputs are under `tests/scenarios/`; assertions are in `tests/sim.test.mjs`.
