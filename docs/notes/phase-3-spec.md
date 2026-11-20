# Phase 3 — Ticket-03 “Đèn cạn dầu”

Source: Lab board, Ticket-03, Contract v1.2. Ticket này thay thế các luật về vòng đời đèn, vùng an toàn, điều kiện thắng, thời lượng và scoring của Ticket-02.

## Acceptance trace

| Yêu cầu | Cách kiểm chứng | Trạng thái |
|---|---|---|
| Fuel nguyên 1/60, decay, tắt và thắp lại | Unit test `lit lantern fuel decays...` | Đạt |
| Châm dầu, chọn đèn nhận được | Unit test `refuel uses...` và interaction regression | Đạt |
| Bóng Mực `drain`, mất safe zone dưới 30 | Unit test `shade drains...` | Đạt |
| Thắng ở bình minh với 60%, không thắng sớm | Unit test `dawn requires...` | Đạt |
| Sức chứa 10 + 2 × successful lights, tối đa 20 | Unit test `successful lights...` | Đạt |
| Scoring v1.2 | Unit tests light/relight/refuel/pulse/dawn | Đạt |
| Snapshot/scenario/event v1.2 | Scenario Phase 3 + JSONL proof | Đạt |
| Thanh fuel, cảnh báo 1 Hz, khác biệt không chỉ bằng màu | Browser smoke và source review | Đạt; FPS đo riêng trong proof |
| Chế độ mù màu được lưu | Browser setting + localStorage `ddl.colorblind` | Đạt |
| ADR và changelog | `ADR-001-phase-3-lantern-lifecycle.md`, `CHANGELOG.md` | Đạt |

## Test migration

- Test thời lượng Contract 1.1 đã đổi thành Contract 1.2 với 240/270/300 giây.
- Kỳ vọng scoring deposit đổi từ 10 thành 5 mỗi mote.
- Không giữ hoặc skip test `all_lit`; thay bằng kiểm tra không kết thúc sớm và `dawn_survived`.
- Các kiểm tra Phase 1–2 không bị thay thế vẫn được giữ trong cùng suite.

## Token/cost note

Ước tính Phase 3 dùng một phiên Codex chính, không gọi model phụ. Tiết kiệm bằng cách đọc trực tiếp Ticket-03, tái sử dụng simulation/headless hiện có và thêm test nhỏ theo từng breaking change trước khi kiểm thử toàn bộ.
