import { createGame, stepGame } from "../sim.mjs";
import { createAudio } from "./audio.mjs";
import { createRenderer, PALETTE } from "./renderer.mjs";

const canvas = document.getElementById("world");
const renderer = createRenderer(canvas);
if (!renderer) {
  document.body.insertAdjacentHTML("beforeend", "<p style='position:fixed;inset:24px;color:#fff'>Trình duyệt cần hỗ trợ WebGL để chơi Đảo Đèn Lồng.</p>");
}

const byId = id => document.getElementById(id);
const ui = {
  home: byId("home"),
  intro: byId("intro"),
  pause: byId("pause"),
  settings: byId("settings"),
  result: byId("result"),
  hud: byId("hud"),
  controlsHint: byId("controls-hint"),
  damageFlash: byId("damage-flash"),
  flames: byId("flames"),
  lanternFuels: byId("lantern-fuels"),
  nightPill: byId("night-pill"),
  clock: byId("clock"),
  dawnGoal: byId("dawn-goal"),
  windWarning: byId("wind-warning"),
  windText: byId("wind-text"),
  lanternCount: byId("lantern-count"),
  score: byId("score"),
  buffBadge: byId("buff-badge"),
  fps: byId("fps"),
  hint: byId("hint"),
  arrow: byId("arrow"),
  arrowLabel: byId("arrow-label"),
  motes: byId("motes"),
  carriedCount: byId("carried-count"),
  capacityCount: byId("capacity-count"),
  dashBadge: byId("dash-badge"),
  dashCd: byId("dash-cd"),
  pulseBadge: byId("pulse-badge"),
  pulseCd: byId("pulse-cd"),
  nightLabel: byId("night-label"),
  introTitle: byId("intro-title"),
  introCopy: byId("intro-copy"),
  pauseNight: byId("pause-night"),
  resultLabel: byId("result-label"),
  resultTitle: byId("result-title"),
  resultCopy: byId("result-copy"),
  resultStats: byId("result-stats"),
  resultAction: byId("result-action"),
  resultReplay: byId("result-replay"),
  volume: byId("volume"),
  volumeValue: byId("volume-value"),
  sensitivity: byId("sensitivity"),
  sensitivityValue: byId("sensitivity-value"),
  colorblind: byId("colorblind"),
};

const NIGHT_META = [
  null,
  {
    name: "Đảo Bến",
    title: "Giữ lửa tới bình minh",
    quote: "Ông Đăng: “Thắp đèn mới chỉ là khởi đầu. Hãy châm dầu và giữ ít nhất ba ngọn sáng tới bình minh.”",
  },
  {
    name: "Đảo Cau",
    title: "Cầu tre trong sương",
    quote: "Ông Đăng: “Cầu tre không lan can nối hai đảo. Giữ ít nhất bốn ngọn sáng, coi chừng Gió Lạc và Bóng Mực hút dầu.”",
  },
  {
    name: "Đảo Chuông",
    title: "Tiếng chuông trên cao",
    quote: "Ông Đăng: “Gió lớn đổi chiều theo chu kỳ. Hãy leo dốc hoặc dùng bục gió lên tầng cao và giữ năm ngọn đèn tới bình minh.”",
  },
];

let audioVolume = Number(localStorage.getItem("ddl.volume") ?? 35) / 100;
let sensitivity = Number(localStorage.getItem("ddl.sensitivity") ?? 100) / 100;
let colorblind = localStorage.getItem("ddl.colorblind") === "true";
document.body.classList.toggle("colorblind", colorblind);

const audio = createAudio(audioVolume);
let game = createGame({ seed: 2026, night: 1 });
// Preview scene on menu: light 2 lanterns cosmetically on initial attract-mode game instance
// (replaced with a fresh createGame on Start Campaign — never affects real gameplay!).
function makeMenuPreview() {
  const preview = createGame({ seed: 2026, night: 1 });
  preview.lanterns[0].lit = true;
  preview.lanterns[0].fuelUnits = 5400;
  preview.lanterns[2].lit = true;
  preview.lanterns[2].fuelUnits = 4200;
  return preview;
}
game = makeMenuPreview();

let currentNight = 1;
let campaignScore = 0;
let cameraYaw = 0;
let targetCameraYaw = 0;
let isRunning = false;
let orbitMenu = true;
let settingsOrigin = "home";
let lastTime = 0;
let accumulator = 0;
let lastHud = 0;
let lastEventIndex = 0;
let lastSeconds = -1;
let fpsFrames = 0;
let fpsStart = 0;
let damageTimer = null;

const keys = new Set();

function showOverlay(name) {
  for (const k of ["home", "intro", "pause", "settings", "result"]) {
    if (ui[k]) ui[k].classList.toggle("hidden", k !== name);
  }
}

function updateSettingLabels() {
  if (ui.volume && ui.volumeValue) ui.volumeValue.textContent = `${ui.volume.value}%`;
  if (ui.sensitivity && ui.sensitivityValue) ui.sensitivityValue.textContent = `${(Number(ui.sensitivity.value) / 100).toFixed(1)}×`;
}

function showIntro(night) {
  isRunning = false;
  orbitMenu = true;
  currentNight = night;
  game = createGame({ seed: 2026 + night, night });
  lastEventIndex = game.events.length;
  cameraYaw = 0;
  targetCameraYaw = 0;
  const meta = NIGHT_META[night];
  ui.nightLabel.textContent = `ĐÊM ${night} · ${meta.name.toUpperCase()}`;
  ui.introTitle.textContent = meta.title;
  ui.introCopy.textContent = meta.quote;
  ui.hud.classList.add("hidden");
  ui.controlsHint.classList.add("hidden");
  showOverlay("intro");
}

function startNight() {
  audio.start();
  isRunning = true;
  orbitMenu = false;
  lastSeconds = -1;
  ui.hud.classList.remove("hidden");
  ui.controlsHint.classList.remove("hidden");
  ui.result.dataset.shown = "";
  showOverlay(null);
  accumulator = 0;
  lastTime = performance.now();
  lastHud = 0;
}

function openSettings(from) {
  settingsOrigin = from;
  ui.volume.value = String(Math.round(audioVolume * 100));
  ui.sensitivity.value = String(Math.round(sensitivity * 100));
  ui.colorblind.checked = colorblind;
  updateSettingLabels();
  showOverlay("settings");
}

function triggerDamageFlash() {
  ui.damageFlash.classList.add("active");
  if (damageTimer) clearTimeout(damageTimer);
  damageTimer = setTimeout(() => ui.damageFlash.classList.remove("active"), 220);
}

function showResult() {
  isRunning = false;
  orbitMenu = true;
  ui.hud.classList.add("hidden");
  ui.controlsHint.classList.add("hidden");
  const won = game.state === "won";
  const lit = game.lanterns.filter(l => l.lit).length;
  const total = game.lanterns.length;
  const required = Math.ceil(total * 0.6);
  if (won) campaignScore += game.score;

  ui.resultLabel.textContent = `ĐÊM ${currentNight} · ${NIGHT_META[currentNight].name.toUpperCase()}`;
  ui.resultTitle.textContent = won
    ? (currentNight === 3 ? "Bình minh rực rỡ trên cả ba hòn đảo!" : "Bình minh đã thức giấc.")
    : (game.player.flames <= 0 ? "Ngọn lửa đã tắt." : "Ánh sáng chưa đủ tới bình minh.");
  ui.resultCopy.textContent = won
    ? `Bạn đã giữ sáng ${lit}/${total} ngọn bảo đăng (yêu cầu ≥ ${required}) vượt qua màn đêm.`
    : `Cần ít nhất ${required}/${total} ngọn đèn còn sáng lúc bình minh và còn Ngọn Lửa.`;

  ui.resultStats.innerHTML = [
    ["ĐÈN CÒN SÁNG", `${lit}/${total}`],
    ["ĐIỂM ĐÊM NAY", `${game.score}`],
    ["TỔNG HÀNH TRÌNH", `${campaignScore}`],
  ].map(([k, v]) => `<div class="stat-box"><span>${k}</span><b>${v}</b></div>`).join("");

  ui.resultAction.textContent = won && currentNight < 3 ? `TIẾP TỤC ĐẾN ĐÊM ${currentNight + 1} →` : "VỀ MENU CHÍNH";
  ui.resultReplay.classList.toggle("hidden", won && currentNight === 3);
  showOverlay("result");
}

const FLAME_SVG = alive => `
<svg class="flame-svg ${alive ? "alive" : "spent"}" viewBox="0 0 24 28" aria-label="${alive ? "Ngọn lửa còn lại" : "Ngọn lửa đã mất"}">
  <path d="M12 1C12 1 20 8.5 20 16.2C20 21.6 16.4 26 12 26C7.6 26 4 21.6 4 16.2C4 12.2 6.4 8.7 8.4 6.5C8.1 9 9.5 10.6 10.6 10.6C10.1 7.2 11.4 3.5 12 1Z" fill="url(#fg)"/>
  <path d="M12 10.5C12 10.5 15.6 14 15.6 17.8C15.6 20.5 14 22.5 12 22.5C10 22.5 8.4 20.5 8.4 17.8C8.4 15.2 10.3 12.6 12 10.5Z" fill="#FFF7D6"/>
  <defs><linearGradient id="fg" x1="12" y1="1" x2="12" y2="26" gradientUnits="userSpaceOnUse"><stop stop-color="#FFE68C"/><stop offset="0.55" stop-color="#FF9A2E"/><stop offset="1" stop-color="#D94528"/></linearGradient></defs>
</svg>`;

function updateHud(now) {
  if (now - lastHud < 80) return;
  lastHud = now;
  const p = game.player;
  const seconds = Math.ceil(game.timeLeftTicks / 60);
  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");
  const litCount = game.lanterns.filter(l => l.lit).length;
  const total = game.lanterns.length;
  const required = Math.ceil(total * 0.6);

  ui.nightPill.textContent = `ĐÊM ${game.night} · ${NIGHT_META[game.night].name.toUpperCase()}`;
  ui.clock.textContent = `${mm}:${ss}`;
  ui.clock.classList.toggle("danger", seconds <= 30);
  ui.dawnGoal.textContent = litCount >= required ? `Đủ mốc bình minh (${litCount}/${required})` : `Cần ≥ ${required}/${total} đèn tới bình minh`;
  ui.dawnGoal.classList.toggle("met", litCount >= required);

  ui.flames.innerHTML = Array.from({ length: 3 }, (_, i) => FLAME_SVG(i < p.flames)).join("");
  ui.lanternCount.textContent = `ĐÈN ${litCount}/${total}`;
  ui.score.textContent = String(campaignScore + game.score);

  const capacity = Math.min(20, 10 + 2 * game.successfulLights);
  ui.carriedCount.textContent = String(p.carried);
  ui.capacityCount.textContent = String(capacity);
  ui.motes.innerHTML = Array.from({ length: capacity }, (_, i) => `<i class="${i < p.carried ? "on" : ""}"></i>`).join("");

  // Skill badges
  const charmActive = p.charmTicks > 0;
  ui.dashCd.textContent = charmActive ? "Bùa Gió · Không hồi" : p.dashCd > 0 ? `Hồi ${(p.dashCd / 60).toFixed(1)}s` : "Sẵn sàng";
  ui.dashBadge.classList.toggle("wait", p.dashCd > 0 && !charmActive);
  ui.dashBadge.classList.toggle("buffed", charmActive);

  ui.pulseCd.textContent = p.pulseCd > 0 ? `Hồi ${(p.pulseCd / 60).toFixed(1)}s` : p.carried < 3 ? "Cần 3 đom đóm" : "Sẵn sàng";
  ui.pulseBadge.classList.toggle("wait", p.pulseCd > 0 || p.carried < 3);

  // Bùa Gió buff badge
  ui.buffBadge.classList.toggle("hidden", !charmActive);
  if (charmActive) ui.buffBadge.textContent = `BÙA GIÓ ${(p.charmTicks / 60).toFixed(1)}s`;

  // Proximity [E] prompt (exact match to sim.mjs: XZ <= 2 m & |dy| <= 1.5 m)
  const near = game.lanterns
    .filter(l => (!l.lit || l.fuelUnits < 6000) && Math.hypot(p.pos[0] - l.pos[0], p.pos[2] - l.pos[2]) <= 2 && Math.abs(p.pos[1] - l.pos[1]) <= 1.5)
    .sort((a, b) => Math.hypot(p.pos[0] - a.pos[0], p.pos[2] - a.pos[2]) - Math.hypot(p.pos[0] - b.pos[0], p.pos[2] - b.pos[2]) || a.id.localeCompare(b.id))[0];
  ui.hint.classList.toggle("hidden", !near);
  if (near) {
    const txt = ui.hint.querySelector(".hint-text");
    txt.textContent = near.lit
      ? `CHÂM DẦU ${near.id} (${Math.floor(near.fuelUnits / 60)}%)`
      : `${near.everLit ? "THẮP LẠI" : "THẮP ĐÈN"} ${near.id} · ${near.deposited}/${near.everLit ? 5 : 10}`;
  }

  // Off-screen guidance pointer toward nearest urgent lantern (low fuel first, then unlit)
  const urgent = game.lanterns
    .filter(l => !l.lit || l.fuelUnits < 1800)
    .sort((a, b) => {
      const aLow = a.lit && a.fuelUnits < 1800 ? 0 : 1;
      const bLow = b.lit && b.fuelUnits < 1800 ? 0 : 1;
      return aLow - bLow || Math.hypot(p.pos[0] - a.pos[0], p.pos[2] - a.pos[2]) - Math.hypot(p.pos[0] - b.pos[0], p.pos[2] - b.pos[2]);
    })[0];
  const dist = urgent ? Math.hypot(p.pos[0] - urgent.pos[0], p.pos[2] - urgent.pos[2]) : 0;
  ui.arrow.classList.toggle("hidden", !urgent || dist < 16);
  if (urgent && dist >= 16) {
    const bearing = Math.atan2(urgent.pos[0] - p.pos[0], urgent.pos[2] - p.pos[2]) - cameraYaw * Math.PI / 180;
    ui.arrow.style.left = `${50 + Math.sin(bearing) * 38}%`;
    ui.arrow.style.top = `${48 - Math.cos(bearing) * 28}%`;
    ui.arrow.style.transform = "translate(-50%,-50%)";
    ui.arrowLabel.textContent = urgent.lit ? `${urgent.id} SẮP CẠN DẦU` : `${urgent.id} CHƯA THẮP`;
  }

  // Individual lantern fuel chips
  const drainingSet = new Set(game.shades.filter(s => s.state === "drain" && s.targetLanternId).map(s => s.targetLanternId));
  ui.lanternFuels.innerHTML = game.lanterns.map(l => {
    const fuel = l.lit ? Math.max(0, Math.min(100, l.fuelUnits / 60)) : 0;
    const low = l.lit && fuel < 30;
    const drain = drainingSet.has(l.id);
    const label = l.lit ? (drain ? "HÚT!" : `${Math.floor(fuel)}%`) : "TẮT";
    return `<div class="fuel-chip ${l.lit ? "lit" : "out"} ${low ? "low" : ""} ${drain ? "draining" : ""}" title="${l.id}: ${Math.floor(fuel)}%">
      <span class="lantern-num">${l.id.slice(1)}</span>
      <div class="fuel-track"><i class="fuel-fill" style="width:${fuel}%"></i></div>
      <span class="fuel-pct">${label}</span>
    </div>`;
  }).join("");

  // Night 3 Wind banner
  const showWind = game.night === 3 && (game.wind.warning || game.wind.active);
  ui.windWarning.classList.toggle("hidden", !showWind);
  if (showWind) {
    ui.windText.textContent = game.wind.active ? `GIÓ LỚN ĐANG THỔI (${game.wind.dirDeg}°)` : "GIÓ LỚN SẮP THỔI!";
  }
}

function handleSimEvents() {
  for (; lastEventIndex < game.events.length; lastEventIndex++) {
    const e = game.events[lastEventIndex];
    audio.playEvent(e);
    if (!renderer) continue;
    if (e.name === "pulse") renderer.spawnPulse(game.player.pos);
    else if (e.name === "mote_picked") renderer.spawnBurst(game.player.pos, PALETTE.moteGlow, 7);
    else if (e.name === "charm_picked") renderer.spawnBurst(game.player.pos, PALETTE.teal, 14);
    else if (e.name === "dash") renderer.spawnBurst(game.player.pos, PALETTE.core, 8);
    else if (e.name === "lantern_lit" || e.name === "refuel") {
      const l = game.lanterns.find(item => item.id === e.data?.lantern_id);
      if (l) renderer.spawnBurst([l.pos[0], l.pos[1] + 2.4, l.pos[2]], PALETTE.goldBright, e.name === "lantern_lit" ? 18 : 10);
    } else if (e.name === "player_hit") {
      triggerDamageFlash();
      renderer.spawnBurst(game.player.pos, PALETTE.danger, 14);
    }
  }
}

function animate(now) {
  const dt = Math.min(0.1, (now - (lastTime || now)) / 1000);
  lastTime = now;

  // Smooth camera yaw interpolation
  cameraYaw += (targetCameraYaw - cameraYaw) * Math.min(1, dt * 14);

  if (isRunning) {
    accumulator += dt;
    while (accumulator >= 1 / 60) {
      const settingsOpen = !ui.settings.classList.contains("hidden");
      const input = {
        move: [
          (keys.has("KeyD") || keys.has("ArrowRight") ? 1 : 0) - (keys.has("KeyA") || keys.has("ArrowLeft") ? 1 : 0),
          (keys.has("KeyW") || keys.has("ArrowUp") ? 1 : 0) - (keys.has("KeyS") || keys.has("ArrowDown") ? 1 : 0),
        ],
        cam_yaw_deg: cameraYaw,
        jump: keys.has("Space"),
        interact: keys.has("KeyE"),
        pulse: keys.has("KeyQ"),
        dash: keys.has("ShiftLeft") || keys.has("ShiftRight"),
        pause: !settingsOpen && (keys.has("Escape") || keys.has("KeyP")),
      };
      const before = game.state;
      stepGame(game, input, { snapshotEvery: 999999 });
      if (before === "playing" && game.state === "paused") {
        ui.pauseNight.textContent = `ĐÊM ${currentNight} · ${NIGHT_META[currentNight].name.toUpperCase()}`;
        showOverlay("pause");
      } else if (before === "paused" && game.state === "playing") {
        showOverlay(null);
      }
      handleSimEvents();
      accumulator -= 1 / 60;
    }
  }

  if (renderer) renderer.render(game, { now, cameraYaw, orbitMenu, colorblind });
  if (isRunning) updateHud(now);

  if ((game.state === "won" || game.state === "lost") && !ui.result.dataset.shown && isRunning) {
    ui.result.dataset.shown = "1";
    showResult();
  }

  // FPS counter
  fpsFrames++;
  if (!fpsStart) fpsStart = now;
  if (now - fpsStart >= 1000) {
    const fps = Math.round((fpsFrames * 1000) / (now - fpsStart));
    ui.fps.textContent = `FPS ${fps}`;
    fpsFrames = 0;
    fpsStart = now;
  }

  if (isRunning && game.state === "playing") {
    const secs = Math.ceil(game.timeLeftTicks / 60);
    if (secs <= 10 && secs > 0 && secs !== lastSeconds) audio.tickCountdown(secs);
    lastSeconds = secs;
  }

  requestAnimationFrame(animate);
}

// Input listeners
window.addEventListener("keydown", e => {
  if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) e.preventDefault();
  keys.add(e.code);
});
window.addEventListener("keyup", e => keys.delete(e.code));
window.addEventListener("blur", () => keys.clear());

// Mouse drag camera orbit
let dragging = false;
let lastX = 0;
canvas.addEventListener("pointerdown", e => {
  dragging = true;
  lastX = e.clientX;
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener("pointerup", () => { dragging = false; });
canvas.addEventListener("pointercancel", () => { dragging = false; });
canvas.addEventListener("pointermove", e => {
  if (dragging && isRunning && game.state === "playing") {
    targetCameraYaw -= (e.clientX - lastX) * 0.28 * sensitivity;
    lastX = e.clientX;
  }
});

// UI Buttons
byId("begin").addEventListener("click", () => { campaignScore = 0; showIntro(1); });
byId("start-night").addEventListener("click", startNight);
byId("resume").addEventListener("click", () => {
  if (game.state === "paused") {
    game.previous.pause = false;
    stepGame(game, { pause: true }, { snapshotEvery: 999999 });
    game.previous.pause = false;
    handleSimEvents();
  }
  isRunning = true;
  showOverlay(null);
});
byId("replay").addEventListener("click", () => {
  game = createGame({ seed: 2026 + currentNight, night: currentNight });
  lastEventIndex = game.events.length;
  startNight();
});
byId("result-replay").addEventListener("click", () => showIntro(currentNight));
byId("open-settings").addEventListener("click", () => openSettings("home"));
byId("pause-settings").addEventListener("click", () => openSettings("pause"));
byId("settings-back").addEventListener("click", () => showOverlay(settingsOrigin));
byId("to-menu").addEventListener("click", () => {
  isRunning = false;
  orbitMenu = true;
  campaignScore = 0;
  game = makeMenuPreview();
  ui.hud.classList.add("hidden");
  ui.controlsHint.classList.add("hidden");
  showOverlay("home");
});
byId("result-action").addEventListener("click", () => {
  if (game.state === "won" && currentNight < 3) showIntro(currentNight + 1);
  else {
    isRunning = false;
    orbitMenu = true;
    campaignScore = 0;
    game = makeMenuPreview();
    showOverlay("home");
  }
});

// Persistent settings
ui.volume.addEventListener("input", () => {
  audioVolume = Number(ui.volume.value) / 100;
  localStorage.setItem("ddl.volume", ui.volume.value);
  audio.setVolume(audioVolume);
  updateSettingLabels();
});
ui.sensitivity.addEventListener("input", () => {
  sensitivity = Number(ui.sensitivity.value) / 100;
  localStorage.setItem("ddl.sensitivity", ui.sensitivity.value);
  updateSettingLabels();
});
ui.colorblind.checked = colorblind;
ui.colorblind.addEventListener("change", () => {
  colorblind = ui.colorblind.checked;
  localStorage.setItem("ddl.colorblind", String(colorblind));
  document.body.classList.toggle("colorblind", colorblind);
});

updateSettingLabels();
requestAnimationFrame(animate);
