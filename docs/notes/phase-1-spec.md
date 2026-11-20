# Phase 1 — Spec & Assumptions

Date: 2026-11-20 (Asia/Ho_Chi_Minh)

## Scope

Phase 1 implements PRD-0: a playable Night 1 single-island game with:
- Player movement (run, jump, dash, pulse)
- Mote collection and lantern deposit
- Shade enemies with wander/chase/flee AI
- 300-second night timer (18 000 ticks at 60 Hz)
- 3 Flame lives, respawn after fall/shade hit
- Headless mode: JSONL output, deterministic with fixed seed

## Assumptions / Design Choices

| Item | Decision |
|------|----------|
| Tick rate | 60 Hz fixed |
| Island layout | Single circular island, r ≈ 25 m |
| Lantern positions | 5 lanterns at radius 25 m, evenly spaced |
| Mote ring 1 | 8 motes at r = 12 m |
| Mote ring 2 | 12 motes at r = 33 m |
| Shade spawn interval | Every 480 ticks (~8 s), first at tick 300 |
| Shade speed | 3 m/s wander, 5 m/s chase |
| Player run speed | 7 m/s max, 6-tick acceleration |
| Jump / gravity | Standard arcade; dash preserves altitude |
| Pulse radius | 8 m, 600-tick cooldown |
| Dash cooldown | 90 ticks |
| Fall edge | > 30 m from origin → fall → 60-tick respawn |
| Score | 10 pts per mote deposited per lantern |
| Determinism | Same seed + scenario + inputs → byte-for-byte identical JSONL |

## Deliverables

- `src/sim.mjs` — deterministic simulation (no rendering imports)
- `src/headless.mjs` — CLI runner
- `index.html` — WebGL browser game (Night 1)
- `tests/sim.test.mjs` — unit test suite
- `game.contract.json` — declared parameters
- `docs/proof/phase-1/` — headless run evidence
