#!/usr/bin/env node
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { addLeaderboardEntry, DEFAULT_STORE, exportLeaderboard, loadLeaderboard } from "./leaderboard.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".mp4": "video/mp4",
  ".jsonl": "application/x-ndjson; charset=utf-8",
};

function parseArgs(argv) {
  const opts = { port: 4173, exportPath: null, store: process.env.DDL_LEADERBOARD_FILE || DEFAULT_STORE };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--export-leaderboard") {
      if (i + 1 >= argv.length) throw new Error("--export-leaderboard requires an output file path");
      opts.exportPath = argv[++i];
    } else if (argv[i] === "--port") {
      if (i + 1 >= argv.length) throw new Error("--port requires an integer");
      opts.port = Number(argv[++i]);
      if (!Number.isInteger(opts.port) || opts.port < 0 || opts.port > 65535) throw new Error("Invalid port");
    } else if (argv[i] === "--store") {
      opts.store = argv[++i];
    } else {
      throw new Error(`Unknown argument: ${argv[i]}`);
    }
  }
  return opts;
}

export function startGameServer({ port = 4173, store = DEFAULT_STORE, onBenchResult = null } = {}) {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

    // Local Leaderboard REST API
    if (url.pathname === "/api/leaderboard") {
      if (req.method === "GET") {
        const entries = loadLeaderboard(store);
        res.writeHead(200, { "Content-Type": MIME[".json"], "Cache-Control": "no-store" });
        res.end(JSON.stringify({ entries }));
        return;
      }
      if (req.method === "POST") {
        let body = "";
        req.on("data", chunk => { body += chunk; if (body.length > 16384) req.destroy(); });
        req.on("end", () => {
          try {
            const data = JSON.parse(body || "{}");
            const result = addLeaderboardEntry(data, store);
            res.writeHead(200, { "Content-Type": MIME[".json"] });
            res.end(JSON.stringify(result));
          } catch (err) {
            res.writeHead(400, { "Content-Type": MIME[".json"] });
            res.end(JSON.stringify({ error: err.message }));
          }
        });
        return;
      }
    }

    // Internal benchmark result collector (active only when invoked by src/bench.mjs)
    if (url.pathname === "/api/bench-result" && req.method === "POST" && onBenchResult) {
      let body = "";
      req.on("data", chunk => { body += chunk; });
      req.on("end", () => {
        try {
          const payload = JSON.parse(body || "{}");
          res.writeHead(200, { "Content-Type": MIME[".json"] });
          res.end(JSON.stringify({ ok: true }));
          onBenchResult(payload);
        } catch (err) {
          res.writeHead(400, { "Content-Type": MIME[".json"] });
          res.end(JSON.stringify({ error: err.message }));
        }
      });
      return;
    }

    // Static asset serving (strictly inside ROOT)
    let relPath = decodeURIComponent(url.pathname);
    if (relPath === "/") relPath = "/index.html";
    const filePath = path.resolve(ROOT, `.${relPath}`);
    if (!filePath.startsWith(ROOT)) {
      res.writeHead(403);
      res.end("Forbidden");
      return;
    }
    fs.readFile(filePath, (err, buf) => {
      if (err) {
        res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
        res.end("Not found");
        return;
      }
      const ext = path.extname(filePath).toLowerCase();
      res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream", "Cache-Control": "no-store" });
      res.end(buf);
    });
  });

  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => {
      const addr = server.address();
      resolve({ server, port: addr.port, url: `http://127.0.0.1:${addr.port}` });
    });
  });
}

// Run as CLI if executed directly
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const opts = parseArgs(process.argv.slice(2));
    if (opts.exportPath) {
      exportLeaderboard(opts.exportPath, opts.store);
      process.exit(0);
    }
    startGameServer({ port: opts.port, store: opts.store }).then(({ url }) => {
      process.stdout.write(`Đảo Đèn Lồng server listening on ${url}\nPress Ctrl+C to stop.\n`);
    }).catch(err => {
      process.stderr.write(`Failed to start server: ${err.message}\n`);
      process.exit(1);
    });
  } catch (err) {
    process.stderr.write(`${err.message}\n`);
    process.exit(1);
  }
}
