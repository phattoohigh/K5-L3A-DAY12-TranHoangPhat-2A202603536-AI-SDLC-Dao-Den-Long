#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { createGame, nightInfo, stepGame } from "./sim.mjs";

function parseArgs(argv) {
  const opts = { seed: 7, nights: 10, out: null };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--seed") opts.seed = Number(argv[++i]);
    else if (arg === "--nights") opts.nights = Number(argv[++i]);
    else if (arg === "--out") opts.out = argv[++i];
    else throw new Error(`Unknown argument: ${arg}`);
  }
  if (!Number.isSafeInteger(opts.seed)) throw new Error("--seed must be an integer");
  if (!Number.isSafeInteger(opts.nights) || opts.nights < 1) throw new Error("--nights must be >= 1");
  return opts;
}

function makeRng(seed) {
  let s = (seed >>> 0) || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

const rssMb = () => Math.round((process.memoryUsage().rss / (1024 * 1024)) * 10) / 10;

try {
  const opts = parseArgs(process.argv.slice(2));
  const t0 = performance.now();
  const results = [];
  let crashes = 0;
  let memStartMb = 0;

  for (let i = 1; i <= opts.nights; i++) {
    const night = ((i - 1) % 3) + 1;
    const nightSeed = opts.seed + i;
    const maxTicks = nightInfo(night).seconds * 60;
    const rng = makeRng(nightSeed ^ 0x9e3779b9);

    try {
      let game = createGame({ seed: nightSeed, night });
      if (i === 1) memStartMb = rssMb();

      const input = { move: [0, 0], cam_yaw_deg: 0, jump: false, dash: false, pulse: false, interact: false, pause: false };
      for (let t = 0; t < maxTicks && game.state === "playing"; t++) {
        if (t % 30 === 0) {
          const angle = rng() * Math.PI * 2;
          input.move[0] = Math.cos(angle);
          input.move[1] = Math.sin(angle);
        }
        input.jump = rng() < 0.05;
        input.dash = rng() < 0.03;
        input.pulse = rng() < 0.02;
        input.interact = rng() < 0.1;
        stepGame(game, input, { snapshotEvery: 999999 });
        // Keep event buffer bounded during long soak runs to mirror normal game lifecycle
        if (game.events.length > 256) game.events.length = 0;
      }

      results.push(game.state === "won" ? "won" : "lost");
      game = null;
    } catch (err) {
      crashes++;
      results.push("crash");
      process.stderr.write(`Night ${i} (night=${night}, seed=${nightSeed}) crashed: ${err.message}\n`);
    }
  }

  if (typeof globalThis.gc === "function") globalThis.gc();
  const memEndMb = rssMb();
  const durationS = Math.round(((performance.now() - t0) / 1000) * 100) / 100;

  const summary = {
    nights: opts.nights,
    crashes,
    results,
    mem_start_mb: memStartMb,
    mem_end_mb: memEndMb,
    duration_s: durationS,
  };

  const json = JSON.stringify(summary, null, 2) + "\n";
  if (opts.out) {
    fs.mkdirSync(path.dirname(path.resolve(opts.out)), { recursive: true });
    fs.writeFileSync(opts.out, json);
  } else {
    process.stdout.write(json);
  }
  if (crashes > 0) process.exit(1);
} catch (err) {
  process.stderr.write(`${err.message}\n`);
  process.exit(1);
}
