---
name: verify-and-proof
description: Run build, unit tests, deterministic headless scenarios, and refresh real evidence files under docs/proof/ without hand-editing outputs. Use before tagging a phase or after modifying simulation, headless CLI, or HUD rendering.
---

# Verify and Proof Workflow

Use this skill whenever `src/sim.mjs`, `src/headless.mjs`, `src/web/`, or `game.contract.json` changes.

## 1. Automated Gate

Run the full local gate in one command:

```bash
npm run verify
```

This checks:
1. CP0 smoke check (`node tools/cp0/hello-headless.mjs`)
2. Syntax checks across all ES modules (`npm run build`)
3. Full unit + CLI test suite (`npm test`)
4. Contract v1.2 parameters in `game.contract.json`
5. Byte-for-byte determinism across repeated headless runs
6. Full Night 3 headless run wall-time (`< 30 s`)
7. Full trajectory regression (launch pad arc & island landing)

Never claim completion or create a tag while `npm run verify` fails.

## 2. Regenerating Real Headless Evidence

Always generate `.jsonl` proof directly from `src/headless.mjs` (never edit output by hand):

```bash
node src/headless.mjs --night 1 --seed 303 --scenario tests/scenarios/phase3-fuel-drain.json --ticks 180 --snapshot-every 60 --out docs/proof/phase-3/fuel-drain.jsonl
node src/headless.mjs --night 3 --seed 42 --scenario tests/scenarios/night3-performance.json --ticks 18000 --snapshot-every 18000 --out docs/proof/phase-3/night3-performance-v12.jsonl
node src/headless.mjs --night 2 --seed 42 --scenario tests/scenarios/night2-charm-pad.json --ticks 120 --snapshot-every 30 --out docs/proof/phase-3/night2-launch-pad.jsonl
```

## 3. Visual & HUD Verification (1280×720)

1. Start static server: `npm run serve` (`http://localhost:4173`).
2. Set browser viewport to `1280×720`.
3. Verify Menu → Night 1 Intro → Playable HUD (04:00 clock, 3 Flames, L1–L5 fuel bars, 10–20 mote slots, cooldowns), Pause (`P`/`Esc`), and Settings (`Bảng màu dễ phân biệt` persisted in `localStorage`).
4. Capture real screenshots into `docs/proof/phase-3/` and record observed FPS + machine specs in `docs/proof/phase-3/results.md`.
