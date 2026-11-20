# Changelog

## Phase 4 — Contract v1.3 / Release v1.0.0 (2026-11-20)

### Added
- **Chế độ benchmark chuẩn (`node src/bench.mjs`):** Mở cửa sổ `1280×720` (không toàn màn hình, tắt vsync), Đêm 1 đủ ánh sáng, 200 Bóng Mực `wander`, 100 đom đóm, L1–L3 sáng `fuel=100`, camera bay vòng tròn R=30 m, Y=15 m ngược chiều kim đồng hồ 15 s/vòng từ `(30,15,0)`, 3 s khởi động + 30 s đo, xuất `bench.json` (`contract_version: "1.3"`).
- **Soak test (`node --jitless --max-semi-space-size=1 --expose-gc src/soak.mjs`):** Chạy 10 Đêm liên tiếp xoay vòng 1→2→3 theo seed `7+i` với input ngẫu nhiên xác định, kiểm tra 0 crash và RSS ổn định `≤ 1.2×`, xuất `soak.json`.
- **Bảng xếp hạng cục bộ (`src/leaderboard.mjs`, `src/server.mjs`):** Nhập tên 3–12 ký tự (`[A-Za-z0-9_]` + tiếng Việt có dấu) sau khi thắng Đêm 3 hoặc thua bất kỳ Đêm nào, giữ Top 10 (điểm giảm dần, bằng điểm xếp ai đạt trước lên trên), lưu bền vững trên đĩa cục bộ, xem từ menu chính và xuất qua `node src/server.mjs --export-leaderboard out.json`.
- **Dễ tiếp cận (Accessibility):** Đổi phím cho cả 9 hành động kèm cảnh báo trùng phím & nút Khôi phục mặc định; phụ đề + mũi tên mép màn hình (Bóng Mực xuất hiện, gió sắp thổi, 10 s cuối, đèn `< 30`); chế độ Giảm chuyển động; cỡ chữ UI tối thiểu `18 px` ở `1280×720` và tùy chọn chữ lớn `×1.25`.
- **Nâng cấp toàn diện đồ họa 3D, âm thanh & đóng gói:** Dựng mới `src/web/renderer.mjs` (pháp tuyến thật, xoay TRS, 8 đèn điểm động, tia hút dầu, sóng xung kích Tỏa Sáng), `src/web/audio.mjs` (ngũ cung Web Audio), `tools/package-release.mjs` (`dist/dao-den-long-v1.0.0.zip`), và bản tổng kết `docs/notes/retro.md`.

### Changed
- `game.contract.json` nâng lên `contract_version: "1.3"`, bổ sung `bench_cmd`, `soak_cmd` và chuyển `run_cmd` sang `node src/server.mjs` (bỏ phụ thuộc Python 3).
- Tối ưu hóa loại bỏ cấp phát đối tượng thừa mỗi tick trong `src/sim.mjs` để giữ bộ nhớ ổn định khi chạy soak test dài.

---

## Phase 3 — Contract v1.2 (2026-11-20)

### Breaking changes
- Thời lượng Đêm 1/2/3 đổi từ 300/330/360 thành 240/270/300 giây.
- Đèn sáng không còn vĩnh viễn: fuel giảm 1/s, có thể được châm dầu, tắt và thắp lại.
- Bóng Mực có trạng thái `drain` và vùng an toàn biến mất khi fuel dưới 30.
- Bỏ thắng sớm `all_lit`; chỉ xét thắng ở bình minh với ít nhất 60% đèn còn sáng.
- Thay toàn bộ scoring: +5/mote, +100 lần đầu, +40 thắp lại, +15 cho Bóng Mực đang drain trúng pulse và thưởng bình minh mới.
- Snapshot, scenario và event schema được mở rộng theo Test Contract v1.2.

### Added & Fixed
- Sức chứa tăng theo số lần thắp thành công, tối đa 20; thanh nhiên liệu trên đèn và HUD; cảnh báo 1 Hz khi fuel dưới 30; bảng màu dễ phân biệt lưu trong `localStorage`.
- ADR-001, bộ kiểm chứng 1 lệnh (`npm run verify`), GitHub Actions CI, pre-commit hook, skill `.agents/skills/verify-and-proof/SKILL.md`, và nhật ký đánh giá/lỗi AI.
- Sửa lỗi trọng lực bục nhảy, chặn teleport vách đá Đêm 3, đồng bộ độ cao quái Đêm 3, hồi sinh/bất tử Đêm 3, ánh sáng môi trường `0.15 + 0.55×(lit/total)`, cầu Đêm 2 không lan can và ẩn vùng an toàn khi `fuel < 30`.

---

## Phase 2 — Contract v1.1 (2026-11-20)

### Added
- Mở rộng thành chiến dịch 3 hòn đảo: Đêm 1 (Đảo Bến), Đêm 2 (Đảo Cau với cầu tre, 2 bục nhảy, Bùa Gió, Gió Lạc), Đêm 3 (Đảo Chuông 3 tầng với 2 dốc, 1 bục nhảy và Gió Lớn theo chu kỳ).
- Chuẩn hóa toàn bộ thông số gameplay theo Test Contract v1.1, menu chiến dịch, tạm dừng, cài đặt âm lượng & độ nhạy lưu cục bộ, và bộ kiểm thử `tests/sim.test.mjs` + kịch bản `tests/scenarios/`.

---

## Phase 1 — PRD-0 & CP0 (2026-11-20)

### Added
- Thiết lập CP0 (`tools/cp0/hello-headless.mjs`, `AGENTS.md`, `docs/notes/CP0.md`) với kiến trúc JavaScript ES modules không phụ thuộc ngoài.
- Chế độ headless tất định (`src/headless.mjs`) xuất JSONL theo seed/scenario/inputs và lưu bằng chứng chạy Đêm 1 (`docs/proof/phase-1/`).
