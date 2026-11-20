# Agent notes

- Project: Đảo Đèn Lồng, a single-player 3D game for macOS/Linux (v1.0.0, Contract v1.3).
- Stack: vanilla JavaScript ES modules; custom WebGL 1.0 renderer + procedural Web Audio for the playable view and Node.js 20+ for shared deterministic simulation, headless/soak/bench runners, and local server. Zero runtime dependencies.
- Keep gameplay simulation (`src/sim.mjs`) independent of rendering (`src/web/`) and use fixed 60 Hz ticks.
- Preserve deterministic output for the same seed, scenario, and inputs across Contract v1.0–v1.3. Do not fake or hand-edit evidence (`bench.json`, `soak.json`, `.jsonl`).
- Before product implementation, run the CP0 smoke command: `node tools/cp0/hello-headless.mjs`.
- Before finishing any change, run `npm run verify` (CP0 smoke, `npm run build`, `npm test`, determinism, trajectory checks, leaderboard export, and soak smoke); do not claim completion while any check is red.
- Enable the pre-commit gate with `git config core.hooksPath .githooks`; see `.agents/skills/verify-and-proof/SKILL.md` when refreshing proof.
- Phase 3–4 use Contract v1.2/v1.3: lantern fuel, dawn survival (≥ 60%), standardized 1280×720 benchmark (`node src/bench.mjs`), 10-night soak (`node src/soak.mjs`), disk-persisted leaderboard (`node src/server.mjs --export-leaderboard`), and accessibility (key remapping, subtitles, reduced motion, ≥ 18 px UI font + ×1.25 large text).
- Test full trajectories and edge cases (ballistic launch pad landing, Night 3 cliff blocking & elevation sync, respawn position & post-respawn invulnerability), never single-tick assertions alone.
- Keep spec documents in `docs/notes/` strictly aligned with `game.contract.json` and actual code; never copy unverified numbers.
- Record assumptions, AI error analysis, token estimates, retro, and real verification outputs under `docs/notes/` and `docs/proof/`.
