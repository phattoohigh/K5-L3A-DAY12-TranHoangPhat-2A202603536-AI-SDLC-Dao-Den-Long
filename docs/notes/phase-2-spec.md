# Phase 2 — Ticket-02 “Ba hòn đảo”

Source: Lab board, Ticket-02, Contract v1.1. Contract v1.1 replaces Phase 1's self-selected tuning. Simulation units are meters and seconds at a fixed 60 ticks/s; Y is up.

## Acceptance criteria

### Standard rules

- [ ] Run speed is 6.0 m/s; acceleration and stopping complete within 0.1 s; air steering remains available.
- [ ] Jump is 7.0 m/s with −20 m/s² gravity and only starts while grounded.
- [ ] Dash is 14 m/s for 12 ticks, cooldown 90 ticks from start, follows movement or facing, preserves altitude in air, grants no invulnerability.
- [ ] Mây carries at most 10 motes. Pickups use XZ distance ≤1 m and vertical difference ≤1.5 m.
- [ ] Each night starts with 20 motes on distinct valid points; active motes cap at 30; spawn one every 240 ticks when a free point exists.
- [ ] Each lantern needs 10 deposited motes. Interaction is within 2 m; deposits the carried/remaining amount into the nearest unlit lantern, tie by ID.
- [ ] Lit lanterns protect a 6 m radius from Bóng Mực; shades inside are pushed out within 30 ticks and cannot damage Mây during the push.
- [ ] Tỏa Sáng costs 3 motes, radius 5 m from Mây's feet +0.8 m, cooldown 180 ticks. It stuns each captured Bóng Mực for 120 ticks and pushes 4 m in the first 15 ticks. Repeated pulses refresh both effects.
- [ ] Bóng Mực move at 4.0 m/s (4.5 on Night 3), detect at 12 m and give up at 18 m. Contact is XZ ≤1 m and height difference ≤1.5 m.
- [ ] Shade damage removes one Flame, drops `floor(carried/2)`, causes 2 m recoil over 60 ticks, and grants 90 ticks invulnerability. At most one Flame is lost per tick.
- [ ] Falling below Y=−10 costs one Flame, discards all carried motes, waits 60 ticks, respawns at start and grants 90 ticks invulnerability. No respawn after the last Flame.
- [ ] Each night has 3 Flames. Durations are 300/330/360 seconds. No Flames loses immediately; otherwise all lights win even on the last time tick; otherwise dawn loses.
- [ ] Score: +10 per deposited mote, +100 per lit lantern, +5 for each shade hit by each pulse, and on win `floor(seconds_left)×2 + 50×Flames_left`.

### Maps and features

- [ ] Night 1: island radius 40 m; five fixed lantern positions; 24 valid mote sites; 12 shade sites; 2 shades at tick 300 then one per 480 ticks, max 6.
- [ ] Night 2: two radius-28 m islands centered at X=0 and X=70 joined by the specified unrailed trestle bridge; two launch pads; six fixed lanterns; 24 mote sites; shade interval 420 ticks, max 8; Bùa Gió at (35,0,0).
- [ ] Night 3: radius-45 m island with Y=0 base, north half-ring at Y=3, center disc at Y=6, two ramps and one launch pad; seven fixed lanterns; 30 mote sites; shade speed 4.5 m/s, interval 360 ticks, max 10; Bùa Gió at (30,0,25) and (−30,0,25).
- [ ] Gió Lạc on Nights 2–3: deterministic spawn schedule, idle/chase/flee/removed states, theft up to 3 motes, pulse interactions and dropped stolen motes.
- [ ] Bùa Gió lasts 600 ticks, refreshes on pickup, grants 7.2 m/s running and removes dash cooldown; charm respawns after 2700 ticks.
- [ ] Campaign flows through menu, night intro, play and results; wins advance, losses replay that night, Night 3 win shows dawn and total score.
- [ ] Pause freezes simulation time/cooldowns/spawns/TTL while wall ticks and snapshots continue. Resume, replay, settings and menu actions work.
- [ ] Volume and mouse sensitivity persist across reloads. Music and the listed gameplay effects are synthesized locally.
- [ ] HUD shows Flames, mm:ss timer, lit lanterns, score, 10-slot mote meter, dash/pulse cooldowns, interact prompt, off-screen lantern guidance, and wind warning. Timer flashes red at ≤30 s.
- [ ] Standard palette stays within 10% RGB channel tolerance. Environment light follows `0.15 + 0.55×(lit/total)`.

### Contract v1.1 and definition of done

- [ ] `game.contract.json` declares version 1.1, standardized tuning and the five added dash/night duration keys.
- [ ] Headless accepts nights 1–3, scenario/input files, seeded determinism, 60 Hz simulation, JSONL snapshots/events/end and the documented error codes.
- [ ] Snapshot includes night, wind, player velocity/grounded/invulnerability/cooldowns/charm, motes, drifters and charms.
- [ ] Shade states use `spawning`, `wander`, `chase`, `recoil`, `stunned`.
- [ ] At least one reproducible headless scenario covers each new feature; existing Phase 1 checks run with standardized tuning.
- [ ] Full-night headless run completes in ≤30 s; regular game averages ≥30 FPS at 1280×720.
- [ ] Acceptance results and proof are recorded without claiming unverified criteria.

## Recorded implementation limitations

The repository had no game source or `phase-1` tag when Ticket-02 became available. Therefore a before/after Phase 1 regression against the student's Phase 1 build cannot be run. This implementation recreates the PRD-0 core using Ticket-02's standard values; hidden-test compatibility remains unverified. See [`../proof/phase-2/results.md`](../proof/phase-2/results.md) for measured evidence and remaining checks. Do not read the unchecked criteria above as acceptance claims; they are the ticket checklist, and completion status is recorded separately in the results report.

## Assumptions where Ticket-02 is silent

- Night 3 starts on the elevated center disc at `(0,6,0)` so the player begins on a valid surface. Scenario files can override the player position. Night 1 and Night 2 preserve the Phase 1 origin spawn.
- A standard play run displays a selected night at a time; the UI campaign accumulates score across nights. The headless contract's `--night` runs that night independently.
