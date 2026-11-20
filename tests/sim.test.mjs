import test from "node:test";
import assert from "node:assert/strict";
import { createGame, runHeadless, stepGame } from "../src/sim.mjs";

const quiet = { random_motes: false, random_shades: false, random_drifters: false, wind_enabled: false, motes: [], shades: [], drifters: [] };

test("Contract 1.1: starts with the selected night, 20 motes, and standard clocks", () => {
  const g1 = createGame({ night: 1 });
  const g2 = createGame({ night: 2 });
  const g3 = createGame({ night: 3 });
  assert.equal(g1.motes.length, 20);
  assert.equal(g1.timeLeftTicks, 18_000);
  assert.equal(g2.timeLeftTicks, 19_800);
  assert.equal(g3.timeLeftTicks, 21_600);
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
  assert.equal(g.score, 110);
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
  assert.equal(g.timeLeftTicks, 18_000);
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
  assert.equal(game.timeLeftTicks, 18_000 - 3);
  assert.ok(output.some(row => row.type === "event" && row.name === "paused"));
  assert.ok(output.some(row => row.type === "event" && row.name === "resumed"));
});
