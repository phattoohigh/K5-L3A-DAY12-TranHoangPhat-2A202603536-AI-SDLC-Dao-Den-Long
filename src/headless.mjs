#!/usr/bin/env node
import fs from "node:fs";
import { runHeadless } from "./sim.mjs";

function fail(message, code = 1) {
  process.stderr.write(`${message}\n`);
  process.exitCode = code;
}

function parseArgs(argv) {
  const values = { seed: 1, night: 1, ticks: null, snapshotEvery: 10, scenario: null, inputs: null, out: null };
  const names = new Map([["--seed", "seed"], ["--night", "night"], ["--ticks", "ticks"], ["--snapshot-every", "snapshotEvery"], ["--scenario", "scenario"], ["--inputs", "inputs"], ["--out", "out"]]);
  for (let i = 0; i < argv.length; i++) {
    const key = names.get(argv[i]);
    if (!key || i + 1 >= argv.length) throw new Error(`Unknown or incomplete argument: ${argv[i]}`);
    values[key] = argv[++i];
  }
  for (const k of ["seed", "night", "ticks", "snapshotEvery"]) if (values[k] !== null) {
    const n = Number(values[k]);
    if (!Number.isSafeInteger(n)) throw new Error(`${k} must be an integer`);
    values[k] = n;
  }
  if (values.ticks == null || values.ticks < 0) throw new Error("--ticks must be a non-negative integer");
  if (values.night < 1 || values.night > 3) throw new Error("--night must be 1, 2, or 3");
  if (values.snapshotEvery < 1) throw new Error("--snapshot-every must be at least 1");
  return values;
}

function readJson(file, kind) {
  if (!file) return null;
  try {
    const value = JSON.parse(fs.readFileSync(file, "utf8"));
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${kind} must be a JSON object`);
    return value;
  }
  catch (error) { throw Object.assign(new Error(`Invalid ${kind} JSON: ${error.message}`), { code: 2 }); }
}

function validateInputs(value) {
  if (value == null) return [];
  if (!value || !Array.isArray(value.frames)) throw Object.assign(new Error("inputs must contain a frames array"), { code: 2 });
  let previous = -1;
  for (const frame of value.frames) {
    if (!Number.isInteger(frame.tick) || frame.tick <= previous || frame.tick < 0) throw Object.assign(new Error("input frame ticks must increase strictly"), { code: 2 });
    previous = frame.tick;
    if (frame.move && (!Array.isArray(frame.move) || frame.move.length !== 2 || frame.move.some(v => !Number.isFinite(v) || v < -1 || v > 1))) throw Object.assign(new Error("move must be [x,z] with values in [-1,1]"), { code: 2 });
    if ("cam_yaw_deg" in frame && !Number.isFinite(frame.cam_yaw_deg)) throw Object.assign(new Error("cam_yaw_deg must be finite"), { code: 2 });
    for (const k of ["jump", "interact", "pulse", "dash", "pause"]) if (k in frame && typeof frame[k] !== "boolean") throw Object.assign(new Error(`${k} must be boolean`), { code: 2 });
  }
  return value.frames;
}

try {
  const args = parseArgs(process.argv.slice(2));
  const scenario = readJson(args.scenario, "scenario");
  const frames = validateInputs(readJson(args.inputs, "inputs"));
  const { output } = runHeadless({ seed: args.seed, night: args.night, ticks: args.ticks, scenario, inputFrames: frames, snapshotEvery: args.snapshotEvery });
  const jsonl = output.map(row => JSON.stringify(row)).join("\n") + "\n";
  if (args.out) fs.writeFileSync(args.out, jsonl);
  else process.stdout.write(jsonl);
} catch (error) {
  fail(error.message, Number.isInteger(error.code) ? error.code : 1);
}
