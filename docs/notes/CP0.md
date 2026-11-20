# Checkpoint 0 — Chuẩn bị

- Repo: `phattoohigh/K5-L3A-DAY12-TranHoangPhat-2A202603536-AI-SDLC-Dao-Den-Long` (repo public hiện có, đúng quy ước tên).
- Công cụ AI: Codex trong IDE; Lab board đã mở được trên claude.ai.
- Lab board hiện hiển thị Phase 1 đang diễn ra; Phase 2–4 chưa phát hành. Nút trợ giảng yêu cầu đăng nhập Claude, nên chưa gửi câu hỏi kiểm tra được.
- Engine/ngôn ngữ: WebGL thuần cho phần hiển thị 3D; JavaScript ES modules dùng chung cho logic; Node.js chạy logic headless. Không cần cài thư viện ngoài ở CP0.
- Lý do chọn: Node.js có sẵn trên máy; cùng module JavaScript có thể chạy trong trình duyệt và Node, giảm nguy cơ lệch logic giữa game và Test Contract.
- Lệnh smoke test: `node tools/cp0/hello-headless.mjs`.
- Giả định ghi chép: dùng `python3 -m http.server` để phục vụ game tĩnh trong quá trình phát triển; chưa xác nhận lệnh build/run cuối cùng vì mã game chưa được tạo.
- Nơi lưu giả định, nhật ký AI và retro: `docs/notes/`; bằng chứng: `docs/proof/`.
- Kiểm tra clone sạch: clone commit `ced7bf0` sang `/private/tmp/day12-cp0.hCl8Ya/checkout`; chạy smoke test thành công, working tree clone sạch.

## Kết quả clone sạch

Lệnh `node tools/cp0/hello-headless.mjs` trả về:

```json
{"status":"ready","project":"dao-den-long","mode":"headless","runtime":"Node.js 26.0.0"}
```
