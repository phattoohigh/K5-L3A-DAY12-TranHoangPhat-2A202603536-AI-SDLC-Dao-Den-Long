# Phase 3 verification record

Date: 2026-11-20 (Asia/Ho_Chi_Minh)

## Automated checks

- `npm run build`: passed for simulation, headless runner and browser module.
- `npm test`: **23/23 passed**, 0 failed. The suite retains Phase 1–2 behavior not replaced by Ticket-03 and adds fuel decay/out/relight, refuel, dynamic capacity, drain/pulse scoring and dawn-threshold tests.
- Determinism: `phase3-fuel-drain.json` was run twice with seed 303; `diff` returned no differences.
- Full Night 3 v1.2: 18,000 ticks completed in **0.06 s** wall time, below the 30 s limit. The no-input fixture correctly ended `lost/dawn`.
- JSONL snapshots expose one-decimal `fuel`, `ever_lit`, `relit_count`, player `capacity`, and shade `drain`; `fuel_drain` is emitted at 60-tick intervals.

## Browser acceptance

- Menu, intro, settings and active Night 1 were played in Chrome from `http://localhost:4173`.
- Active HUD visibly showed 04:00, 3 Flames, 0/5 lamps, 10 mote slots and individual L1–L5 fuel bars.
- “Bảng màu dễ phân biệt” toggled successfully and persisted through localStorage (`ddl.colorblind`).
- The observed active-game counter was **119 FPS** in the inspected Chrome window. This is a live HUD observation, not a controlled sustained 1280×720 benchmark; the exact benchmark remains for the grader/common machine.
- Layout remained readable with fuel bars separated from Flames, time, score, mote capacity and skill cooldowns.

## Artifacts

- `fuel-drain.jsonl`: three-second deterministic weak-lantern/drain fixture.
- `night3-performance-v12.jsonl`: complete 300-second Night 3 no-input performance run.
- Source scenario: `tests/scenarios/phase3-fuel-drain.json`.

## Known external limitation

Hidden grader scenarios are unavailable. No claim is made about them; public/local checks are green.
