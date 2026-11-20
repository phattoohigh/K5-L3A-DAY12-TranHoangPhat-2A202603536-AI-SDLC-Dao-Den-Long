import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createGame, runHeadless, stepGame } from "../src/sim.mjs";

const quiet = { random_motes: false, random_shades: false, random_drifters: false, wind_enabled: false, motes: [], shades: [], drifters: [] };

test("Contract 1.2: starts with the selected night, 20 motes, and shortened clocks", () => {
  const g1 = createGame({ night: 1 });
  const g2 = createGame({ night: 2 });
  const g3 = createGame({ night: 3 });
  assert.equal(g1.motes.length, 20);
  assert.equal(g1.timeLeftTicks, 14_400);
  assert.equal(g2.timeLeftTicks, 16_200);
  assert.equal(g3.timeLeftTicks, 18_000);
  assert.equal(g2.lanterns.length, 6);
  assert.equal(g3.lanterns.length, 7);
  assert.deepEqual(g3.player.pos, [0, 6, 0]);
});

test("motes auto-pick only inside horizontal and vertical thresholds", () => {
  const g = createGame({ scenario: { ...quiet, motes: [[0, 1.5, 1], [0, 1.51, 0]] } });
  stepGame(g, {});
  assert.equal(g.player.carried, 1);
  assert.equal(g.motes.filter(m => m.active).length, 1);
});

test("interaction deposits to the nearest lantern and lights it at ten", () => {
  const g = createGame({ scenario: { ...quiet, player: { pos: [0, 0, 0], carried: 5 }, lanterns: [{ id: "L1", pos: [1.5, 0, 0], deposited: 7 }, { id: "L2", pos: [-0.5, 0, 0], deposited: 9 }] } });
  stepGame(g, { interact: true });
  assert.equal(g.lanterns.find(x => x.id === "L2").deposited, 10);
  assert.equal(g.lanterns.find(x => x.id === "L2").lit, true);
  assert.equal(g.lanterns.find(x => x.id === "L1").deposited, 7);
  assert.equal(g.player.carried, 4);
  assert.equal(g.score, 105);
});

test("pulse spends three motes, hits a 3D target, and applies stun", () => {
  const g = createGame({ scenario: { ...quiet, player: { carried: 3 }, shades: [{ id: "S1", pos: [0, 0, 4] }, { id: "S2", pos: [0, 6, 0] }] } });
  stepGame(g, { pulse: true });
  assert.equal(g.player.carried, 0);
  assert.equal(g.shades.find(x => x.id === "S1").state, "stunned");
  assert.equal(g.shades.find(x => x.id === "S2").state, "chase");
  assert.equal(g.score, 5);
});

test("dash uses the 14 m/s standard for twelve ticks without granting invulnerability", () => {
  const g = createGame({ scenario: { ...quiet, player: { pos: [0, 0, 0] } } });
  stepGame(g, { move: [0, 1], dash: true });
  assert.ok(Math.abs(g.player.pos[2] - 14 / 60) < 1e-9);
  assert.equal(g.player.dashTicks, 11);
  assert.equal(g.player.invuln, 0);
});

test("pause advances wall ticks but freezes simulation time and resumes on a fresh press", () => {
  const g = createGame();
  stepGame(g, { pause: true });
  assert.equal(g.state, "paused");
  assert.equal(g.simTick, 0);
  assert.equal(g.timeLeftTicks, 14_400);
  stepGame(g, { pause: false });
  stepGame(g, { pause: true });
  assert.equal(g.state, "playing");
  assert.equal(g.simTick, 1);
});

test("fall costs one flame once, drops all carried motes, and starts a 60 tick respawn", () => {
  const g = createGame({ scenario: { ...quiet, player: { pos: [42, -10.1, 0], carried: 7 }, lanterns: [{ id: "L1", pos: [0, 0, 25] }] } });
  const records = stepGame(g, {});
  const hit = records.find(r => r.name === "player_hit");
  assert.deepEqual(hit.data, { by: "fall", flames: 2, dropped: 7, lost: 7 });
  assert.equal(g.player.pos[0], 0);
  assert.equal(g.player.respawnTicks, 60);
});

test("drifter steals once; pulse during flee drops the stolen motes", () => {
  const g = createGame({ night: 2, scenario: { ...quiet, player: { pos: [0, 0, 0], carried: 6 }, drifters: [{ id: "D1", pos: [1, 0, 0], state: "chase" }] } });
  stepGame(g, {});
  assert.equal(g.player.carried, 3);
  assert.equal(g.drifters[0].stolen, 3);
  assert.ok(g.events.some(e => e.name === "drifter_steal"));
  g.player.carried = 3;
  stepGame(g, { pulse: true });
  assert.ok(g.events.some(e => e.name === "drifter_drop"));
});

test("same seed, scenario, and inputs produce byte-for-byte identical JSONL records", () => {
  const args = { seed: 991, night: 3, ticks: 500, scenario: quiet, inputFrames: [{ tick: 0, move: [0, 1] }] };
  assert.deepEqual(runHeadless(args).output, runHeadless(args).output);
});

test("night 2 launch pad preserves its standard horizontal launch speed", () => {
  const g = createGame({ night: 2, scenario: { ...quiet, player: { pos: [20, 0, 18] } } });
  stepGame(g, {});
  assert.equal(g.player.launched, true);
  assert.equal(Math.round(Math.hypot(g.player.vel[0], g.player.vel[2])), 24);
  assert.equal(g.player.vel[1], 14);
});

test("night 3 wind warns at 28 seconds and starts its seeded gust at 30 seconds", () => {
  const g = createGame({ night: 3, scenario: { ...quiet, wind_enabled: true } });
  stepGame(g, {});
  assert.equal(g.wind.active, false);
  assert.equal(g.wind.warning, false);
  for (let i = 1; i < 1680; i++) stepGame(g, {});
  assert.equal(g.wind.warning, true);
  assert.equal(g.wind.active, false);
  for (let i = 1680; i < 1800; i++) stepGame(g, {});
  assert.equal(g.wind.active, true);
  assert.ok(g.wind.dirDeg >= 0 && g.wind.dirDeg < 360);
});

test("Bùa Gió refreshes its 600 tick effect and enables lướt without cooldown", () => {
  const g = createGame({ night: 2, scenario: { ...quiet, player: { pos: [35, 0, 0] }, charms: [{ id: "C1", pos: [35, 0, 0], available: true }] } });
  stepGame(g, {});
  assert.equal(g.player.charmTicks, 600);
  stepGame(g, { move: [0, 1], dash: true });
  assert.equal(g.player.dashCd, 0);
  assert.equal(g.player.dashTicks, 11);
});

test("shade spawns twice at tick 300 and uses standardized spawn names", () => {
  const { game } = runHeadless({ seed: 44, night: 1, ticks: 300, snapshotEvery: 300 });
  assert.deepEqual(game.shades.map(s => s.id), ["S1", "S2"]);
  assert.ok(game.shades.every(s => s.state === "spawning"));
});

test("lit lantern pushes shades to the six metre safe edge over at most thirty ticks", () => {
  const g = createGame({ scenario: { ...quiet, shades: [{ id: "S1", pos: [3, 0, 0], state: "wander" }], lanterns: [{ id: "L1", pos: [0, 0, 0], lit: true }] } });
  for (let i = 0; i < 30; i++) stepGame(g, {});
  assert.ok(Math.hypot(g.shades[0].pos[0], g.shades[0].pos[2]) >= 5.99);
});

test("shade hit applies one Flame, drops half the carried motes, and recoil is bounded", () => {
  const g = createGame({ scenario: { ...quiet, player: { pos: [0, 0, 0], carried: 6 }, shades: [{ id: "S1", pos: [0, 0, .9], state: "chase" }] } });
  stepGame(g, {});
  assert.equal(g.player.flames, 2);
  assert.equal(g.player.carried, 3);
  assert.equal(g.shades[0].state, "recoil");
  const start = [...g.shades[0].pos];
  for (let i = 0; i < 60; i++) stepGame(g, {});
  assert.ok(Math.hypot(g.shades[0].pos[0] - start[0], g.shades[0].pos[2] - start[2]) <= 2.01);
});

test("dash preserves current altitude while airborne", () => {
  const g = createGame({ scenario: { ...quiet, player: { pos: [0, 2, 0] } } });
  g.player.grounded = false; g.player.vel[1] = 2;
  stepGame(g, { move: [0, 1], dash: true });
  assert.equal(g.player.pos[1], 2);
  assert.equal(g.player.vel[1], 2);
});

test("run acceleration and stopping complete within six fixed ticks", () => {
  const g = createGame({ scenario: quiet });
  for (let i = 0; i < 6; i++) stepGame(g, { move: [0, 1] });
  assert.equal(g.player.vel[2], 6);
  for (let i = 0; i < 6; i++) stepGame(g, { move: [0, 0] });
  assert.equal(g.player.vel[2], 0);
});

test("headless pause consumes wall ticks but resumes simulation from inputs", () => {
  const { game, output } = runHeadless({ ticks: 5, snapshotEvery: 1, scenario: quiet, inputFrames: [
    { tick: 0, pause: true }, { tick: 1, pause: false }, { tick: 2, pause: true }, { tick: 3, pause: false },
  ] });
  assert.equal(game.tick, 5);
  assert.equal(game.simTick, 3);
  assert.equal(game.timeLeftTicks, 14_400 - 3);
  assert.ok(output.some(row => row.type === "event" && row.name === "paused"));
  assert.ok(output.some(row => row.type === "event" && row.name === "resumed"));
});

test("lit lantern fuel decays exactly, goes out, and can be relit for five motes", () => {
  const g = createGame({ scenario: { ...quiet, player: { pos: [0, 0, 0], carried: 5 }, lanterns: [{ id: "L1", pos: [1, 0, 0], lit: true, fuel: 0.1, ever_lit: true }] } });
  for (let i = 0; i < 6; i++) stepGame(g, {});
  assert.equal(g.lanterns[0].lit, false);
  assert.equal(g.lanterns[0].deposited, 0);
  assert.ok(g.events.some(e => e.name === "lantern_out"));
  stepGame(g, { interact: true });
  assert.equal(g.lanterns[0].lit, true);
  assert.equal(g.lanterns[0].relitCount, 1);
  assert.equal(g.player.carried, 0);
  assert.equal(g.score, 65);
});

test("refuel uses the minimum motes and scores five each", () => {
  const g = createGame({ scenario: { ...quiet, player: { pos: [0, 0, 0], carried: 4 }, lanterns: [{ id: "L1", pos: [1, 0, 0], lit: true, fuel: 72, ever_lit: true }] } });
  const first = stepGame(g, { interact: true });
  assert.equal(g.player.carried, 1);
  assert.ok(g.lanterns[0].fuelUnits / 60 > 99.9);
  assert.equal(g.score, 15);
  assert.ok(first.some(e => e.name === "refuel" && e.data.amount === 3));
});

test("successful lights grow capacity by two up to twenty", () => {
  const g = createGame({ scenario: { ...quiet, player: { pos: [0, 0, 0], carried: 10, successful_lights: 3 }, motes: [[0, 0, 0]] } });
  stepGame(g, {});
  assert.equal(g.player.carried, 11);
  const snap = runHeadless({ ticks: 0, scenario: { ...quiet, player: { successful_lights: 3 } } }).output[0];
  assert.equal(snap.player.capacity, 16);
});

test("shade drains weak lantern, pulse grants total fifteen, and refuel restores safety", () => {
  const g = createGame({ scenario: { ...quiet, player: { pos: [0, 0, 10], carried: 3 }, lanterns: [{ id: "L1", pos: [0, 0, 0], lit: true, fuel: 20 }], shades: [{ id: "S1", pos: [1, 0, 0], state: "drain", target_lantern_id: "L1" }] } });
  stepGame(g, {});
  assert.equal(g.shades[0].state, "drain");
  const fuel = g.lanterns[0].fuelUnits;
  assert.equal(fuel, 20 * 60 - 6);
  g.player.pos = [0, 0, 4.5];
  stepGame(g, { pulse: true });
  assert.equal(g.shades[0].state, "stunned");
  assert.equal(g.score, 15);
});

test("dawn requires sixty percent lit and never ends early", () => {
  const lanterns = [1, 2, 3, 4, 5].map(i => ({ id: `L${i}`, lit: i <= 3, fuel: 100, ever_lit: i <= 3 }));
  const g = createGame({ scenario: { ...quiet, time_left_s: 2 / 60, lanterns } });
  stepGame(g, {});
  assert.equal(g.state, "playing");
  stepGame(g, {});
  assert.equal(g.state, "won");
  assert.ok(g.events.some(e => e.name === "game_over" && e.data.reason === "dawn_survived"));
  // Each of 3 lit lanterns decayed 2 ticks => 99.966..., floor = 99 => 3*(50+99) + 3*50 = 597
  assert.equal(g.score, 3 * (50 + 99) + 3 * 50);
});

test("dawn with fewer than sixty percent lit loses without dawn bonus", () => {
  const lanterns = [1, 2, 3, 4, 5].map(i => ({ id: `L${i}`, lit: i <= 2, fuel: 80, ever_lit: i <= 2 }));
  const g = createGame({ scenario: { ...quiet, time_left_s: 1 / 60, lanterns } });
  stepGame(g, {});
  assert.equal(g.state, "lost");
  assert.equal(g.score, 0);
  assert.ok(g.events.some(e => e.name === "game_over" && e.data.reason === "dawn"));
});

test("no_flames takes precedence over dawn survival on the final tick", () => {
  const lanterns = [1, 2, 3, 4, 5].map(i => ({ id: `L${i}`, lit: i <= 4, fuel: 90, ever_lit: i <= 4 }));
  const g = createGame({ scenario: { ...quiet, time_left_s: 1 / 60, player: { pos: [42, -10.1, 0], flames: 1 }, lanterns } });
  stepGame(g, {});
  assert.equal(g.state, "lost");
  assert.ok(g.events.some(e => e.name === "game_over" && e.data.reason === "no_flames"));
});

test("night 2 launch pad arcs under gravity and lands cleanly on the opposite island", () => {
  const g = createGame({ night: 2, scenario: { ...quiet, player: { pos: [20, 0, 18] } } });
  stepGame(g, {});
  assert.equal(g.player.launched, true);
  assert.equal(Math.round(Math.hypot(g.player.vel[0], g.player.vel[2])), 24);
  assert.equal(g.player.vel[1], 14);
  let landed = false;
  for (let i = 0; i < 120; i++) {
    stepGame(g, {});
    if (g.player.grounded) { landed = true; break; }
  }
  assert.equal(landed, true);
  assert.equal(g.player.launched, false);
  assert.equal(g.player.pos[1], 0);
  assert.ok(Math.hypot(g.player.pos[0] - 70, g.player.pos[2]) <= 28);
});

test("night 3 launch pad lands cleanly on the elevated center disc", () => {
  const g = createGame({ night: 3, scenario: { ...quiet, player: { pos: [0, 3, 13] } } });
  let landed = false;
  for (let i = 0; i < 90; i++) {
    stepGame(g, {});
    if (i > 5 && g.player.grounded) { landed = true; break; }
  }
  assert.equal(landed, true);
  assert.equal(g.player.pos[1], 6);
  assert.ok(Math.hypot(g.player.pos[0], g.player.pos[2]) <= 8);
});

test("night 3 blocks walking straight up sheer cliffs but allows ascending the ramp", () => {
  const cliff = createGame({ night: 3, scenario: { ...quiet, player: { pos: [0, 0, 24.05] } } });
  for (let i = 0; i < 30; i++) stepGame(cliff, { move: [0, -1] });
  assert.equal(cliff.player.pos[1], 0);
  assert.ok(cliff.player.pos[2] >= 24);

  const a = 30 * Math.PI / 180;
  const ramp = createGame({ night: 3, scenario: { ...quiet, player: { pos: [Math.cos(a) * 29.8, 0, Math.sin(a) * 29.8] } } });
  for (let i = 0; i < 90; i++) stepGame(ramp, { move: [-Math.cos(a), -Math.sin(a)] });
  assert.equal(ramp.player.pos[1], 3);
});

test("night 2 unrailed bridge supports crossing and drops player when stepping off", () => {
  const bridge = createGame({ night: 2, scenario: { ...quiet, player: { pos: [35, 0, 0] } } });
  for (let i = 0; i < 20; i++) stepGame(bridge, { move: [1, 0] });
  assert.equal(bridge.player.grounded, true);
  assert.equal(bridge.player.pos[1], 0);
  for (let i = 0; i < 120; i++) stepGame(bridge, { move: [0, 1] });
  assert.equal(bridge.player.flames, 2);
});

test("night 3 fall respawns at center disc, locks actions while respawning, and keeps full 90-tick invuln after", () => {
  const g = createGame({ night: 3, scenario: { ...quiet, player: { pos: [47, -10.1, 0], carried: 4 }, motes: [[0, 6, 0]] } });
  stepGame(g, {});
  assert.deepEqual(g.player.pos, [0, 6, 0]);
  assert.equal(g.player.respawnTicks, 60);
  assert.equal(g.player.invuln, 90);
  for (let i = 0; i < 59; i++) stepGame(g, { dash: true });
  assert.equal(g.player.carried, 0);
  assert.equal(g.player.invuln, 90);
  stepGame(g, {}); // respawnTicks 1 -> 0
  assert.equal(g.player.respawnTicks, 0);
  assert.equal(g.player.invuln, 90);
  stepGame(g, {}); // first active tick decrements invuln to 89
  assert.equal(g.player.invuln, 89);
});

test("refuel ignores full lanterns and restores safe zone when crossing fuel 30", () => {
  const full = createGame({ scenario: { ...quiet, player: { pos: [0, 0, 0], carried: 5 }, lanterns: [{ id: "L1", pos: [1, 0, 0], lit: true, fuel: 100 }] } });
  stepGame(full, { interact: true });
  assert.equal(full.player.carried, 5);
  assert.equal(full.score, 0);

  const weak = createGame({
    scenario: {
      ...quiet,
      player: { pos: [0, 0, 0], carried: 3 },
      lanterns: [{ id: "L1", pos: [1, 0, 0], lit: true, fuel: 20 }],
      shades: [{ id: "S1", pos: [3, 0, 0], state: "wander" }],
    },
  });
  stepGame(weak, { interact: true });
  assert.ok(weak.lanterns[0].fuelUnits / 60 >= 49);
  for (let i = 0; i < 30; i++) stepGame(weak, {});
  assert.ok(Math.hypot(weak.shades[0].pos[0] - 1, weak.shades[0].pos[2]) >= 5.99);
});

test("picked-up dropped motes do not count against the 30 active mote cap", () => {
  const motes = Array.from({ length: 29 }, (_, i) => ({ id: `M${i + 1}`, pos: [10 + i * 0.2, 0, 0], kind: "random" }));
  motes.push({ id: "M30", pos: [0, 0, 0], kind: "dropped", ttl_ticks: 480 });
  const g = createGame({ scenario: { ...quiet, random_motes: true, player: { pos: [0, 0, 0] }, motes } });
  stepGame(g, {});
  assert.equal(g.player.carried, 1);
  assert.equal(g.motes.filter(m => m.active).length, 29);
  for (let i = 1; i < 240; i++) stepGame(g, {});
  assert.equal(g.motes.filter(m => m.active).length, 30);
});

test("scenario shade starting in recoil does not throw", () => {
  const g = createGame({ scenario: { ...quiet, shades: [{ id: "S1", pos: [5, 0, 0], state: "recoil", state_ticks_left: 2 }] } });
  stepGame(g, {});
  stepGame(g, {});
  assert.equal(g.shades[0].state, "wander");
});

test("night 3 shades and drifters track terrain elevation instead of clipping underground", () => {
  const g = createGame({
    night: 3,
    scenario: {
      ...quiet,
      player: { pos: [0, 6, 0] },
      shades: [{ id: "S1", pos: [18, 0, 10], state: "wander" }],
      drifters: [{ id: "D1", pos: [0, 0, 5], state: "idle" }],
    },
  });
  stepGame(g, {});
  assert.equal(g.shades[0].pos[1], 3);
  assert.equal(g.drifters[0].pos[1], 6);
});

test("headless CLI validates arguments, malformed inputs, and deterministic JSONL output", () => {
  const badNight = spawnSync(process.execPath, ["src/headless.mjs", "--night", "4", "--ticks", "10"], { encoding: "utf8" });
  assert.equal(badNight.status, 1);

  const missingFile = spawnSync(process.execPath, ["src/headless.mjs", "--night", "1", "--ticks", "10", "--scenario", "tests/scenarios/does-not-exist.json"], { encoding: "utf8" });
  assert.equal(missingFile.status, 2);

  const run1 = spawnSync(process.execPath, ["src/headless.mjs", "--seed", "303", "--night", "1", "--scenario", "tests/scenarios/phase3-fuel-drain.json", "--ticks", "180", "--snapshot-every", "60"], { encoding: "utf8" });
  const run2 = spawnSync(process.execPath, ["src/headless.mjs", "--seed", "303", "--night", "1", "--scenario", "tests/scenarios/phase3-fuel-drain.json", "--ticks", "180", "--snapshot-every", "60"], { encoding: "utf8" });
  assert.equal(run1.status, 0);
  assert.equal(run1.stdout, run2.stdout);
  const rows = run1.stdout.trim().split("\n").map(line => JSON.parse(line));
  assert.equal(rows[0].type, "snapshot");
  assert.equal(rows[rows.length - 1].type, "end");
});
