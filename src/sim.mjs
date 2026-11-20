export const HZ = 60;
export const BASE_CARRY = 10;
export const MAX_CARRY = 20;
export const FUEL_MAX = 100;
const FUEL_UNITS_PER_POINT = HZ;
const FUEL_MAX_UNITS = FUEL_MAX * FUEL_UNITS_PER_POINT;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const dist2 = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const dist3 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const idOrder = (a, b) => a.id.localeCompare(b.id, undefined, { numeric: true });
const round3 = n => Math.round(n * 1000) / 1000;
const copy = value => structuredClone(value);

const nights = {
  1: { name: "Đảo Bến", seconds: 240, shadeSpeed: 4, shadeInterval: 480, shadeMax: 6 },
  2: { name: "Đảo Cau", seconds: 270, shadeSpeed: 4, shadeInterval: 420, shadeMax: 8 },
  3: { name: "Đảo Chuông", seconds: 300, shadeSpeed: 4.5, shadeInterval: 360, shadeMax: 10 },
};

const polar = (r, degrees, y = 0, centerX = 0, centerZ = 0) => {
  const a = degrees * Math.PI / 180;
  return [round3(centerX + Math.cos(a) * r), y, round3(centerZ + Math.sin(a) * r)];
};
const lantern = (id, pos) => ({ id, pos, lit: false, deposited: 0, fuelUnits: 0, everLit: false, relitCount: 0 });
const fuelOf = l => l.fuelUnits / FUEL_UNITS_PER_POINT;
const capacityOf = game => Math.min(MAX_CARRY, BASE_CARRY + 2 * game.successfulLights);

function mapFor(night) {
  if (night === 1) {
    const motes = [...Array(8)].map((_, i) => polar(12, i * 45))
      .concat([...Array(16)].map((_, i) => polar(33, i * 22.5)));
    return {
      islands: [{ x: 0, z: 0, r: 40 }],
      lanterns: [lantern("L1", [0, 0, 25]), lantern("L2", [23.8, 0, 7.7]), lantern("L3", [14.7, 0, -20.2]), lantern("L4", [-14.7, 0, -20.2]), lantern("L5", [-23.8, 0, 7.7])],
      motes,
      shadePoints: [...Array(12)].map((_, i) => polar(37, 15 + i * 30)),
      pads: [],
      bridges: [],
      charms: [],
    };
  }
  if (night === 2) {
    const motes = [];
    for (const cx of [0, 70]) {
      for (const a of [0, 90, 180, 270]) motes.push(polar(10, a, 0, cx));
      for (let i = 0; i < 8; i++) motes.push(polar(22, i * 45, 0, cx));
    }
    const shadePoints = [];
    for (const cx of [0, 70]) for (let i = 0; i < 8; i++) shadePoints.push(polar(26, 22.5 + i * 45, 0, cx));
    return {
      islands: [{ x: 0, z: 0, r: 28 }, { x: 70, z: 0, r: 28 }],
      bridges: [{ x1: 26, x2: 44, z1: -2, z2: 2 }],
      lanterns: [[0, 0, 20], [17, 0, -10], [-17, 0, -10], [70, 0, 20], [87, 0, -10], [53, 0, -10]].map((p, i) => lantern(`L${i + 1}`, p)),
      motes, shadePoints,
      pads: [{ pos: [20, 0, 18], target: [70, 0, 0] }, { pos: [50, 0, -18], target: [0, 0, 0] }],
      charms: [{ id: "C1", pos: [35, 0, 0], available: true, respawnTicks: 0 }],
    };
  }
  const motes = [...Array(18)].map((_, i) => polar(34, i * 20))
    .concat([...Array(8)].map((_, i) => polar(18, 20 + i * 20, 3)))
    .concat([45, 135, 225, 315].map(a => polar(5, a, 6)));
  const shadePoints = [...Array(16)].map((_, i) => polar(43, i * 22.5));
  return {
    islands: [{ x: 0, z: 0, r: 45 }],
    lanterns: [[0, 6, 6], [18, 3, 10], [-18, 3, 10], [35, 0, -10], [-35, 0, -10], [20, 0, -35], [-20, 0, -35]].map((p, i) => lantern(`L${i + 1}`, p)),
    motes, shadePoints,
    pads: [{ pos: [0, 3, 13], target: [0, 6, 8] }],
    bridges: [],
    charms: [{ id: "C1", pos: [30, 0, 25], available: true, respawnTicks: 0 }, { id: "C2", pos: [-30, 0, 25], available: true, respawnTicks: 0 }],
    ramps: [30, 150],
  };
}

function rngFor(seed) {
  let state = (seed >>> 0) || 1;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function surfaceY(night, x, z) {
  if (night !== 3) return 0;
  const r = Math.hypot(x, z);
  if (z > 0 && r >= 12 && r <= 24) return 3;
  if (r <= 8) return 6;
  for (const degrees of [30, 150]) {
    const a = degrees * Math.PI / 180, along = x * Math.cos(a) + z * Math.sin(a), across = Math.abs(-x * Math.sin(a) + z * Math.cos(a));
    if (across <= 1.5 && along >= 23.5 && along <= 30) return clamp(3 * (30 - along) / 6, 0, 3);
  }
  return 0;
}

function spawnPosFor(night) {
  return night === 3 ? [0, 6, 0] : [0, 0, 0];
}

function insideMap(map, x, z) {
  if (map.islands.some(i => Math.hypot(x - i.x, z - i.z) <= i.r)) return true;
  return map.bridges.some(b => x >= b.x1 && x <= b.x2 && z >= b.z1 && z <= b.z2);
}

function makeMotes(map, night) {
  let source = map.motes;
  if (night === 2) source = [...map.motes.slice(0, 10), ...map.motes.slice(12, 22)];
  if (night === 3) source = [...map.motes.slice(0, 12), ...map.motes.slice(18, 23), ...map.motes.slice(26, 29)];
  return source.slice(0, 20).map((pos, i) => ({ id: `M${i + 1}`, pos: copy(pos), kind: "random", ttlTicks: null, active: true }));
}

function applyScenario(game, scenario) {
  if (!scenario) return;
  if (scenario.player) {
    if (scenario.player.pos) game.player.pos = copy(scenario.player.pos);
    if (Number.isInteger(scenario.player.successful_lights)) game.successfulLights = Math.max(0, scenario.player.successful_lights);
    if (Number.isInteger(scenario.player.carried)) game.player.carried = clamp(scenario.player.carried, 0, capacityOf(game));
    if (Number.isInteger(scenario.player.flames)) game.player.flames = scenario.player.flames;
    for (const [k, src] of [["invulnTicks", "invuln_ticks"], ["dashCd", "dash_cd_ticks"], ["pulseCd", "pulse_cd_ticks"], ["charmTicks", "charm_ticks"]]) {
      if (Number.isInteger(scenario.player[src])) game.player[k] = Math.max(0, scenario.player[src]);
    }
    game.player.grounded = Math.abs(game.player.pos[1] - surfaceY(game.night, game.player.pos[0], game.player.pos[2])) < 0.01;
  }
  for (const name of ["motes", "shades", "drifters", "charms"]) {
    if (Array.isArray(scenario[name])) {
      if (name === "motes") game.motes = scenario.motes.map((v, i) => Array.isArray(v) ? { id: `M${i + 1}`, pos: copy(v), kind: "random", ttlTicks: null, active: true } : ({ id: v.id ?? `M${i + 1}`, pos: copy(v.pos), kind: v.kind ?? "random", ttlTicks: v.ttl_ticks ?? null, active: true }));
      if (name === "shades") game.shades = scenario.shades.map((v, i) => ({ id: v.id ?? `S${i + 1}`, pos: copy(v.pos), state: v.state ?? "wander", stateTicks: v.state_ticks_left ?? 0, target: null, targetLanternId: v.target_lantern_id ?? null, spawnIndex: i, safeTicks: 0, knockbackTicks: 0, knockDir: [1, 0], recoilDir: [0, 0] }));
      if (name === "drifters") game.drifters = scenario.drifters.map((v, i) => ({ id: v.id ?? `D${i + 1}`, pos: copy(v.pos), state: v.state ?? "idle", stolen: v.stolen ?? 0, stateTicks: v.state_ticks_left ?? 0, target: null }));
      if (name === "charms") game.charms = scenario.charms.map((v, i) => ({ id: v.id ?? `C${i + 1}`, pos: copy(v.pos ?? [0, 0, 0]), available: v.available ?? true, respawnTicks: v.respawn_ticks ?? 0 }));
    }
  }
  if (Array.isArray(scenario.lanterns)) for (const change of scenario.lanterns) {
    const l = game.lanterns.find(item => item.id === change.id);
    if (l) {
      if (change.pos) l.pos = copy(change.pos);
      if (Number.isInteger(change.deposited)) l.deposited = change.deposited;
      if (typeof change.ever_lit === "boolean") l.everLit = change.ever_lit;
      if (Number.isInteger(change.relit_count)) l.relitCount = Math.max(0, change.relit_count);
      if (change.lit === true) {
        l.lit = true; l.everLit = change.ever_lit ?? true;
        const fuel = change.fuel == null ? FUEL_MAX : clamp(Number(change.fuel), 0, FUEL_MAX);
        l.fuelUnits = Math.round(fuel * FUEL_UNITS_PER_POINT);
      } else if (change.lit === false) { l.lit = false; l.fuelUnits = 0; }
    }
  }
  if (scenario.time_left_s != null) game.timeLeftTicks = Math.max(0, Math.round(scenario.time_left_s * HZ));
  if (scenario.random_motes === false) game.randomMotes = false;
  if (scenario.random_shades === false) game.randomShades = false;
  if (scenario.random_drifters === false) game.randomDrifters = false;
  if (scenario.wind_enabled === false) game.windEnabled = false;
}

export function createGame({ seed = 1, night = 1, scenario = null } = {}) {
  if (!nights[night]) throw new RangeError("night must be 1, 2, or 3");
  const map = mapFor(night);
  const meta = nights[night];
  const game = {
    seed, night, nightName: meta.name, map, random: rngFor(seed),
    tick: 0, simTick: 0, timeLeftTicks: meta.seconds * HZ, state: "playing", score: 0, totalScore: 0,
    player: { pos: night === 3 ? [0, 6, 0] : [0, 0, 0], vel: [0, 0, 0], facing: [0, 0, 1], grounded: true, carried: 0, flames: 3, invuln: 0, dashCd: 0, dashTicks: 0, dashDir: [0, 0], pulseCd: 0, charmTicks: 0, respawnTicks: 0, recoilTicks: 0, fallingHandled: false, launched: false },
    lanterns: map.lanterns.map(copy), motes: makeMotes(map, night), shades: [], drifters: [], charms: map.charms.map(copy),
    safePush: new Map(), windEnabled: true, wind: { active: false, warning: false, dirDeg: 0, ticks: 0 },
    randomMotes: true, randomShades: true, randomDrifters: true, events: [], previous: { jump: false, interact: false, pulse: false, dash: false, pause: false },
    spawnShadeAt: 300, spawnDrifterAt: 1200, lastInput: { move: [0, 0], cam_yaw_deg: 0, jump: false, interact: false, pulse: false, dash: false, pause: false },
    shadeSerial: 0, drifterSerial: 0, moteSerial: map.motes.length, shadeCursor: 0, drifterCursor: 0,
    terminalAtTick: null, successfulLights: 0,
  };
  applyScenario(game, scenario);
  game.moteSerial = Math.max(game.moteSerial, ...game.motes.map(m => Number(m.id.slice(1)) || 0));
  game.shadeSerial = Math.max(0, ...game.shades.map(s => Number(s.id.slice(1)) || 0));
  game.drifterSerial = Math.max(0, ...game.drifters.map(d => Number(d.id.slice(1)) || 0));
  game.events.push({ type: "event", tick: 0, name: "night_start", data: { night } });
  return game;
}

function emit(game, name, data = {}) { game.events.push({ type: "event", tick: game.tick, name, data }); }

function nearestSurface(game, x, z) {
  const y = surfaceY(game.night, x, z);
  return { y, inMap: insideMap(game.map, x, z) };
}

function applyHorizontalMove(game, dx, dz) {
  const p = game.player;
  const maxStepUp = 0.5;
  const canMoveTo = (nx, nz) => {
    const f = nearestSurface(game, nx, nz);
    return !(f.inMap && f.y > p.pos[1] + maxStepUp);
  };
  const nextX = p.pos[0] + dx, nextZ = p.pos[2] + dz;
  if (canMoveTo(nextX, nextZ)) {
    p.pos[0] = nextX; p.pos[2] = nextZ;
  } else if (canMoveTo(nextX, p.pos[2])) {
    p.pos[0] = nextX; p.vel[2] = 0;
  } else if (canMoveTo(p.pos[0], nextZ)) {
    p.pos[2] = nextZ; p.vel[0] = 0;
  } else {
    p.vel[0] = 0; p.vel[2] = 0;
  }
}

function movePlayer(game, input) {
  const p = game.player;
  if (p.respawnTicks > 0) { p.respawnTicks--; p.vel = [0, 0, 0]; return; }
  const mv = input.move ?? [0, 0];
  let [mx, mz] = mv;
  const mlen = Math.hypot(mx, mz);
  if (mlen > 1) { mx /= mlen; mz /= mlen; }
  const theta = (input.cam_yaw_deg ?? 0) * Math.PI / 180;
  const wx = mx * Math.cos(theta) + mz * Math.sin(theta);
  const wz = -mx * Math.sin(theta) + mz * Math.cos(theta);
  const len = Math.hypot(wx, wz);
  if (len > 0.001) p.facing = [wx / len, 0, wz / len];
  const maxSpeed = p.charmTicks > 0 ? 7.2 : 6;
  const dashActive = p.dashTicks > 0;
  let moveX = 0, moveZ = 0;
  if (dashActive) {
    moveX = p.dashDir[0] * 14 / HZ;
    moveZ = p.dashDir[1] * 14 / HZ;
    p.dashTicks--;
  } else if (p.recoilTicks > 0) {
    moveX = p.vel[0] / HZ; moveZ = p.vel[2] / HZ; p.recoilTicks--;
  } else if (p.launched) {
    moveX = p.vel[0] / HZ; moveZ = p.vel[2] / HZ;
  } else {
    const targetX = wx * maxSpeed, targetZ = wz * maxSpeed;
    const dx = targetX - p.vel[0], dz = targetZ - p.vel[2], dv = Math.hypot(dx, dz), maxChange = maxSpeed / 6;
    const response = dv > maxChange ? maxChange / dv : 1;
    p.vel[0] += dx * response;
    p.vel[2] += dz * response;
    moveX = p.vel[0] / HZ; moveZ = p.vel[2] / HZ;
  }
  if (game.night === 3 && game.wind.active) {
    const a = game.wind.dirDeg * Math.PI / 180;
    moveX += Math.cos(a) * 2 / HZ; moveZ += Math.sin(a) * 2 / HZ;
  }
  applyHorizontalMove(game, moveX, moveZ);
  const floor = nearestSurface(game, p.pos[0], p.pos[2]);
  if (input.jump && !game.previous.jump && p.grounded && !p.launched) { p.vel[1] = 7; p.grounded = false; emit(game, "jump", {}); }
  const pad = game.map.pads.find(item => dist2(p.pos, item.pos) <= 1 && Math.abs(p.pos[1] - item.pos[1]) <= 1.5 && p.grounded && !p.launched);
  const justLaunched = Boolean(pad);
  if (pad) {
    const dx = pad.target[0] - p.pos[0], dz = pad.target[2] - p.pos[2], d = Math.hypot(dx, dz) || 1;
    const launchSpeed = game.night === 2 ? 24 : 8;
    p.vel[0] = dx / d * launchSpeed; p.vel[2] = dz / d * launchSpeed;
    p.vel[1] = game.night === 2 ? 14 : 12; p.grounded = false; p.launched = true;
  }
  if (!p.grounded || p.pos[1] > floor.y) {
    if (dashActive) { /* an aerial dash keeps the current height */ }
    else {
      if (!justLaunched) p.vel[1] -= 20 / HZ;
      p.pos[1] += p.vel[1] / HZ;
      if (floor.inMap && p.pos[1] <= floor.y) {
        if (p.launched) { p.vel[0] = 0; p.vel[2] = 0; }
        p.pos[1] = floor.y; p.vel[1] = 0; p.grounded = true; p.launched = false;
      }
    }
  } else if (floor.inMap) { p.pos[1] = floor.y; p.vel[1] = 0; p.grounded = true; }
  if (!floor.inMap && p.pos[1] > -10) p.grounded = false;
  if (p.pos[1] < -10 && !p.fallingHandled) handleFall(game);
}

function handleFall(game) {
  const p = game.player;
  p.fallingHandled = true; p.flames--;
  const lost = p.carried; p.carried = 0;
  emit(game, "player_hit", { by: "fall", flames: p.flames, dropped: lost, lost });
  if (p.flames <= 0) { finishNight(game, "lost", "no_flames"); return; }
  p.respawnTicks = 60; p.invuln = 90; p.pos = spawnPosFor(game.night); p.vel = [0, 0, 0];
  p.grounded = true; p.launched = false; p.dashTicks = 0; p.recoilTicks = 0; p.fallingHandled = false;
}

function pickupItems(game) {
  const p = game.player;
  for (const m of game.motes) {
    if (m.active && p.carried < capacityOf(game) && dist2(p.pos, m.pos) <= 1 && Math.abs(p.pos[1] - m.pos[1]) <= 1.5) {
      m.active = false; m.ttlTicks = null; p.carried++; emit(game, "mote_picked", { carried: p.carried });
    }
  }
  for (const c of game.charms) if (c.available && dist2(p.pos, c.pos) <= 1 && Math.abs(p.pos[1] - c.pos[1]) <= 1.5) {
    c.available = false; c.respawnTicks = 2700; p.charmTicks = 600; emit(game, "charm_picked", { charm_id: c.id, charm_ticks: 600 });
  }
}

function interact(game, input) {
  if (!input.interact || game.previous.interact) return;
  const p = game.player;
  const candidates = game.lanterns.filter(l => (!l.lit || l.fuelUnits < FUEL_MAX_UNITS) && dist2(p.pos, l.pos) <= 2 && Math.abs(p.pos[1] - l.pos[1]) <= 1.5)
    .sort((a, b) => dist2(p.pos, a.pos) - dist2(p.pos, b.pos) || idOrder(a, b));
  const l = candidates[0]; if (!l || p.carried <= 0) return;
  if (l.lit) {
    const before = fuelOf(l);
    const used = Math.min(p.carried, Math.ceil((FUEL_MAX - before) / 10));
    if (used <= 0) return;
    p.carried -= used; l.fuelUnits = Math.min(FUEL_MAX_UNITS, l.fuelUnits + used * 10 * FUEL_UNITS_PER_POINT); game.score += used * 5;
    emit(game, "refuel", { lantern_id: l.id, amount: used, fuel: round3(fuelOf(l)) });
    if (before < 30 && fuelOf(l) >= 30) game.safePush.set(l.id, 30);
    return;
  }
  const cost = l.everLit ? 5 : 10;
  const amount = Math.min(p.carried, cost - l.deposited); p.carried -= amount; l.deposited += amount; game.score += amount * 5;
  emit(game, "deposit", { lantern_id: l.id, amount, deposited: l.deposited });
  if (l.deposited >= cost) {
    const relight = l.everLit;
    l.lit = true; l.fuelUnits = FUEL_MAX_UNITS; l.deposited = cost; l.everLit = true;
    if (relight) l.relitCount++;
    game.successfulLights++; game.score += relight ? 40 : 100; game.safePush.set(l.id, 30);
    emit(game, "lantern_lit", { lantern_id: l.id, relight });
  }
}

function updateSafeZones(game) {
  for (const shade of game.shades) {
    for (const l of game.lanterns.filter(x => x.lit && fuelOf(x) >= 30)) {
      const dx = shade.pos[0] - l.pos[0], dz = shade.pos[2] - l.pos[2], d = Math.hypot(dx, dz);
      if (d < 6 && d > 0.0001) {
        const ticks = game.safePush.get(l.id) ?? 1;
        const step = (6 - d) / Math.min(30, Math.max(1, ticks));
        shade.pos[0] += dx / d * step; shade.pos[2] += dz / d * step;
        shade.safeTicks = Math.max(shade.safeTicks ?? 0, 1);
      } else if (d <= 0.0001) { shade.pos[0] += 0.2; shade.safeTicks = 1; }
    }
  }
  for (const [id, ticks] of game.safePush) { if (ticks <= 1) game.safePush.delete(id); else game.safePush.set(id, ticks - 1); }
}

function pulse(game, input) {
  const p = game.player;
  if (!input.pulse || game.previous.pulse || p.pulseCd > 0 || p.carried < 3) return;
  p.carried -= 3; p.pulseCd = 180;
  const center = [p.pos[0], p.pos[1] + 0.8, p.pos[2]];
  const targets = [...game.shades, ...game.drifters.filter(d => d.state === "chase" || d.state === "flee")]
    .filter(e => dist3(center, e.pos) <= 5).sort(idOrder);
  const stunned = [];
  for (const e of targets) {
    if (e.id.startsWith("S")) {
      const wasDraining = e.state === "drain";
      e.state = "stunned"; e.stateTicks = 120; e.knockbackTicks = 15;
      const dx = e.pos[0] - p.pos[0], dz = e.pos[2] - p.pos[2], d = Math.hypot(dx, dz) || 0;
      e.knockDir = d ? [dx / d, dz / d] : [1, 0];
      game.score += wasDraining ? 15 : 5; stunned.push(e.id);
    } else if (e.state === "chase") { e.state = "flee"; e.stateTicks = 240; }
    else if (e.state === "flee" && e.stolen > 0) {
      dropMotes(game, e.pos, e.stolen, 480); emit(game, "drifter_drop", { drifter_id: e.id, amount: e.stolen }); e.stolen = 0; e.state = "removed"; e.stateTicks = 1;
    }
  }
  emit(game, "pulse", { stunned_ids: stunned });
}

function dropMotes(game, pos, amount, ttl) {
  const count = Math.min(amount, 30 - game.motes.filter(m => m.active).length);
  for (let i = 0; i < count; i++) {
    const a = (i / Math.max(1, count)) * Math.PI * 2;
    const r = 1.5 + (i % 3) * 0.5;
    game.moteSerial++;
    game.motes.push({ id: `M${game.moteSerial}`, pos: [round3(pos[0] + Math.cos(a) * r), pos[1], round3(pos[2] + Math.sin(a) * r)], kind: "dropped", ttlTicks: ttl, active: true });
  }
}

function hitPlayer(game, by, source) {
  const p = game.player;
  if (p.invuln > 0) return false;
  p.flames--; const dropped = Math.floor(p.carried / 2); p.carried -= dropped;
  if (dropped) dropMotes(game, p.pos, dropped, 480);
  p.invuln = 90;
  const dx = p.pos[0] - source.pos[0], dz = p.pos[2] - source.pos[2], d = Math.hypot(dx, dz) || 1;
  p.vel[0] = dx / d * 2; p.vel[2] = dz / d * 2; p.recoilTicks = 60;
  emit(game, "player_hit", { by, flames: p.flames, dropped });
  if (p.flames <= 0) finishNight(game, "lost", "no_flames");
  return true;
}

function updateShades(game) {
  const meta = nights[game.night], p = game.player;
  const inSafeZone = (x, z) => game.lanterns.some(l => l.lit && fuelOf(l) >= 30 && Math.hypot(x - l.pos[0], z - l.pos[2]) <= 6);
  for (const s of game.shades.slice().sort(idOrder)) {
    if (s.state === "stunned") {
      if (s.knockbackTicks > 0) { s.pos[0] += s.knockDir[0] * 4 / 15; s.pos[2] += s.knockDir[1] * 4 / 15; s.knockbackTicks--; }
      if (s.stateTicks <= 0) s.state = "wander";
      continue;
    }
    if (s.state === "spawning") { s.stateTicks--; if (s.stateTicks <= 0) s.state = "wander"; continue; }
    if (s.state === "recoil") {
      const rx = (s.recoilDir ?? [0, 0])[0], rz = (s.recoilDir ?? [0, 0])[1];
      s.pos[0] += rx * 2 / HZ; s.pos[2] += rz * 2 / HZ; s.stateTicks--;
      if (s.stateTicks <= 0) s.state = "wander";
      continue;
    }
    const d = dist2(s.pos, p.pos);
    if (s.state === "drain") {
      const target = game.lanterns.find(l => l.id === s.targetLanternId);
      if (!target || !target.lit || fuelOf(target) >= 30 || dist2(s.pos, target.pos) > 2) {
        s.state = "wander"; s.targetLanternId = null;
      } else if (d < 6) {
        s.state = "chase"; s.targetLanternId = null;
      } else {
        continue;
      }
    }
    if (s.state === "chase" && d >= 18) s.state = "wander";
    else if (s.state !== "chase" && d <= 12) s.state = "chase";
    if (s.state === "chase" && d > 0.001) {
      let nx = (p.pos[0] - s.pos[0]) / d, nz = (p.pos[2] - s.pos[2]) / d;
      const step = meta.shadeSpeed / HZ;
      const tx = s.pos[0] + nx * step, tz = s.pos[2] + nz * step;
      if (!inSafeZone(tx, tz)) { s.pos[0] = tx; s.pos[2] = tz; }
      if (p.respawnTicks <= 0 && p.invuln <= 0 && (s.safeTicks ?? 0) <= 0 && dist2(s.pos, p.pos) <= 1 && Math.abs(s.pos[1] - p.pos[1]) <= 1.5) {
        if (hitPlayer(game, "shade", s)) { s.state = "recoil"; s.stateTicks = 60; s.recoilDir = [-nx, -nz]; }
      }
    } else if (s.state === "wander") {
      const targets = game.lanterns.filter(l => (l.lit && fuelOf(l) < 30) || !l.lit)
        .sort((a, b) => {
          const aWeak = a.lit && fuelOf(a) < 30 ? 0 : 1, bWeak = b.lit && fuelOf(b) < 30 ? 0 : 1;
          return aWeak - bWeak || dist2(s.pos, a.pos) - dist2(s.pos, b.pos) || idOrder(a, b);
        });
      const target = targets[0];
      if (target) {
        s.targetLanternId = target.id;
        const ld = dist2(s.pos, target.pos);
        if (target.lit && fuelOf(target) < 30 && ld <= 2) s.state = "drain";
        else if (ld > 0.001) {
          const tx = s.pos[0] + (target.pos[0] - s.pos[0]) / ld * meta.shadeSpeed / HZ;
          const tz = s.pos[2] + (target.pos[2] - s.pos[2]) / ld * meta.shadeSpeed / HZ;
          if (!inSafeZone(tx, tz)) { s.pos[0] = tx; s.pos[2] = tz; }
        }
      }
    }
    if (s.safeTicks > 0) s.safeTicks--;
    if (game.night === 3 && insideMap(game.map, s.pos[0], s.pos[2])) s.pos[1] = surfaceY(3, s.pos[0], s.pos[2]);
  }
}

function updateLanternFuel(game) {
  for (const l of game.lanterns.filter(item => item.lit)) {
    const drainers = game.shades.filter(s => s.state === "drain" && s.targetLanternId === l.id).sort(idOrder);
    l.fuelUnits -= 1 + drainers.length * 5;
    if (drainers.length && game.simTick % HZ === 0) {
      for (const s of drainers) emit(game, "fuel_drain", { lantern_id: l.id, shade_id: s.id, fuel: round3(Math.max(0, fuelOf(l))) });
    }
    if (l.fuelUnits <= 0) {
      l.fuelUnits = 0; l.lit = false; l.deposited = 0; game.safePush.delete(l.id);
      emit(game, "lantern_out", { lantern_id: l.id });
      for (const s of drainers) { s.state = "wander"; s.targetLanternId = null; }
    }
  }
}

function updateDrifters(game) {
  const p = game.player;
  for (const d of game.drifters.slice().sort(idOrder)) {
    if (d.state === "removed") { d.stateTicks--; if (d.stateTicks <= 0) game.drifters = game.drifters.filter(x => x !== d); continue; }
    const range = dist2(d.pos, p.pos);
    if (d.state === "idle" && p.carried >= 5 && range <= 15) d.state = "chase";
    if (d.state === "chase" && (p.carried < 5 || range > 15)) d.state = "idle";
    if ((d.state === "chase" || d.state === "flee") && range > 0.001) {
      const speed = d.state === "chase" ? 7 : 7;
      const sign = d.state === "flee" ? -1 : 1;
      d.pos[0] += (p.pos[0] - d.pos[0]) / range * speed / HZ * sign;
      d.pos[2] += (p.pos[2] - d.pos[2]) / range * speed / HZ * sign;
    }
    if (d.state === "chase" && range <= 1.2 && d.stolen === 0) {
      const amount = Math.min(3, p.carried); p.carried -= amount; d.stolen = amount; d.state = "flee"; d.stateTicks = 240;
      emit(game, "drifter_steal", { drifter_id: d.id, amount, carried: p.carried });
    } else if (d.state === "flee") {
      d.stateTicks--; if (d.stateTicks <= 0) { d.state = "removed"; d.stateTicks = 1; }
    } else if (d.state === "idle") {
      const phase = game.simTick / 75 + (d.phase ?? 0);
      d.pos[0] += Math.cos(phase) * 2 / HZ; d.pos[2] += Math.sin(phase) * 2 / HZ;
    }
    if (game.night === 3 && insideMap(game.map, d.pos[0], d.pos[2])) d.pos[1] = surfaceY(3, d.pos[0], d.pos[2]);
  }
}

function updateWind(game) {
  if (game.night !== 3 || !game.windEnabled) return;
  const cycle = game.simTick % 1800;
  game.wind.warning = game.simTick >= 1680 && cycle >= 1680;
  game.wind.active = game.simTick >= 1800 && cycle < 300;
  if (game.wind.active && cycle === 0) game.wind.dirDeg = Math.floor(game.random() * 360);
}

function spawnEntities(game) {
  if (game.randomMotes && game.simTick > 0 && game.simTick % 240 === 0 && game.motes.filter(m => m.active).length < 30) {
    const candidates = game.map.motes.filter(pos => !game.motes.some(m => m.active && dist2(m.pos, pos) < 0.1));
    if (candidates.length) { const pos = candidates[Math.floor(game.random() * candidates.length)]; game.moteSerial++; game.motes.push({ id: `M${game.moteSerial}`, pos: copy(pos), kind: "random", ttlTicks: null, active: true }); }
  }
  if (game.randomShades && game.simTick >= game.spawnShadeAt && game.shades.length < nights[game.night].shadeMax) {
    const batch = game.simTick === 300 ? 2 : 1;
    for (let j = 0; j < batch && game.shades.length < nights[game.night].shadeMax; j++) {
      const candidates = game.map.shadePoints.filter(pos => dist2(pos, game.player.pos) >= 15);
      if (!candidates.length) break;
      const pos = candidates[game.shadeCursor++ % candidates.length]; game.shadeSerial++;
      game.shades.push({ id: `S${game.shadeSerial}`, pos: copy(pos), state: "spawning", stateTicks: 30, safeTicks: 0, knockbackTicks: 0, knockDir: [1, 0], recoilDir: [0, 0], targetLanternId: null });
      emit(game, "shade_spawned", { id: `S${game.shadeSerial}` });
    }
    game.spawnShadeAt += nights[game.night].shadeInterval;
  }
  if (game.randomDrifters && game.night >= 2 && game.simTick >= game.spawnDrifterAt && game.drifters.length < 2) {
    const pos = game.map.shadePoints[game.drifterCursor++ % game.map.shadePoints.length]; game.drifterSerial++;
    game.drifters.push({ id: `D${game.drifterSerial}`, pos: copy(pos), state: "idle", stolen: 0, stateTicks: 0 });
    game.spawnDrifterAt += 1200;
  }
}

function finishNight(game, state, reason) {
  if (game.state !== "playing") return;
  game.state = state; game.terminalAtTick = game.tick;
  if (state === "won") {
    game.score += game.lanterns.filter(l => l.lit).reduce((sum, l) => sum + 50 + Math.floor(fuelOf(l)), 0);
    game.score += 50 * game.player.flames; game.totalScore = game.score;
  }
  emit(game, "game_over", { result: state, reason });
}

function advanceTimers(game) {
  const p = game.player;
  if (p.respawnTicks <= 0) p.invuln = Math.max(0, p.invuln - 1);
  p.dashCd = Math.max(0, p.dashCd - 1); p.pulseCd = Math.max(0, p.pulseCd - 1); p.charmTicks = Math.max(0, p.charmTicks - 1);
  for (const c of game.charms) if (!c.available && c.respawnTicks > 0) { c.respawnTicks--; if (c.respawnTicks <= 0) c.available = true; }
  for (const s of game.shades) if (s.state === "stunned" && s.stateTicks > 0) s.stateTicks--;
  for (const m of game.motes) if (m.active && m.ttlTicks !== null) { m.ttlTicks--; if (m.ttlTicks <= 0) m.active = false; }
  game.timeLeftTicks = Math.max(0, game.timeLeftTicks - 1);
}

function snapshot(game) {
  const p = game.player;
  return {
    type: "snapshot", tick: game.tick, sim_tick: game.simTick, night: game.night, state: game.state,
    time_left_s: round3(game.timeLeftTicks / HZ), score: game.score, total_score: game.totalScore,
    wind: { active: game.wind.active, dir_deg: game.wind.dirDeg, warning: game.wind.warning },
    player: { pos: p.pos.map(round3), vel: p.vel.map(round3), grounded: p.grounded, flames: p.flames, carried: p.carried, capacity: capacityOf(game),
      invuln: p.invuln > 0, dash_cd_s: round3(p.dashCd / HZ), pulse_cd_s: round3(p.pulseCd / HZ), charm_s: round3(p.charmTicks / HZ) },
    lanterns: game.lanterns.map(l => ({ id: l.id, pos: l.pos.map(round3), lit: l.lit, deposited: l.deposited,
      fuel: Math.round(fuelOf(l) * 10) / 10, ever_lit: l.everLit, relit_count: l.relitCount })),
    motes: game.motes.filter(m => m.active).map(m => ({ id: m.id, pos: m.pos.map(round3), kind: m.kind, ttl_s: m.ttlTicks == null ? null : round3(m.ttlTicks / HZ) })),
    motes_active: game.motes.filter(m => m.active).length,
    shades: game.shades.map(s => ({ id: s.id, pos: s.pos.map(round3), state: s.state })),
    drifters: game.drifters.map(d => ({ id: d.id, pos: d.pos.map(round3), state: d.state, stolen: d.stolen })),
    charms: game.charms.map(c => ({ id: c.id, available: c.available, respawn_s: c.available ? 0 : round3(c.respawnTicks / HZ) })),
  };
}

export function stepGame(game, rawInput = {}, { snapshotEvery = 10 } = {}) {
  if (game.state === "won" || game.state === "lost") return [];
  const input = { ...game.lastInput, ...rawInput };
  input.move ??= [0, 0]; input.cam_yaw_deg ??= 0;
  for (const k of ["jump", "interact", "pulse", "dash", "pause"]) input[k] ??= false;
  game.tick++;
  const newEventsAt = game.events.length;
  const partialRecords = () => {
    const records = game.events.slice(newEventsAt);
    if (game.tick % snapshotEvery === 0) records.push(snapshot(game));
    return records;
  };
  const p = game.player;
  if (game.state === "paused") {
    if (input.pause && !game.previous.pause) { game.state = "playing"; emit(game, "resumed", {}); }
    else {
      game.previous = { ...game.previous, pause: input.pause };
      game.lastInput = input;
      return [snapshot(game)];
    }
  } else if (input.pause && !game.previous.pause) {
    game.state = "paused"; emit(game, "paused", {});
    game.previous = { ...game.previous, pause: input.pause };
    game.lastInput = input;
    return partialRecords();
  }
  game.simTick++; advanceTimers(game); updateWind(game);
  const respawning = p.respawnTicks > 0;
  if (!respawning && input.dash && !game.previous.dash && (p.dashCd <= 0 || p.charmTicks > 0) && p.dashTicks <= 0) {
    let dx = input.move[0], dz = input.move[1]; const a = input.cam_yaw_deg * Math.PI / 180;
    let wx = dx * Math.cos(a) + dz * Math.sin(a), wz = -dx * Math.sin(a) + dz * Math.cos(a), d = Math.hypot(wx, wz);
    if (!d) { wx = p.facing[0]; wz = p.facing[2]; d = Math.hypot(wx, wz) || 1; }
    p.dashDir = [wx / d, wz / d]; p.dashTicks = 12; p.dashCd = p.charmTicks > 0 ? 0 : 90; emit(game, "dash", {});
  }
  movePlayer(game, input);
  if (game.state !== "playing") return partialRecords();
  if (!respawning && p.respawnTicks <= 0) { pickupItems(game); interact(game, input); }
  updateSafeZones(game);
  if (!respawning && p.respawnTicks <= 0) pulse(game, input);
  updateShades(game); updateLanternFuel(game); updateDrifters(game); spawnEntities(game);
  if (p.flames <= 0) finishNight(game, "lost", "no_flames");
  else if (game.timeLeftTicks <= 0) {
    const required = Math.ceil(game.lanterns.length * 0.6);
    const lit = game.lanterns.filter(l => l.lit).length;
    finishNight(game, lit >= required ? "won" : "lost", lit >= required ? "dawn_survived" : "dawn");
  }
  game.previous = { jump: input.jump, interact: input.interact, pulse: input.pulse, dash: input.dash, pause: input.pause };
  game.lastInput = { ...input, move: [...input.move] };
  const result = game.events.slice(newEventsAt);
  if (game.tick % snapshotEvery === 0) result.push(snapshot(game));
  return result;
}

export function runHeadless({ seed = 1, night = 1, ticks = 0, scenario = null, inputFrames = [], snapshotEvery = 10 }) {
  const game = createGame({ seed, night, scenario });
  const output = [snapshot(game)];
  output.push(...game.events);
  let frameIndex = 0;
  for (let i = 0; i < ticks && game.state !== "won" && game.state !== "lost"; i++) {
    while (frameIndex < inputFrames.length && inputFrames[frameIndex].tick === i) {
      const { tick: _ignoredTick, ...frame } = inputFrames[frameIndex];
      Object.assign(game.lastInput, frame); frameIndex++;
    }
    const records = stepGame(game, game.lastInput, { snapshotEvery });
    for (const record of records) {
      if (record.type === "snapshot" && record.tick !== 0 && (record.tick % snapshotEvery !== 0)) continue;
      output.push(record);
    }
  }
  if ((game.state === "won" || game.state === "lost") && (output[output.length - 1]?.type !== "snapshot" || output[output.length - 1]?.tick !== game.tick)) {
    output.push(snapshot(game));
  }
  output.push({ type: "end", ticks: game.tick, state: game.state, score: game.score, night: game.night });
  return { game, output };
}

export function nightInfo(night) { return { ...nights[night], night }; }
