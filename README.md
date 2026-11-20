# Đảo Đèn Lồng

Game 3D góc nhìn thứ ba qua ba đêm: Đảo Bến, Đảo Cau và Đảo Chuông. Mây nhặt đom đóm, thắp các đèn lớn và tránh Bóng Mực cùng Gió Lạc.

## Chạy game

Cần Node.js 20+ và Python 3. Không có thư viện runtime bên ngoài.

```bash
npm run build
npm test
npm run serve
```

Mở <http://localhost:4173>. Lệnh server chạy ở foreground; nhấn Ctrl+C để dừng.

## Điều khiển

- `W A S D`: di chuyển theo camera; kéo chuột trên khung game để xoay camera.
- `Space`: nhảy · `Shift`: lướt · `E`: nạp đom đóm vào đèn · `Q`: Tỏa Sáng.
- `Esc` hoặc `P`: tạm dừng. Menu tạm dừng có tiếp tục, chơi lại đêm, cài đặt và về menu.

## Điểm

+10 mỗi đom đóm nạp, +100 khi thắp một đèn, +5 mỗi lần Bóng Mực trúng Tỏa Sáng. Khi thắng đêm: cộng `floor(giây còn lại) × 2 + 50 × Ngọn Lửa còn lại`. Tổng hành trình cộng điểm các đêm đã thắng.

## Chạy headless

```bash
node src/headless.mjs --seed 42 --night 1 --ticks 18000 --snapshot-every 60 --out /tmp/night.jsonl
```

Contract đầy đủ ở [`game.contract.json`](game.contract.json). Tham số scenario và inputs tuân theo Test Contract v1.1. Lệnh có thể chạy với `--night 1`, `2` hoặc `3`; đầu ra là JSONL xác định theo seed, scenario và inputs.

## Sáng tạo của tôi

Đảo, nhân vật, đèn, đom đóm và sinh vật được dựng từ hình khối WebGL và màu tự chọn, không dùng asset ngoài. Nhạc nền và hiệu ứng âm thanh được tạo trực tiếp bằng Web Audio. Gameplay headless dùng chung mô phỏng nhưng không bật âm thanh hay hiệu ứng hình ảnh.

## Hồ sơ dự án

- Acceptance criteria và giả định Phase 2: [`docs/notes/phase-2-spec.md`](docs/notes/phase-2-spec.md)
- Kết quả kiểm chứng: [`docs/proof/phase-2/`](docs/proof/phase-2/)
- Harness: [`AGENTS.md`](AGENTS.md)
- Tài liệu lab, submission và rubric: [CHECKPOINTS](CHECKPOINTS.md), [GUIDE](GUIDE.md), [SUBMISSION](SUBMISSION.md), [RUBRIC](RUBRIC.md)
- Nguồn và giấy phép: [`CREDITS.md`](CREDITS.md)
