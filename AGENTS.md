# Agent notes

- Project: Đảo Đèn Lồng, a single-player 3D game for macOS/Linux.
- Stack: vanilla JavaScript ES modules; WebGL for the playable view and Node.js for shared deterministic/headless game logic. Avoid runtime dependencies unless a requirement needs one.
- Keep gameplay simulation independent of rendering and use fixed 60 Hz ticks.
- For the headless contract, preserve deterministic output for the same seed, scenario, and inputs. Do not fake or hand-edit evidence.
- Before product implementation, run the CP0 smoke command: `node tools/cp0/hello-headless.mjs`.
- Before finishing a change, run `npm run verify` (which executes CP0 smoke, `npm run build`, `npm test`, determinism, and trajectory checks); do not claim completion while any check is red.
- Enable the pre-commit gate with `git config core.hooksPath .githooks`; see `.agents/skills/verify-and-proof/SKILL.md` when refreshing proof or checking visual HUD changes.
- Phase 3 uses Contract v1.2: lantern fuel and dawn survival replace permanent lights and `all_lit` victory.
- Test full trajectories and edge cases (e.g., ballistic landing from launch pads, cliff step-height blocking on Night 3, respawn position and post-respawn invulnerability), never single-tick assertions alone.
- Keep spec documents in `docs/notes/` strictly aligned with `game.contract.json` and actual code; never copy unverified numbers.
- Record assumptions, AI error analysis, token estimates, and real verification outputs under `docs/notes/` and `docs/proof/`.
