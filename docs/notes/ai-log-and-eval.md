# Đánh giá từng Phase, Phân tích lỗi AI và Quản lý Token

Tài liệu này ghi nhận trung thực quá trình làm việc qua CP0 và Phase 1–3, bao gồm đánh giá sau từng phase, các lỗi thực tế do AI gây ra (và cách sửa harness để không lặp lại), cùng ước tính token/chi phí.

---

## 1. Đánh giá từng Phase

| Phase | Đạt | Chưa đạt / Hạn chế | Hồi quy phase trước | Điều cần chỉnh |
|---|---|---|---|---|
| **CP0** | Repo public đúng tên, chọn stack JS ES modules + WebGL + Node.js, smoke check `tools/cp0/hello-headless.mjs` chạy sạch trên clone mới. | Chưa gửi câu hỏi thử tới trợ giảng Claude vì yêu cầu đăng nhập. | N/A | Bắt đầu ghi log token và mở harness sớm hơn. |
| **Phase 1** | Có baseline headless JSONL tất định (`night1-baseline.jsonl`, 2 lần chạy giống từng byte). | Không có commit game Phase 1 độc lập trước khi sang Phase 2; tag `phase-1` gắn hồi tố sau `phase-2`; bản `phase-1-spec.md` ban đầu có thông số sai lệch với code thật (đã bổ sung đính chính). | Chưa thể chạy hồi quy độc lập trước/sau Phase 1 do gộp vào nền Phase 2. | Luôn gắn tag trước khi làm phase mới và kiểm tra chéo spec với `game.contract.json`. |
| **Phase 2** | Đủ 3 đảo, cầu, bục nhảy, Bùa Gió, Gió Lạc, Gió Đêm 3, Pause, Web Audio, Contract v1.1; headless Đêm 3 chạy ~0.07 s. | Ở thời điểm tag `phase-2`, còn lỗi trọng lực bục nhảy (bay lên mãi không hạ cánh), lỗi teleport vách đá Đêm 3, lỗi hồi sinh/bất tử Đêm 3, `envLight` sai công thức, cầu Đêm 2 vẽ lan can, thiếu kiểm chứng đo FPS 1280×720 dài hơi. Các lỗi mô phỏng và WebGL đã được sửa ở đợt rà soát Phase 3. | Chạy lại kiểm chứng Đêm 1 bằng tuning chuẩn hóa v1.1. | Không gom 23 file vào 1 commit; viết test toàn quỹ đạo thay vì test 1 tick. |
| **Phase 3** | Đủ vòng đời nhiên liệu đèn (nguyên 1/60), châm dầu, tắt/thắp lại, Bóng Mực `drain`, mất safe zone `< 30`, sức chứa tối đa 20, thắng bình minh ≥ 60%, scoring v1.2, chế độ mù màu, ADR-001, CHANGELOG, CI, skill + pre-commit hook, 34/34 test xanh, `npm run verify` xanh. | Đo benchmark FPS bền vững đúng khung 1280×720 và chụp ảnh màn hình trực tiếp vẫn cần chạy trên máy có Chrome bật giao diện/remote debugging; test ẩn của giảng viên chưa công bố. | Giữ toàn bộ hành vi Phase 1–2 không bị Ticket-03 thay thế; sửa sạch các lỗi Phase 2 (launch pad, vách đá Đêm 3, respawn/invuln, active mote cap). | Đảm bảo luôn `git push` cả nhánh lẫn tag sau khi `npm run verify` xanh; chuẩn bị Phase 4 (benchmark, đóng gói Release v1.0.0, video demo). |

---

## 2. Phân tích lỗi của AI và Cách chỉnh Harness

Phần rà soát này được thực hiện bởi một phiên đánh giá độc lập (Antigravity / Gemini) kiểm tra toàn bộ mã nguồn, bằng chứng `.jsonl` và lịch sử git do phiên viết code trước (Codex) tạo ra.

| # | Lỗi của AI | Cách phát hiện | Cách sửa trong Code & Test | Chỉnh Harness để không lặp lại |
|---|---|---|---|---|
| 1 | **Tắt trọng lực khi đang bay từ Launch Pad (`if (!p.launched) p.vel[1] -= 20 / HZ`)** khiến Mây bay lên trời vĩnh viễn (`y = 7 → 14 → 21 → 28`). Test AI viết chỉ kiểm tra đúng 1 tick nên báo xanh giả. | Đọc trực tiếp file bằng chứng `docs/proof/phase-2/night2-charm-pad.jsonl` thấy `pos[1]` tăng đều không giảm. | Chỉ bỏ trừ trọng lực ở đúng tick khởi phóng (`!justLaunched`), áp dụng trọng lực `-20/60` từ tick 2 trở đi; thêm test hạ cánh thực tế cho cả Đêm 2 (đáp Đảo 2) và Đêm 3 (đáp đĩa `Y=6`). | Bổ sung kiểm tra quỹ đạo hạ cánh vào `tools/verify.mjs` (`npm run verify`) và thêm quy tắc vào `AGENTS.md`: *không chỉ viết assertion 1 tick cho chuyển động*. |
| 2 | **Bịa thông số trong `docs/notes/phase-1-spec.md`** (`r ≈ 25 m`, tốc độ `7 m/s`, pulse `8 m`, AI `flee`) mâu thuẫn với `src/sim.mjs` và `game.contract.json` ở cùng tag `phase-1`. | Đối chiếu trực tiếp `phase-1-spec.md` với `git show phase-1:game.contract.json` và `src/sim.mjs`. | Bổ sung mục đính chính rõ ràng trong `docs/notes/phase-1-spec.md` (không force-push xóa lịch sử cũ theo `RULES.md`). | Thêm bước đối chiếu `game.contract.json` vào `tools/verify.mjs` và quy tắc trong `AGENTS.md`: *mọi số liệu trong `docs/notes/` phải khớp `game.contract.json`*. |
| 3 | **Đi bộ xuyên vách đá (teleport thẳng từ `Y=0` lên `Y=3` / `Y=6`)** trên Đêm 3 vì nhánh `grounded` gán thẳng `p.pos[1] = floor.y` không xét độ cao bước. | Đọc kỹ nhánh cập nhật bề mặt `movePlayer` trong `src/sim.mjs`. | Thêm hàm `applyHorizontalMove` chặn chuyển động ngang nếu `floor.y > p.pos[1] + 0.5`, đồng thời vá khe hở nhỏ ở đỉnh dốc `along ∈ [23.5, 30]`. Thêm test chặn vách đá + leo dốc 30°. | Thêm yêu cầu test biên địa hình vào `AGENTS.md` và bộ test tự động chạy trên CI (`.github/workflows/ci.yml`). |
| 4 | **`handleFall` luôn respawn về `[0, 0, 0]` (sai ở Đêm 3) và trừ `invuln` ngay trong 60 tick chờ hồi sinh** (chỉ còn 30 tick bất tử sau khi hồi sinh). | Kiểm tra chéo `handleFall` với `advanceTimers` và `stepGame`. | Dùng `spawnPosFor(game.night)` (`[0, 6, 0]` ở Đêm 3), tạm dừng trừ `invuln` và chặn `dash/pickup/interact/pulse` khi `respawnTicks > 0`; thêm unit test xác nhận đủ 90 tick sau hồi sinh. | Bổ sung test hồi quy vào `npm test` và hook `.githooks/pre-commit` chặn commit khi test đỏ. |
| 5 | **Lệch hiển thị WebGL/HUD so với spec**: `envLight` đổi thành `0.24 + 0.50*(lit/total)` thay vì `0.15 + 0.55*(lit/total)`; vẽ lan can trên cầu Đêm 2 dù yêu cầu không lan can; vẽ vòng safe zone ngay cả khi `fuel < 30`; gõ nhầm `colors.teal-400` thành phép trừ `NaN`; icon mù màu `⚠` bị đè chồng nhau do thiếu `position: relative`. | Đọc chéo `src/web/game.mjs` và `src/web/style.css` với từng gạch đầu dòng trong `phase-2-spec.md` và `phase-3-spec.md`. | Sửa toàn bộ trong `src/web/game.mjs`, `src/web/style.css`, `index.html`. | Tạo skill `.agents/skills/verify-and-proof/SKILL.md` quy định rõ danh sách kiểm tra HUD/visual trước khi tag. |
| 6 | **Thiếu CI, thiếu hook chặn test đỏ, quên push Phase 3 và thiếu nguồn AI trong `CREDITS.md`**. | Kiểm tra chéo với `RUBRIC.md` (mục B, C, D) và `RULES.md` (mục 7, 8). | Thêm `.github/workflows/ci.yml`, `.githooks/pre-commit`, `tools/verify.mjs`, `.agents/skills/verify-and-proof/SKILL.md`, cập nhật `CREDITS.md`. | Đưa lệnh `npm run verify` làm cổng bắt buộc trong `AGENTS.md` và CI. |

---

## 3. Ước tính Token và Chi phí theo từng Phase

> Lưu ý: Các công cụ IDE không xuất bảng đếm token chính xác theo từng lệnh; các con số dưới đây là **ước tính bảo thủ** dựa trên số phiên làm việc, kích thước ngữ cảnh và khối lượng thay đổi mã nguồn ở mỗi phase.

| Phase | Công cụ AI | Ước tính Input / Output tokens | Chi phí ước tính (USD quy đổi) | Cách tiết kiệm token |
|---|---|---:|---:|---|
| **CP0** | Codex | ~15k / ~3k | ~$0.05 | Chỉ tạo 1 script smoke check 11 dòng, giữ `AGENTS.md` dưới 15 dòng. |
| **Phase 1** | Codex | ~25k / ~6k | ~$0.09 | Dùng lại mô phỏng JS chung, chỉ sinh baseline JSONL và spec ngắn. |
| **Phase 2** | Codex | ~90k / ~28k | ~$0.40 | Không dùng thư viện ngoài nặng ngữ cảnh; tách gọn `src/sim.mjs` (~490 dòng) và `src/web/game.mjs`. |
| **Phase 3 (code + UI)** | Codex | ~70k / ~20k | ~$0.30 | Đọc trực tiếp Ticket-03, nâng cấp tại chỗ trên state machine sẵn có thay vì viết lại. |
| **Phase 3 (audit độc lập & sửa lỗi)** | Antigravity (Gemini) | ~85k / ~18k | ~$0.32 | Đọc gộp toàn bộ file song song theo lô, sửa nhiều vùng một lượt và chạy 1 lệnh `npm run verify` để kiểm chứng tổng hợp. |
| **Tổng cộng (tới hết Phase 3)** | — | **~285k / ~75k** | **~$1.16** | Tránh lặp vòng hỏi-sửa mù bằng cách chạy test + diff JSONL trực tiếp. |
