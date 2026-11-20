# Phase 1 Verification Record

Date: 2026-11-20 (Asia/Ho_Chi_Minh)
Machine: MacBook Pro, Node.js 26.0.0

## Automated Checks

- `node tools/cp0/hello-headless.mjs`: passed — `{"status":"ready","project":"dao-den-long","mode":"headless","runtime":"Node.js 26.0.0"}`
- `npm test`: **18 / 18 tests passed, 0 failed** (106 ms)
  - Covers: movement, motes, lanterns, pulse, shades, safety zones, fall/respawn, deterministic JSONL output, pause/resume, dash, shade spawn, lantern repulsion

## Headless Baseline Run (Night 1)

Command:
```
node src/headless.mjs --night 1 --seed 42 --ticks 3600 --snapshot-every 3600 --out docs/proof/phase-1/night1-baseline.jsonl
```

Output: `night1-baseline.jsonl` — 2 snapshots (tick 0 and tick 3600) + events

Key observations from tick-3600 snapshot:
- State: `playing` (no-input run, player idle — expected)
- 6 shades spawned and in `wander` state
- 24 motes active (8 ring-1 + 12 ring-2 + 4 respawned by tick 3600)
- 5 lanterns unlit (no input → no deposits — expected)
- time_left_s: 240 (60 simulated seconds consumed = 3600 ticks / 60 Hz)

## Determinism Check

Run 2 with identical seed/scenario/inputs:
```
diff night1-baseline.jsonl night1-baseline-run2.jsonl → no differences
```
Result: **byte-for-byte identical** ✅

## Not Yet Verified at Phase 1 Cutoff

- WebGL renderer sustained FPS measurement (browser smoke only)
- Full 300-second night completion scenario (would require 18 000 ticks)
- Phase 1 hidden grader scenarios (unavailable)

## Artifacts

- `night1-baseline.jsonl` — deterministic headless snapshot
- `night1-baseline-run2.jsonl` — second run confirming determinism
