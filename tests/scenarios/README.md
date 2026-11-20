# Headless phase scenarios

- `night2-drifter.json` + `night2-drifter.inputs.json`: deterministic theft followed by pulse/drop.
- `night2-charm-pad.json`: charm pickup and bridge-pad launch at the same known position.
- `night3-wind.json`: wind disabled/enabled timelines use the night 3 28 s warning and 30 s gust schedule.
- Additional assertions for pickup height, nearest-lantern deposit, safe zones, fall/respawn, dash, pauses, fixed spawn ticks, and three-night map constants live in `../sim.test.mjs`.
