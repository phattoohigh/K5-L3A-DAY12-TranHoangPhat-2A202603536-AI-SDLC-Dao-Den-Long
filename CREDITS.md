# Credits

- **Gameplay, simulation, renderer, and UI:** Original procedural implementation created for the Day 12 AI SDLC lab (*Đảo Đèn Lồng*), with no third-party characters, story assets, or game IP.
- **AI tools used:**
  - **OpenAI Codex (IDE agent):** Initial CP0 setup, Phase 2–3 simulation, WebGL renderer, Web Audio synthesizer, HUD/CSS, and initial tests/docs.
  - **Google Antigravity (Gemini):** Independent end-to-end code/spec audit, simulation & WebGL bug fixes, expanded regression/CLI test suite, CI workflow, verification harness/skill, and evaluation notes.
- **3D geometry:** Generated procedurally at runtime from primitive WebGL meshes (`sphere`, `cylinder`, `cone`, `pyramid`, `torus`, `box`, rings, ramps); no external 3D models or textures.
- **Sound and music:** Synthesized procedurally at runtime using the browser Web Audio API; no external audio files.
- **Fonts:** macOS/Linux system serif and sans-serif fallbacks; no downloaded font assets or network font dependency.
- **Runtime:** Node.js built-ins and standard browser WebGL / Web Audio APIs (zero runtime npm dependencies).
