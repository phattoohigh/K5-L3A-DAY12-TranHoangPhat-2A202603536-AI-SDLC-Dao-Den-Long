# Changelog

## Phase 3 — Contract v1.2 (2026-11-20)

### Breaking changes

- Thời lượng Đêm 1/2/3 đổi từ 300/330/360 thành 240/270/300 giây.
- Đèn sáng không còn vĩnh viễn: fuel giảm 1/s, có thể được châm dầu, tắt và thắp lại.
- Bóng Mực có trạng thái `drain` và vùng an toàn biến mất khi fuel dưới 30.
- Bỏ thắng sớm `all_lit`; chỉ xét thắng ở bình minh với ít nhất 60% đèn còn sáng.
- Thay toàn bộ scoring: +5/mote, +100 lần đầu, +40 thắp lại, +15 cho Bóng Mực đang drain trúng pulse và thưởng bình minh mới.
- Snapshot, scenario và event schema được mở rộng theo Test Contract v1.2.

### Added

- Sức chứa tăng theo số lần thắp thành công, tối đa 20.
- Thanh nhiên liệu trên đèn và HUD; cảnh báo chớp 1 Hz khi fuel dưới 30.
- Bảng màu dễ phân biệt được lưu trong localStorage; Bóng Mực dùng viền/mắt xanh lam và cảnh báo dùng trắng + biểu tượng.
- ADR mô tả state model và luật thắng mới; scenario và test hồi quy Phase 3.
- Bộ kiểm chứng 1 lệnh (`npm run verify` / `tools/verify.mjs`), GitHub Actions CI (`.github/workflows/ci.yml`), pre-commit hook (`.githooks/pre-commit`) và skill `.agents/skills/verify-and-proof/SKILL.md`.
- Đánh giá các phase, phân tích lỗi AI và ước tính token tại `docs/notes/ai-log-and-eval.md`.

### Fixed (Audit & Regression Pass)

- Sửa trọng lực cho bục nhảy (Launch Pad) ở Đêm 2 và Đêm 3 để Mây bay theo quỹ đạo parabol và hạ cánh đúng đảo đích thay vì bay lên mãi.
- Chặn teleport xuyên vách đá 3 m / 6 m trên Đêm 3 bằng kiểm tra độ cao bước (`maxStepUp = 0.5 m`), giữ chuyển động mượt trên 2 dốc 30°/150°.
- Sửa hồi sinh khi rơi ở Đêm 3 về đúng `[0, 6, 0]`, khóa hành động trong 60 tick chờ hồi sinh và giữ đủ 90 tick bất tử sau khi hồi sinh.
- Sửa đếm giới hạn 30 đom đóm active, dọn Gió Lạc ở trạng thái `removed`, tránh vùng an toàn khi Bóng Mực `wander` và khởi tạo đủ trường mặc định khi load scenario `recoil`.
- Khôi phục ánh sáng môi trường đúng công thức `0.15 + 0.55 × (lit/total)`, ẩn vòng safe zone 6 m khi `fuel < 30`, bỏ lan can trên cầu không lan can Đêm 2, sửa biểu thức màu `colors.teal`, thêm kiểm tra độ cao cho gợi ý `[E]`, sửa vị trí biểu tượng cảnh báo `⚠` chế độ mù màu.
