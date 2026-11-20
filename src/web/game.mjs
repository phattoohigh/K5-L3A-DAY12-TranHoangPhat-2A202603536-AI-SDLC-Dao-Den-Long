import { createGame, stepGame } from "../sim.mjs";

const canvas = document.querySelector("#world");
const gl = canvas.getContext("webgl", { antialias: true, alpha: false });
if (!gl) document.body.insertAdjacentHTML("beforeend", "<p class='webgl-error'>WebGL is required to play this 3D game.</p>");

const $ = selector => document.querySelector(selector);
const ui = Object.fromEntries(["home", "intro", "pause", "settings", "result", "hud", "controls-hint", "flames", "clock", "lantern-count", "score", "motes", "dash-cd", "pulse-cd", "hint", "arrow", "wind-warning", "night-label", "intro-title", "intro-copy", "pause-night", "result-label", "result-title", "result-copy", "result-action", "result-replay", "volume", "sensitivity", "volume-value", "sensitivity-value", "fps"].map(id => [id.replaceAll("-", "_"), document.getElementById(id)]));
const colors = { sky: "#0E1430", sky2: "#1B2350", grass: "#2F5D50", sand: "#C9B48A", wood: "#6B4A2F", sea: "#12384A", amber: "#FFB347", core: "#FFE9B0", unlit: "#5B5F6E", mote: "#FFF6C2", moteGlow: "#FFE58A", shade: "#120A1A", violet: "#7A3CFF", stunned: "#3A3450", robe: "#E8E2D0", red: "#C8102E", gold: "#F2C14E", drifter: "#8FA3B8" };
const rgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255);
const mat4 = {
  identity: () => new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]),
  multiply: (a, b) => { const o = new Float32Array(16); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3]; return o; },
  perspective: (fovy, aspect, near, far) => { const f = 1 / Math.tan(fovy / 2), nf = 1 / (near - far); return new Float32Array([f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) * nf, -1, 0, 0, 2 * far * near * nf, 0]); },
  lookAt: (eye, center, up) => {
    let zx = eye[0] - center[0], zy = eye[1] - center[1], zz = eye[2] - center[2], zl = Math.hypot(zx, zy, zz) || 1; zx /= zl; zy /= zl; zz /= zl;
    let xx = up[1] * zz - up[2] * zy, xy = up[2] * zx - up[0] * zz, xz = up[0] * zy - up[1] * zx, xl = Math.hypot(xx, xy, xz) || 1; xx /= xl; xy /= xl; xz /= xl;
    const yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx;
    return new Float32Array([xx, yx, zx, 0, xy, yy, zy, 0, xz, yz, zz, 0, -(xx * eye[0] + xy * eye[1] + xz * eye[2]), -(yx * eye[0] + yy * eye[1] + yz * eye[2]), -(zx * eye[0] + zy * eye[1] + zz * eye[2]), 1]);
  },
  model: (pos, scale) => new Float32Array([scale[0], 0, 0, 0, 0, scale[1], 0, 0, 0, 0, scale[2], 0, pos[0], pos[1], pos[2], 1]),
};

function compile(type, source) { const sh = gl.createShader(type); gl.shaderSource(sh, source); gl.compileShader(sh); if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw Error(gl.getShaderInfoLog(sh)); return sh; }
const program = gl.createProgram();
gl.attachShader(program, compile(gl.VERTEX_SHADER, `attribute vec3 position; uniform mat4 projection; uniform mat4 view; uniform mat4 model; varying float light; varying float depth; void main(){vec4 p=view*model*vec4(position,1.0); gl_Position=projection*p; depth=length(p.xyz); vec3 n=normalize(mat3(model)*position); light=0.52+0.48*max(dot(n,normalize(vec3(-0.35,0.9,0.28))),0.0);}`));
gl.attachShader(program, compile(gl.FRAGMENT_SHADER, `precision mediump float; uniform vec3 color; uniform float glow; uniform float environment; varying float light; varying float depth; void main(){float fog=smoothstep(65.0,125.0,depth)*0.48; vec3 lit=mix(color*(environment+0.42*light+glow),vec3(0.055,0.08,0.17),fog); gl_FragColor=vec4(lit,1.0);}`));
gl.linkProgram(program); if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw Error(gl.getProgramInfoLog(program));
gl.useProgram(program);
const loc = { position: gl.getAttribLocation(program, "position"), projection: gl.getUniformLocation(program, "projection"), view: gl.getUniformLocation(program, "view"), model: gl.getUniformLocation(program, "model"), color: gl.getUniformLocation(program, "color"), glow: gl.getUniformLocation(program, "glow"), environment: gl.getUniformLocation(program, "environment") };

function mesh(vertices) { const buffer = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buffer); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW); return { buffer, count: vertices.length / 3 }; }
function sphereMesh() { const v = []; const rows = 12, cols = 18; for (let y = 0; y < rows; y++) { const a0 = -Math.PI / 2 + y / rows * Math.PI, a1 = -Math.PI / 2 + (y + 1) / rows * Math.PI; for (let x = 0; x < cols; x++) { const b0 = x / cols * Math.PI * 2, b1 = (x + 1) / cols * Math.PI * 2; const p = (a, b) => [Math.cos(a) * Math.cos(b), Math.sin(a), Math.cos(a) * Math.sin(b)]; const a = p(a0, b0), b = p(a1, b0), c = p(a1, b1), d = p(a0, b1); v.push(...a, ...b, ...c, ...a, ...c, ...d); } } return mesh(v); }
function cylinderMesh(sides = 16) { const v = []; for (let i = 0; i < sides; i++) { const a = i / sides * Math.PI * 2, b = (i + 1) / sides * Math.PI * 2, x = Math.cos(a), z = Math.sin(a), X = Math.cos(b), Z = Math.sin(b); v.push(0, 0, 0, X, 0, Z, x, 0, z, x, 1, z, X, 1, Z, 0, 1, 0, x, 0, z, X, 0, Z, X, 1, Z, x, 0, z, X, 1, Z, x, 1, z); } return mesh(v); }
function coneMesh(sides = 16) { const v = []; for (let i = 0; i < sides; i++) { const a = i / sides * Math.PI * 2, b = (i + 1) / sides * Math.PI * 2; v.push(0, 0, 0, Math.cos(b), 0, Math.sin(b), Math.cos(a), 0, Math.sin(a), Math.cos(a), 0, Math.sin(a), 0, 1, 0, Math.cos(b), 0, Math.sin(b)); } return mesh(v); }
function boxMesh() { const v = []; const faces = [[[-.5,-.5,.5],[.5,-.5,.5],[.5,.5,.5],[-.5,.5,.5]],[[.5,-.5,-.5],[-.5,-.5,-.5],[-.5,.5,-.5],[.5,.5,-.5]],[[-.5,-.5,-.5],[-.5,-.5,.5],[-.5,.5,.5],[-.5,.5,-.5]],[[.5,-.5,.5],[.5,-.5,-.5],[.5,.5,-.5],[.5,.5,.5]],[[-.5,.5,.5],[.5,.5,.5],[.5,.5,-.5],[-.5,.5,-.5]],[[-.5,-.5,-.5],[.5,-.5,-.5],[.5,-.5,.5],[-.5,-.5,.5]]]; for (const f of faces) v.push(...f[0],...f[1],...f[2],...f[0],...f[2],...f[3]); return mesh(v); }
const meshes = { sphere: sphereMesh(), cylinder: cylinderMesh(), cone: coneMesh(), box: boxMesh() };
gl.enable(gl.DEPTH_TEST); gl.clearColor(...rgb(colors.sky), 1);

function draw(kind, pos, scale, color, glow = 0) { const m = meshes[kind]; gl.bindBuffer(gl.ARRAY_BUFFER, m.buffer); gl.enableVertexAttribArray(loc.position); gl.vertexAttribPointer(loc.position, 3, gl.FLOAT, false, 0, 0); gl.uniformMatrix4fv(loc.model, false, mat4.model(pos, scale)); gl.uniform3fv(loc.color, rgb(color)); gl.uniform1f(loc.glow, glow); gl.drawArrays(gl.TRIANGLES, 0, m.count); }
const ringCache = new Map();
function drawRing(pos, inner, outer, color, start = 0, end = 360) { const steps = Math.ceil((end - start) / 8), ratio = inner / outer, key = `${steps}/${ratio.toFixed(4)}/${start}/${end}`; let ring = ringCache.get(key); if (!ring) { const verts = []; for (let i = 0; i < steps; i++) { const a = (start + (end - start) * i / steps) * Math.PI / 180, b = (start + (end - start) * (i + 1) / steps) * Math.PI / 180; const p = (r, t) => [Math.cos(t) * r, 0, Math.sin(t) * r]; const a0 = p(ratio, a), a1 = p(1, a), b1 = p(1, b), b0 = p(ratio, b); verts.push(...a0,...a1,...b1,...a0,...b1,...b0); } ring = mesh(verts); ringCache.set(key, ring); } gl.bindBuffer(gl.ARRAY_BUFFER, ring.buffer); gl.vertexAttribPointer(loc.position, 3, gl.FLOAT, false, 0, 0); gl.uniformMatrix4fv(loc.model, false, mat4.model(pos, [outer, 1, outer])); gl.uniform3fv(loc.color, rgb(color)); gl.uniform1f(loc.glow, 0); gl.drawArrays(gl.TRIANGLES, 0, ring.count); }
const rampCache = new Map();
function drawRamp(degrees) { let ramp = rampCache.get(degrees); if (!ramp) { const a = degrees * Math.PI / 180, ux = Math.cos(a), uz = Math.sin(a), px = -uz * 1.5, pz = ux * 1.5; const outerL = [ux * 30 + px, 0, uz * 30 + pz], outerR = [ux * 30 - px, 0, uz * 30 - pz], innerL = [ux * 24 + px, 3, uz * 24 + pz], innerR = [ux * 24 - px, 3, uz * 24 - pz]; ramp = mesh([...outerL,...innerL,...innerR,...outerL,...innerR,...outerR]); rampCache.set(degrees, ramp); } gl.bindBuffer(gl.ARRAY_BUFFER, ramp.buffer); gl.vertexAttribPointer(loc.position, 3, gl.FLOAT, false, 0, 0); gl.uniformMatrix4fv(loc.model, false, mat4.identity()); gl.uniform3fv(loc.color, rgb(colors.sand)); gl.uniform1f(loc.glow, 0); gl.drawArrays(gl.TRIANGLES, 0, ramp.count); }

let game = createGame({ seed: 2026, night: 1 });
let currentNight = 1, campaignScore = 0, cameraYaw = 0, lastTime = 0, accumulator = 0, lastHud = 0, lastEventIndex = 0, audioCtx = null, musicGain = null, audioVolume = Number(localStorage.getItem("ddl.volume") ?? 35) / 100, sensitivity = Number(localStorage.getItem("ddl.sensitivity") ?? 100) / 100, settingsOrigin = "home", isRunning = false, fpsFrames = 0, fpsTime = 0, lastSeconds = -1;
const keys = new Set();
const nightNames = ["", "Đảo Bến", "Đảo Cau", "Đảo Chuông"];
const nightDurations = [0, 300, 330, 360];

function show(id) { for (const name of ["home", "intro", "pause", "settings", "result"]) ui[name].classList.add("hidden"); if (id) ui[id].classList.remove("hidden"); }
function startSound() { if (audioCtx) return; audioCtx = new AudioContext(); musicGain = audioCtx.createGain(); musicGain.gain.value = audioVolume * 0.035; musicGain.connect(audioCtx.destination); const osc = audioCtx.createOscillator(); const low = audioCtx.createOscillator(); const lfo = audioCtx.createOscillator(); const trem = audioCtx.createGain(); osc.type = "sine"; low.type = "triangle"; lfo.frequency.value = .12; trem.gain.value = 3; lfo.connect(trem); trem.connect(osc.frequency); osc.frequency.value = 196; low.frequency.value = 98; osc.connect(musicGain); low.connect(musicGain); osc.start(); low.start(); lfo.start(); }
function sfx(freq = 500, duration = .11, type = "sine") { if (!audioCtx) return; const o = audioCtx.createOscillator(), g = audioCtx.createGain(); o.type = type; o.frequency.value = freq; g.gain.setValueAtTime(audioVolume * .16, audioCtx.currentTime); g.gain.exponentialRampToValueAtTime(.001, audioCtx.currentTime + duration); o.connect(g); g.connect(audioCtx.destination); o.start(); o.stop(audioCtx.currentTime + duration); }
function showIntro(night) { isRunning = false; currentNight = night; game = createGame({ seed: 2026 + night, night }); lastEventIndex = 0; ui.night_label.textContent = `ĐÊM ${night} · ${nightNames[night].toUpperCase()}`; ui.intro_title.textContent = ["", "Đèn đã tắt", "Cầu tre trong sương", "Tiếng chuông trên cao"][night]; ui.intro_copy.textContent = ["", "Ông Đăng: “Đom đóm vẫn còn quanh đảo. Hãy mang ánh sáng về những ngọn đèn.”", "Ông Đăng: “Cầu tre nối hai đảo. Đừng quên các bục nhảy.”", "Ông Đăng: “Gió đổi chiều. Lắng nghe trước khi bước lên tầng cao.”"][night]; show("intro"); }
function startNight() { startSound(); if (audioCtx.state === "suspended") audioCtx.resume(); isRunning = true; ui.hud.classList.remove("hidden"); ui.controls_hint.classList.remove("hidden"); show(null); accumulator = 0; lastTime = performance.now(); }
function enterPause() { if (game.state === "paused") { game.state = "playing"; show(null); } else if (game.state === "playing") { game.state = "paused"; ui.pause_night.textContent = `ĐÊM ${currentNight}`; show("pause"); } }
function openSettings(from) { settingsOrigin = from; ui.volume.value = String(Math.round(audioVolume * 100)); ui.sensitivity.value = String(Math.round(sensitivity * 100)); updateSettingLabels(); show("settings"); }
function updateSettingLabels() { ui.volume_value.textContent = `${ui.volume.value}%`; ui.sensitivity_value.textContent = `${(Number(ui.sensitivity.value) / 100).toFixed(1)}×`; }
function showResult() {
  isRunning = false; ui.hud.classList.add("hidden"); ui.controls_hint.classList.add("hidden");
  const won = game.state === "won";
  campaignScore += won ? game.score : 0;
  ui.result_label.textContent = `ĐÊM ${currentNight} · ${won ? "ĐÃ THẮP SÁNG" : "SƯƠNG ĐEN"}`;
  ui.result_title.textContent = won ? (currentNight === 3 ? "Bình minh đã về." : "Một hòn đảo đã thức.") : "Đêm nay chưa kết thúc.";
  ui.result_copy.textContent = won ? `Điểm đêm: ${game.score} · Tổng hành trình: ${campaignScore}` : `Lửa còn lại: ${game.player.flames} · Điểm hành trình: ${campaignScore}`;
  ui.result_action.textContent = won && currentNight < 3 ? `TIẾP TỤC ĐẾN ĐÊM ${currentNight + 1}  →` : "VỀ MENU";
  ui.result_replay.classList.toggle("hidden", won && currentNight === 3);
  show("result"); sfx(won ? 740 : 165, .55, "triangle");
}
function updateHud(now) {
  if (now - lastHud < 100) return; lastHud = now;
  const p = game.player, seconds = Math.ceil(game.timeLeftTicks / 60), mm = String(Math.floor(seconds / 60)).padStart(2, "0"), ss = String(seconds % 60).padStart(2, "0");
  ui.clock.textContent = `${mm}:${ss}`; ui.clock.classList.toggle("danger", seconds <= 30);
  ui.flames.innerHTML = Array.from({ length: 3 }, (_, i) => `<span style="opacity:${i < p.flames ? 1 : .18}">✦</span>`).join("");
  ui.lantern_count.textContent = `ĐÈN ${game.lanterns.filter(l => l.lit).length}/${game.lanterns.length}`; ui.score.textContent = String(campaignScore + game.score);
  ui.motes.innerHTML = Array.from({ length: 10 }, (_, i) => `<i class="${i < p.carried ? "on" : ""}"></i>`).join("");
  ui.dash_cd.textContent = p.charmTicks > 0 ? "LƯỚT · BÙA GIÓ" : p.dashCd > 0 ? `LƯỚT · ${Math.ceil(p.dashCd / 60)}s` : "LƯỚT SẴN SÀNG"; ui.dash_cd.classList.toggle("wait", p.dashCd > 0 && p.charmTicks <= 0);
  ui.pulse_cd.textContent = p.pulseCd > 0 ? `TỎA SÁNG · ${Math.ceil(p.pulseCd / 60)}s` : p.carried < 3 ? "TỎA SÁNG · CẦN 3 ĐOM ĐÓM" : "TỎA SÁNG SẴN SÀNG"; ui.pulse_cd.classList.toggle("wait", p.pulseCd > 0);
  const near = game.lanterns.filter(l => !l.lit && Math.hypot(p.pos[0] - l.pos[0], p.pos[2] - l.pos[2]) <= 2).sort((a,b) => Math.hypot(p.pos[0]-a.pos[0],p.pos[2]-a.pos[2])-Math.hypot(p.pos[0]-b.pos[0],p.pos[2]-b.pos[2]) || a.id.localeCompare(b.id))[0];
  ui.hint.classList.toggle("hidden", !near); if (near) ui.hint.textContent = `E — NẠP ÁNH SÁNG (${p.carried}/${10 - near.deposited})`;
  const target = game.lanterns.filter(l => !l.lit).sort((a,b) => Math.hypot(p.pos[0]-a.pos[0],p.pos[2]-a.pos[2])-Math.hypot(p.pos[0]-b.pos[0],p.pos[2]-b.pos[2]))[0];
  const targetDistance = target ? Math.hypot(p.pos[0]-target.pos[0],p.pos[2]-target.pos[2]) : 0;
  ui.arrow.classList.toggle("hidden", !target || targetDistance < 26);
  if (target && targetDistance >= 26) { const bearing = Math.atan2(target.pos[0]-p.pos[0], target.pos[2]-p.pos[2]) - cameraYaw * Math.PI / 180; ui.arrow.style.left = `${50 + Math.sin(bearing) * 38}%`; ui.arrow.style.top = `${48 - Math.cos(bearing) * 29}%`; ui.arrow.style.right = "auto"; ui.arrow.style.transform = "translate(-50%,-50%)"; }
  ui.wind_warning.classList.toggle("hidden", !game.wind.warning);
}

function drawWorld(now) {
  if (!gl) return;
  const dpr = Math.min(2, devicePixelRatio || 1); const w = Math.floor(innerWidth * dpr), h = Math.floor(innerHeight * dpr);
  if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; gl.viewport(0, 0, w, h); }
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  const p = game.player, yaw = cameraYaw * Math.PI / 180, forward = [Math.sin(yaw), 0, Math.cos(yaw)];
  const focus = [p.pos[0], p.pos[1] + 1.1, p.pos[2]], eye = [p.pos[0] - forward[0] * 8, p.pos[1] + 4.5, p.pos[2] - forward[2] * 8];
  gl.uniformMatrix4fv(loc.projection, false, mat4.perspective(Math.PI / 3.2, w / Math.max(1, h), .1, 180)); gl.uniformMatrix4fv(loc.view, false, mat4.lookAt(eye, focus, [0, 1, 0]));
  gl.uniform1f(loc.environment, .15 + .55 * game.lanterns.filter(l => l.lit).length / game.lanterns.length);
  // Deep sky, cloud-sea and star points.
  for (let i = 0; i < 35; i++) { const x = Math.sin(i * 79.3) * 90, z = Math.cos(i * 31.7) * 90; draw("sphere", [x, 22 + (i % 7), z], [.12, .12, .12], i % 3 ? colors.core : colors.gold, .5); }
  draw("box", [0, -10, 0], [500, .2, 500], colors.sea);
  for (const island of game.map.islands) {
    draw("sphere", [island.x, -.5, island.z], [island.r, .55, island.r], colors.grass);
    draw("cylinder", [island.x, -.8, island.z], [island.r * .96, .65, island.r * .96], colors.wood);
    drawRing([island.x, .015, island.z], island.r - .35, island.r, colors.sand);
  }
  for (const bridge of game.map.bridges) draw("box", [(bridge.x1 + bridge.x2) / 2, -.02, 0], [bridge.x2 - bridge.x1, .2, bridge.z2 - bridge.z1], colors.wood);
  for (const pad of game.map.pads) { draw("cylinder", pad.pos, [1, .16, 1], colors.gold, .3); draw("sphere", [pad.pos[0], pad.pos[1] + .18, pad.pos[2]], [.38, .12, .38], colors.core, .5); }
  if (currentNight === 3) {
    draw("cylinder", [0, 2.8, 0], [24, .3, 24], colors.grass);
    // The upper terrace appears only on the north half; the lower island remains visible as a safe base.
    drawRing([0, 3.02, 0], 12, 24, colors.grass, 0, 180);
    draw("cylinder", [0, 5.8, 0], [8, .35, 8], colors.sand);
    draw("cylinder", [0, 6.0, 0], [2, 8, 2], colors.wood);
    for (const deg of [30, 150]) drawRamp(deg);
  }
  for (const l of game.lanterns) {
    draw("cylinder", l.pos, [.18, 2.1, .18], colors.wood);
    draw("sphere", [l.pos[0], l.pos[1] + 2.1, l.pos[2]], [.62, .8, .62], l.lit ? colors.amber : colors.unlit, l.lit ? .8 : 0);
    draw("sphere", [l.pos[0], l.pos[1] + 2.1, l.pos[2]], [.28, .42, .28], l.lit ? colors.core : colors.sky2, l.lit ? 1 : 0);
    draw("cone", [l.pos[0], l.pos[1] + 2.75, l.pos[2]], [.52, .4, .52], colors.wood);
    if (l.lit) drawRing([l.pos[0], .03, l.pos[2]], 5.8, 6, colors.amber);
  }
  for (const m of game.motes) if (m.active) { const floatY = .38 + Math.sin(now * .002 + (Number(m.id.slice(1)) || 1)) * .1; draw("sphere", [m.pos[0], m.pos[1] + floatY, m.pos[2]], [.26, .26, .26], colors.mote, .9); }
  for (const c of game.charms) if (c.available) { draw("box", [c.pos[0], c.pos[1] + .4, c.pos[2]], [.48, .48, .12], colors.red, .4); draw("sphere", [c.pos[0], c.pos[1] + .7, c.pos[2]], [.11, .11, .11], colors.gold, .5); }
  for (const s of game.shades) {
    draw("sphere", [s.pos[0], s.pos[1] + .8, s.pos[2]], [.8, .8, .8], s.state === "stunned" ? colors.stunned : colors.shade, s.state === "stunned" ? .3 : .05);
    draw("sphere", [s.pos[0] - .22, s.pos[1] + .95, s.pos[2] + .67], [.09, .09, .09], colors.violet, .7); draw("sphere", [s.pos[0] + .22, s.pos[1] + .95, s.pos[2] + .67], [.09, .09, .09], colors.violet, .7);
  }
  for (const d of game.drifters) { draw("sphere", [d.pos[0], d.pos[1] + .8 + Math.sin(now * .004) * .12, d.pos[2]], [.45, .95, .45], colors.drifter, .35); draw("cone", [d.pos[0], d.pos[1] + .85, d.pos[2]], [.65, .8, .65], colors.drifter, .1); }
  // Mây: cloth robe, lantern belt, and conical hat.
  draw("cylinder", [p.pos[0], p.pos[1], p.pos[2]], [.52, 1.0, .52], colors.robe);
  draw("sphere", [p.pos[0], p.pos[1] + 1.05, p.pos[2]], [.35, .38, .35], colors.robe);
  draw("cone", [p.pos[0], p.pos[1] + 1.35, p.pos[2]], [.52, .58, .52], colors.red);
  draw("sphere", [p.pos[0] + .28, p.pos[1] + .65, p.pos[2] + .28], [.19, .27, .19], colors.amber, .8);
  draw("cylinder", [p.pos[0], p.pos[1] + .48, p.pos[2]], [.54, .12, .54], colors.red);
  if (game.wind.active) draw("box", [p.pos[0] - .75, p.pos[1] + 1.5, p.pos[2]], [1.5, .08, .08], colors.drifter, .3);
}

function animate(now) {
  const dt = Math.min(.1, (now - (lastTime || now)) / 1000); lastTime = now;
  if (isRunning) accumulator += dt;
  while (accumulator >= 1 / 60) {
    const input = { move: [(keys.has("KeyD") ? 1 : 0) - (keys.has("KeyA") ? 1 : 0), (keys.has("KeyW") ? 1 : 0) - (keys.has("KeyS") ? 1 : 0)], cam_yaw_deg: cameraYaw,
      jump: keys.has("Space"), interact: keys.has("KeyE"), pulse: keys.has("KeyQ"), dash: keys.has("ShiftLeft") || keys.has("ShiftRight"), pause: keys.has("Escape") || keys.has("KeyP") };
    const before = game.state; stepGame(game, input, { snapshotEvery: 999999 });
    if (before === "playing" && game.state === "paused") show("pause");
    if (before === "paused" && game.state === "playing") show(null);
    for (; lastEventIndex < game.events.length; lastEventIndex++) { const e = game.events[lastEventIndex]; if (e.name === "mote_picked") sfx(660, .08); else if (e.name === "deposit") sfx(520, .1, "triangle"); else if (e.name === "lantern_lit") sfx(880, .28, "triangle"); else if (e.name === "pulse") sfx(260, .22, "sawtooth"); else if (e.name === "player_hit") sfx(130, .2, "sawtooth"); else if (e.name === "dash") sfx(430, .09, "triangle"); else if (e.name === "jump") sfx(380, .08); else if (e.name === "shade_spawned") sfx(112, .2, "sawtooth"); else if (e.name === "game_over") sfx(e.data.result === "won" ? 740 : 165, .4, "triangle"); }
    accumulator -= 1 / 60;
  }
  drawWorld(now); updateHud(now);
  if ((game.state === "won" || game.state === "lost") && !ui.result.dataset.shown) { ui.result.dataset.shown = "1"; showResult(); }
  if (isRunning && game.state === "playing") ui.result.dataset.shown = "";
  fpsFrames++; if (!fpsTime) fpsTime = now; if (now - fpsTime >= 1000) { ui.fps.textContent = `FPS ${Math.round(fpsFrames * 1000 / (now - fpsTime))}`; fpsFrames = 0; fpsTime = now; }
  if (isRunning && game.state === "playing") { const secs = Math.ceil(game.timeLeftTicks / 60); if (secs <= 10 && secs !== lastSeconds && secs > 0) sfx(620 - (10 - secs) * 26, .12); lastSeconds = secs; }
  requestAnimationFrame(animate);
}

function onKeyDown(e) { if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) e.preventDefault(); if (["Escape", "KeyP"].includes(e.code) && game.state === "paused") { /* let the simulation consume the resume edge */ } keys.add(e.code); }
function onKeyUp(e) { keys.delete(e.code); }
window.addEventListener("keydown", onKeyDown); window.addEventListener("keyup", onKeyUp);
let drag = false, lastX = 0;
canvas.addEventListener("pointerdown", e => { drag = true; lastX = e.clientX; canvas.setPointerCapture(e.pointerId); });
canvas.addEventListener("pointerup", () => { drag = false; });
canvas.addEventListener("pointermove", e => { if (drag && game.state === "playing") { cameraYaw -= (e.clientX - lastX) * .25 * sensitivity; lastX = e.clientX; } });

$("#begin").addEventListener("click", () => { campaignScore = 0; showIntro(1); });
$("#start-night").addEventListener("click", startNight);
$("#resume").addEventListener("click", () => { if (game.state === "paused") game.state = "playing"; isRunning = true; show(null); });
$("#replay").addEventListener("click", () => { game = createGame({ seed: 2026 + currentNight, night: currentNight }); lastEventIndex = 0; ui.result.dataset.shown = ""; startNight(); });
$("#result-replay").addEventListener("click", () => { game = createGame({ seed: 2026 + currentNight, night: currentNight }); lastEventIndex = 0; ui.result.dataset.shown = ""; showIntro(currentNight); });
$("#open-settings").addEventListener("click", () => openSettings("home"));
$("#pause-settings").addEventListener("click", () => openSettings("pause"));
$("#settings-back").addEventListener("click", () => show(settingsOrigin));
$("#to-menu").addEventListener("click", () => { isRunning = false; game = createGame(); show("home"); ui.hud.classList.add("hidden"); ui.controls_hint.classList.add("hidden"); });
ui.volume.addEventListener("input", () => { audioVolume = Number(ui.volume.value) / 100; localStorage.setItem("ddl.volume", ui.volume.value); if (musicGain) musicGain.gain.value = audioVolume * .035; updateSettingLabels(); });
ui.sensitivity.addEventListener("input", () => { sensitivity = Number(ui.sensitivity.value) / 100; localStorage.setItem("ddl.sensitivity", ui.sensitivity.value); updateSettingLabels(); });
$("#result-action").addEventListener("click", () => { if (game.state === "won" && currentNight < 3) showIntro(currentNight + 1); else { isRunning = false; campaignScore = 0; game = createGame(); show("home"); } });
updateSettingLabels();
requestAnimationFrame(animate);
