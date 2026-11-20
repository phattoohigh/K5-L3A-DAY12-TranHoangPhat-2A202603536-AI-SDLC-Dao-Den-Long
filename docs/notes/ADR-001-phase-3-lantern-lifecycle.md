# ADR-001 — Vòng đời đèn và điều kiện thắng Phase 3

Date: 2026-11-20 (Asia/Ho_Chi_Minh)  
Status: Accepted

## Context

Ticket-03 thay thế luật “đèn sáng vĩnh viễn” và “thắng ngay khi mọi đèn sáng”. Đèn phải hao dầu, có thể bị Bóng Mực hút dầu, tắt và được thắp lại. Trạng thái cuối cùng ở bình minh mới quyết định thắng/thua.

## Decision

- Mỗi đèn giữ `lit`, `deposited`, `fuelUnits`, `everLit`, `relitCount`.
- `fuelUnits` là số nguyên, 60 đơn vị bằng 1 fuel. Vì vậy hao 1 fuel/s là đúng 1 đơn vị/tick và hút 5 fuel/s là đúng 5 đơn vị/tick, không tích lũy sai số số thực.
- Đèn tắt luôn có fuel 0 và deposited 0. Đèn đã từng sáng cần 5 mote để thắp lại; đèn mới cần 10.
- `successfulLights` thuộc về một đêm, tăng ở cả lần thắp đầu và thắp lại; sức chứa được suy ra bằng `min(20, 10 + 2 × successfulLights)`.
- Không còn kết thúc sớm. Ở tick bình minh, `no_flames` được xét trước; sau đó thắng nếu số đèn đang sáng đạt `ceil(0.6 × total)`.
- Renderer chỉ đọc mô hình mô phỏng; headless và trình duyệt dùng cùng một state machine.

## Consequences

- Test Phase 1–2 về thắng `all_lit`, thời lượng và scoring cũ phải được thay thế có ghi nhận trong changelog.
- Scenario v1.2 có thể đặt trực tiếp fuel/ever_lit/target_lantern_id để kiểm tra drain và bình minh xác định.
- Thanh fuel và cảnh báo dầu thấp có thể hiển thị trực tiếp từ cùng trạng thái dùng trong headless.
