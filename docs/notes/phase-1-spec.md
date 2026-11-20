# Phase 1 — Spec & Assumptions

Date: 2026-11-20 (Asia/Ho_Chi_Minh)

## Scope

Phase 1 implements PRD-0: a playable Night 1 single-island game with:
- Player movement (run, jump, dash, pulse)
- Mote collection and lantern deposit
- Shade enemies with wander/chase/flee AI
- 300-second night timer (18 000 ticks at 60 Hz)
- 3 Flame lives, respawn after fall/shade hit
- Headless mode: JSONL output, deterministic with fixed seed

## Assumptions / Design Choices

| Item | Decision |
|------|----------|
| Tick rate | 60 Hz fixed |
| Island layout | Single circular island, r ≈ 25 m |
| Lantern positions | 5 lanterns at radius 25 m, evenly spaced |
| Mote ring 1 | 8 motes at r = 12 m |
| Mote ring 2 | 12 motes at r = 33 m |
| Shade spawn interval | Every 480 ticks (~8 s), first at tick 300 |
| Shade speed | 3 m/s wander, 5 m/s chase |
| Player run speed | 7 m/s max, 6-tick acceleration |
| Jump / gravity | Standard arcade; dash preserves altitude |
| Pulse radius | 8 m, 600-tick cooldown |
| Dash cooldown | 90 ticks |
| Fall edge | > 30 m from origin → fall → 60-tick respawn |
| Score | 10 pts per mote deposited per lantern |
| Determinism | Same seed + scenario + inputs → byte-for-byte identical JSONL |

## Correction Note (Audit Verification)

> **Đính chính trung thực (2026-11-20):** Tag `phase-1` (`a7669cb`) được gắn hồi tố sau commit `phase-2` (`f5e75ed`), nên mã nguồn và `game.contract.json` tại tag `phase-1` thực tế sử dụng **Contract v1.1** (thông số chuẩn hóa của Ticket-02), KHÔNG phải các con số giả định cũ ở bảng trên. Đối chiếu đúng với mã nguồn tại tag `phase-1`:
> - Bán kính đảo Đêm 1: `40 m` (không phải `25 m`); rơi khi `y < -10` (không phải `> 30 m`).
> - Vòng đom đóm 2: `16` điểm ở `r = 33 m` (tổng 24 điểm hợp lệ, khởi đầu 20 đom đóm).
> - Tốc độ Mây: `6.0 m/s`; tốc độ Bóng Mực: `4.0 m/s` (không có trạng thái `flee`, dùng `spawning/wander/chase/recoil/stunned`).
> - Tỏa Sáng (Pulse): bán kính `5.0 m`, cooldown `180 ticks` (`3 s`), choáng `120 ticks` (`2 s`).
> - Điểm: `+10`/mote nạp, `+100`/đèn thắp, `+5`/Bóng Mực trúng Pulse, thưởng thắng `floor(seconds_left)*2 + 50*flames`.
>
> Theo `RULES.md` mục 7, lịch sử git và tag cũ không bị viết lại (no force-push). Xem chi tiết phân tích sai lệch này tại [`ai-log-and-eval.md`](ai-log-and-eval.md).

## Deliverables

- `src/sim.mjs` — deterministic simulation (no rendering imports)
- `src/headless.mjs` — CLI runner
- `index.html` — WebGL browser game (Night 1)
- `tests/sim.test.mjs` — unit test suite
- `game.contract.json` — declared parameters
- `docs/proof/phase-1/` — headless run evidence
