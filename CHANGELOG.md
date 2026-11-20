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
