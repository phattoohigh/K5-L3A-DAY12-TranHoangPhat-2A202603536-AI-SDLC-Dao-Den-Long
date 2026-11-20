import { createBenchGame, createGame, stepGame } from "../sim.mjs";
import { createAudio } from "./audio.mjs";
import { createRenderer, PALETTE } from "./renderer.mjs";

const params = new URLSearchParams(window.location.search);
const BENCH_MODE = params.get("bench") === "1";
const SNAP_MODE = params.get("snap");

const canvas = document.getElementById("world");
const renderer = createRenderer(canvas, { preserveDrawingBuffer: Boolean(SNAP_MODE) });
if (!renderer) {
  document.body.insertAdjacentHTML("beforeend", "<p style='position:fixed;inset:24px;color:#fff'>Trình duyệt cần hỗ trợ WebGL để chơi Đảo Đèn Lồng.</p>");
}

const byId = id => document.getElementById(id);
const ui = {
  home: byId("home"),
  intro: byId("intro"),
  pause: byId("pause"),
  settings: byId("settings"),
  leaderboard: byId("leaderboard"),
  result: byId("result"),
  hud: byId("hud"),
  damageFlash: byId("damage-flash"),
  flames: byId("flames"),
  lanternFuels: byId("lantern-fuels"),
  nightPill: byId("night-pill"),
  clock: byId("clock"),
  dawnGoal: byId("dawn-goal"),
  windWarning: byId("wind-warning"),
  windText: byId("wind-text"),
  subtitles: byId("subtitles"),
  lanternCount: byId("lantern-count"),
  score: byId("score"),
  buffBadge: byId("buff-badge"),
  fps: byId("fps"),
  hint: byId("hint"),
  hintKey: byId("hint-key"),
  arrow: byId("arrow"),
  arrowLabel: byId("arrow-label"),
  shadeArrow: byId("shade-arrow"),
  motes: byId("motes"),
  carriedCount: byId("carried-count"),
  capacityCount: byId("capacity-count"),
  dashBadge: byId("dash-badge"),
  dashKeyLabel: byId("dash-key-label"),
  dashCd: byId("dash-cd"),
  pulseBadge: byId("pulse-badge"),
  pulseKeyLabel: byId("pulse-key-label"),
  pulseCd: byId("pulse-cd"),
  homeKeys: byId("home-keys"),
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
  lbForm: byId("lb-form"),
  lbName: byId("lb-name"),
  lbSubmit: byId("lb-submit"),
  lbFeedback: byId("lb-feedback"),
  lbTable: byId("lb-table"),
  volume: byId("volume"),
  volumeValue: byId("volume-value"),
  sensitivity: byId("sensitivity"),
  sensitivityValue: byId("sensitivity-value"),
  colorblind: byId("colorblind"),
  reducedMotion: byId("reduced-motion"),
  largeText: byId("large-text"),
  keybindList: byId("keybind-list"),
  keybindWarning: byId("keybind-warning"),
};

// ======================== BENCHMARK MODE (Ticket-04 §1) ========================
if (BENCH_MODE) {
  for (const k of ["home", "intro", "pause", "settings", "leaderboard", "result", "hud"]) {
    if (ui[k]) ui[k].classList.add("hidden");
  }
  const seed = Number(params.get("seed") ?? 42);
  const durationSec = Number(params.get("duration") ?? 30);
  const processStartMs = Number(params.get("t0") ?? Date.now());
  const warmupSec = 3.0;
  const benchGame = createBenchGame({ seed });

  let firstFrameAt = null;
  let loadMs = 0;
  let simAccum = 0;
  let lastNow = 0;
  let measureStart = null;
  const dts = [];
  let posted = false;

  function computeMetrics() {
    const n = dts.length;
    const sum = dts.reduce((a, b) => a + b, 0) || 1;
    const avgFps = Math.round(((1000 * n) / sum) * 10) / 10;
    const desc = [...dts].sort((a, b) => b - a);
    const k = Math.max(1, Math.ceil(0.01 * n));
    const slowAvg = desc.slice(0, k).reduce((a, b) => a + b, 0) / k;
    const p1LowFps = Math.round((1000 / slowAvg) * 10) / 10;
    const asc = [...dts].sort((a, b) => a - b);
    const p95 = Math.round(asc[Math.min(n - 1, Math.ceil(0.95 * n) - 1)] * 100) / 100;
    return {
      frames: n,
      avg_fps: avgFps,
      p1_low_fps: p1LowFps,
      frame_ms_p95: p95,
      load_ms: loadMs,
      renderer: renderer ? renderer.getRendererInfo() : "unavailable",
    };
  }

  function benchLoop(now) {
    if (firstFrameAt === null) {
      firstFrameAt = now;
      loadMs = Math.max(1, Math.round(Date.now() - processStartMs));
      lastNow = now;
    }
    const dtMs = now - lastNow;
    lastNow = now;
    const elapsedTotalSec = (now - firstFrameAt) / 1000;

    // Advance bench simulation at fixed 60 Hz (200 shades wandering normally)
    simAccum += Math.min(0.1, dtMs / 1000);
    while (simAccum >= 1 / 60) {
      stepGame(benchGame, {}, { snapshotEvery: 999999 });
      simAccum -= 1 / 60;
    }

    if (renderer) {
      renderer.render(benchGame, {
        now,
        cameraYaw: 0,
        benchMode: true,
        benchElapsedSec: elapsedTotalSec,
      });
      if (SNAP_MODE === "bench" && !posted && dts.length >= 2) {
        posted = true;
        fetch("/api/bench-result", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ png: canvas.toDataURL("image/png") }),
        }).catch(() => {});
        return;
      }
    }

    if (elapsedTotalSec >= warmupSec) {
      if (measureStart === null) {
        measureStart = now;
      } else {
        if (dtMs > 0) dts.push(dtMs);
        if ((now - measureStart) / 1000 >= durationSec && !posted) {
          posted = true;
          const payload = computeMetrics();
          fetch("/api/bench-result", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          }).catch(() => {});
          return;
        }
      }
    }
    requestAnimationFrame(benchLoop);
  }
  requestAnimationFrame(benchLoop);
} else {
  // ======================== NORMAL PLAYABLE GAME ========================
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

  const DEFAULT_BINDS = {
    up: "KeyW",
    down: "KeyS",
    left: "KeyA",
    right: "KeyD",
    jump: "Space",
    dash: "ShiftLeft",
    interact: "KeyE",
    pulse: "KeyQ",
    pause: "KeyP",
  };
  const BIND_LABELS = {
    up: "Đi lên",
    down: "Đi xuống",
    left: "Sang trái",
    right: "Sang phải",
    jump: "Nhảy",
    dash: "Lướt",
    interact: "Thắp / Châm dầu",
    pulse: "Tỏa Sáng",
    pause: "Tạm dừng",
  };
  const NAME_RE = /^[\p{L}0-9_]{3,12}$/u;

  function loadBinds() {
    try {
      const saved = JSON.parse(localStorage.getItem("ddl.keybinds") || "null");
      return saved && typeof saved === "object" ? { ...DEFAULT_BINDS, ...saved } : { ...DEFAULT_BINDS };
    } catch {
      return { ...DEFAULT_BINDS };
    }
  }

  function formatKeyCode(code) {
    if (!code) return "?";
    if (code.startsWith("Key")) return code.slice(3);
    if (code.startsWith("Digit")) return code.slice(5);
    if (code === "Space") return "SPACE";
    if (code === "ShiftLeft" || code === "ShiftRight") return "SHIFT";
    if (code === "Escape") return "ESC";
    return code.replace("Arrow", "↑↓←→"["UpDownLeftRight".indexOf(code.slice(5)) / 4] || "");
  }

  let keybinds = loadBinds();
  let listeningAction = null;
  let audioVolume = Number(localStorage.getItem("ddl.volume") ?? 35) / 100;
  let sensitivity = Number(localStorage.getItem("ddl.sensitivity") ?? 100) / 100;
  let colorblind = localStorage.getItem("ddl.colorblind") === "true";
  let reducedMotion = localStorage.getItem("ddl.reducedMotion") === "true";
  let largeText = localStorage.getItem("ddl.largeText") === "true";

  document.body.classList.toggle("colorblind", colorblind);
  document.body.classList.toggle("reduced-motion", reducedMotion);
  document.body.classList.toggle("large-text", largeText);

  const audio = createAudio(audioVolume);
  function makeMenuPreview() {
    const preview = createGame({ seed: 2026, night: 1 });
    preview.lanterns[0].lit = true;
    preview.lanterns[0].fuelUnits = 5400;
    preview.lanterns[2].lit = true;
    preview.lanterns[2].fuelUnits = 4200;
    return preview;
  }
  let game = makeMenuPreview();

  let currentNight = 1;
  let campaignScore = 0;
  let nightsWon = 0;
  let campaignSeed = 2026;
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
  let recentShadePos = null;
  let recentShadeUntil = 0;
  let lastLowFuelCaption = 0;
  let lastWindCaption = false;
  let lastTenSecCaption = false;
  const activeSubtitles = [];

  const keys = new Set();

  function addSubtitle(text, alert = false, ttlMs = 3200) {
    const now = performance.now();
    const existing = activeSubtitles.find(s => s.text === text);
    if (existing) { existing.until = now + ttlMs; return; }
    activeSubtitles.push({ text, alert, until: now + ttlMs });
    if (activeSubtitles.length > 3) activeSubtitles.shift();
  }

  function showOverlay(name) {
    listeningAction = null;
    for (const k of ["home", "intro", "pause", "settings", "leaderboard", "result"]) {
      if (ui[k]) ui[k].classList.toggle("hidden", k !== name);
    }
  }

  function refreshKeyLabels() {
    ui.hintKey.textContent = formatKeyCode(keybinds.interact);
    ui.dashKeyLabel.textContent = formatKeyCode(keybinds.dash);
    ui.pulseKeyLabel.textContent = formatKeyCode(keybinds.pulse);
    ui.homeKeys.innerHTML = [
      `${formatKeyCode(keybinds.up)}/${formatKeyCode(keybinds.left)}/${formatKeyCode(keybinds.down)}/${formatKeyCode(keybinds.right)} Di chuyển`,
      `${formatKeyCode(keybinds.jump)} Nhảy`,
      `${formatKeyCode(keybinds.dash)} Lướt`,
      `${formatKeyCode(keybinds.interact)} Nạp đèn`,
      `${formatKeyCode(keybinds.pulse)} Tỏa Sáng`,
      `${formatKeyCode(keybinds.pause)} Tạm dừng`,
    ].map(s => `<span>${s}</span>`).join("");
  }

  function renderKeybindList() {
    ui.keybindList.innerHTML = Object.keys(DEFAULT_BINDS).map(action => {
      const listening = listeningAction === action;
      return `<div class="keybind-row">
        <span>${BIND_LABELS[action]}</span>
        <button type="button" class="keybind-btn ${listening ? "listening" : ""}" data-action="${action}">
          ${listening ? "Nhấn phím..." : formatKeyCode(keybinds[action])}
        </button>
      </div>`;
    }).join("");
    for (const btn of ui.keybindList.querySelectorAll(".keybind-btn")) {
      btn.addEventListener("click", () => {
        listeningAction = btn.dataset.action;
        ui.keybindWarning.classList.add("hidden");
        renderKeybindList();
      });
    }
  }

  function updateSettingLabels() {
    ui.volumeValue.textContent = `${ui.volume.value}%`;
    ui.sensitivityValue.textContent = `${(Number(ui.sensitivity.value) / 100).toFixed(1)}×`;
  }

  function showIntro(night) {
    isRunning = false;
    orbitMenu = true;
    currentNight = night;
    game = createGame({ seed: campaignSeed + night, night });
    lastEventIndex = game.events.length;
    cameraYaw = 0;
    targetCameraYaw = 0;
    activeSubtitles.length = 0;
    recentShadePos = null;
    lastWindCaption = false;
    lastTenSecCaption = false;
    const meta = NIGHT_META[night];
    ui.nightLabel.textContent = `ĐÊM ${night} · ${meta.name.toUpperCase()}`;
    ui.introTitle.textContent = meta.title;
    ui.introCopy.textContent = meta.quote;
    ui.hud.classList.add("hidden");
    showOverlay("intro");
  }

  function startNight() {
    audio.start();
    isRunning = true;
    orbitMenu = false;
    lastSeconds = -1;
    ui.hud.classList.remove("hidden");
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
    ui.reducedMotion.checked = reducedMotion;
    ui.largeText.checked = largeText;
    ui.keybindWarning.classList.add("hidden");
    updateSettingLabels();
    renderKeybindList();
    showOverlay("settings");
  }

  async function fetchLeaderboard() {
    try {
      const res = await fetch("/api/leaderboard", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.entries)) {
          localStorage.setItem("ddl.leaderboard", JSON.stringify(data.entries));
          return data.entries;
        }
      }
    } catch {}
    try {
      return JSON.parse(localStorage.getItem("ddl.leaderboard") || "[]");
    } catch {
      return [];
    }
  }

  async function openLeaderboard() {
    showOverlay("leaderboard");
    ui.lbTable.innerHTML = `<div class="lb-empty">Đang tải bảng xếp hạng...</div>`;
    const entries = await fetchLeaderboard();
    if (!entries.length) {
      ui.lbTable.innerHTML = `<div class="lb-empty">Chưa có người giữ lửa nào được lưu.</div>`;
      return;
    }
    ui.lbTable.innerHTML = `
      <div class="lb-row head"><span>#</span><span>Tên</span><span>Điểm</span><span>Đêm</span></div>
      ${entries.map((e, idx) => `<div class="lb-row">
        <span>#${idx + 1}</span>
        <span>${String(e.name).replace(/[<>&]/g, "")}</span>
        <span>${e.score}</span>
        <span>${e.nights_won}/3</span>
      </div>`).join("")}
    `;
  }

  function triggerDamageFlash() {
    if (reducedMotion) return;
    ui.damageFlash.classList.add("active");
    if (damageTimer) clearTimeout(damageTimer);
    damageTimer = setTimeout(() => ui.damageFlash.classList.remove("active"), 220);
  }

  function showResult() {
    isRunning = false;
    orbitMenu = true;
    ui.hud.classList.add("hidden");
    const won = game.state === "won";
    const lit = game.lanterns.filter(l => l.lit).length;
    const total = game.lanterns.length;
    const required = Math.ceil(total * 0.6);
    if (won) {
      campaignScore += game.score;
      nightsWon = Math.max(nightsWon, currentNight);
    }

    ui.resultLabel.textContent = `ĐÊM ${currentNight} · ${NIGHT_META[currentNight].name.toUpperCase()}`;
    ui.resultTitle.textContent = won
      ? (currentNight === 3 ? "Bình minh rực rỡ trên cả ba hòn đảo!" : "Bình minh đã thức giấc.")
      : (game.player.flames <= 0 ? "Ngọn lửa đã tắt." : "Ánh sáng chưa đủ tới bình minh.");
    ui.resultCopy.textContent = won
      ? `Giữ sáng ${lit}/${total} ngọn bảo đăng (yêu cầu ≥ ${required}).`
      : `Cần ít nhất ${required}/${total} đèn còn sáng lúc bình minh và còn Ngọn Lửa.`;

    ui.resultStats.innerHTML = [
      ["ĐÈN SÁNG", `${lit}/${total}`],
      ["ĐIỂM ĐÊM", `${game.score}`],
      ["TỔNG ĐIỂM", `${campaignScore}`],
    ].map(([k, v]) => `<div class="stat-box"><span>${k}</span><b>${v}</b></div>`).join("");

    // Ticket-04 §3: prompt name save after Night 3 Dawn victory OR after losing any night
    const showLbSave = (won && currentNight === 3) || !won;
    ui.lbForm.classList.toggle("hidden", !showLbSave);
    ui.lbName.value = "";
    ui.lbName.disabled = false;
    ui.lbSubmit.disabled = false;
    ui.lbFeedback.textContent = "";
    ui.lbFeedback.classList.remove("error");

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
    ui.dawnGoal.textContent = litCount >= required ? `Đủ mốc (${litCount}/${required})` : `Cần ≥ ${required}/${total} đèn`;
    ui.dawnGoal.classList.toggle("met", litCount >= required);

    // Subtitle triggers (Ticket-04 §4: last 10 s, wind warning, low fuel < 30)
    if (seconds <= 10 && seconds > 0 && !lastTenSecCaption) {
      lastTenSecCaption = true;
      addSubtitle("Chỉ còn 10 giây tới bình minh!", true, 4000);
    }
    if (game.wind.warning && !lastWindCaption) {
      lastWindCaption = true;
      addSubtitle("Gió lớn sắp thổi!", true, 3200);
    } else if (!game.wind.warning) {
      lastWindCaption = false;
    }
    const lowLantern = game.lanterns.find(l => l.lit && l.fuelUnits < 1800);
    if (lowLantern && now - lastLowFuelCaption > 5000) {
      lastLowFuelCaption = now;
      addSubtitle(`Đèn ${lowLantern.id} sắp cạn dầu (< 30%)!`, true, 3200);
    }

    // Render active subtitles
    for (let i = activeSubtitles.length - 1; i >= 0; i--) {
      if (now >= activeSubtitles[i].until) activeSubtitles.splice(i, 1);
    }
    ui.subtitles.innerHTML = activeSubtitles.map(s => `<div class="subtitle-line ${s.alert ? "alert" : ""}">${s.text}</div>`).join("");

    // Directional edge arrow for newly spawned Bóng Mực
    const showShadeArrow = recentShadePos && now < recentShadeUntil;
    ui.shadeArrow.classList.toggle("hidden", !showShadeArrow);
    if (showShadeArrow) {
      const bearing = Math.atan2(recentShadePos[0] - p.pos[0], recentShadePos[2] - p.pos[2]) - cameraYaw * Math.PI / 180;
      ui.shadeArrow.style.left = `${50 - Math.sin(bearing) * 42}%`;
      ui.shadeArrow.style.top = `${50 - Math.cos(bearing) * 34}%`;
      ui.shadeArrow.style.transform = "translate(-50%,-50%)";
    }

    ui.flames.innerHTML = Array.from({ length: 3 }, (_, i) => FLAME_SVG(i < p.flames)).join("");
    ui.lanternCount.textContent = `ĐÈN ${litCount}/${total}`;
    ui.score.textContent = String(campaignScore + game.score);

    const capacity = Math.min(20, 10 + 2 * game.successfulLights);
    ui.carriedCount.textContent = String(p.carried);
    ui.capacityCount.textContent = String(capacity);
    ui.motes.innerHTML = Array.from({ length: capacity }, (_, i) => `<i class="${i < p.carried ? "on" : ""}"></i>`).join("");

    const charmActive = p.charmTicks > 0;
    ui.dashCd.textContent = charmActive ? "Bùa Gió" : p.dashCd > 0 ? `${(p.dashCd / 60).toFixed(1)}s` : "Sẵn sàng";
    ui.dashBadge.classList.toggle("wait", p.dashCd > 0 && !charmActive);
    ui.dashBadge.classList.toggle("buffed", charmActive);

    ui.pulseCd.textContent = p.pulseCd > 0 ? `${(p.pulseCd / 60).toFixed(1)}s` : p.carried < 3 ? "Cần 3" : "Sẵn sàng";
    ui.pulseBadge.classList.toggle("wait", p.pulseCd > 0 || p.carried < 3);

    ui.buffBadge.classList.toggle("hidden", !charmActive);
    if (charmActive) ui.buffBadge.textContent = `BÙA GIÓ ${(p.charmTicks / 60).toFixed(1)}s`;

    const near = game.lanterns
      .filter(l => (!l.lit || l.fuelUnits < 6000) && Math.hypot(p.pos[0] - l.pos[0], p.pos[2] - l.pos[2]) <= 2 && Math.abs(p.pos[1] - l.pos[1]) <= 1.5)
      .sort((a, b) => Math.hypot(p.pos[0] - a.pos[0], p.pos[2] - a.pos[2]) - Math.hypot(p.pos[0] - b.pos[0], p.pos[2] - b.pos[2]) || a.id.localeCompare(b.id))[0];
    ui.hint.classList.toggle("hidden", !near);
    if (near) {
      ui.hint.querySelector(".hint-text").textContent = near.lit
        ? `CHÂM DẦU ${near.id} (${Math.floor(near.fuelUnits / 60)}%)`
        : `${near.everLit ? "THẮP LẠI" : "THẮP ĐÈN"} ${near.id} · ${near.deposited}/${near.everLit ? 5 : 10}`;
    }

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
      ui.arrow.style.left = `${50 - Math.sin(bearing) * 38}%`;
      ui.arrow.style.top = `${50 - Math.cos(bearing) * 28}%`;
      ui.arrow.style.transform = "translate(-50%,-50%)";
      ui.arrowLabel.textContent = urgent.lit ? `${urgent.id} CẠN DẦU` : `${urgent.id}`;
    }

    const drainingSet = new Set(game.shades.filter(s => s.state === "drain" && s.targetLanternId).map(s => s.targetLanternId));
    ui.lanternFuels.innerHTML = game.lanterns.map(l => {
      const fuel = l.lit ? Math.max(0, Math.min(100, l.fuelUnits / 60)) : 0;
      const low = l.lit && fuel < 30;
      const drain = drainingSet.has(l.id);
      const label = l.lit ? (drain ? "HÚT!" : `${Math.floor(fuel)}%`) : "TẮT";
      return `<div class="fuel-chip ${l.lit ? "lit" : "out"} ${low ? "low" : ""} ${drain ? "draining" : ""}">
        <span class="lantern-num">${l.id}</span>
        <div class="fuel-track"><i class="fuel-fill" style="width:${fuel}%"></i></div>
        <span class="fuel-pct">${label}</span>
      </div>`;
    }).join("");

    const showWind = game.night === 3 && (game.wind.warning || game.wind.active);
    ui.windWarning.classList.toggle("hidden", !showWind);
    if (showWind) {
      ui.windText.textContent = game.wind.active ? `GIÓ LỚN (${game.wind.dirDeg}°)` : "GIÓ LỚN SẮP THỔI!";
    }
  }

  function handleSimEvents() {
    for (; lastEventIndex < game.events.length; lastEventIndex++) {
      const e = game.events[lastEventIndex];
      audio.playEvent(e);
      if (e.name === "shade_spawned") {
        addSubtitle("Bóng Mực vừa xuất hiện!", true, 3500);
        const sh = game.shades.find(s => s.id === e.data?.id);
        if (sh) {
          recentShadePos = [...sh.pos];
          recentShadeUntil = performance.now() + 3500;
        }
      }
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

    cameraYaw = reducedMotion ? targetCameraYaw : cameraYaw + (targetCameraYaw - cameraYaw) * Math.min(1, dt * 14);

    if (isRunning) {
      accumulator += dt;
      while (accumulator >= 1 / 60) {
        const settingsOpen = !ui.settings.classList.contains("hidden");
        const input = {
          move: [
            (keys.has(keybinds.left) ? 1 : 0) - (keys.has(keybinds.right) ? 1 : 0),
            (keys.has(keybinds.up) ? 1 : 0) - (keys.has(keybinds.down) ? 1 : 0),
          ],
          cam_yaw_deg: cameraYaw,
          jump: keys.has(keybinds.jump),
          interact: keys.has(keybinds.interact),
          pulse: keys.has(keybinds.pulse),
          dash: keys.has(keybinds.dash) || (keybinds.dash === "ShiftLeft" && keys.has("ShiftRight")),
          pause: !settingsOpen && (keys.has(keybinds.pause) || (keybinds.pause === "KeyP" && keys.has("Escape"))),
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

    if (renderer) {
      renderer.render(game, { now, cameraYaw, orbitMenu, colorblind, reducedMotion });
      if (SNAP_MODE === "world" && fpsFrames >= 5) {
        fetch("/api/bench-result", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ png: canvas.toDataURL("image/png") }),
        }).catch(() => {});
        return;
      }
    }
    if (isRunning) updateHud(now);

    if ((game.state === "won" || game.state === "lost") && !ui.result.dataset.shown && isRunning) {
      ui.result.dataset.shown = "1";
      showResult();
    }

    fpsFrames++;
    if (!fpsStart) fpsStart = now;
    if (now - fpsStart >= 1000) {
      ui.fps.textContent = `FPS ${Math.round((fpsFrames * 1000) / (now - fpsStart))}`;
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

  // Input + Key Remapping handler
  window.addEventListener("keydown", e => {
    if (listeningAction) {
      e.preventDefault();
      const duplicate = Object.entries(keybinds).find(([act, code]) => act !== listeningAction && code === e.code);
      if (duplicate) {
        ui.keybindWarning.textContent = `Phím "${formatKeyCode(e.code)}" đã trùng với "${BIND_LABELS[duplicate[0]]}"! Vui lòng chọn phím khác.`;
        ui.keybindWarning.classList.remove("hidden");
        return;
      }
      keybinds[listeningAction] = e.code;
      localStorage.setItem("ddl.keybinds", JSON.stringify(keybinds));
      listeningAction = null;
      ui.keybindWarning.classList.add("hidden");
      renderKeybindList();
      refreshKeyLabels();
      return;
    }
    if (document.activeElement && document.activeElement.tagName === "INPUT") return;
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

  // UI buttons
  byId("begin").addEventListener("click", () => { campaignScore = 0; nightsWon = 0; showIntro(1); });
  byId("open-leaderboard").addEventListener("click", openLeaderboard);
  byId("lb-back").addEventListener("click", () => showOverlay("home"));
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
    game = createGame({ seed: campaignSeed + currentNight, night: currentNight });
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
    nightsWon = 0;
    game = makeMenuPreview();
    ui.hud.classList.add("hidden");
    showOverlay("home");
  });
  byId("result-action").addEventListener("click", () => {
    if (game.state === "won" && currentNight < 3) showIntro(currentNight + 1);
    else {
      isRunning = false;
      orbitMenu = true;
      campaignScore = 0;
      nightsWon = 0;
      game = makeMenuPreview();
      showOverlay("home");
    }
  });
  byId("reset-keys").addEventListener("click", () => {
    keybinds = { ...DEFAULT_BINDS };
    listeningAction = null;
    localStorage.setItem("ddl.keybinds", JSON.stringify(keybinds));
    ui.keybindWarning.classList.add("hidden");
    renderKeybindList();
    refreshKeyLabels();
  });

  // Leaderboard submit
  ui.lbForm.addEventListener("submit", async e => {
    e.preventDefault();
    const rawName = ui.lbName.value.trim();
    if (!NAME_RE.test(rawName)) {
      ui.lbFeedback.textContent = "Tên phải dài 3–12 ký tự (chữ cái, số hoặc _, không khoảng trắng).";
      ui.lbFeedback.classList.add("error");
      return;
    }
    const payload = { name: rawName, score: campaignScore, nights_won: nightsWon, seed: campaignSeed };
    try {
      const res = await fetch("/api/leaderboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Không lưu được điểm");
      localStorage.setItem("ddl.leaderboard", JSON.stringify(data.entries || []));
      ui.lbFeedback.textContent = `Đã lưu "${rawName}" (${campaignScore} điểm) vào Bảng xếp hạng!`;
      ui.lbFeedback.classList.remove("error");
      ui.lbName.disabled = true;
      ui.lbSubmit.disabled = true;
    } catch (err) {
      ui.lbFeedback.textContent = err.message;
      ui.lbFeedback.classList.add("error");
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
  ui.reducedMotion.checked = reducedMotion;
  ui.reducedMotion.addEventListener("change", () => {
    reducedMotion = ui.reducedMotion.checked;
    localStorage.setItem("ddl.reducedMotion", String(reducedMotion));
    document.body.classList.toggle("reduced-motion", reducedMotion);
  });
  ui.largeText.checked = largeText;
  ui.largeText.addEventListener("change", () => {
    largeText = ui.largeText.checked;
    localStorage.setItem("ddl.largeText", String(largeText));
    document.body.classList.toggle("large-text", largeText);
  });

  updateSettingLabels();
  refreshKeyLabels();
  requestAnimationFrame(animate);
}
