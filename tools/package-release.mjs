#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIST = path.join(ROOT, "dist");
const STAGE = path.join(DIST, "dao-den-long-v1.0.0");
const ZIP_PATH = path.join(DIST, "dao-den-long-v1.0.0.zip");

fs.rmSync(STAGE, { recursive: true, force: true });
fs.mkdirSync(STAGE, { recursive: true });

const includeFiles = [
  "index.html",
  "package.json",
  "game.contract.json",
  "README.md",
  "LICENSE",
  "CREDITS.md",
  "CHANGELOG.md",
];
for (const file of includeFiles) {
  const src = path.join(ROOT, file);
  if (fs.existsSync(src)) fs.copyFileSync(src, path.join(STAGE, file));
}

fs.cpSync(path.join(ROOT, "src"), path.join(STAGE, "src"), { recursive: true });

// Include a tiny one-command launcher script for macOS/Linux
const launcher = `#!/usr/bin/env sh
set -eu
echo "Starting Đảo Đèn Lồng v1.0.0 at http://127.0.0.1:4173"
exec node src/server.mjs "$@"
`;
fs.writeFileSync(path.join(STAGE, "play.sh"), launcher, { mode: 0o755 });

fs.rmSync(ZIP_PATH, { force: true });
const zip = spawnSync("zip", ["-rq", ZIP_PATH, "dao-den-long-v1.0.0"], { cwd: DIST, encoding: "utf8" });
if (zip.status !== 0) {
  process.stderr.write(`zip failed: ${zip.stderr || zip.stdout}\n`);
  process.exit(1);
}
const sizeKb = Math.round(fs.statSync(ZIP_PATH).size / 1024);
process.stdout.write(JSON.stringify({ status: "packaged", zip: path.relative(ROOT, ZIP_PATH), size_kb: sizeKb }) + "\n");
