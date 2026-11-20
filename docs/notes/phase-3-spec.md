# Phase 3 — Ticket-03 “Đèn cạn dầu”

Source: Lab board, Ticket-03, Contract v1.2. Ticket này thay thế các luật về vòng đời đèn, vùng an toàn, điều kiện thắng, thời lượng và scoring của Ticket-02.

## Acceptance trace

| Yêu cầu | Cách kiểm chứng | Bằng chứng | Trạng thái |
|---|---|---|---|
| Fuel nguyên 1/60, decay, tắt và thắp lại | Unit test `lit lantern fuel decays...` | `tests/sim.test.mjs` | Đạt |
| Châm dầu (bỏ qua đèn đầy), khôi phục vùng an toàn khi vượt 30 | Unit tests `refuel uses...` và `refuel ignores full lanterns...` | `tests/sim.test.mjs` | Đạt |
| Bóng Mực `drain`, mất safe zone dưới 30 | Unit test `shade drains...` + scenario `phase3-fuel-drain.json` | `docs/proof/phase-3/fuel-drain.jsonl` | Đạt |
| Thắng ở bình minh ≥ 60%, thua < 60%, `no_flames` ưu tiên hơn bình minh, không thắng sớm | Unit tests `dawn requires...`, `dawn with fewer...`, `no_flames takes precedence...` | `tests/sim.test.mjs` | Đạt |
| Sức chứa `10 + 2 × successfulLights`, tối đa 20 | Unit test `successful lights...` + snapshot `capacity` | `docs/proof/phase-3/fuel-drain.jsonl` | Đạt |
| Scoring v1.2 (deposit, light, relight, pulse drain +15, dawn bonus `50 + floor(fuel)` và `50 × flames`) | Unit tests light/relight/refuel/pulse/dawn | `tests/sim.test.mjs` | Đạt |
| Snapshot/scenario/event v1.2 + CLI error codes + tất định | CLI tests + `npm run verify` (chạy 2 lần so byte-for-byte) | `tools/verify.mjs`, `docs/proof/phase-3/` | Đạt |
| Hồi quy Phase 1–2 (launch pad hạ cánh đúng đảo, chặn vách đá Đêm 3, respawn/invuln Đêm 3, cầu không lan can) | Regression unit tests + `night2-launch-pad.jsonl` | `docs/proof/phase-3/night2-launch-pad.jsonl` | Đạt |
| Thanh fuel trên đèn & HUD, ẩn vòng safe zone khi `< 30`, cảnh báo 1 Hz, khác biệt không chỉ bằng màu | Source review + browser smoke check trước đó | `src/web/game.mjs`, `src/web/style.css` | Đạt logic/UI; cần chụp ảnh 1280×720 trực tiếp trên Chrome |
| Chế độ mù màu được lưu (`ddl.colorblind`), sửa vị trí ký hiệu `⚠` | `localStorage` + CSS `position: relative` | `src/web/game.mjs`, `src/web/style.css` | Đạt |
| ADR, changelog, đánh giá & phân tích lỗi AI | Review tài liệu | `ADR-001-phase-3-lantern-lifecycle.md`, `CHANGELOG.md`, `ai-log-and-eval.md` | Đạt |

## Test migration

- Test thời lượng Contract 1.1 đã đổi thành Contract 1.2 với 240/270/300 giây.
- Kỳ vọng scoring deposit đổi từ 10 thành 5 mỗi mote.
- Không giữ hoặc skip test `all_lit`; thay bằng kiểm tra không kết thúc sớm, `dawn_survived`, `dawn` (thua `< 60%`) và ưu tiên `no_flames`.
- Các kiểm tra Phase 1–2 không bị thay thế vẫn được giữ và mở rộng thêm kiểm tra quỹ đạo hạ cánh launch pad, địa hình Đêm 3 (dốc/vách đá), cầu Đêm 2 và mã lỗi CLI.

## Token/cost & evaluation note

Xem bảng ước tính token đầy đủ (CP0 đến Phase 3), đánh giá từng phase và phân tích lỗi AI tại [`ai-log-and-eval.md`](ai-log-and-eval.md).
