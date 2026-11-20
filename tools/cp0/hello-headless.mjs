#!/usr/bin/env node

// CP0 smoke check: confirms the selected Node.js runtime works without a GPU.
const result = {
  status: "ready",
  project: "dao-den-long",
  mode: "headless",
  runtime: `Node.js ${process.versions.node}`,
};

process.stdout.write(`${JSON.stringify(result)}\n`);
