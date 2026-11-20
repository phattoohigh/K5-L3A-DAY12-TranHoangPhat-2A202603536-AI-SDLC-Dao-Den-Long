# Phase 4 Verification Record (Release v1.0.0 — Contract v1.3)

Date: 2026-11-20 (Asia/Ho_Chi_Minh)  
Machine: MacBook Pro — **Apple M5**, **16 GB RAM**, **macOS 27.0.1** (`Darwin 27.0.0 arm64`), **Node.js 26.0.0**, **Google Chrome (ANGLE Metal Renderer: Apple M5)**

---

## 1. Benchmark (`bench.json`) — Ticket-04 §1

Command:
```bash
node src/bench.mjs --seed 42 --duration 30 --out bench.json
```

Measured output (committed verbatim at [`bench.json`](../../../bench.json)):

| Metric | Measured | Ticket-04 Target | Status |
|---|---:|---:|---|
| `contract_version` | `"1.3"` | `"1.3"` | PASS |
| `avg_fps` | **643.1** | `≥ 60` | PASS |
| `p1_low_fps` | **290.9** | `≥ 30` | PASS |
| `frame_ms_p95` | **2.9 ms** | — | Recorded |
| `frames` | **19,295** (in 30 s) | — | Recorded |
| `load_ms` | **2,324 ms** | `≤ 10,000 ms` | PASS |
| `peak_mem_mb` | **855.3 MB** (Chrome process tree RSS) | — | Recorded |
| `vsync_off` | `true` (`--disable-gpu-vsync --disable-frame-rate-limit`) | — | Confirmed |

Scene proof (`1280×720` real WebGL Metal capture):
- Standardized benchmark scene (Night 1, 200 wandering shades, 100 motes, L1–L3 lit at fuel 100, Mây at `(0,0,0)`, orbit `R=30, Y=15`): [`bench-scene-1280x720.png`](bench-scene-1280x720.png)
- Playable 3D world view (rebuilt multi-point-light WebGL renderer): [`island-world-1280x720.png`](island-world-1280x720.png)

> Lưu ý theo Ticket-04: Số liệu trên đo trên máy cá nhân để tham khảo; giảng viên sẽ chấm lại trên máy chấm chung bằng chính lệnh `<bench_cmd> --seed 42 --duration 30 --out bench.json`.

---

## 2. Soak Test (`soak.json`) — Ticket-04 §2

Command:
```bash
node --jitless --max-semi-space-size=1 --expose-gc src/soak.mjs --seed 7 --nights 10 --out soak.json
```

Measured output (committed verbatim at [`soak.json`](../../../soak.json)):

| Metric | Measured | Ticket-04 Target | Status |
|---|---:|---:|---|
| `nights` | **10** (Đêm 1→2→3 xoay vòng, seed `8..17`) | 10 | PASS |
| `crashes` | **0** | `0` | PASS |
| `mem_start_mb` | **45.3 MB** | — | Recorded |
| `mem_end_mb` | **50.7 MB** (`1.12× mem_start_mb`) | `≤ 1.2 × mem_start_mb` | PASS |
| `duration_s` | **0.22 s** | — | Recorded |

---

## 3. Automated Tests, Contract v1.3, Leaderboard & Regression

- `npm run verify`: **PASS** (`contract_version: "1.3"`, byte-for-byte determinism verified, Night 3 full 18,000 ticks in **56 ms**, launch pad landing `[51.614, 0, 6.619]`, leaderboard CLI export verified, 3-night soak memory ratio `1.11×`).
- `npm test`: **38/38 passed**, 0 failed (covers Phase 1–3 regressions + Contract v1.3 bench scene, leaderboard validation/sorting/disk-persistence/CLI export, and soak runner).
- DOM binding check: **72/72** UI IDs verified in `index.html` (including Settings key remapping, subtitles, reduced motion, large text `×1.25`, and Leaderboard modal/form).
- Release package (`npm run package`): built standalone `dist/dao-den-long-v1.0.0.zip` (**61 KB**, zero runtime dependencies).
- Phase 3 headless evidence diff (`docs/proof/phase-3/*.jsonl`): unchanged byte-for-byte — Phase 4 additions & 3D overhaul do not alter headless output.

## 4. Video Demo & GitHub Release

- **Video demo (`.mp4`, 49 s, 1280×720 H.264, 54 MB):** Full-screen macOS capture of Chrome running live WebGL (`src/sim.mjs` + `src/web/renderer.mjs`) covering Night 1 gameplay (120 FPS, lighting L1, dash, pulse stunning draining shade, colorblind HUD & subtitles), Night 2 unrailed bridge & ballistic launch pad, Night 3 3-tier sanctuary, standardized 200-shade benchmark window, and real `npm run verify` / `npm test` (38/38 passed) / `bench.json` / `soak.json`. Committed at [`docs/demo/demo.mp4`](../../demo/demo.mp4) (also copied to `dist/demo.mp4`).
- **GitHub Release `v1.0.0`:** Upload `dist/dao-den-long-v1.0.0.zip` and `dist/demo.mp4` on GitHub Releases for tag `v1.0.0` (`gh` CLI is not installed locally).
