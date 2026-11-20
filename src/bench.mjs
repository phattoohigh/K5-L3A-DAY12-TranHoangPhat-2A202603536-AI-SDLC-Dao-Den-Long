#!/usr/bin/env node
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { startGameServer } from "./server.mjs";

const PROCESS_START_MS = Date.now();

function parseArgs(argv) {
  const opts = { seed: 42, duration: 30, out: "bench.json", headless: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--seed") opts.seed = Number(argv[++i]);
    else if (arg === "--duration") opts.duration = Number(argv[++i]);
    else if (arg === "--out") opts.out = argv[++i];
    else if (arg === "--headless") opts.headless = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  if (!Number.isSafeInteger(opts.seed)) throw new Error("--seed must be an integer");
  if (!Number.isFinite(opts.duration) || opts.duration <= 0) throw new Error("--duration must be > 0");
  return opts;
}

function findBrowser() {
  const candidates = [
    process.env.CHROME_PATH,
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
  ].filter(Boolean);
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  for (const name of ["google-chrome", "chromium", "chromium-browser"]) {
    const res = spawnSync("which", [name], { encoding: "utf8" });
    if (res.status === 0 && res.stdout.trim()) return res.stdout.trim();
  }
  return null;
}

function measureTreeRssMb(rootPid) {
  try {
    const res = spawnSync("ps", ["-axo", "pid=,ppid=,rss="], { encoding: "utf8" });
    if (res.status !== 0) return null;
    const rows = res.stdout.trim().split("\n").map(line => line.trim().split(/\s+/).map(Number)).filter(r => r.length === 3);
    const children = new Map();
    const rssByPid = new Map();
    for (const [pid, ppid, rss] of rows) {
      rssByPid.set(pid, rss);
      if (!children.has(ppid)) children.set(ppid, []);
      children.get(ppid).push(pid);
    }
    const queue = [rootPid];
    const seen = new Set();
    let totalKb = 0;
    while (queue.length) {
      const cur = queue.pop();
      if (seen.has(cur)) continue;
      seen.add(cur);
      totalKb += rssByPid.get(cur) || 0;
      for (const ch of children.get(cur) || []) queue.push(ch);
    }
    return totalKb > 0 ? Math.round((totalKb / 1024) * 10) / 10 : null;
  } catch {
    return null;
  }
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const browser = findBrowser();
  if (!browser) {
    throw new Error("Could not find Chrome/Chromium binary. Set CHROME_PATH or install Google Chrome / Chromium.");
  }

  let resolveBench;
  const benchPromise = new Promise(resolve => { resolveBench = resolve; });
  const { server, url } = await startGameServer({ port: 0, onBenchResult: payload => resolveBench(payload) });

  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "ddl-bench-"));
  const benchUrl = `${url}/?bench=1&seed=${opts.seed}&duration=${opts.duration}&t0=${PROCESS_START_MS}`;
  const flags = [
    `--user-data-dir=${userDataDir}`,
    "--window-size=1280,720",
    "--window-position=80,80",
    "--disable-gpu-vsync",
    "--disable-frame-rate-limit",
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-background-timer-throttling",
    "--disable-backgrounding-occluded-windows",
    "--disable-renderer-backgrounding",
    "--autoplay-policy=no-user-gesture-required",
    `--app=${benchUrl}`,
  ];
  if (opts.headless) flags.unshift("--headless=new", "--use-gl=angle", "--enable-webgl", "--ignore-gpu-blocklist");

  const child = spawn(browser, flags, { stdio: "ignore" });
  let peakMemMb = null;
  const poll = setInterval(() => {
    const mb = measureTreeRssMb(child.pid);
    if (mb !== null && (peakMemMb === null || mb > peakMemMb)) peakMemMb = mb;
  }, 500);

  const timeoutMs = (opts.duration + 25) * 1000;
  const timeout = setTimeout(() => {
    clearInterval(poll);
    child.kill("SIGKILL");
    server.close();
    fs.rmSync(userDataDir, { recursive: true, force: true });
    process.stderr.write(`Benchmark timed out after ${timeoutMs / 1000}s\n`);
    process.exit(1);
  }, timeoutMs);

  const raw = await benchPromise;
  clearTimeout(timeout);
  clearInterval(poll);

  const finalSample = measureTreeRssMb(child.pid);
  if (finalSample !== null && (peakMemMb === null || finalSample > peakMemMb)) peakMemMb = finalSample;

  child.kill("SIGTERM");
  setTimeout(() => { try { child.kill("SIGKILL"); } catch {} }, 1500).unref();
  server.close();
  setTimeout(() => { try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch {} }, 800).unref();

  const report = {
    contract_version: "1.3",
    avg_fps: raw.avg_fps,
    p1_low_fps: raw.p1_low_fps,
    frame_ms_p95: raw.frame_ms_p95,
    frames: raw.frames,
    load_ms: raw.load_ms,
    peak_mem_mb: peakMemMb,
    vsync_off: true,
    renderer: raw.renderer || "WebGL 1.0 procedural renderer",
    os: `${os.type()} ${os.release()} (${os.platform()} ${os.arch()})`,
  };

  const json = JSON.stringify(report, null, 2) + "\n";
  if (opts.out) {
    fs.mkdirSync(path.dirname(path.resolve(opts.out)), { recursive: true });
    fs.writeFileSync(opts.out, json);
  }
  process.stdout.write(json);
  process.exit(0);
}

main().catch(err => {
  process.stderr.write(`${err.message}\n`);
  process.exit(1);
});
