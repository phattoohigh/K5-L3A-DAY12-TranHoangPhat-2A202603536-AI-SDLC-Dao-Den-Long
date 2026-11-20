# Đảo Đèn Lồng

Game 3D góc nhìn thứ ba qua ba đêm: Đảo Bến, Đảo Cau và Đảo Chuông. Mây nhặt đom đóm, giữ nhiên liệu cho đèn tới bình minh và chống Bóng Mực hút dầu cùng Gió Lạc.

## Chạy game

Cần Node.js 20+ và Python 3. Không có thư viện runtime bên ngoài.

```bash
npm run build
npm test
npm run serve
```

Mở <http://localhost:4173>. Lệnh server chạy ở foreground; nhấn Ctrl+C để dừng.

Để chạy trọn bộ kiểm chứng tự động (CP0 smoke, build, 34 unit/CLI tests, kiểm tra tính tất định, đo hiệu năng Đêm 3 và quỹ đạo bục nhảy):

```bash
npm run verify
```

## Điều khiển

- `W A S D`: di chuyển theo camera; kéo chuột trên khung game để xoay camera.
- `Space`: nhảy · `Shift`: lướt · `E`: nạp đom đóm / châm dầu vào đèn · `Q`: Tỏa Sáng.
- `Esc` hoặc `P`: tạm dừng. Menu tạm dừng có tiếp tục, chơi lại đêm, cài đặt và về menu.
- Trong Cài đặt có **Bảng màu dễ phân biệt**; âm lượng, độ nhạy và bảng màu đều được lưu trong `localStorage`.

## Điểm

+5 mỗi đom đóm nạp hoặc châm dầu, +100 khi thắp lần đầu, +40 khi thắp lại. Tỏa Sáng được +5 mỗi Bóng Mực, hoặc tổng +15 nếu nó đang hút dầu. Khi sống tới bình minh với ít nhất 60% đèn còn sáng, mỗi đèn cộng `50 + floor(fuel)` và mỗi Ngọn Lửa còn lại cộng 50.

## Chạy headless

```bash
node src/headless.mjs --seed 42 --night 1 --ticks 14400 --snapshot-every 60 --out /tmp/night.jsonl
```

Contract đầy đủ ở [`game.contract.json`](game.contract.json). Tham số scenario và inputs tuân theo Test Contract v1.2 (Đêm 1: 240 s / 14 400 ticks, Đêm 2: 270 s / 16 200 ticks, Đêm 3: 300 s / 18 000 ticks). Đầu ra là JSONL xác định theo seed, scenario và inputs.

## Sáng tạo của tôi

- **Thế giới 3D & âm thanh thủ tục 100% không asset ngoài:** Đảo bậc tầng, đèn lồng mái chùa 2 tầng có tua rua, nhân vật Mây (nón lá, áo tứ thân, đèn lồng cầm tay), đom đóm đập cánh, hoa đăng bay trên bầu trời sao, Bóng Mực và Gió Lạc đều được dựng từ hình khối WebGL thuần (`src/web/game.mjs`); nhạc nền và toàn bộ hiệu ứng âm thanh tổng hợp trực tiếp bằng Web Audio API.
- **Không ảnh hưởng phần lõi và Test Contract (bằng chứng):** `src/sim.mjs` hoàn toàn không import `src/web/` hay bất kỳ API trình duyệt nào; `npm run verify` kiểm chứng hai lần chạy headless giống nhau từng byte và hoàn thành toàn bộ Đêm 3 (18 000 ticks) trong `63 ms` ([`docs/proof/phase-3/results.md`](docs/proof/phase-3/results.md)).

## Hồ sơ dự án & Harness

- Acceptance criteria Phase 3: [`docs/notes/phase-3-spec.md`](docs/notes/phase-3-spec.md)
- Quyết định thiết kế vòng đời đèn: [`docs/notes/ADR-001-phase-3-lantern-lifecycle.md`](docs/notes/ADR-001-phase-3-lantern-lifecycle.md)
- Đánh giá từng phase, phân tích lỗi AI & ước tính token: [`docs/notes/ai-log-and-eval.md`](docs/notes/ai-log-and-eval.md)
- Kết quả kiểm chứng: [`docs/proof/phase-3/results.md`](docs/proof/phase-3/results.md)
- Harness & Tự động hóa: [`AGENTS.md`](AGENTS.md), [`.agents/skills/verify-and-proof/SKILL.md`](.agents/skills/verify-and-proof/SKILL.md), [`.githooks/pre-commit`](.githooks/pre-commit), [`.github/workflows/ci.yml`](.github/workflows/ci.yml), [`tools/verify.mjs`](tools/verify.mjs)
- Tài liệu lab, submission và rubric: [CHECKPOINTS](CHECKPOINTS.md), [GUIDE](GUIDE.md), [SUBMISSION](SUBMISSION.md), [RUBRIC](RUBRIC.md)
- Nguồn và giấy phép: [`CREDITS.md`](CREDITS.md), [`LICENSE`](LICENSE)
