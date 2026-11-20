#!/usr/bin/env node
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import { performance } from "node:perf_hooks";

function run(cmd, args, label) {
  const start = performance.now();
  const res = spawnSync(cmd, args, { encoding: "utf8" });
  const elapsedMs = Math.round(performance.now() - start);
  if (res.status !== 0) {
    process.stderr.write(`[FAIL] ${label} (exit ${res.status})\n${res.stderr || res.stdout}\n`);
    process.exit(1);
  }
  return { stdout: res.stdout, elapsedMs };
}

// 1. CP0 smoke check
const cp0 = run(process.execPath, ["tools/cp0/hello-headless.mjs"], "CP0 smoke");
assert.equal(JSON.parse(cp0.stdout).status, "ready");

// 2. Syntax build & unit test suite
run("npm", ["run", "build"], "npm run build");
run("npm", ["test"], "npm test");

// 3. Contract v1.2 declaration sanity
const contract = JSON.parse(fs.readFileSync("game.contract.json", "utf8"));
assert.equal(contract.contract_version, "1.2");
assert.equal(contract.tuning.night1_duration_s, 240);
assert.equal(contract.tuning.night2_duration_s, 270);
assert.equal(contract.tuning.night3_duration_s, 300);
assert.equal(contract.tuning.win_ratio, 0.6);

// 4. Phase 3 deterministic fuel/drain scenario (2 identical runs)
const drainArgs = ["src/headless.mjs", "--night", "1", "--seed", "303", "--scenario", "tests/scenarios/phase3-fuel-drain.json", "--ticks", "180", "--snapshot-every", "60"];
const drain1 = run(process.execPath, drainArgs, "Phase 3 fuel-drain run 1");
const drain2 = run(process.execPath, drainArgs, "Phase 3 fuel-drain run 2");
assert.equal(drain1.stdout, drain2.stdout, "fuel-drain output must be byte-for-byte deterministic");
const drainRows = drain1.stdout.trim().split("\n").map(line => JSON.parse(line));
assert.equal(drainRows[0].player.capacity, 14);
assert.equal(drainRows[0].lanterns[0].fuel, 20);
assert.ok(drainRows.some(r => r.type === "event" && r.name === "fuel_drain"));

// 5. Phase 3 full Night 3 headless performance (< 30 s budget)
const perfArgs = ["src/headless.mjs", "--night", "3", "--seed", "42", "--scenario", "tests/scenarios/night3-performance.json", "--ticks", "18000", "--snapshot-every", "18000"];
const perf = run(process.execPath, perfArgs, "Phase 3 Night 3 full-run performance");
assert.ok(perf.elapsedMs < 30_000, `Full Night 3 run took ${perf.elapsedMs} ms (>= 30000 ms)`);
const perfRows = perf.stdout.trim().split("\n").map(line => JSON.parse(line));
assert.equal(perfRows[perfRows.length - 1].state, "lost");

// 6. Night 2 launch pad landing verification (regression for gravity bug)
const padArgs = ["src/headless.mjs", "--night", "2", "--seed", "42", "--scenario", "tests/scenarios/night2-charm-pad.json", "--ticks", "120", "--snapshot-every", "30"];
const pad = run(process.execPath, padArgs, "Night 2 launch pad trajectory");
const padSnaps = pad.stdout.trim().split("\n").map(line => JSON.parse(line)).filter(r => r.type === "snapshot");
const lastPadSnap = padSnaps[padSnaps.length - 1];
assert.equal(lastPadSnap.player.grounded, true, "Player must land after launch pad");
assert.equal(lastPadSnap.player.pos[1], 0, "Player must land on island surface Y=0");
assert.ok(Math.hypot(lastPadSnap.player.pos[0] - 70, lastPadSnap.player.pos[2]) <= 28, "Player must land on Island 2");

process.stdout.write(JSON.stringify({
  status: "ok",
  contract_version: contract.contract_version,
  determinism: "identical",
  night3_full_run_ms: perf.elapsedMs,
  pad_landing_pos: lastPadSnap.player.pos,
}, null, 2) + "\n");
