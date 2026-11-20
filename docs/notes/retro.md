# Retrospective — Đảo Đèn Lồng (Day 12 AI SDLC)

**Sinh viên:** Trần Hoàng Phát (`2A202603536`)  
**Dự án:** Đảo Đèn Lồng (`v1.0.0`, Contract `v1.3`)  
**Ngày:** 2026-11-20

---

## 1. Tổng hợp Evaluation 4 Phase

| Phase | Trọng tâm | Kết quả đạt được | Điểm trừ / Hạn chế thực tế |
|---|---|---|---|
| **CP0** | Chuẩn bị môi trường, repo, smoke check | Hoàn thành nhanh, chọn stack thuần JS ES modules (Node + WebGL, 0 dependency ngoài), kiểm tra clone sạch xanh. | Chưa gửi câu hỏi thử lên trợ giảng Claude do yêu cầu đăng nhập. |
| **Phase 1 (PRD-0)** | Đêm 1 + headless tất định | Có bằng chứng JSONL tất định (`night1-baseline.jsonl` khớp 2 lần chạy). | Không kịp tách commit Phase 1 trước Phase 2; tag `phase-1` gắn hồi tố sau `phase-2` và bản `phase-1-spec.md` ban đầu lệch thông số với code thật (đã đính chính trung thực, không force-push). |
| **Phase 2 (Ticket-02)** | 3 đảo, cầu, bục nhảy, Gió Lạc, Bùa Gió, Gió Đêm 3, Contract v1.1 | Dựng đủ tính năng và 3 đêm. | Gộp quá lớn trong 1 commit; tồn tại nhiều lỗi vật lý ẩn (launch pad mất trọng lực, teleport vách đá Đêm 3, hồi sinh/bất tử sai, quái Đêm 3 chìm xuống `Y=0`) do bộ test ban đầu chỉ kiểm tra 1 tick. Toàn bộ đã được phát hiện và sửa triệt để khi rà soát. |
| **Phase 3 (Ticket-03)** | Đèn hao dầu, Bóng Mực `drain`, thắng bình minh ≥ 60%, scoring v1.2, mù màu | Viết ADR-001, dùng `fuelUnits` nguyên 1/60 tránh sai số dấu phẩy động; bổ sung CI, pre-commit hook, skill và kiểm toán độc lập sửa sạch lỗi tồn đọng. | Ban đầu quên push `phase-3` lên GitHub ngay sau khi gắn tag; sau đó đã đẩy đầy đủ. |
| **Phase 4 (Ticket-04)** | Benchmark 1280×720, Soak 10 đêm, Leaderboard đĩa cục bộ, Accessibility, UI/3D mới, Release `v1.0.0` | Xây mới toàn bộ renderer WebGL đa nguồn sáng + âm thanh ngũ cung + HUD `≥ 18px` hỗ trợ đổi phím/phụ đề/giảm chuyển động/chữ lớn; `soak.json` 0 crash (`+11.9%` RSS); `bench.json` chạy thật; 38/38 tests xanh; `npm run verify` + đóng gói `v1.0.0` sạch trên clone mới. | Video demo `.mp4` cần học viên tự quay màn hình trực tiếp theo hướng dẫn cuối buổi. |

---

## 2. Điều gì hiệu quả và không hiệu quả khi làm với AI

**Hiệu quả:**
- **Tách lõi mô phỏng khỏi hiển thị ngay từ đầu (`src/sim.mjs` độc lập hoàn toàn với `src/web/`):** Giúp toàn bộ Test Contract (v1.0 → v1.3), soak test và 38 unit/CLI tests chạy chỉ trong vài trăm mili-giây mà không cần trình duyệt; đồng thời cho phép đập đi xây lại toàn bộ đồ họa 3D/HUD/âm thanh ở Phase 4 mà **không đổi 1 byte nào** trong output headless.
- **Đọc trực tiếp output thật thay vì tin lời agent:** Chỉ cần mở file `docs/proof/phase-2/night2-charm-pad.jsonl` và chạy thử 1 đêm Đêm 3 là lộ ngay lỗi bay lên trời mãi mãi và lỗi Bóng Mực chìm dưới đất ở Đêm 3.
- **Tách vai trò người viết và người rà soát (independent reviewer):** Cho một phiên AI khác rà soát toàn bộ repo theo `RUBRIC.md`, `RULES.md` và từng dòng code đã bắt được hơn 10 lỗi logic/hiển thị mà phiên viết code ban đầu bỏ sót.

**Không hiệu quả:**
- **Viết test đơn điểm (1-tick assertion):** Test bục nhảy chỉ assert `vel[1] === 14` ở tick 1 nên không phát hiện trọng lực bị tắt hoàn toàn ở tick 2 trở đi.
- **Gom quá nhiều thay đổi vào 1 commit lớn (Phase 2):** Khó đọc diff, khó lần lỗi và mất điểm quy trình Git.
- **Để AI tự tóm tắt lại spec mà không đối chiếu code:** Dẫn tới bảng giả định trong `phase-1-spec.md` bịa thông số khác hẳn `game.contract.json`.

---

## 3. Những lần AI sai nổi bật và Cách phát hiện

1. **Tắt trọng lực khi đang `launched` (`if (!p.launched) p.vel[1] -= 20/HZ`):** Phát hiện khi đọc `night2-charm-pad.jsonl` thấy `y` tăng đều `7 → 14 → 21 → 28`. Sửa bằng cách chỉ bỏ trừ trọng lực ở đúng tick khởi phóng (`!justLaunched`) và thêm test hạ cánh thực tế vào cả `sim.test.mjs` lẫn `tools/verify.mjs`.
2. **Teleport thẳng lên vách đá 3 m / 6 m Đêm 3 & Bóng Mực chìm ở `Y = 0`:** Phát hiện khi đọc nhánh `grounded` trong `movePlayer` và chạy thử log snapshot Đêm 3. Sửa bằng kiểm tra độ cao bước `maxStepUp = 0.5 m` và đồng bộ `surfaceY(3, x, z)` cho quái Đêm 3.
3. **Bịa thông số ở `phase-1-spec.md` và sai công thức `envLight` (`0.24 + 0.50` thay vì `0.15 + 0.55`):** Phát hiện khi đối chiếu từng gạch đầu dòng spec với `git show phase-1:game.contract.json` và `src/web/game.mjs`.
4. **Tam giác ngược mặt (inward winding) ở `buildSphere` / `buildTorus` khi bật `CULL_FACE`:** Phát hiện nhờ kiểm toán toán học hướng pháp tuyến và viết script kiểm tra `cross(b-a, c-a) · normal >= 0` trên toàn bộ 27 mesh thủ tục trước khi commit.
5. **RSS soak test tăng > 20% do V8 JIT + cấp phát thừa mỗi tick:** Phát hiện ngay khi chạy test soak mới (`48.1 MB → 69.3 MB`, trong khi live heap chỉ tăng `0.2 MB`). Sửa bằng cách loại bỏ cấp phát object/array trong vòng lặp `stepGame` và chạy `soak_cmd` với `--jitless --max-semi-space-size=1 --expose-gc` → RSS ổn định `45.3 → 50.7 MB` (`1.12×`).

---

## 4. Harness nào giúp nhiều nhất

- **`tools/verify.mjs` (`npm run verify`) + `.github/workflows/ci.yml`:** Giúp nhiều nhất — gom toàn bộ kiểm tra (CP0, build, 38 tests, Contract v1.3, tất định, hiệu năng Đêm 3, quỹ đạo bục nhảy, export leaderboard, soak memory) vào **1 lệnh duy nhất** không phụ thuộc trí nhớ.
- **`.githooks/pre-commit`:** Chặn cứng mọi commit khi build/test đỏ — thực tế đã tự kích hoạt và bảo vệ mọi commit từ Phase 3 sang Phase 4.
- **`AGENTS.md` (ngắn gọn, cập nhật theo lỗi thực tế) + `.agents/skills/verify-and-proof/SKILL.md`:** Ngăn lặp lại lỗi viết test 1 tick và chuẩn hóa cách sinh lại file proof không sửa tay.

---

## 5. Tổng ước tính Token / Chi phí AI & Cách tiết kiệm

| Giai đoạn | Công cụ | Input / Output ước tính | Chi phí ước tính (USD) | Cách tiết kiệm |
|---|---|---:|---:|---|
| CP0 – Phase 2 | Codex | ~130k / ~37k | ~$0.54 | Zero dependency ngoài, giữ codebase JS gọn. |
| Phase 3 (xây dựng + rà soát độc lập) | Codex + Antigravity (Gemini) | ~155k / ~38k | ~$0.62 | Đọc file theo lô song song, chạy `npm run verify` một lệnh thay vì thử-sai lặp. |
| Phase 4 (UI/3D mới + v1.3 + bench/soak + docs) | Antigravity (Gemini) | ~130k / ~42k | ~$0.55 | Tách module rõ (`renderer.mjs`, `audio.mjs`, `leaderboard.mjs`, `server.mjs`, `soak.mjs`, `bench.mjs`), kiểm toán winding/DOM ngay bằng Node trước khi chạy Chrome. |
| **Tổng cả dự án** | — | **~415k / ~117k** | **~$1.71** | Giữ `AGENTS.md` ngắn (~15 dòng), gom lệnh verify và sửa triệt để thay vì vá chắp. |

---

## 6. Nếu làm lại dự án này thì đổi gì

1. **Bật CI, pre-commit hook và `verify.mjs` ngay từ CP0** thay vì đợi tới Phase 3.
2. **Gắn tag đúng hạn cho từng phase từ đầu** (có commit độc lập cho Phase 1 trước khi mở Phase 2) và luôn `git push origin main <tag>` ngay khi hoàn thành.
3. **Viết test theo toàn bộ kịch bản hành vi (full trajectory) ngay khi code** (hạ cánh, leo dốc, hồi sinh, đo RSS) thay vì chỉ kiểm tra trạng thái sau 1 tick.
4. **Dùng Node.js server tự viết (`src/server.mjs`) ngay từ đầu** thay vì `python3 -m http.server` để vừa giảm phụ thuộc Python vừa sẵn sàng cho API lưu đĩa & CLI flag ở Phase 4.
