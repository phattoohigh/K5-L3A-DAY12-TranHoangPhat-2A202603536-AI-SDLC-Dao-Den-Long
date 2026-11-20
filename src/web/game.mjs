import { createGame, stepGame } from "../sim.mjs";

const canvas = document.querySelector("#world");
const gl = canvas.getContext("webgl", { antialias: true, alpha: false });
if (!gl) document.body.insertAdjacentHTML("beforeend", "<p class='webgl-error'>WebGL is required to play this 3D game.</p>");

const $ = selector => document.querySelector(selector);
const ui = Object.fromEntries([
  "home", "intro", "pause", "settings", "result", "hud", "controls-hint",
  "flames", "clock", "lantern-count", "score", "motes", "dash-cd", "pulse-cd",
  "hint", "arrow", "wind-warning", "night-label", "intro-title", "intro-copy",
  "pause-night", "result-label", "result-title", "result-copy", "result-action",
  "result-replay", "volume", "sensitivity", "volume-value", "sensitivity-value",
  "fps", "carried-count", "capacity-count", "dash-badge", "pulse-badge", "lantern-fuels", "colorblind"
].map(id => [id.replaceAll("-", "_"), document.getElementById(id)]));

const colors = {
  sky: "#10152B",
  sky2: "#263A61",
  grass: "#315D4C",
  grassDark: "#244739",
  grassLight: "#477A62",
  sand: "#C4AA7C",
  rock: "#5C636E",
  rockDark: "#3E434D",
  wood: "#5A3820",
  woodDark: "#382010",
  woodRed: "#78281E",
  sea: "#132E43",
  seaFoam: "#39708A",
  amber: "#FFA830",
  amberDeep: "#E07810",
  core: "#FFF4D0",
  unlit: "#454854",
  mote: "#FFF8D6",
  moteGlow: "#FFDC52",
  shade: "#090312",
  shadeBody: "#150824",
  violet: "#7A35FF",
  violetBright: "#AC66FF",
  stunned: "#2F2745",
  goldSeal: "#FFD700",
  robe: "#F6F1E6",
  robeOuter: "#1A3245",
  skin: "#FDE6D2",
  hair: "#120D1A",
  red: "#C8102E",
  gold: "#F2C14E",
  drifter: "#7B9DB5",
  drifterDark: "#4D6B82",
  teal: "#4ECDC4"
};

const rgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255);

const mat4 = {
  identity: () => new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]),
  multiply: (a, b) => {
    const o = new Float32Array(16);
    for (let c = 0; c < 4; c++)
      for (let r = 0; r < 4; r++)
        o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
    return o;
  },
  perspective: (fovy, aspect, near, far) => {
    const f = 1 / Math.tan(fovy / 2), nf = 1 / (near - far);
    return new Float32Array([f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) * nf, -1, 0, 0, 2 * far * near * nf, 0]);
  },
  lookAt: (eye, center, up) => {
    let zx = eye[0] - center[0], zy = eye[1] - center[1], zz = eye[2] - center[2], zl = Math.hypot(zx, zy, zz) || 1;
    zx /= zl; zy /= zl; zz /= zl;
    let xx = up[1] * zz - up[2] * zy, xy = up[2] * zx - up[0] * zz, xz = up[0] * zy - up[1] * zx, xl = Math.hypot(xx, xy, xz) || 1;
    xx /= xl; xy /= xl; xz /= xl;
    const yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx;
    return new Float32Array([xx, yx, zx, 0, xy, yy, zy, 0, xz, yz, zz, 0, -(xx * eye[0] + xy * eye[1] + xz * eye[2]), -(yx * eye[0] + yy * eye[1] + yz * eye[2]), -(zx * eye[0] + zy * eye[1] + zz * eye[2]), 1]);
  },
  model: (pos, scale) => new Float32Array([scale[0], 0, 0, 0, 0, scale[1], 0, 0, 0, 0, scale[2], 0, pos[0], pos[1], pos[2], 1]),
};

function compile(type, source) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, source);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw Error(gl.getShaderInfoLog(sh));
  return sh;
}

const program = gl.createProgram();
gl.attachShader(program, compile(gl.VERTEX_SHADER,
  `attribute vec3 position;
   uniform mat4 projection, view, model;
   uniform float time;
   varying vec3 vNormal;
   varying float vDepth;
   varying vec3 vWorldPos;
   void main(){
     vec4 wp = model * vec4(position, 1.0);
     vWorldPos = wp.xyz;
     vec4 vp = view * wp;
     gl_Position = projection * vp;
     vDepth = length(vp.xyz);
     vNormal = normalize(mat3(model) * position);
   }`
));
gl.attachShader(program, compile(gl.FRAGMENT_SHADER,
  `precision mediump float;
   uniform vec3 color;
   uniform float glow, environment, time;
   varying vec3 vNormal, vWorldPos;
   varying float vDepth;
   void main(){
     vec3 keyDir   = normalize(vec3(-0.4, 0.85, 0.3));
     vec3 fillDir  = normalize(vec3( 0.6, 0.4, -0.5));
     vec3 rimDir   = normalize(vec3( 0.1,-0.3, -0.9));
     vec3 n = normalize(vNormal);
     float key  = max(dot(n, keyDir),  0.0);
     float fill = max(dot(n, fillDir), 0.0) * 0.30;
     float rim  = pow(max(dot(n, rimDir), 0.0), 3.0) * 0.22;
     float amb = environment * (0.22 + 0.14 * (n.y * 0.5 + 0.5));
     vec3 viewDir = normalize(-vWorldPos);
     vec3 h = normalize(keyDir + viewDir);
     float spec = pow(max(dot(n, h), 0.0), 32.0) * 0.15;
     float light = amb + key * (0.58 + 0.35 * environment) + fill + rim + spec + glow;
     float fog = smoothstep(55.0, 140.0, vDepth) * 0.58;
     vec3 fogColor = vec3(0.075, 0.105, 0.19);
     vec3 lit = mix(color * light, fogColor, fog);
     float ground = smoothstep(-1.5, 0.5, vWorldPos.y);
     lit *= (0.75 + 0.25 * ground);
     gl_FragColor = vec4(lit, 1.0);
   }`
));
gl.linkProgram(program);
if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw Error(gl.getProgramInfoLog(program));
gl.useProgram(program);

const loc = {
  position: gl.getAttribLocation(program, "position"),
  projection: gl.getUniformLocation(program, "projection"),
  view: gl.getUniformLocation(program, "view"),
  model: gl.getUniformLocation(program, "model"),
  color: gl.getUniformLocation(program, "color"),
  glow: gl.getUniformLocation(program, "glow"),
  environment: gl.getUniformLocation(program, "environment"),
  time: gl.getUniformLocation(program, "time"),
};

function mesh(vertices) {
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
  return { buffer, count: vertices.length / 3 };
}

function sphereMesh() {
  const v = [];
  const rows = 14, cols = 20;
  for (let y = 0; y < rows; y++) {
    const a0 = -Math.PI / 2 + y / rows * Math.PI, a1 = -Math.PI / 2 + (y + 1) / rows * Math.PI;
    for (let x = 0; x < cols; x++) {
      const b0 = x / cols * Math.PI * 2, b1 = (x + 1) / cols * Math.PI * 2;
      const p = (a, b) => [Math.cos(a) * Math.cos(b), Math.sin(a), Math.cos(a) * Math.sin(b)];
      const a = p(a0, b0), b = p(a1, b0), c = p(a1, b1), d = p(a0, b1);
      v.push(...a, ...b, ...c, ...a, ...c, ...d);
    }
  }
  return mesh(v);
}

function cylinderMesh(sides = 18) {
  const v = [];
  for (let i = 0; i < sides; i++) {
    const a = i / sides * Math.PI * 2, b = (i + 1) / sides * Math.PI * 2;
    const x = Math.cos(a), z = Math.sin(a), X = Math.cos(b), Z = Math.sin(b);
    v.push(0, 0, 0, X, 0, Z, x, 0, z, x, 1, z, X, 1, Z, 0, 1, 0, x, 0, z, X, 0, Z, X, 1, Z, x, 0, z, X, 1, Z, x, 1, z);
  }
  return mesh(v);
}

function coneMesh(sides = 18) {
  const v = [];
  for (let i = 0; i < sides; i++) {
    const a = i / sides * Math.PI * 2, b = (i + 1) / sides * Math.PI * 2;
    v.push(0, 0, 0, Math.cos(b), 0, Math.sin(b), Math.cos(a), 0, Math.sin(a), Math.cos(a), 0, Math.sin(a), 0, 1, 0, Math.cos(b), 0, Math.sin(b));
  }
  return mesh(v);
}

function pyramidMesh(sides = 4) {
  const v = [];
  for (let i = 0; i < sides; i++) {
    const a = i / sides * Math.PI * 2, b = (i + 1) / sides * Math.PI * 2;
    v.push(0, 0, 0, Math.cos(b), 0, Math.sin(b), Math.cos(a), 0, Math.sin(a), Math.cos(a), 0, Math.sin(a), 0, 1, 0, Math.cos(b), 0, Math.sin(b));
  }
  return mesh(v);
}

function torusMesh(R = 1, r = 0.22, segsR = 16, segsr = 8) {
  const v = [];
  for (let i = 0; i < segsR; i++) {
    const u0 = i / segsR * Math.PI * 2, u1 = (i + 1) / segsR * Math.PI * 2;
    for (let j = 0; j < segsr; j++) {
      const v0 = j / segsr * Math.PI * 2, v1 = (j + 1) / segsr * Math.PI * 2;
      const p = (u, t) => [
        (R + r * Math.cos(t)) * Math.cos(u),
        r * Math.sin(t),
        (R + r * Math.cos(t)) * Math.sin(u)
      ];
      const a = p(u0, v0), b = p(u1, v0), c = p(u1, v1), d = p(u0, v1);
      v.push(...a, ...b, ...c, ...a, ...c, ...d);
    }
  }
  return mesh(v);
}

function boxMesh() {
  const v = [];
  const faces = [
    [[-.5,-.5,.5],[.5,-.5,.5],[.5,.5,.5],[-.5,.5,.5]],
    [[.5,-.5,-.5],[-.5,-.5,-.5],[-.5,.5,-.5],[.5,.5,-.5]],
    [[-.5,-.5,-.5],[-.5,-.5,.5],[-.5,.5,.5],[-.5,.5,-.5]],
    [[.5,-.5,.5],[.5,-.5,-.5],[.5,.5,-.5],[.5,.5,.5]],
    [[-.5,.5,.5],[.5,.5,.5],[.5,.5,-.5],[-.5,.5,-.5]],
    [[-.5,-.5,-.5],[.5,-.5,-.5],[.5,-.5,.5],[-.5,-.5,.5]]
  ];
  for (const f of faces) v.push(...f[0], ...f[1], ...f[2], ...f[0], ...f[2], ...f[3]);
  return mesh(v);
}

const meshes = {
  sphere: sphereMesh(),
  cylinder: cylinderMesh(),
  cone: coneMesh(),
  pyramid: pyramidMesh(),
  torus: torusMesh(),
  box: boxMesh()
};

gl.enable(gl.DEPTH_TEST);
gl.clearColor(...rgb(colors.sky), 1);

let _currentTime = 0;
function draw(kind, pos, scale, color, glow = 0) {
  const m = meshes[kind] || meshes.box;
  gl.bindBuffer(gl.ARRAY_BUFFER, m.buffer);
  gl.enableVertexAttribArray(loc.position);
  gl.vertexAttribPointer(loc.position, 3, gl.FLOAT, false, 0, 0);
  gl.uniformMatrix4fv(loc.model, false, mat4.model(pos, scale));
  gl.uniform3fv(loc.color, rgb(color));
  gl.uniform1f(loc.glow, glow);
  gl.uniform1f(loc.time, _currentTime);
  gl.drawArrays(gl.TRIANGLES, 0, m.count);
}

const ringCache = new Map();
function drawRing(pos, inner, outer, color, start = 0, end = 360) {
  const steps = Math.ceil((end - start) / 8), ratio = inner / outer, key = `${steps}/${ratio.toFixed(4)}/${start}/${end}`;
  let ring = ringCache.get(key);
  if (!ring) {
    const verts = [];
    for (let i = 0; i < steps; i++) {
      const a = (start + (end - start) * i / steps) * Math.PI / 180;
      const b = (start + (end - start) * (i + 1) / steps) * Math.PI / 180;
      const p = (r, t) => [Math.cos(t) * r, 0, Math.sin(t) * r];
      const a0 = p(ratio, a), a1 = p(1, a), b1 = p(1, b), b0 = p(ratio, b);
      verts.push(...a0, ...a1, ...b1, ...a0, ...b1, ...b0);
    }
    ring = mesh(verts);
    ringCache.set(key, ring);
  }
  gl.bindBuffer(gl.ARRAY_BUFFER, ring.buffer);
  gl.vertexAttribPointer(loc.position, 3, gl.FLOAT, false, 0, 0);
  gl.uniformMatrix4fv(loc.model, false, mat4.model(pos, [outer, 1, outer]));
  gl.uniform3fv(loc.color, rgb(color));
  gl.uniform1f(loc.glow, 0);
  gl.uniform1f(loc.time, _currentTime);
  gl.drawArrays(gl.TRIANGLES, 0, ring.count);
}

const rampCache = new Map();
function drawRamp(degrees) {
  let ramp = rampCache.get(degrees);
  if (!ramp) {
    const a = degrees * Math.PI / 180, ux = Math.cos(a), uz = Math.sin(a), px = -uz * 1.5, pz = ux * 1.5;
    const outerL = [ux * 30 + px, 0, uz * 30 + pz], outerR = [ux * 30 - px, 0, uz * 30 - pz];
    const innerL = [ux * 24 + px, 3, uz * 24 + pz], innerR = [ux * 24 - px, 3, uz * 24 - pz];
    ramp = mesh([...outerL, ...innerL, ...innerR, ...outerL, ...innerR, ...outerR]);
    rampCache.set(degrees, ramp);
  }
  gl.bindBuffer(gl.ARRAY_BUFFER, ramp.buffer);
  gl.vertexAttribPointer(loc.position, 3, gl.FLOAT, false, 0, 0);
  gl.uniformMatrix4fv(loc.model, false, mat4.identity());
  gl.uniform3fv(loc.color, rgb(colors.sand));
  gl.uniform1f(loc.glow, 0);
  gl.uniform1f(loc.time, _currentTime);
  gl.drawArrays(gl.TRIANGLES, 0, ramp.count);
}

let game = createGame({ seed: 2026, night: 1 });
let currentNight = 1, campaignScore = 0, cameraYaw = 0, lastTime = 0, accumulator = 0;
let lastHud = 0, lastEventIndex = 0, audioCtx = null, musicGain = null;
let audioVolume = Number(localStorage.getItem("ddl.volume") ?? 35) / 100;
let sensitivity = Number(localStorage.getItem("ddl.sensitivity") ?? 100) / 100;
let colorblind = localStorage.getItem("ddl.colorblind") === "true";
document.body.classList.toggle("colorblind", colorblind);
let settingsOrigin = "home", isRunning = false, fpsFrames = 0, fpsTime = 0, lastSeconds = -1;
const keys = new Set();
const nightNames = ["", "Đảo Bến", "Đảo Cau", "Đảo Chuông"];

function show(id) {
  for (const name of ["home", "intro", "pause", "settings", "result"]) {
    if (ui[name]) ui[name].classList.add("hidden");
  }
  if (id && ui[id]) ui[id].classList.remove("hidden");
}

function startSound() {
  if (audioCtx) return;
  audioCtx = new AudioContext();
  musicGain = audioCtx.createGain();
  musicGain.gain.value = audioVolume * 0.035;
  musicGain.connect(audioCtx.destination);
  const osc = audioCtx.createOscillator();
  const low = audioCtx.createOscillator();
  const lfo = audioCtx.createOscillator();
  const trem = audioCtx.createGain();
  osc.type = "sine";
  low.type = "triangle";
  lfo.frequency.value = .12;
  trem.gain.value = 3;
  lfo.connect(trem);
  trem.connect(osc.frequency);
  osc.frequency.value = 196;
  low.frequency.value = 98;
  osc.connect(musicGain);
  low.connect(musicGain);
  osc.start();
  low.start();
  lfo.start();
}

function sfx(freq = 500, duration = .11, type = "sine") {
  if (!audioCtx) return;
  const o = audioCtx.createOscillator(), g = audioCtx.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(audioVolume * .16, audioCtx.currentTime);
  g.gain.exponentialRampToValueAtTime(.001, audioCtx.currentTime + duration);
  o.connect(g);
  g.connect(audioCtx.destination);
  o.start();
  o.stop(audioCtx.currentTime + duration);
}

function showIntro(night) {
  isRunning = false;
  currentNight = night;
  game = createGame({ seed: 2026 + night, night });
  lastEventIndex = 0;
  if (ui.night_label) ui.night_label.textContent = `ĐÊM ${night} · ${nightNames[night].toUpperCase()}`;
  if (ui.intro_title) ui.intro_title.textContent = ["", "Giữ lửa tới bình minh", "Cầu tre trong sương", "Tiếng chuông trên cao"][night];
  if (ui.intro_copy) ui.intro_copy.textContent = [
    "",
    "Ông Đăng: “Thắp đèn mới chỉ là khởi đầu. Hãy châm dầu và giữ ít nhất ba ngọn sáng tới bình minh.”",
    "Ông Đăng: “Cầu tre nối hai đảo. Giữ ít nhất bốn ngọn sáng, và coi chừng Bóng Mực hút dầu.”",
    "Ông Đăng: “Gió đổi chiều. Giữ năm ngọn sáng tới bình minh và lắng nghe trước khi bước lên tầng cao.”"
  ][night];
  show("intro");
}

function startNight() {
  startSound();
  if (audioCtx && audioCtx.state === "suspended") audioCtx.resume();
  isRunning = true;
  if (ui.hud) ui.hud.classList.remove("hidden");
  if (ui.controls_hint) ui.controls_hint.classList.remove("hidden");
  show(null);
  accumulator = 0;
  lastTime = performance.now();
}

function openSettings(from) {
  settingsOrigin = from;
  if (ui.volume) ui.volume.value = String(Math.round(audioVolume * 100));
  if (ui.sensitivity) ui.sensitivity.value = String(Math.round(sensitivity * 100));
  updateSettingLabels();
  show("settings");
}

function updateSettingLabels() {
  if (ui.volume && ui.volume_value) ui.volume_value.textContent = `${ui.volume.value}%`;
  if (ui.sensitivity && ui.sensitivity_value) ui.sensitivity_value.textContent = `${(Number(ui.sensitivity.value) / 100).toFixed(1)}×`;
}

function showResult() {
  isRunning = false;
  if (ui.hud) ui.hud.classList.add("hidden");
  if (ui.controls_hint) ui.controls_hint.classList.add("hidden");
  const won = game.state === "won";
  campaignScore += won ? game.score : 0;
  if (ui.result_label) ui.result_label.textContent = `ĐÊM ${currentNight} · ${won ? "GIỮ SÁNG THÀNH CÔNG" : "SƯƠNG ĐEN"}`;
  if (ui.result_title) ui.result_title.textContent = won ? "Bình minh đã thức giấc." : "Ánh sáng chưa đủ tới bình minh.";
  if (ui.result_copy) ui.result_copy.textContent = won ? `Đèn còn sáng: ${game.lanterns.filter(l => l.lit).length}/${game.lanterns.length} · Điểm đêm: ${game.score} · Tổng hành trình: ${campaignScore}` : `Đèn còn sáng: ${game.lanterns.filter(l => l.lit).length}/${game.lanterns.length} · Lửa còn lại: ${game.player.flames} · Điểm hành trình: ${campaignScore}`;
  if (ui.result_action) ui.result_action.textContent = won && currentNight < 3 ? `TIẾP TỤC ĐẾN ĐÊM ${currentNight + 1}  →` : "VỀ MENU CHÍNH";
  if (ui.result_replay) ui.result_replay.classList.toggle("hidden", won && currentNight === 3);
  show("result");
  sfx(won ? 740 : 165, .55, "triangle");
}

function updateHud(now) {
  if (now - lastHud < 100) return;
  lastHud = now;
  const p = game.player;
  const seconds = Math.ceil(game.timeLeftTicks / 60);
  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");

  if (ui.clock) {
    ui.clock.textContent = `${mm}:${ss}`;
    ui.clock.classList.toggle("danger", seconds <= 30);
  }
  if (ui.flames) {
    ui.flames.innerHTML = Array.from({ length: 3 }, (_, i) => `<span class="flame-mark ${i < p.flames ? "alive" : "spent"}" aria-label="${i < p.flames ? "Ngọn lửa còn lại" : "Ngọn lửa đã mất"}"></span>`).join("");
  }
  if (ui.lantern_count) {
    ui.lantern_count.textContent = `ĐÈN ${game.lanterns.filter(l => l.lit).length}/${game.lanterns.length}`;
  }
  if (ui.score) {
    ui.score.textContent = String(campaignScore + game.score);
  }
  if (ui.carried_count) {
    ui.carried_count.textContent = String(p.carried);
  }
  const capacity = Math.min(20, 10 + 2 * game.successfulLights);
  if (ui.capacity_count) ui.capacity_count.textContent = String(capacity);
  if (ui.motes) {
    ui.motes.innerHTML = Array.from({ length: capacity }, (_, i) => `<i class="${i < p.carried ? "on" : ""}"></i>`).join("");
  }

  // Cooldown status
  if (ui.dash_cd) {
    ui.dash_cd.textContent = p.charmTicks > 0 ? "LƯỚT · BÙA GIÓ" : p.dashCd > 0 ? `LƯỚT (${Math.ceil(p.dashCd / 60)}s)` : "LƯỚT SẴN SÀNG";
    ui.dash_cd.classList.toggle("wait", p.dashCd > 0 && p.charmTicks <= 0);
  }
  if (ui.pulse_cd) {
    ui.pulse_cd.textContent = p.pulseCd > 0 ? `TỎA SÁNG (${Math.ceil(p.pulseCd / 60)}s)` : p.carried < 3 ? "TỎA SÁNG (CẦN 3 ĐOM ĐÓM)" : "TỎA SÁNG SẴN SÀNG";
    ui.pulse_cd.classList.toggle("wait", p.pulseCd > 0);
  }

  // Proximity hint (matches sim.mjs XZ <= 2 m and |dy| <= 1.5 m)
  const near = game.lanterns.filter(l => (!l.lit || l.fuelUnits < 6000) && Math.hypot(p.pos[0] - l.pos[0], p.pos[2] - l.pos[2]) <= 2 && Math.abs(p.pos[1] - l.pos[1]) <= 1.5).sort((a,b) => Math.hypot(p.pos[0]-a.pos[0],p.pos[2]-a.pos[2])-Math.hypot(p.pos[0]-b.pos[0],p.pos[2]-b.pos[2]) || a.id.localeCompare(b.id))[0];
  if (ui.hint) {
    ui.hint.classList.toggle("hidden", !near);
    if (near) {
      const hintText = ui.hint.querySelector(".hint-text");
      if (hintText) hintText.textContent = near.lit ? `CHÂM DẦU · ${Math.round(near.fuelUnits / 60)}%` : `${near.everLit ? "THẮP LẠI" : "THẮP ĐÈN"} · ${near.deposited}/${near.everLit ? 5 : 10}`;
    }
  }

  // Compass indicator
  const target = game.lanterns.filter(l => !l.lit || l.fuelUnits < 1800).sort((a,b) => Math.hypot(p.pos[0]-a.pos[0],p.pos[2]-a.pos[2])-Math.hypot(p.pos[0]-b.pos[0],p.pos[2]-b.pos[2]))[0];
  const targetDistance = target ? Math.hypot(p.pos[0]-target.pos[0], p.pos[2]-target.pos[2]) : 0;
  if (ui.arrow) {
    ui.arrow.classList.toggle("hidden", !target || targetDistance < 26);
    if (target && targetDistance >= 26) {
      const bearing = Math.atan2(target.pos[0]-p.pos[0], target.pos[2]-p.pos[2]) - cameraYaw * Math.PI / 180;
      ui.arrow.style.left = `${50 + Math.sin(bearing) * 38}%`;
      ui.arrow.style.top = `${48 - Math.cos(bearing) * 29}%`;
      ui.arrow.style.right = "auto";
      ui.arrow.style.transform = "translate(-50%,-50%)";
    }
  }
  if (ui.lantern_fuels) ui.lantern_fuels.innerHTML = game.lanterns.map(l => {
    const fuel = l.lit ? Math.max(0, Math.min(100, l.fuelUnits / 60)) : 0;
    const low = l.lit && fuel < 30;
    return `<div class="fuel-chip ${l.lit ? "lit" : "out"} ${low ? "low" : ""}" title="${l.id}: ${Math.floor(fuel)}% nhiên liệu"><span class="lantern-glyph">${l.id.slice(1)}</span><div><i style="width:${fuel}%"></i></div><b>${l.lit ? `${Math.floor(fuel)}%` : "TẮT"}</b></div>`;
  }).join("");

  if (ui.wind_warning) {
    ui.wind_warning.classList.toggle("hidden", !game.wind.warning);
  }
}

function drawWorld(now) {
  if (!gl) return;
  _currentTime = now * 0.001;
  const dpr = Math.min(2, devicePixelRatio || 1);
  const w = Math.floor(innerWidth * dpr), h = Math.floor(innerHeight * dpr);
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w; canvas.height = h;
    gl.viewport(0, 0, w, h);
  }
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  const p = game.player, yaw = cameraYaw * Math.PI / 180;
  const forward = [Math.sin(yaw), 0, Math.cos(yaw)];
  const focus = [p.pos[0], p.pos[1] + 1.1, p.pos[2]];
  const eye = [p.pos[0] - forward[0] * 8, p.pos[1] + 4.5, p.pos[2] - forward[2] * 8];

  gl.uniformMatrix4fv(loc.projection, false, mat4.perspective(Math.PI / 3.2, w / Math.max(1, h), .1, 200));
  gl.uniformMatrix4fv(loc.view, false, mat4.lookAt(eye, focus, [0, 1, 0]));

  const litCount = game.lanterns.filter(l => l.lit).length;
  const envLight = 0.15 + 0.55 * (litCount / game.lanterns.length);
  gl.uniform1f(loc.environment, envLight);

  // 1. SKY & CELESTIAL ELEMENTS
  // Deep twilight gradient dome
  draw("sphere", [eye[0], eye[1] - 12, eye[2]], [170, 85, 170], colors.sky);
  draw("sphere", [eye[0], eye[1] + 25, eye[2]], [130, 45, 130], colors.sky2, 0.04);

  // Twinkling Celestial Starfield
  for (let i = 0; i < 60; i++) {
    const sx = Math.sin(i * 61.3 + 1.1) * 110, sz = Math.cos(i * 23.7 + 0.7) * 110;
    const sy = 25 + (i % 9) * 2.5;
    const twinkle = 0.4 + 0.35 * Math.sin(_currentTime * (0.8 + (i % 5) * 0.4) + i);
    const starColor = i % 4 === 0 ? colors.gold : i % 7 === 0 ? colors.amber : colors.core;
    const starSize = 0.07 + (i % 3) * 0.04;
    draw("sphere", [sx, sy, sz], [starSize, starSize, starSize], starColor, twinkle);
  }

  // Full Moon with Soft Glowing Ring
  draw("sphere", [65, 55, -85], [5.2, 5.2, 5.2], colors.core, 1.0);
  draw("sphere", [65, 55, -85], [8.0, 8.0, 8.0], colors.gold, 0.15);
  draw("torus", [65, 55, -85], [7.5, 0.3, 7.5], colors.amber, 0.25);

  // Distant Floating Sky Lanterns (Thả Hoa Đăng lên Trời)
  for (let i = 0; i < 14; i++) {
    const lx = Math.sin(i * 2.8) * 80 + Math.cos(_currentTime * 0.05 + i) * 5;
    const lz = Math.cos(i * 2.8) * 80;
    const ly = 12 + ((_currentTime * 1.5 + i * 8) % 45);
    draw("cylinder", [lx, ly, lz], [0.35, 0.6, 0.35], colors.amber, 0.9);
    draw("sphere", [lx, ly + 0.3, lz], [0.2, 0.2, 0.2], colors.core, 1.2);
  }

  // 2. OCEAN (BIỂN MÂY NƯỚC)
  draw("box", [0, -10, 0], [600, .2, 600], colors.sea);
  const t = _currentTime;
  for (let i = 0; i < 10; i++) {
    const wx = Math.sin(i * 1.7 + t * 0.15) * 65, wz = Math.cos(i * 2.1 + t * 0.12) * 65;
    const ws = 14 + Math.sin(i * 0.7 + t * 0.08) * 5;
    draw("box", [wx, -9.88, wz], [ws, .02, ws * 0.35], colors.seaFoam, 0.05 + 0.03 * Math.sin(t + i));
  }

  // Moonlit water reflection path
  for (let r = 1; r <= 6; r++) {
    const rx = 65 * (r / 7), rz = -85 * (r / 7);
    draw("sphere", [rx, -9.9, rz], [3.5 * r * 0.4, 0.02, 1.2], colors.core, 0.08);
  }

  // 3. ISLANDS (CÁC HÒN ĐẢO THẦN TIÊN)
  for (const island of game.map.islands) {
    // Stepped layered island terrain
    draw("sphere", [island.x, -.45, island.z], [island.r, .65, island.r], colors.grass);
    draw("sphere", [island.x, -.42, island.z], [island.r * 0.88, .62, island.r * 0.88], colors.grassLight);
    draw("cylinder", [island.x, -.85, island.z], [island.r * .97, .75, island.r * .97], colors.woodDark);
    drawRing([island.x, .025, island.z], island.r - .65, island.r, colors.sand);
    drawRing([island.x, -.01, island.z], island.r - .15, island.r + .25, colors.rockDark);

    // Mossy Shoreline Boulders
    for (let b = 0; b < 10; b++) {
      const ba = (b / 10) * Math.PI * 2 + island.x;
      const br = island.r - 0.4 + Math.sin(b * 3.7) * 0.3;
      const bx = island.x + Math.cos(ba) * br;
      const bz = island.z + Math.sin(ba) * br;
      const bs = 0.5 + (b % 3) * 0.3;
      draw("sphere", [bx, 0.1, bz], [bs, bs * 0.6, bs], b % 2 === 0 ? colors.rock : colors.rockDark);
    }
  }

  // Bridges (Cầu Tre Không Lan Can Vượt Biển)
  for (const bridge of game.map.bridges) {
    draw("box", [(bridge.x1 + bridge.x2) / 2, -.02, 0], [bridge.x2 - bridge.x1, .25, bridge.z2 - bridge.z1], colors.wood);
    // Transverse wooden planks (unrailed per Night 2 specification)
    for (let bx = bridge.x1 + 1.2; bx < bridge.x2; bx += 2.0) {
      draw("box", [bx, .02, 0], [0.35, .08, (bridge.z2 - bridge.z1) + 0.12], colors.woodDark);
    }
  }

  // Launch Pads (Bục Nhảy Khí Công)
  for (const pad of game.map.pads) {
    draw("cylinder", pad.pos, [1.2, .2, 1.2], colors.woodDark);
    draw("cylinder", [pad.pos[0], pad.pos[1] + 0.1, pad.pos[2]], [1.0, .14, 1.0], colors.gold, .4);
    draw("torus", [pad.pos[0], pad.pos[1] + 0.22, pad.pos[2]], [0.8, 0.08, 0.8], colors.core, .7);
    drawRing([pad.pos[0], pad.pos[1] + .02, pad.pos[2]], .9, 1.4, colors.amber);
  }

  // Night 3 Multi-Tier Elevated Sanctuary
  if (currentNight === 3) {
    draw("cylinder", [0, 2.8, 0], [24, .32, 24], colors.grass);
    drawRing([0, 3.02, 0], 12, 24, colors.grassLight, 0, 180);
    draw("cylinder", [0, 5.8, 0], [8.5, .38, 8.5], colors.sand);
    draw("cylinder", [0, 6.0, 0], [2.2, 8.2, 2.2], colors.woodDark);
    draw("torus", [0, 6.1, 0], [8.2, 0.2, 8.2], colors.gold, 0.3);
    for (const deg of [30, 150]) drawRamp(deg);
  }

  // 4. THE SACRED TEMPLE LANTERNS (BẢO ĐĂNG TRÊN ĐẢO)
  for (const l of game.lanterns) {
    const lx = l.pos[0], ly = l.pos[1], lz = l.pos[2];
    const fuel = l.lit ? Math.max(0, Math.min(100, l.fuelUnits / 60)) : 0;
    const lowFuel = l.lit && fuel < 30;
    const blink = !lowFuel || Math.floor(now / 500) % 2 === 0;
    const lanternScale = l.lit ? 1 : .8;
    // Octagonal tiered stone base
    draw("cylinder", [lx, ly, lz], [0.8, 0.25, 0.8], colors.rockDark);
    draw("cylinder", [lx, ly + 0.25, lz], [0.6, 0.2, 0.6], colors.rock);
    // Main teak pillar
    draw("cylinder", [lx, ly + 0.45, lz], [0.22, 1.8, 0.22], colors.wood);
    draw("torus", [lx, ly + 1.2, lz], [0.28, 0.06, 0.28], colors.woodRed);
    // Lantern pavilion base
    draw("cylinder", [lx, ly + 2.25, lz], [0.75, 0.15, 0.75], colors.woodDark);
    // 4 Corner pillars of lantern pavilion
    for (let c = 0; c < 4; c++) {
      const ca = c * Math.PI / 2 + Math.PI / 4;
      const cpx = lx + Math.cos(ca) * 0.45, cpz = lz + Math.sin(ca) * 0.45;
      draw("cylinder", [cpx, ly + 2.35, cpz], [0.06, 0.9, 0.06], colors.woodRed);
    }
    // Translucent glowing paper chamber
    draw("cylinder", [lx, ly + 2.38, lz], [0.42 * lanternScale, 0.82 * lanternScale, 0.42 * lanternScale], l.lit && blink ? colors.amber : colors.unlit, l.lit && blink ? 0.9 : 0);
    // Sacred Flame Core inside
    draw("sphere", [lx, ly + 2.78, lz], [0.22 * lanternScale, 0.34 * lanternScale, 0.22 * lanternScale], l.lit && blink ? colors.core : colors.sky2, l.lit && blink ? 1.4 : 0);
    if (!l.lit) {
      draw("box", [lx - .27, ly + 2.45, lz + .34], [.18, .04, .04], colors.sky, 0);
      draw("box", [lx + .22, ly + 2.25, lz + .34], [.22, .04, .04], colors.sky, 0);
    } else {
      draw("box", [lx, ly + 3.02, lz], [1.15, .10, .10], colors.woodDark);
      draw("box", [lx - .575 + .575 * fuel / 100, ly + 3.03, lz + .02], [1.15 * fuel / 100, .07, .12], lowFuel ? (colorblind ? colors.core : colors.red) : colors.gold, lowFuel && blink ? .9 : .35);
    }

    // Pagoda Roof Eaves (Mái Chùa Cong 2 Tầng)
    draw("pyramid", [lx, ly + 3.2, lz], [1.1, 0.35, 1.1], colors.woodDark);
    draw("pyramid", [lx, ly + 3.48, lz], [0.75, 0.3, 0.75], colors.woodRed);
    // Golden Spire Finial (Đỉnh Chóp Hoa Sen)
    draw("cone", [lx, ly + 3.75, lz], [0.2, 0.45, 0.2], colors.gold, l.lit ? 0.6 : 0.2);
    draw("sphere", [lx, ly + 4.15, lz], [0.1, 0.1, 0.1], colors.core, l.lit ? 1.0 : 0.3);

    // Red Silk Tassels (Tua Rua Buộc 4 Góc Mái)
    for (let c = 0; c < 4; c++) {
      const ca = c * Math.PI / 2 + Math.PI / 4;
      const tx = lx + Math.cos(ca) * 0.75, tz = lz + Math.sin(ca) * 0.75;
      const sway = Math.sin(_currentTime * 2.5 + c) * 0.05;
      draw("cylinder", [tx + sway, ly + 3.0, tz], [0.03, 0.3, 0.03], colors.red, 0.3);
      draw("sphere", [tx + sway, ly + 2.9, tz], [0.06, 0.06, 0.06], colors.gold, 0.4);
    }

    // Safe-zone ring is active only while lit and fuel >= 30 (Contract v1.2).
    if (l.lit && !lowFuel) {
      drawRing([lx, ly + .03, lz], 5.72, 5.92, colors.gold);
    }
    if (l.lit && blink) {
      draw("sphere", [lx, ly + 2.72, lz], [.36, .5, .36], colors.core, 1.65);
      // Rising light embers
      for (let e = 0; e < 3; e++) {
        const ex = lx + Math.sin(_currentTime * 3 + e * 2) * 0.6;
        const ez = lz + Math.cos(_currentTime * 3 + e * 2) * 0.6;
        const ey = ly + 3.2 + ((_currentTime * 1.2 + e * 0.8) % 1.8);
        draw("sphere", [ex, ey, ez], [0.08, 0.08, 0.08], colors.core, 1.2);
      }
    }
  }

  // 5. MOTES (ĐOM ĐÓM THẦN BÍ)
  for (const m of game.motes) {
    if (!m.active) continue;
    const idx = Number(m.id.slice(1)) || 1;
    const floatY = .45 + Math.sin(now * .0025 + idx * 1.3) * .15;
    const pulse = .22 + .05 * Math.sin(now * .004 + idx * 0.8);
    const mx = m.pos[0], my = m.pos[1] + floatY, mz = m.pos[2];

    // Firefly Glowing Core & Outer Aura
    draw("sphere", [mx, my, mz], [pulse, pulse, pulse], colors.mote, 1.3);
    draw("sphere", [mx, my, mz], [pulse + 0.12, pulse + 0.12, pulse + 0.12], colors.moteGlow, 0.25);

    // Rapid Fluttering Fairy Wings
    const wingFlap = Math.sin(now * 0.035 + idx);
    draw("box", [mx + 0.12, my + 0.08 + wingFlap * 0.04, mz], [0.16, 0.02, 0.1], colors.core, 0.8);
    draw("box", [mx - 0.12, my + 0.08 - wingFlap * 0.04, mz], [0.16, 0.02, 0.1], colors.core, 0.8);

    // Trailing tiny ember spark
    const tx = mx + Math.sin(now * 0.005 + idx) * 0.22;
    const tz = mz + Math.cos(now * 0.005 + idx) * 0.22;
    draw("sphere", [tx, my - 0.1, tz], [0.06, 0.06, 0.06], colors.gold, 1.0);
  }

  // 6. CHARMS (BÙA GIÓ THẦN ĐẠO)
  for (const c of game.charms) {
    if (!c.available) continue;
    const spin = now * .0016;
    const cx = c.pos[0], cy = c.pos[1] + .55 + Math.sin(now * .0025) * .1, cz = c.pos[2];
    // Fluttering ancient paper talisman
    draw("box", [cx + Math.cos(spin) * 0.2, cy, cz + Math.sin(spin) * 0.2], [.48, .55, .08], colors.red, .55);
    draw("box", [cx + Math.cos(spin) * 0.2, cy, cz + Math.sin(spin) * 0.2], [.36, .45, .1], colors.gold, .4);
    // Floating mystical seal orbs
    draw("sphere", [cx, cy + .45, cz], [.14, .14, .14], colors.goldSeal, .9);
    draw("torus", [cx, cy, cz], [.65, .04, .65], colors.goldSeal, .5);
  }

  // 7. SHADES (BÓNG MỰC ĐẦY ÁM KHÍ)
  for (const s of game.shades) {
    const isStunned = s.state === "stunned";
    const bobY = isStunned ? 0 : Math.sin(now * .0035 + s.pos[0]) * .1;
    const sx = s.pos[0], sy = s.pos[1] + .85 + bobY, sz = s.pos[2];
    const shadeAccent = colorblind ? "#00B3FF" : colors.violetBright;

    // A single floating ink-spirit silhouette instead of stacked primitive blocks.
    draw("cone", [sx, sy - .78, sz], [.78, 1.35, .78], isStunned ? colors.stunned : colors.shadeBody, isStunned ? .24 : .05);
    draw("sphere", [sx, sy + .26, sz], [.52, .56, .52], isStunned ? colors.stunned : colors.shade, isStunned ? .2 : .08);
    draw("torus", [sx, sy - .18, sz], [.72, .045, .72], shadeAccent, isStunned ? .2 : .38);

    // Glowing Eerie Phantom Eyes
    const eyeGlow = isStunned ? .15 : .9 + .25 * Math.sin(now * .006);
    draw("sphere", [sx - .17, sy + .31, sz + .47], [.075, .055, .06], isStunned ? colors.stunned : shadeAccent, eyeGlow);
    draw("sphere", [sx + .17, sy + .31, sz + .47], [.075, .055, .06], isStunned ? colors.stunned : shadeAccent, eyeGlow);
    if (colorblind && !isStunned) draw("torus", [sx, sy, sz], [1.0, .035, 1.0], "#00B3FF", .55);

    // Orbiting Wisps of Black Smoke Tendrils
    for (let w = 0; w < 5; w++) {
      const wa = (w / 5) * Math.PI * 2 + now * 0.0022;
      const wx = sx + Math.cos(wa) * (0.48 + w * .045);
      const wz = sz + Math.sin(wa) * (0.48 + w * .045);
      const wy = sy - 0.72 + Math.sin(wa * 2) * 0.13;
      draw("sphere", [wx, wy, wz], [0.12, 0.18, 0.12], colors.shade, 0.08);
    }

    // Stunned: Runic Golden Rings Binding the Shade
    if (isStunned) {
      draw("torus", [sx, sy, sz], [1.1, 0.06, 1.1], colors.goldSeal, 0.9);
      draw("torus", [sx, sy + 0.3, sz], [0.9, 0.05, 0.9], colors.goldSeal, 0.7);
    }
  }

  // 8. DRIFTERS (GIÓ LẠC LINH HỒN)
  for (const d of game.drifters) {
    if (d.state === "removed") continue;
    const dy = Math.sin(now * .0045 + d.pos[0]) * .18;
    const dx = d.pos[0], dposy = d.pos[1] + .85 + dy, dz = d.pos[2];
    draw("sphere", [dx, dposy, dz], [.5, 1.05, .5], colors.drifter, .42);
    draw("cone", [dx, dposy + .88, dz], [.7, .8, .7], colors.drifterDark, .15);
    // Trailing wind ribbon tails
    for (let r = 0; r < 3; r++) {
      const ra = (r - 1) * 0.25;
      const wave = Math.sin(now * 0.008 + r) * 0.15;
      draw("cylinder", [dx + ra + wave, dposy - 0.4, dz], [0.06, 0.6, 0.06], colors.drifter, 0.3);
    }
  }

  // 9. HEROINE MÂY (ÁO DÀI, NÓN LÁ & ĐÈN LỒNG CẦM TAY)
  const px = p.pos[0], py = p.pos[1], pz = p.pos[2];
  const isMoving = Math.hypot(p.vel[0], p.vel[2]) > 0.2;
  const runStride = isMoving ? Math.sin(now * 0.012) * 0.18 : 0;
  const moveLean = isMoving ? 0.08 : 0;

  // Stride Shoes (Guốc Mộc)
  draw("box", [px - 0.16, py + 0.05 + runStride, pz], [0.16, 0.08, 0.3], colors.woodDark);
  draw("box", [px + 0.16, py + 0.05 - runStride, pz], [0.16, 0.08, 0.3], colors.woodDark);

  // Inner Robe Gown (Bạch Sa Thắt Dưới)
  draw("cylinder", [px, py + 0.1, pz], [.46, 0.7, .46], colors.robe);

  // Outer Robe / Áo Tứ Thân (Midnight Indigo Robe)
  draw("cylinder", [px, py + 0.35 + moveLean, pz], [.52, 0.85, .52], colors.robeOuter);
  // Embroidered Hem Trim
  draw("torus", [px, py + 0.36 + moveLean, pz], [.54, 0.04, .54], colors.gold, 0.35);

  // Red Silk Sash (Khăn Lưng Đỏ Buộc Vạt)
  draw("cylinder", [px, py + 0.72 + moveLean, pz], [.55, 0.14, .55], colors.red);
  draw("sphere", [px, py + 0.72 + moveLean, pz + 0.38], [.1, .1, .1], colors.gold, 0.5);

  // Left & Right Arms / Graceful Flowing Sleeves
  const armSway = isMoving ? Math.sin(now * 0.012) * 0.12 : 0;
  draw("cylinder", [px - 0.42, py + 0.8 + armSway, pz], [0.14, 0.55, 0.14], colors.robeOuter);
  draw("cylinder", [px + 0.42, py + 0.8 - armSway, pz], [0.14, 0.55, 0.14], colors.robeOuter);

  // Neck & Face (Làn Da Trắng Ngà)
  draw("cylinder", [px, py + 1.15, pz], [0.16, 0.2, 0.16], colors.skin);
  draw("sphere", [px, py + 1.28, pz], [0.28, 0.32, 0.28], colors.skin);

  // Black Hair Bun (Búi Tóc Cài Trâm Vàng)
  draw("sphere", [px, py + 1.34, pz - 0.22], [0.18, 0.18, 0.18], colors.hair);
  draw("cylinder", [px, py + 1.34, pz - 0.22], [0.03, 0.45, 0.03], colors.gold, 0.6);

  // Traditional Conical Hat (Nón Lá Duyên Dáng)
  draw("cone", [px, py + 1.48, pz], [.64, .58, .64], colors.sand);
  draw("torus", [px, py + 1.49, pz], [.65, .03, .65], colors.wood, 0.2);
  // Red Chin-Ribbon (Quai Nón Lụa Đỏ)
  draw("torus", [px, py + 1.28, pz], [.3, .02, .3], colors.red);

  // Handheld Miniature Lantern (Đèn Lồng Tre Cầm Tay)
  const lStickX = px + 0.48, lStickY = py + 0.95, lStickZ = pz + 0.45;
  draw("cylinder", [lStickX, lStickY, lStickZ], [0.03, 0.5, 0.03], colors.wood);
  // Lantern cord & glowing cage
  const lanX = lStickX + 0.05, lanY = lStickY - 0.3, lanZ = lStickZ + 0.1;
  draw("cylinder", [lanX, lanY, lanZ], [0.15, 0.3, 0.15], colors.amber, 1.1);
  draw("sphere", [lanX, lanY + 0.15, lanZ], [0.1, 0.1, 0.1], colors.core, 1.5);
  // Miniature Red Tassel
  draw("cylinder", [lanX, lanY - 0.18, lanZ], [0.03, 0.18, 0.03], colors.red, 0.4);

  // Charm Wind Aura Banner
  if (game.wind.active || p.charmTicks > 0) {
    const wave = Math.sin(now * .01) * .08;
    draw("box", [px - .85 + wave, py + 1.55, pz], [1.6, .08, .08], colors.teal, .5);
    draw("box", [px - 1.0 + wave, py + 1.42, pz], [.7, .06, .06], colors.core, .35);
  }
}

function animate(now) {
  const dt = Math.min(.1, (now - (lastTime || now)) / 1000);
  lastTime = now;
  if (isRunning) accumulator += dt;

  while (accumulator >= 1 / 60) {
    const settingsOpen = ui.settings && !ui.settings.classList.contains("hidden");
    const input = {
      move: [(keys.has("KeyD") ? 1 : 0) - (keys.has("KeyA") ? 1 : 0), (keys.has("KeyW") ? 1 : 0) - (keys.has("KeyS") ? 1 : 0)],
      cam_yaw_deg: cameraYaw,
      jump: keys.has("Space"),
      interact: keys.has("KeyE"),
      pulse: keys.has("KeyQ"),
      dash: keys.has("ShiftLeft") || keys.has("ShiftRight"),
      pause: !settingsOpen && (keys.has("Escape") || keys.has("KeyP"))
    };

    const before = game.state;
    stepGame(game, input, { snapshotEvery: 999999 });

    if (before === "playing" && game.state === "paused") {
      if (ui.pause_night) ui.pause_night.textContent = `ĐÊM ${currentNight}`;
      show("pause");
    }
    if (before === "paused" && game.state === "playing") show(null);

    for (; lastEventIndex < game.events.length; lastEventIndex++) {
      const e = game.events[lastEventIndex];
      if (e.name === "mote_picked") sfx(660, .08);
      else if (e.name === "deposit") sfx(520, .1, "triangle");
      else if (e.name === "refuel") sfx(610, .12, "triangle");
      else if (e.name === "lantern_lit") sfx(880, .28, "triangle");
      else if (e.name === "lantern_out") sfx(105, .32, "sawtooth");
      else if (e.name === "fuel_drain") sfx(145, .06, "sawtooth");
      else if (e.name === "pulse") sfx(260, .22, "sawtooth");
      else if (e.name === "player_hit") sfx(130, .2, "sawtooth");
      else if (e.name === "dash") sfx(430, .09, "triangle");
      else if (e.name === "jump") sfx(380, .08);
      else if (e.name === "shade_spawned") sfx(112, .2, "sawtooth");
      else if (e.name === "game_over") sfx(e.data.result === "won" ? 740 : 165, .4, "triangle");
    }
    accumulator -= 1 / 60;
  }

  drawWorld(now);
  updateHud(now);

  if ((game.state === "won" || game.state === "lost") && !ui.result.dataset.shown) {
    ui.result.dataset.shown = "1";
    showResult();
  }
  if (isRunning && game.state === "playing" && ui.result) {
    ui.result.dataset.shown = "";
  }

  fpsFrames++;
  if (!fpsTime) fpsTime = now;
  if (now - fpsTime >= 1000) {
    if (ui.fps) ui.fps.textContent = `FPS ${Math.round(fpsFrames * 1000 / (now - fpsTime))}`;
    fpsFrames = 0;
    fpsTime = now;
  }

  if (isRunning && game.state === "playing") {
    const secs = Math.ceil(game.timeLeftTicks / 60);
    if (secs <= 10 && secs !== lastSeconds && secs > 0) sfx(620 - (10 - secs) * 26, .12);
    lastSeconds = secs;
  }

  requestAnimationFrame(animate);
}

function onKeyDown(e) {
  if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) e.preventDefault();
  if (["Escape", "KeyP"].includes(e.code) && game.state === "paused") {
    // Handled in stepGame
  }
  keys.add(e.code);
}

function onKeyUp(e) {
  keys.delete(e.code);
}

window.addEventListener("keydown", onKeyDown);
window.addEventListener("keyup", onKeyUp);
window.addEventListener("blur", () => keys.clear());

let drag = false, lastX = 0;
canvas.addEventListener("pointerdown", e => {
  drag = true;
  lastX = e.clientX;
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener("pointerup", () => { drag = false; });
canvas.addEventListener("pointermove", e => {
  if (drag && game.state === "playing") {
    cameraYaw -= (e.clientX - lastX) * .25 * sensitivity;
    lastX = e.clientX;
  }
});

$("#begin").addEventListener("click", () => { campaignScore = 0; showIntro(1); });
$("#start-night").addEventListener("click", startNight);
$("#resume").addEventListener("click", () => {
  if (game.state === "paused") {
    game.previous.pause = false;
    stepGame(game, { pause: true }, { snapshotEvery: 999999 });
    game.previous.pause = false;
  }
  isRunning = true;
  show(null);
});
$("#replay").addEventListener("click", () => {
  game = createGame({ seed: 2026 + currentNight, night: currentNight });
  lastEventIndex = 0;
  if (ui.result) ui.result.dataset.shown = "";
  startNight();
});
$("#result-replay").addEventListener("click", () => {
  game = createGame({ seed: 2026 + currentNight, night: currentNight });
  lastEventIndex = 0;
  if (ui.result) ui.result.dataset.shown = "";
  showIntro(currentNight);
});
$("#open-settings").addEventListener("click", () => openSettings("home"));
$("#pause-settings").addEventListener("click", () => openSettings("pause"));
$("#settings-back").addEventListener("click", () => show(settingsOrigin));
$("#to-menu").addEventListener("click", () => {
  isRunning = false;
  game = createGame();
  show("home");
  if (ui.hud) ui.hud.classList.add("hidden");
  if (ui.controls_hint) ui.controls_hint.classList.add("hidden");
});

if (ui.volume) {
  ui.volume.addEventListener("input", () => {
    audioVolume = Number(ui.volume.value) / 100;
    localStorage.setItem("ddl.volume", ui.volume.value);
    if (musicGain) musicGain.gain.value = audioVolume * .035;
    updateSettingLabels();
  });
}

if (ui.sensitivity) {
  ui.sensitivity.addEventListener("input", () => {
    sensitivity = Number(ui.sensitivity.value) / 100;
    localStorage.setItem("ddl.sensitivity", ui.sensitivity.value);
    updateSettingLabels();
  });
}

if (ui.colorblind) {
  ui.colorblind.checked = colorblind;
  ui.colorblind.addEventListener("change", () => {
    colorblind = ui.colorblind.checked;
    localStorage.setItem("ddl.colorblind", String(colorblind));
    document.body.classList.toggle("colorblind", colorblind);
  });
}

$("#result-action").addEventListener("click", () => {
  if (game.state === "won" && currentNight < 3) showIntro(currentNight + 1);
  else {
    isRunning = false;
    campaignScore = 0;
    game = createGame();
    show("home");
  }
});

updateSettingLabels();
requestAnimationFrame(animate);
