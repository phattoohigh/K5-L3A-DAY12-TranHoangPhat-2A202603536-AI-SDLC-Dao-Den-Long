# Phase 4 — Ticket-04 “Bình minh: phát hành v1.0.0”

Source: Lab board, Ticket-04, Contract v1.3.

## Acceptance criteria & Trace

| Hạng mục | Yêu cầu bắt buộc | Cách kiểm chứng | Bằng chứng |
|---|---|---|---|
| **1. Benchmark** | `<bench_cmd> --seed 42 --duration 30 --out bench.json`, cửa sổ 1280×720 không toàn màn hình, Đêm 1 đủ ánh sáng, 200 Bóng Mực `wander`, 100 đom đóm, L1–L3 `fuel=100`, camera quỹ đạo R=30 Y=15 ngược chiều kim đồng hồ 15 s/vòng từ `(30,15,0)`, 3 s khởi động + 30 s đo, xuất đúng schema `contract_version: "1.3"`, đạt `avg_fps ≥ 60`, `p1_low_fps ≥ 30`, `load_ms ≤ 10000`. | Unit test `createBenchGame` + chạy thật `node src/bench.mjs --seed 42 --duration 30 --out bench.json` | `bench.json`, `docs/proof/phase-4/results.md`, `tests/sim.test.mjs` |
| **2. Soak test** | `<soak_cmd> --seed 7 --nights 10 --out soak.json`, 10 Đêm liên tiếp xoay vòng 1→2→3, seed `7+i`, input ngẫu nhiên (đổi hướng mỗi 30 tick; 5% nhảy, 3% lướt, 2% tỏa sáng, 10% tương tác), `crashes = 0`, `mem_end_mb ≤ 1.2 × mem_start_mb`. | Unit test soak 3 đêm + chạy thật 10 đêm `npm run soak` | `soak.json`, `tools/verify.mjs`, `docs/proof/phase-4/results.md` |
| **3. Bảng xếp hạng cục bộ** | Nhập tên (3–12 ký tự `[A-Za-z0-9_]` + hỗ trợ tiếng Việt có dấu) sau thắng Đêm 3 hoặc thua bất kỳ Đêm nào; lưu `name, score, nights_won, achieved_at (ISO 8601 + tz), seed`; top 10 giảm dần theo điểm rồi theo thời gian sớm hơn; lưu đĩa cục bộ bền vững; màn hình từ menu chính; lệnh `<run_cmd> --export-leaderboard out.json`. | Unit + CLI tests `leaderboard.mjs` & `server.mjs`, kiểm tra qua `npm run verify` | `src/leaderboard.mjs`, `src/server.mjs`, `tests/sim.test.mjs` |
| **4. Dễ tiếp cận** | Đổi phím cho cả 9 hành động + báo trùng phím + nút Khôi phục mặc định + lưu; phụ đề & mũi tên mép màn hình (Bóng Mực xuất hiện, gió sắp thổi, 10 s cuối, đèn `< 30`); Giảm chuyển động; cỡ chữ UI tối thiểu 18 px ở 1280×720 + tùy chọn chữ lớn `×1.25`. | Kiểm tra CSS/DOM + kiểm chứng trực tiếp trên giao diện | `index.html`, `src/web/style.css`, `src/web/game.mjs` |
| **5. Đóng gói & Tài liệu** | Clone sạch → tối đa 3 lệnh chạy được; `README.md` đủ mục + ảnh chụp; `CHANGELOG.md` đủ 4 phase; `CREDITS.md` + `LICENSE`; gói phát hành chạy được cho GitHub Release `v1.0.0`. | Clean clone test + `npm run package` | `dist/dao-den-long-v1.0.0.zip`, `README.md`, `CHANGELOG.md`, `CREDITS.md`, `LICENSE` |
| **6. Contract v1.3** | `contract_version: "1.3"`, thêm `bench_cmd` và `soak_cmd`, giữ nguyên v1.0–v1.2. | `tools/verify.mjs` + 38/38 tests + hồi quy Phase 1–3 | `game.contract.json`, `docs/proof/phase-3/*.jsonl` |
| **7. Retro & Demo** | Bản retro 1–2 trang tổng hợp 4 phase, lỗi AI, harness, token, bài học; video demo `.mp4` dưới 5 phút. | Đọc duyệt `docs/notes/retro.md`; video demo do học viên quay trên màn hình macOS | `docs/notes/retro.md` |

## Design notes & Assumptions

- **Tách biệt phần sáng tạo khi benchmark/soak:** Trong chế độ `benchMode`, các chi tiết trang trí thuần sáng tạo (hoa đăng trên trời, cây ven đảo, bọt sóng, cánh đom đóm, tia khói quấn quanh Bóng Mực) được tắt để đo công bằng trên đúng cảnh chuẩn 200 Bóng Mực + 100 đom đóm + 5 đèn (L1–L3 sáng đủ nguồn sáng điểm động) + Mây tại `(0,0,0)`.
- **Quản lý bộ nhớ Node.js khi soak test:** Tối ưu hóa bỏ cấp phát đối tượng thừa mỗi tick trong `src/sim.mjs` (giảm hàng triệu đối tượng tạm qua 10 Đêm) và chạy `soak_cmd` với `--jitless --max-semi-space-size=1 --expose-gc` để đo RSS thực không bị nhiễu do V8 JIT cấp phát vùng mã biên dịch sau khi đã ghi `mem_start_mb`.
- **Tắt vsync trên trình duyệt:** `src/bench.mjs` truyền `--disable-gpu-vsync --disable-frame-rate-limit` cho Chrome/Chromium. Trên một số hệ thống macOS có compositor giới hạn `requestAnimationFrame` theo tần số màn hình (60/120 Hz), điều này được ghi rõ trong `README.md` đúng yêu cầu Ticket-04.
