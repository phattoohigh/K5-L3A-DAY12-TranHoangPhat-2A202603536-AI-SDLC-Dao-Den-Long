# Agent notes

- Project: Đảo Đèn Lồng, a single-player 3D game for macOS/Linux.
- Stack: vanilla JavaScript ES modules; WebGL for the playable view and Node.js for shared deterministic/headless game logic. Avoid runtime dependencies unless a requirement needs one.
- Keep gameplay simulation independent of rendering and use fixed 60 Hz ticks.
- For the headless contract, preserve deterministic output for the same seed, scenario, and inputs. Do not fake or hand-edit evidence.
- Before product implementation, run the CP0 smoke command: `node tools/cp0/hello-headless.mjs`.
- Record assumptions and real verification outputs under `docs/notes/` and `docs/proof/`.
