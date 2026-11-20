// High-craft procedural WebGL 3D renderer for Đảo Đèn Lồng.
// Uses real per-vertex normals, full TRS rotation matrices, up to 8 dynamic point lights,
// Fresnel rim lighting, sea-mist atmospheric fog, translucent VFX, and zero external assets.

export const PALETTE = {
  skyLow: "#0B1328",
  skyMid: "#152344",
  skyHigh: "#253D6E",
  seaDeep: "#0C2136",
  seaGlow: "#1B435E",
  seaFoam: "#5CA3B8",
  grass: "#2D5E4C",
  grassMid: "#39735B",
  grassLight: "#4B8B6E",
  sand: "#C9AE7E",
  sandWarm: "#DEC496",
  rock: "#56606D",
  rockDark: "#323944",
  rockMoss: "#415A50",
  wood: "#633D22",
  woodDark: "#3A2212",
  woodRed: "#8F271E",
  gold: "#F2C14E",
  goldBright: "#FFE48A",
  amber: "#FFA630",
  amberDeep: "#D86E12",
  core: "#FFF7DC",
  unlitPaper: "#475066",
  unlitCore: "#283148",
  mote: "#FFF9DC",
  moteGlow: "#FFD64D",
  moteDrop: "#9CEEFF",
  shadeBody: "#160926",
  shadeCore: "#090312",
  shadeAccent: "#A65CFF",
  shadeStun: "#3B3459",
  colorblindAccent: "#00C8FF",
  robeInner: "#F7F1E5",
  robeOuter: "#1D4459",
  robeTrim: "#F2C14E",
  sash: "#CC2438",
  skin: "#FCE3CE",
  hair: "#15101F",
  hat: "#D8BE86",
  hatRim: "#7A522B",
  drifter: "#89C4D6",
  drifterDark: "#4B788E",
  charmRed: "#CF2A34",
  teal: "#4ECDC4",
  danger: "#FF4D5A",
  leaf: "#245443",
  leafTip: "#3A785D",
};

function hexToRgb(hex) {
  return [
    parseInt(hex.slice(1, 3), 16) / 255,
    parseInt(hex.slice(3, 5), 16) / 255,
    parseInt(hex.slice(5, 7), 16) / 255,
  ];
}

const RGB_CACHE = new Map();
function rgb(hex) {
  let c = RGB_CACHE.get(hex);
  if (!c) {
    c = new Float32Array(hexToRgb(hex));
    RGB_CACHE.set(hex, c);
  }
  return c;
}

const VERT_SRC = `
attribute vec3 aPos;
attribute vec3 aNorm;
uniform mat4 uProj;
uniform mat4 uView;
uniform mat4 uModel;
uniform mat3 uNormalMat;
varying vec3 vNormal;
varying vec3 vWorldPos;
varying float vDepth;
void main() {
  vec4 wp = uModel * vec4(aPos, 1.0);
  vWorldPos = wp.xyz;
  vec4 vp = uView * wp;
  vDepth = length(vp.xyz);
  vNormal = normalize(uNormalMat * aNorm);
  gl_Position = uProj * vp;
}
`;

const FRAG_SRC = `
precision mediump float;
uniform vec3 uColor;
uniform vec3 uCameraPos;
uniform vec3 uFogColor;
uniform float uGlow;
uniform float uAlpha;
uniform float uEnv;
uniform float uFlat;
uniform int uLightCount;
uniform vec3 uLightPos[8];
uniform vec3 uLightColor[8];
varying vec3 vNormal;
varying vec3 vWorldPos;
varying float vDepth;

void main() {
  if (uFlat > 0.5) {
    float fogF = smoothstep(70.0, 175.0, vDepth) * 0.45;
    vec3 col = mix(uColor, uFogColor, fogF);
    gl_FragColor = vec4(col, uAlpha);
    return;
  }

  vec3 n = normalize(vNormal);
  vec3 viewDir = normalize(uCameraPos - vWorldPos);

  // Moonlight key + sky fill + warm underbounce
  vec3 moonDir = normalize(vec3(0.42, 0.78, -0.46));
  vec3 fillDir = normalize(vec3(-0.55, 0.35, 0.72));
  float ndl = max(dot(n, moonDir), 0.0);
  float fill = max(dot(n, fillDir), 0.0) * 0.24;
  float hemi = n.y * 0.5 + 0.5;
  vec3 amb = mix(vec3(0.08, 0.11, 0.20), vec3(0.28, 0.36, 0.54), hemi) * (0.45 + 1.15 * uEnv);

  // Subtle moonlight specular + stylized Fresnel rim
  vec3 h = normalize(moonDir + viewDir);
  float spec = pow(max(dot(n, h), 0.0), 28.0) * (0.14 + 0.16 * uEnv);
  float rim = pow(1.0 - max(dot(n, viewDir), 0.0), 3.0) * (0.16 + 0.12 * uEnv);

  vec3 lighting = amb + vec3(0.68, 0.76, 0.94) * ndl * (0.48 + 0.55 * uEnv) + vec3(0.22, 0.30, 0.48) * fill + vec3(0.55, 0.72, 0.95) * (spec + rim);

  // Dynamic point lights (Mây's lantern + lit temple lanterns)
  for (int i = 0; i < 8; i++) {
    if (i >= uLightCount) break;
    vec3 toL = uLightPos[i] - vWorldPos;
    float dist = length(toL);
    float atten = 1.0 / (1.0 + 0.055 * dist + 0.022 * dist * dist);
    float diffuse = 0.32 + 0.68 * max(dot(n, toL / max(dist, 0.001)), 0.0);
    lighting += uLightColor[i] * diffuse * atten;
  }

  vec3 lit = uColor * lighting + uColor * uGlow;

  // Gentle depth darkening below sea level + atmospheric sea mist fog
  float seaShade = smoothstep(-2.8, 0.2, vWorldPos.y);
  lit *= (0.76 + 0.24 * seaShade);
  float fog = smoothstep(52.0, 148.0, vDepth) * 0.72;
  vec3 finalColor = mix(lit, uFogColor, fog);

  gl_FragColor = vec4(finalColor, uAlpha);
}
`;

// Preallocated math helpers
const _m = new Float32Array(16);
const _nm = new Float32Array(9);

function perspective(out, fovy, aspect, near, far) {
  const f = 1 / Math.tan(fovy / 2);
  const nf = 1 / (near - far);
  out.fill(0);
  out[0] = f / aspect;
  out[5] = f;
  out[10] = (far + near) * nf;
  out[11] = -1;
  out[14] = 2 * far * near * nf;
  return out;
}

function lookAt(out, eye, center, up) {
  let zx = eye[0] - center[0], zy = eye[1] - center[1], zz = eye[2] - center[2];
  let len = Math.hypot(zx, zy, zz) || 1;
  zx /= len; zy /= len; zz /= len;
  let xx = up[1] * zz - up[2] * zy;
  let xy = up[2] * zx - up[0] * zz;
  let xz = up[0] * zy - up[1] * zx;
  len = Math.hypot(xx, xy, xz) || 1;
  xx /= len; xy /= len; xz /= len;
  const yx = zy * xz - zz * xy;
  const yy = zz * xx - zx * xz;
  const yz = zx * xy - zy * xx;
  out[0] = xx; out[1] = yx; out[2] = zx; out[3] = 0;
  out[4] = xy; out[5] = yy; out[6] = zy; out[7] = 0;
  out[8] = xz; out[9] = yz; out[10] = zz; out[11] = 0;
  out[12] = -(xx * eye[0] + xy * eye[1] + xz * eye[2]);
  out[13] = -(yx * eye[0] + yy * eye[1] + yz * eye[2]);
  out[14] = -(zx * eye[0] + zy * eye[1] + zz * eye[2]);
  out[15] = 1;
  return out;
}

// Build model matrix (Translate * RotY * RotX * RotZ * Scale) + inverse-transpose 3x3 normal matrix
function buildModelAndNormal(pos, scale, rotY = 0, rotX = 0, rotZ = 0) {
  const cy = Math.cos(rotY), sy = Math.sin(rotY);
  const cx = Math.cos(rotX), sx = Math.sin(rotX);
  const cz = Math.cos(rotZ), sz = Math.sin(rotZ);

  // R = Ry * Rx * Rz
  const r00 = cy * cz + sy * sx * sz;
  const r01 = -cy * sz + sy * sx * cz;
  const r02 = sy * cx;
  const r10 = cx * sz;
  const r11 = cx * cz;
  const r12 = -sx;
  const r20 = -sy * cz + cy * sx * sz;
  const r21 = sy * sz + cy * sx * cz;
  const r22 = cy * cx;

  const sx0 = scale[0], sy0 = scale[1], sz0 = scale[2];
  // Column-major 4x4
  _m[0] = r00 * sx0; _m[1] = r10 * sx0; _m[2] = r20 * sx0; _m[3] = 0;
  _m[4] = r01 * sy0; _m[5] = r11 * sy0; _m[6] = r21 * sy0; _m[7] = 0;
  _m[8] = r02 * sz0; _m[9] = r12 * sz0; _m[10] = r22 * sz0; _m[11] = 0;
  _m[12] = pos[0];   _m[13] = pos[1];   _m[14] = pos[2];   _m[15] = 1;

  // Normal matrix for R * S is R * inv(S) (since R is orthogonal)
  const ix = sx0 ? 1 / sx0 : 1, iy = sy0 ? 1 / sy0 : 1, iz = sz0 ? 1 / sz0 : 1;
  _nm[0] = r00 * ix; _nm[1] = r10 * ix; _nm[2] = r20 * ix;
  _nm[3] = r01 * iy; _nm[4] = r11 * iy; _nm[5] = r21 * iy;
  _nm[6] = r02 * iz; _nm[7] = r12 * iz; _nm[8] = r22 * iz;
}

// Procedural geometry builders producing interleaved [x,y,z, nx,ny,nz]
function pushTri(out, a, b, c, na = null, nb = null, nc = null) {
  if (!na) {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
    const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const len = Math.hypot(nx, ny, nz) || 1;
    na = nb = nc = [nx / len, ny / len, nz / len];
  }
  out.push(a[0], a[1], a[2], na[0], na[1], na[2]);
  out.push(b[0], b[1], b[2], nb[0], nb[1], nb[2]);
  out.push(c[0], c[1], c[2], nc[0], nc[1], nc[2]);
}

function buildBox() {
  const out = [];
  const faces = [
    { n: [0, 0, 1], v: [[-.5, -.5, .5], [.5, -.5, .5], [.5, .5, .5], [-.5, .5, .5]] },
    { n: [0, 0, -1], v: [[.5, -.5, -.5], [-.5, -.5, -.5], [-.5, .5, -.5], [.5, .5, -.5]] },
    { n: [-1, 0, 0], v: [[-.5, -.5, -.5], [-.5, -.5, .5], [-.5, .5, .5], [-.5, .5, -.5]] },
    { n: [1, 0, 0], v: [[.5, -.5, .5], [.5, -.5, -.5], [.5, .5, -.5], [.5, .5, .5]] },
    { n: [0, 1, 0], v: [[-.5, .5, .5], [.5, .5, .5], [.5, .5, -.5], [-.5, .5, -.5]] },
    { n: [0, -1, 0], v: [[-.5, -.5, -.5], [.5, -.5, -.5], [.5, -.5, .5], [-.5, -.5, .5]] },
  ];
  for (const f of faces) {
    pushTri(out, f.v[0], f.v[1], f.v[2], f.n, f.n, f.n);
    pushTri(out, f.v[0], f.v[2], f.v[3], f.n, f.n, f.n);
  }
  return out;
}

function buildSphere(rows = 14, cols = 20) {
  const out = [];
  for (let y = 0; y < rows; y++) {
    const a0 = -Math.PI / 2 + (y / rows) * Math.PI;
    const a1 = -Math.PI / 2 + ((y + 1) / rows) * Math.PI;
    for (let x = 0; x < cols; x++) {
      const b0 = (x / cols) * Math.PI * 2;
      const b1 = ((x + 1) / cols) * Math.PI * 2;
      const pt = (a, b) => [Math.cos(a) * Math.cos(b), Math.sin(a), Math.cos(a) * Math.sin(b)];
      const p0 = pt(a0, b0), p1 = pt(a1, b0), p2 = pt(a1, b1), p3 = pt(a0, b1);
      pushTri(out, p0, p1, p2, p0, p1, p2);
      pushTri(out, p0, p2, p3, p0, p2, p3);
    }
  }
  return out;
}

function buildCylinder(sides = 20, topScale = 1) {
  const out = [];
  const slopeY = (1 - topScale);
  const nLen = Math.hypot(1, slopeY) || 1;
  for (let i = 0; i < sides; i++) {
    const a = (i / sides) * Math.PI * 2;
    const b = ((i + 1) / sides) * Math.PI * 2;
    const ca = Math.cos(a), sa = Math.sin(a), cb = Math.cos(b), sb = Math.sin(b);
    const b0 = [ca, 0, sa], b1 = [cb, 0, sb];
    const t0 = [ca * topScale, 1, sa * topScale], t1 = [cb * topScale, 1, sb * topScale];
    const na = [ca / nLen, slopeY / nLen, sa / nLen];
    const nb = [cb / nLen, slopeY / nLen, sb / nLen];
    // Side wall
    pushTri(out, b0, t1, b1, na, nb, nb);
    pushTri(out, b0, t0, t1, na, na, nb);
    // Top cap
    if (topScale > 0.001) pushTri(out, [0, 1, 0], t1, t0, [0, 1, 0], [0, 1, 0], [0, 1, 0]);
    // Bottom cap
    pushTri(out, [0, 0, 0], b0, b1, [0, -1, 0], [0, -1, 0], [0, -1, 0]);
  }
  return out;
}

function buildCone(sides = 18, flat = false) {
  const out = [];
  const tip = [0, 1, 0];
  for (let i = 0; i < sides; i++) {
    const a = (i / sides) * Math.PI * 2;
    const b = ((i + 1) / sides) * Math.PI * 2;
    const ca = Math.cos(a), sa = Math.sin(a), cb = Math.cos(b), sb = Math.sin(b);
    const p0 = [ca, 0, sa], p1 = [cb, 0, sb];
    if (flat) {
      pushTri(out, p0, tip, p1);
    } else {
      const s = 1 / Math.SQRT2;
      const n0 = [ca * s, s, sa * s], n1 = [cb * s, s, sb * s];
      const nm = [Math.cos((a + b) / 2) * s, s, Math.sin((a + b) / 2) * s];
      pushTri(out, p0, tip, p1, n0, nm, n1);
    }
    pushTri(out, [0, 0, 0], p0, p1, [0, -1, 0], [0, -1, 0], [0, -1, 0]);
  }
  return out;
}

function buildTorus(R = 1, r = 0.14, segsR = 24, segsr = 10) {
  const out = [];
  for (let i = 0; i < segsR; i++) {
    const u0 = (i / segsR) * Math.PI * 2, u1 = ((i + 1) / segsR) * Math.PI * 2;
    for (let j = 0; j < segsr; j++) {
      const v0 = (j / segsr) * Math.PI * 2, v1 = ((j + 1) / segsr) * Math.PI * 2;
      const pt = (u, v) => [(R + r * Math.cos(v)) * Math.cos(u), r * Math.sin(v), (R + r * Math.cos(v)) * Math.sin(u)];
      const nm = (u, v) => [Math.cos(v) * Math.cos(u), Math.sin(v), Math.cos(v) * Math.sin(u)];
      const p0 = pt(u0, v0), p1 = pt(u1, v0), p2 = pt(u1, v1), p3 = pt(u0, v1);
      const n0 = nm(u0, v0), n1 = nm(u1, v0), n2 = nm(u1, v1), n3 = nm(u0, v1);
      pushTri(out, p0, p2, p1, n0, n2, n1);
      pushTri(out, p0, p3, p2, n0, n3, n2);
    }
  }
  return out;
}

function buildDisc(sides = 24) {
  const out = [];
  const up = [0, 1, 0];
  for (let i = 0; i < sides; i++) {
    const a = (i / sides) * Math.PI * 2, b = ((i + 1) / sides) * Math.PI * 2;
    pushTri(out, [0, 0, 0], [Math.cos(b), 0, Math.sin(b)], [Math.cos(a), 0, Math.sin(a)], up, up, up);
  }
  return out;
}

function buildArcSlab(inner, outer, height, startDeg, endDeg, steps = 28) {
  const out = [];
  const up = [0, 1, 0], down = [0, -1, 0];
  for (let i = 0; i < steps; i++) {
    const a = (startDeg + ((endDeg - startDeg) * i) / steps) * Math.PI / 180;
    const b = (startDeg + ((endDeg - startDeg) * (i + 1)) / steps) * Math.PI / 180;
    const ca = Math.cos(a), sa = Math.sin(a), cb = Math.cos(b), sb = Math.sin(b);
    const ti0 = [ca * inner, height, sa * inner], ti1 = [cb * inner, height, sb * inner];
    const to0 = [ca * outer, height, sa * outer], to1 = [cb * outer, height, sb * outer];
    const bi0 = [ca * inner, 0, sa * inner], bi1 = [cb * inner, 0, sb * inner];
    const bo0 = [ca * outer, 0, sa * outer], bo1 = [cb * outer, 0, sb * outer];
    // Top face
    pushTri(out, ti0, to1, to0, up, up, up);
    pushTri(out, ti0, ti1, to1, up, up, up);
    // Outer wall
    if (height > 0.001) {
      pushTri(out, bo0, to1, bo1, [ca, 0, sa], [cb, 0, sb], [cb, 0, sb]);
      pushTri(out, bo0, to0, to1, [ca, 0, sa], [ca, 0, sa], [cb, 0, sb]);
      // Inner wall
      pushTri(out, bi0, bi1, ti1, [-ca, 0, -sa], [-cb, 0, -sb], [-cb, 0, -sb]);
      pushTri(out, bi0, ti1, ti0, [-ca, 0, -sa], [-cb, 0, -sb], [-ca, 0, -sa]);
      // Bottom cap
      pushTri(out, bi0, bo0, bo1, down, down, down);
      pushTri(out, bi0, bo1, bi1, down, down, down);
    }
  }
  // End caps if partial arc
  if (height > 0.001 && endDeg - startDeg < 359) {
    for (const [deg, flip] of [[startDeg, false], [endDeg, true]]) {
      const r = deg * Math.PI / 180, c = Math.cos(r), s = Math.sin(r);
      const bi = [c * inner, 0, s * inner], bo = [c * outer, 0, s * outer];
      const ti = [c * inner, height, s * inner], to = [c * outer, height, s * outer];
      if (flip) { pushTri(out, bi, bo, to); pushTri(out, bi, to, ti); }
      else { pushTri(out, bi, to, bo); pushTri(out, bi, ti, to); }
    }
  }
  return out;
}

function buildRampMesh(degrees) {
  const out = [];
  const a = degrees * Math.PI / 180;
  const ux = Math.cos(a), uz = Math.sin(a), px = -uz * 1.55, pz = ux * 1.55;
  const oL = [ux * 30 + px, 0.02, uz * 30 + pz], oR = [ux * 30 - px, 0.02, uz * 30 - pz];
  const iL = [ux * 23.8 + px, 3.01, uz * 23.8 + pz], iR = [ux * 23.8 - px, 3.01, uz * 23.8 - pz];
  const bL = [ux * 23.8 + px, 0, uz * 23.8 + pz], bR = [ux * 23.8 - px, 0, uz * 23.8 - pz];
  // Top sloped surface
  pushTri(out, oL, iL, iR);
  pushTri(out, oL, iR, oR);
  // Side stone skirts
  pushTri(out, oL, bL, iL);
  pushTri(out, oR, iR, bR);
  return out;
}

export function createRenderer(canvas, { preserveDrawingBuffer = false } = {}) {
  const gl = canvas.getContext("webgl", { antialias: true, alpha: false, preserveDrawingBuffer, powerPreference: "high-performance" });
  if (!gl) return null;

  function compile(type, src) {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh));
    return sh;
  }

  const prog = gl.createProgram();
  gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT_SRC));
  gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG_SRC));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
  gl.useProgram(prog);

  const loc = {
    aPos: gl.getAttribLocation(prog, "aPos"),
    aNorm: gl.getAttribLocation(prog, "aNorm"),
    uProj: gl.getUniformLocation(prog, "uProj"),
    uView: gl.getUniformLocation(prog, "uView"),
    uModel: gl.getUniformLocation(prog, "uModel"),
    uNormalMat: gl.getUniformLocation(prog, "uNormalMat"),
    uColor: gl.getUniformLocation(prog, "uColor"),
    uCameraPos: gl.getUniformLocation(prog, "uCameraPos"),
    uFogColor: gl.getUniformLocation(prog, "uFogColor"),
    uGlow: gl.getUniformLocation(prog, "uGlow"),
    uAlpha: gl.getUniformLocation(prog, "uAlpha"),
    uEnv: gl.getUniformLocation(prog, "uEnv"),
    uFlat: gl.getUniformLocation(prog, "uFlat"),
    uLightCount: gl.getUniformLocation(prog, "uLightCount"),
    uLightPos: gl.getUniformLocation(prog, "uLightPos"),
    uLightColor: gl.getUniformLocation(prog, "uLightColor"),
  };

  function upload(data) {
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW);
    return { buffer, count: data.length / 6 };
  }

  const meshes = {
    box: upload(buildBox()),
    sphere: upload(buildSphere(12, 18)),
    sphereHi: upload(buildSphere(16, 24)),
    cylinder: upload(buildCylinder(20, 1)),
    taper: upload(buildCylinder(18, 0.72)),
    octPillar: upload(buildCylinder(8, 0.88)),
    islandBase: upload(buildCylinder(36, 1.0)),
    islandCliff: upload(buildCylinder(28, 0.74)),
    cone: upload(buildCone(18, false)),
    pagodaRoof: upload(buildCone(4, true)),
    hexRoof: upload(buildCone(6, true)),
    torus: upload(buildTorus(1, 0.12, 24, 8)),
    torusThin: upload(buildTorus(1, 0.045, 28, 8)),
    disc: upload(buildDisc(24)),
    halfRingTier: upload(buildArcSlab(12, 24, 3.0, 0, 180, 28)),
    halfRingTop: upload(buildArcSlab(12.6, 23.4, 0.04, 0, 180, 28)),
    ramp30: upload(buildRampMesh(30)),
    ramp150: upload(buildRampMesh(150)),
  };

  const ringCache = new Map();
  function getRingMesh(inner, outer, start = 0, end = 360) {
    const key = `${inner.toFixed(2)}:${outer.toFixed(2)}:${start}:${end}`;
    let m = ringCache.get(key);
    if (!m) {
      m = upload(buildArcSlab(inner, outer, 0.0, start, end, Math.max(16, Math.ceil((end - start) / 10))));
      ringCache.set(key, m);
    }
    return m;
  }

  let boundBuffer = null;
  function bindMesh(m) {
    if (boundBuffer === m.buffer) return;
    boundBuffer = m.buffer;
    gl.bindBuffer(gl.ARRAY_BUFFER, m.buffer);
    gl.enableVertexAttribArray(loc.aPos);
    gl.vertexAttribPointer(loc.aPos, 3, gl.FLOAT, false, 24, 0);
    gl.enableVertexAttribArray(loc.aNorm);
    gl.vertexAttribPointer(loc.aNorm, 3, gl.FLOAT, false, 24, 12);
  }

  function drawMesh(m, pos, scale, colorHex, { rotY = 0, rotX = 0, rotZ = 0, glow = 0, alpha = 1, flat = false } = {}) {
    bindMesh(m);
    buildModelAndNormal(pos, scale, rotY, rotX, rotZ);
    gl.uniformMatrix4fv(loc.uModel, false, _m);
    gl.uniformMatrix3fv(loc.uNormalMat, false, _nm);
    gl.uniform3fv(loc.uColor, rgb(colorHex));
    gl.uniform1f(loc.uGlow, glow);
    gl.uniform1f(loc.uAlpha, alpha);
    gl.uniform1f(loc.uFlat, flat ? 1 : 0);
    gl.drawArrays(gl.TRIANGLES, 0, m.count);
  }

  function draw(kind, pos, scale, colorHex, opts) {
    drawMesh(meshes[kind] || meshes.box, pos, scale, colorHex, opts);
  }

  function drawRing(pos, inner, outer, colorHex, opts = {}) {
    const m = getRingMesh(inner, outer, opts.start ?? 0, opts.end ?? 360);
    drawMesh(m, pos, [1, 1, 1], colorHex, opts);
  }

  // Transparent queue sorted/drawn after opaque geometry
  const transparentQueue = [];
  function queueAlpha(fn) { transparentQueue.push(fn); }

  // Decorative scenic trees (strictly placed near shoreline edges where no lantern/pad sits)
  function drawTree(x, y, z, style, seed, time) {
    const sway = Math.sin(time * 1.4 + seed) * 0.04;
    if (style === "areca") {
      // Tall slender Vietnamese areca palm (Đảo Cau)
      const h = 4.6 + (seed % 3) * 0.7;
      draw("cylinder", [x, y, z], [0.16, h, 0.16], PALETTE.wood, { rotZ: sway * 0.6 });
      for (let f = 0; f < 6; f++) {
        const a = (f / 6) * Math.PI * 2 + seed;
        draw("box", [x + Math.cos(a) * 0.85, y + h - 0.1, z + Math.sin(a) * 0.85], [1.7, 0.08, 0.34], f % 2 ? PALETTE.leafTip : PALETTE.leaf, { rotY: -a, rotZ: -0.25 + sway });
      }
      draw("sphere", [x, y + h, z], [0.28, 0.24, 0.28], PALETTE.leafTip);
    } else {
      // Stylized layered coastal pine
      draw("cylinder", [x, y, z], [0.22, 1.5, 0.22], PALETTE.woodDark);
      draw("cone", [x, y + 1.15, z], [1.35, 1.6, 1.35], PALETTE.leaf, { rotZ: sway });
      draw("cone", [x, y + 2.15, z], [1.05, 1.4, 1.05], PALETTE.leafTip, { rotZ: sway * 1.2 });
      draw("cone", [x, y + 3.0, z], [0.7, 1.1, 0.7], PALETTE.grassLight, { rotZ: sway * 1.4 });
    }
  }

  function drawHeroMay(p, now, time, colorblind, windActive) {
    // Smoothly turn Mây to face her facing vector
    const px = p.pos[0], py = p.pos[1], pz = p.pos[2];
    const speed = Math.hypot(p.vel[0], p.vel[2]);
    const moving = speed > 0.25;
    const faceYaw = Math.atan2(p.facing[0], p.facing[2]);
    const fx = Math.sin(faceYaw), fz = Math.cos(faceYaw);
    const rx = fz, rz = -fx; // local right axis (+X rotated by faceYaw)

    // Blink during invulnerability
    if (p.invuln > 0 && Math.floor(now / 70) % 2 === 0) return;

    const stride = moving && p.grounded ? Math.sin(time * 13) * 0.45 : 0;
    const bob = moving && p.grounded ? Math.abs(Math.sin(time * 13)) * 0.07 : Math.sin(time * 2.4) * 0.02;
    const lean = p.dashTicks > 0 ? 0.34 : (moving ? 0.14 : 0);

    // Contact shadow on ground
    if (p.grounded) {
      queueAlpha(() => draw("disc", [px, py + 0.025, pz], [0.58, 1, 0.58], "#050712", { alpha: 0.42, flat: true }));
    }

    // Articulated feet / wooden sandals (Guốc mộc)
    const lx = px - rx * 0.15 + fx * stride * 0.35;
    const lz = pz - rz * 0.15 + fz * stride * 0.35;
    const rfx = px + rx * 0.15 - fx * stride * 0.35;
    const rfz = pz + rz * 0.15 - fz * stride * 0.35;
    draw("box", [lx, py + 0.06 + Math.max(0, stride) * 0.14, lz], [0.16, 0.1, 0.32], PALETTE.woodDark, { rotY: faceYaw });
    draw("box", [rfx, py + 0.06 + Math.max(0, -stride) * 0.14, rfz], [0.16, 0.1, 0.32], PALETTE.woodDark, { rotY: faceYaw });

    // Inner ivory robe (Áo trong)
    draw("taper", [px, py + 0.12 + bob, pz], [0.42, 0.72, 0.42], PALETTE.robeInner, { rotY: faceYaw, rotX: lean * 0.5 });

    // Outer midnight-teal Áo tứ thân + golden hem trim
    draw("taper", [px, py + 0.36 + bob, pz], [0.46, 0.78, 0.44], PALETTE.robeOuter, { rotY: faceYaw, rotX: lean });
    draw("torusThin", [px, py + 0.38 + bob, pz], [0.47, 0.5, 0.45], PALETTE.robeTrim, { rotY: faceYaw, glow: 0.25 });

    // Crimson silk waist sash + flowing back ribbon
    draw("cylinder", [px, py + 0.72 + bob, pz], [0.36, 0.13, 0.34], PALETTE.sash, { rotY: faceYaw, rotX: lean });
    const tailSway = Math.sin(time * (moving ? 14 : 3.2)) * 0.14;
    draw("box", [px - fx * 0.34, py + 0.60 + bob, pz - fz * 0.34], [0.16, 0.44, 0.04], PALETTE.sash, {
      rotY: faceYaw + tailSway,
      rotX: -0.35 - (moving ? 0.35 : 0),
    });

    // Shoulders & swinging sleeves
    const armSwing = stride * 0.55;
    draw("taper", [px - rx * 0.38, py + 0.76 + bob, pz - rz * 0.38], [0.13, 0.44, 0.13], PALETTE.robeOuter, { rotY: faceYaw, rotX: armSwing });
    draw("taper", [px + rx * 0.38, py + 0.78 + bob, pz + rz * 0.38], [0.13, 0.44, 0.13], PALETTE.robeOuter, { rotY: faceYaw, rotX: -0.35 - armSwing * 0.3 });

    // Neck, head, hair bun + golden hairpin
    const hx = px + fx * lean * 0.4, hz = pz + fz * lean * 0.4;
    draw("cylinder", [hx, py + 1.12 + bob, hz], [0.11, 0.16, 0.11], PALETTE.skin);
    draw("sphere", [hx, py + 1.32 + bob, hz], [0.24, 0.26, 0.24], PALETTE.skin);
    draw("sphere", [hx - fx * 0.19, py + 1.35 + bob, hz - fz * 0.19], [0.15, 0.15, 0.15], PALETTE.hair);
    draw("cylinder", [hx - fx * 0.22, py + 1.35 + bob, hz - fz * 0.22], [0.025, 0.38, 0.025], PALETTE.gold, { rotY: faceYaw, rotZ: 1.25, glow: 0.4 });

    // Traditional Vietnamese conical hat (Nón lá) with woven rim & red chin ribbon
    draw("cone", [hx, py + 1.48 + bob, hz], [0.62, 0.48, 0.62], PALETTE.hat, { rotY: faceYaw, rotX: lean * 0.8 });
    draw("torusThin", [hx, py + 1.49 + bob, hz], [0.62, 0.55, 0.62], PALETTE.hatRim, { rotY: faceYaw, rotX: lean * 0.8 });
    draw("torusThin", [hx, py + 1.32 + bob, hz], [0.24, 0.4, 0.24], PALETTE.sash, { rotY: faceYaw });

    // Handheld bamboo-pole miniature lantern on right hand (glows brighter as motes increase!)
    const poleX = px + rx * 0.46 + fx * 0.42;
    const poleZ = pz + rz * 0.46 + fz * 0.42;
    const poleY = py + 1.02 + bob;
    const lanSway = Math.sin(time * (moving ? 10 : 2.8)) * 0.08;
    draw("cylinder", [poleX - fx * 0.12, poleY - 0.05, poleZ - fz * 0.12], [0.025, 0.62, 0.025], PALETTE.wood, { rotY: faceYaw, rotX: 0.7 });
    const lanX = poleX + fx * 0.22 + rx * lanSway;
    const lanY = poleY + 0.12;
    const lanZ = poleZ + fz * 0.22 + rz * lanSway;
    const moteBoost = Math.min(1, p.carried / 10);
    draw("cylinder", [lanX, lanY - 0.18, lanZ], [0.13, 0.24, 0.13], PALETTE.amber, { glow: 0.85 + moteBoost * 0.6 });
    draw("sphere", [lanX, lanY - 0.06, lanZ], [0.09, 0.11, 0.09], PALETTE.core, { glow: 1.4 + moteBoost * 0.5 });
    draw("cylinder", [lanX, lanY - 0.34, lanZ], [0.022, 0.16, 0.022], PALETTE.sash, { glow: 0.25 });

    // Orbiting motes visual around Mây's lantern (shows carried energy diegetically!)
    const visibleOrbs = Math.min(6, Math.ceil(p.carried / 2));
    for (let i = 0; i < visibleOrbs; i++) {
      const a = time * 3.1 + (i / visibleOrbs) * Math.PI * 2;
      draw("sphere", [px + Math.cos(a) * 0.72, py + 0.95 + Math.sin(a * 2) * 0.18, pz + Math.sin(a) * 0.72], [0.055, 0.055, 0.055], PALETTE.mote, { glow: 1.4 });
    }

    // Bùa Gió speed aura rings
    if (p.charmTicks > 0 || windActive) {
      const auraColor = p.charmTicks > 0 ? PALETTE.teal : PALETTE.drifter;
      queueAlpha(() => {
        draw("torusThin", [px, py + 0.55 + Math.sin(time * 6) * 0.15, pz], [0.85, 0.8, 0.85], auraColor, { rotY: time * 4, rotX: 0.35, alpha: 0.65, flat: true });
        draw("torusThin", [px, py + 1.05 - Math.sin(time * 6) * 0.15, pz], [0.72, 0.8, 0.72], PALETTE.core, { rotY: -time * 5, rotZ: 0.3, alpha: 0.5, flat: true });
      });
    }
  }

  function drawTempleLantern(l, now, time, colorblind) {
    const [lx, ly, lz] = l.pos;
    const fuel = l.lit ? Math.max(0, Math.min(100, l.fuelUnits / 60)) : 0;
    const lowFuel = l.lit && fuel < 30;
    const blinkOn = !lowFuel || Math.floor(now / 500) % 2 === 0;
    const chamberColor = l.lit ? (blinkOn ? PALETTE.amber : (colorblind ? PALETTE.core : PALETTE.danger)) : PALETTE.unlitPaper;
    const coreColor = l.lit ? (blinkOn ? PALETTE.core : PALETTE.amberDeep) : PALETTE.unlitCore;
    const chamberGlow = l.lit ? (blinkOn ? 0.95 + Math.sin(time * 6 + lx) * 0.1 : 0.25) : 0.04;

    // Octagonal stone pedestal + base step
    draw("octPillar", [lx, ly, lz], [0.95, 0.22, 0.95], PALETTE.rockDark);
    draw("octPillar", [lx, ly + 0.22, lz], [0.72, 0.22, 0.72], PALETTE.rock);

    // Carved teak pillar & crimson collar rings
    draw("octPillar", [lx, ly + 0.44, lz], [0.24, 1.85, 0.24], PALETTE.wood);
    draw("torus", [lx, ly + 1.15, lz], [0.28, 0.35, 0.28], PALETTE.woodRed);
    draw("torus", [lx, ly + 2.22, lz], [0.34, 0.4, 0.34], PALETTE.gold, { glow: l.lit ? 0.3 : 0.05 });

    // Pavilion platform + 4 corner lacquer posts
    draw("octPillar", [lx, ly + 2.28, lz], [0.82, 0.14, 0.82], PALETTE.woodDark);
    for (let c = 0; c < 4; c++) {
      const ca = c * Math.PI / 2 + Math.PI / 4;
      draw("cylinder", [lx + Math.cos(ca) * 0.5, ly + 2.4, lz + Math.sin(ca) * 0.5], [0.055, 0.94, 0.055], PALETTE.woodRed);
    }

    // Silk lantern chamber + sacred flame core
    const scaleBody = l.lit ? 1.0 : 0.84;
    draw("octPillar", [lx, ly + 2.42, lz], [0.46 * scaleBody, 0.88 * scaleBody, 0.46 * scaleBody], chamberColor, { glow: chamberGlow });
    draw("sphere", [lx, ly + 2.86, lz], [0.24 * scaleBody, 0.34 * scaleBody, 0.24 * scaleBody], coreColor, { glow: l.lit && blinkOn ? 1.5 : 0.05 });

    // 2-tier pagoda roof + lotus spire
    draw("pagodaRoof", [lx, ly + 3.3, lz], [1.22, 0.4, 1.22], PALETTE.woodDark, { rotY: Math.PI / 4 });
    draw("pagodaRoof", [lx, ly + 3.62, lz], [0.82, 0.32, 0.82], PALETTE.woodRed, { rotY: Math.PI / 4 });
    draw("cone", [lx, ly + 3.9, lz], [0.18, 0.42, 0.18], PALETTE.gold, { glow: l.lit ? 0.65 : 0.15 });
    draw("sphere", [lx, ly + 4.32, lz], [0.1, 0.1, 0.1], PALETTE.core, { glow: l.lit ? 1.2 : 0.2 });

    // 4 swaying crimson silk tassels
    for (let c = 0; c < 4; c++) {
      const ca = c * Math.PI / 2 + Math.PI / 4;
      const sway = Math.sin(time * 2.4 + c + lx) * 0.07;
      const tx = lx + Math.cos(ca) * 0.82;
      const tz = lz + Math.sin(ca) * 0.82;
      draw("cylinder", [tx, ly + 2.98, tz], [0.028, 0.3, 0.028], PALETTE.sash, { rotZ: sway, glow: 0.2 });
      draw("sphere", [tx + sway * 0.2, ly + 2.94, tz], [0.055, 0.055, 0.055], PALETTE.gold, { glow: 0.35 });
    }

    // Diegetic 3D fuel bar above lit lanterns, or deposit progress ring on unlit lanterns
    if (l.lit) {
      const barW = 1.3;
      const fillW = Math.max(0.02, barW * (fuel / 100));
      const barCol = lowFuel ? (colorblind ? PALETTE.core : PALETTE.danger) : PALETTE.gold;
      draw("box", [lx, ly + 4.66, lz], [barW + 0.08, 0.12, 0.1], PALETTE.woodDark);
      draw("box", [lx - barW / 2 + fillW / 2, ly + 4.66, lz], [fillW, 0.08, 0.13], barCol, { glow: lowFuel && blinkOn ? 1.2 : 0.55 });
    } else if (l.deposited > 0) {
      const cost = l.everLit ? 5 : 10;
      const frac = Math.min(1, l.deposited / cost);
      queueAlpha(() => drawRing([lx, ly + 0.06, lz], 1.15, 1.38, PALETTE.gold, { end: Math.max(12, frac * 360), alpha: 0.8, flat: true }));
    }

    // Translucent warm aura & 6 m safe-zone ring (ONLY when lit AND fuel >= 30!)
    if (l.lit) {
      queueAlpha(() => {
        if (!lowFuel) {
          drawRing([lx, ly + 0.04, lz], 5.82, 6.0, PALETTE.gold, { alpha: 0.52, flat: true });
          drawRing([lx, ly + 0.035, lz], 5.35, 5.82, PALETTE.amber, { alpha: 0.12, flat: true });
        }
        if (blinkOn) {
          draw("sphere", [lx, ly + 2.86, lz], [0.95, 1.05, 0.95], PALETTE.amber, { alpha: 0.18, flat: true });
          for (let e = 0; e < 3; e++) {
            const ea = time * 2.2 + e * 2.09 + lx;
            const ey = ly + 3.1 + ((time * 1.1 + e * 0.7) % 1.9);
            draw("sphere", [lx + Math.cos(ea) * 0.58, ey, lz + Math.sin(ea) * 0.58], [0.065, 0.065, 0.065], PALETTE.core, { alpha: 0.85, flat: true });
          }
        }
      });
    }
  }

  function drawShade(s, game, now, time, colorblind, benchMode = false, reducedMotion = false) {
    const isStunned = s.state === "stunned";
    const isDrain = s.state === "drain";
    const isSpawn = s.state === "spawning";
    const [sx, baseY, sz] = s.pos;
    const bob = (isStunned || reducedMotion || benchMode) ? 0 : Math.sin(time * 3.8 + sx) * 0.12;
    const spawnScale = isSpawn ? Math.max(0.25, 1 - (s.stateTicks ?? 0) / 30) : 1;
    const sy = baseY + 0.95 + bob;
    const accent = colorblind ? PALETTE.colorblindAccent : PALETTE.shadeAccent;

    // Face player when chasing, lantern when draining/wandering
    let tx = game.player.pos[0], tz = game.player.pos[2];
    if (s.state === "drain" || s.state === "wander") {
      const targetL = game.lanterns.find(l => l.id === s.targetLanternId);
      if (targetL) { tx = targetL.pos[0]; tz = targetL.pos[2]; }
    }
    const yaw = Math.atan2(tx - sx, tz - sz);
    const fx = Math.sin(yaw), fz = Math.cos(yaw), rx = fz, rz = -fx;

    if (benchMode) {
      // Standardized bench silhouette (creative sub-ornaments disabled per Ticket-04)
      draw("cone", [sx, sy - 0.82, sz], [0.76, 1.45, 0.76], PALETTE.shadeBody, { rotY: yaw, glow: 0.04 });
      draw("sphere", [sx, sy + 0.28, sz], [0.48, 0.52, 0.48], PALETTE.shadeCore, { glow: 0.06 });
      return;
    }

    // Ground dark shadow
    queueAlpha(() => draw("disc", [sx, baseY + 0.03, sz], [0.85 * spawnScale, 1, 0.85 * spawnScale], "#05020C", { alpha: 0.52, flat: true }));

    // Ink-spirit tattered cloak body + hood head + shoulder wisps
    const tilt = s.state === "chase" ? 0.24 : (isDrain ? -0.15 : 0);
    draw("cone", [sx, sy - 0.82, sz], [0.76 * spawnScale, 1.45 * spawnScale, 0.76 * spawnScale], isStunned ? PALETTE.shadeStun : PALETTE.shadeBody, { rotY: yaw, rotX: tilt, glow: isStunned ? 0.18 : 0.04 });
    draw("sphere", [sx + fx * tilt * 0.3, sy + 0.28, sz + fz * tilt * 0.3], [0.48 * spawnScale, 0.52 * spawnScale, 0.48 * spawnScale], isStunned ? PALETTE.shadeStun : PALETTE.shadeCore, { glow: 0.06 });
    draw("torusThin", [sx, sy - 0.15, sz], [0.72 * spawnScale, 0.7, 0.72 * spawnScale], accent, { rotY: reducedMotion ? 0 : time * 2.2, rotX: 0.22, glow: isStunned ? 0.15 : 0.55 });

    // Twin glowing phantom eyes properly aligned to facing yaw!
    const eyeGlow = isStunned ? 0.1 : (reducedMotion ? 1.15 : 1.15 + 0.3 * Math.sin(time * 7 + sx));
    const eyeY = sy + 0.32;
    const eyeBaseX = sx + fx * (0.44 * spawnScale), eyeBaseZ = sz + fz * (0.44 * spawnScale);
    draw("sphere", [eyeBaseX - rx * 0.16, eyeY, eyeBaseZ - rz * 0.16], [0.075, 0.055, 0.06], isStunned ? PALETTE.shadeStun : accent, { glow: eyeGlow });
    draw("sphere", [eyeBaseX + rx * 0.16, eyeY, eyeBaseZ + rz * 0.16], [0.075, 0.055, 0.06], isStunned ? PALETTE.shadeStun : accent, { glow: eyeGlow });

    // Orbiting shadow tendrils
    for (let w = 0; w < 4; w++) {
      const wa = (w / 4) * Math.PI * 2 + (reducedMotion ? 0 : time * 2.6);
      draw("sphere", [sx + Math.cos(wa) * 0.55 * spawnScale, sy - 0.62 + Math.sin(wa * 2) * 0.14, sz + Math.sin(wa) * 0.55 * spawnScale], [0.11, 0.17, 0.11], PALETTE.shadeCore);
    }

    // Colorblind distinct diamond ring
    if (colorblind && !isStunned) {
      draw("torusThin", [sx, sy + 0.1, sz], [0.98, 0.9, 0.98], PALETTE.colorblindAccent, { rotY: reducedMotion ? 0 : time * 1.8, glow: 0.85 });
    }

    // Stunned golden seal rings
    if (isStunned) {
      draw("torusThin", [sx, sy + 0.08, sz], [1.05, 0.9, 1.05], PALETTE.goldBright, { rotY: reducedMotion ? 0 : time * 5, rotX: 0.3, glow: 1.0 });
      draw("torusThin", [sx, sy + 0.42, sz], [0.82, 0.9, 0.82], PALETTE.gold, { rotY: reducedMotion ? 0 : -time * 4, rotZ: 0.25, glow: 0.85 });
    }

    // Active DRAIN energy tether beam to weak lantern!
    if (isDrain && s.targetLanternId) {
      const target = game.lanterns.find(l => l.id === s.targetLanternId);
      if (target) {
        const lx = target.pos[0], ly = target.pos[1] + 2.8, lz = target.pos[2];
        const mx = (sx + lx) / 2, my = (sy + ly) / 2, mz = (sz + lz) / 2;
        const dx = lx - sx, dy = ly - sy, dz = lz - sz;
        const beamLen = Math.hypot(dx, dy, dz) || 1;
        const beamYaw = Math.atan2(dx, dz);
        const beamPitch = Math.atan2(Math.hypot(dx, dz), dy);
        queueAlpha(() => {
          draw("cylinder", [sx, sy, sz], [0.09, beamLen, 0.09], accent, { rotY: beamYaw, rotX: beamPitch, alpha: 0.65, flat: true });
          const pulseT = reducedMotion ? 0.5 : (time * 2.2) % 1;
          draw("sphere", [lx - dx * pulseT, ly - dy * pulseT, lz - dz * pulseT], [0.22, 0.22, 0.22], PALETTE.amber, { alpha: 0.9, flat: true });
          draw("sphere", [mx, my, mz], [0.16, 0.16, 0.16], accent, { alpha: 0.75, flat: true });
        });
      }
    }
  }

  function drawDrifter(d, time) {
    if (d.state === "removed") return;
    const [dx, baseY, dz] = d.pos;
    const dy = baseY + 1.05 + Math.sin(time * 4.5 + dx) * 0.2;
    draw("sphere", [dx, dy, dz], [0.42, 0.68, 0.42], PALETTE.drifter, { glow: 0.45 });
    draw("cone", [dx, dy + 0.5, dz], [0.68, 0.62, 0.68], PALETTE.drifterDark, { rotY: time * 2.5, glow: 0.2 });
    queueAlpha(() => {
      draw("torusThin", [dx, dy - 0.1, dz], [0.78, 0.9, 0.78], PALETTE.core, { rotY: time * 4, rotX: 0.4, alpha: 0.55, flat: true });
    });
    // Orbiting stolen motes so player sees the thief carrying their motes!
    for (let i = 0; i < (d.stolen ?? 0); i++) {
      const a = time * 5 + (i / Math.max(1, d.stolen)) * Math.PI * 2;
      draw("sphere", [dx + Math.cos(a) * 0.85, dy + 0.2, dz + Math.sin(a) * 0.85], [0.15, 0.15, 0.15], PALETTE.moteGlow, { glow: 1.4 });
    }
  }

  // VFX state (purely cosmetic, fed by simulation events)
  const vfx = { pulses: [], bursts: [] };

  function spawnPulse(pos) {
    vfx.pulses.push({ pos: [...pos], born: performance.now(), duration: 520 });
  }

  function spawnBurst(pos, color, count = 10) {
    const born = performance.now();
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + Math.random() * 0.4;
      const spd = 2.2 + Math.random() * 2.8;
      vfx.bursts.push({
        pos: [pos[0], pos[1] + 0.6, pos[2]],
        vel: [Math.cos(a) * spd, 2.2 + Math.random() * 2.5, Math.sin(a) * spd],
        color,
        born,
        duration: 450 + Math.random() * 250,
      });
    }
  }

  const projMat = new Float32Array(16);
  const viewMat = new Float32Array(16);
  const lightPosArr = new Float32Array(8 * 3);
  const lightColArr = new Float32Array(8 * 3);

  gl.enable(gl.DEPTH_TEST);
  gl.enable(gl.CULL_FACE);
  gl.cullFace(gl.BACK);

  function getRendererInfo() {
    try {
      const dbg = gl.getExtension && gl.getExtension("WEBGL_debug_renderer_info");
      const gpu = dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
      return `WebGL 1.0 custom procedural (${gpu || "WebGL"})`;
    } catch {
      return "WebGL 1.0 custom procedural";
    }
  }

  return {
    getRendererInfo,
    spawnPulse,
    spawnBurst,
    render(game, { now, cameraYaw, orbitMenu = false, colorblind = false, benchMode = false, benchElapsedSec = 0, reducedMotion = false }) {
      const time = now * 0.001;
      const dpr = benchMode ? 1 : Math.min(2, window.devicePixelRatio || 1);
      const w = Math.max(1, Math.floor((benchMode ? 1280 : window.innerWidth) * dpr));
      const h = Math.max(1, Math.floor((benchMode ? 720 : window.innerHeight) * dpr));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        gl.viewport(0, 0, w, h);
      }

      const litCount = game.lanterns.filter(l => l.lit).length;
      const litRatio = litCount / Math.max(1, game.lanterns.length);
      // Exact Phase 2 formula: 0.15 + 0.55 * (lit / total)
      const envLight = 0.15 + 0.55 * litRatio;

      // Sky & fog gently brighten toward dawn gold as lanterns light up
      const fogR = 0.055 + 0.095 * litRatio;
      const fogG = 0.088 + 0.092 * litRatio;
      const fogB = 0.175 + 0.075 * litRatio;
      gl.clearColor(fogR, fogG, fogB, 1);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

      // Camera: Ticket-04 bench orbit (CCW from above, R=30, Y=15, 15s/rev, start (30,15,0)),
      // menu orbit, or third-person follow
      const p = game.player;
      let eye, focus;
      if (benchMode) {
        const angle = (benchElapsedSec / 15) * Math.PI * 2;
        eye = [30 * Math.cos(angle), 15, -30 * Math.sin(angle)];
        focus = [0, 0, 0];
      } else if (orbitMenu) {
        const a = reducedMotion ? 0.65 : time * 0.16;
        eye = [Math.sin(a) * 34, 15.5, Math.cos(a) * 34];
        focus = [0, 2.2, 0];
      } else {
        const yaw = cameraYaw * Math.PI / 180;
        const fx = Math.sin(yaw), fz = Math.cos(yaw);
        focus = [p.pos[0], p.pos[1] + 1.35, p.pos[2]];
        eye = [p.pos[0] - fx * 9.2, p.pos[1] + 4.9, p.pos[2] - fz * 9.2];
      }

      perspective(projMat, Math.PI / 3.3, w / h, 0.15, 240);
      lookAt(viewMat, eye, focus, [0, 1, 0]);
      gl.uniformMatrix4fv(loc.uProj, false, projMat);
      gl.uniformMatrix4fv(loc.uView, false, viewMat);
      gl.uniform3f(loc.uCameraPos, eye[0], eye[1], eye[2]);
      gl.uniform3f(loc.uFogColor, fogR, fogG, fogB);
      gl.uniform1f(loc.uEnv, envLight);

      // Pack up to 8 dynamic point lights: Mây's lantern + lit temple lanterns
      let lCount = 0;
      const pushLight = (x, y, z, r, g, b) => {
        if (lCount >= 8) return;
        lightPosArr[lCount * 3] = x;
        lightPosArr[lCount * 3 + 1] = y;
        lightPosArr[lCount * 3 + 2] = z;
        lightColArr[lCount * 3] = r;
        lightColArr[lCount * 3 + 1] = g;
        lightColArr[lCount * 3 + 2] = b;
        lCount++;
      };
      const playerGlow = 0.95 + Math.min(0.65, p.carried * 0.08);
      pushLight(p.pos[0], p.pos[1] + 1.5, p.pos[2], 1.15 * playerGlow, 0.82 * playerGlow, 0.36 * playerGlow);
      for (const l of game.lanterns) {
        if (!l.lit) continue;
        const fuel = l.fuelUnits / 60;
        const flicker = reducedMotion ? 1.0 : 0.92 + 0.08 * Math.sin(time * 8 + l.pos[0]);
        const strength = (fuel < 30 ? 1.2 : 2.1) * flicker;
        pushLight(l.pos[0], l.pos[1] + 3.0, l.pos[2], 1.1 * strength, 0.72 * strength, 0.25 * strength);
      }
      gl.uniform1i(loc.uLightCount, lCount);
      gl.uniform3fv(loc.uLightPos, lightPosArr);
      gl.uniform3fv(loc.uLightColor, lightColArr);

      transparentQueue.length = 0;

      // 1. CELESTIAL SKY (creative-only sky lanterns & extra stars disabled during benchMode)
      gl.disable(gl.CULL_FACE);
      draw("sphereHi", [68, 54, -92], [5.8, 5.8, 5.8], PALETTE.core, { flat: true });
      if (!benchMode) {
        queueAlpha(() => draw("sphere", [68, 54, -92], [11.5, 11.5, 11.5], PALETTE.gold, { alpha: 0.16, flat: true }));
        for (let i = 0; i < 64; i++) {
          const sx = Math.sin(i * 61.3 + 1.1) * 115;
          const sz = Math.cos(i * 23.7 + 0.7) * 115;
          const sy = 26 + (i % 10) * 3.1;
          const szs = 0.09 + (i % 3) * 0.045;
          draw("sphere", [sx, sy, sz], [szs, szs, szs], i % 5 === 0 ? PALETTE.goldBright : PALETTE.core, { flat: true });
        }
        for (let i = 0; i < 14; i++) {
          const lx = Math.sin(i * 2.55) * 76 + Math.cos(time * 0.12 + i) * 4;
          const lz = Math.cos(i * 2.55) * 76;
          const ly = 11 + (((reducedMotion ? 0 : time * 1.15) + i * 7.5) % 42);
          draw("octPillar", [lx, ly, lz], [0.36, 0.56, 0.36], PALETTE.amber, { flat: true });
          draw("sphere", [lx, ly + 0.28, lz], [0.2, 0.2, 0.2], PALETTE.core, { flat: true });
        }
      }
      gl.enable(gl.CULL_FACE);

      // 2. OCEAN & MOONLIT WATER SHIMMER
      draw("box", [0, -10.1, 0], [520, 0.25, 520], PALETTE.seaDeep);
      if (!benchMode) {
        for (let r = 1; r <= 7; r++) {
          const rx = 68 * (r / 8), rz = -92 * (r / 8);
          const shimmer = reducedMotion ? 1.0 : 1.0 + 0.2 * Math.sin(time * 2.4 + r);
          queueAlpha(() => draw("disc", [rx, -9.94, rz], [3.6 * shimmer, 1, 1.4], PALETTE.core, { alpha: 0.13, flat: true }));
        }
        for (let i = 0; i < 12; i++) {
          const wx = Math.sin(i * 1.9 + (reducedMotion ? 0 : time * 0.1)) * 72;
          const wz = Math.cos(i * 2.3 + (reducedMotion ? 0 : time * 0.08)) * 72;
          const ws = 10 + Math.sin(i + (reducedMotion ? 0 : time * 0.5)) * 3;
          queueAlpha(() => draw("box", [wx, -9.95, wz], [ws, 0.02, 0.9], PALETTE.seaFoam, { rotY: 0.4, alpha: 0.12, flat: true }));
        }
      }

      // 3. ISLANDS, SHORELINE CLIFFS, SCENIC TREES & LANDMARKS
      for (const island of game.map.islands) {
        const { x, z, r } = island;
        // Underwater cliff column + stepped coastal rock + sandy beach + lush grass lawn (staggered Y to prevent z-fighting)
        draw("islandCliff", [x, -10.0, z], [r * 0.92, 9.5, r * 0.92], PALETTE.rockDark);
        draw("islandBase", [x, -0.77, z], [r, 0.75, r], PALETTE.sand);
        draw("islandBase", [x, -0.18, z], [r - 0.85, 0.18, r - 0.85], PALETTE.grass);
        draw("islandBase", [x, -0.058, z], [r * 0.82, 0.07, r * 0.82], PALETTE.grassMid);
        if (!benchMode) {
          queueAlpha(() => {
            const pulse = reducedMotion ? 1 : 1 + Math.sin(time * 1.8 + x) * 0.012;
            drawRing([x, -9.9, z], r * 0.76 * pulse, (r * 0.76 + 1.8) * pulse, PALETTE.seaFoam, { alpha: 0.26, flat: true });
          });
          for (let b = 0; b < 12; b++) {
            const ba = (b / 12) * Math.PI * 2 + x * 0.1;
            const bx = x + Math.cos(ba) * (r - 0.55);
            const bz = z + Math.sin(ba) * (r - 0.55);
            const bs = 0.65 + (b % 3) * 0.35;
            draw("sphere", [bx, 0.12, bz], [bs, bs * 0.55, bs * 0.85], b % 2 ? PALETTE.rock : PALETTE.rockDark, { rotY: ba });
          }
          const treeStyle = game.night === 2 ? "areca" : "pine";
          const treeCount = game.night === 2 ? 7 : 9;
          for (let ti = 0; ti < treeCount; ti++) {
            const ta = (ti / treeCount) * Math.PI * 2 + 0.38;
            const tx = x + Math.cos(ta) * (r - 3.0);
            const tz = z + Math.sin(ta) * (r - 3.0);
            const tooClose = game.lanterns.some(l => Math.hypot(tx - l.pos[0], tz - l.pos[2]) < 4.5)
              || game.map.pads.some(pd => Math.hypot(tx - pd.pos[0], tz - pd.pos[2]) < 4)
              || game.map.bridges.some(br => tx > br.x1 - 3 && tx < br.x2 + 3 && Math.abs(tz) < 5);
            if (!tooClose) drawTree(tx, 0, tz, treeStyle, ti * 1.7 + x, reducedMotion ? 0 : time);
          }
        }
      }

      // Night 1 subtle harbor plaza stone circle at spawn
      if (game.night === 1) {
        draw("octPillar", [0, 0.0, 0], [3.6, 0.06, 3.6], PALETTE.sandWarm);
        draw("octPillar", [0, 0.02, 0], [2.4, 0.06, 2.4], PALETTE.rock);
      }

      // Night 2 UNRAILED Trestle Bridge (matching x ∈ [26, 44], z ∈ [-2, 2], zero railings per spec!)
      for (const bridge of game.map.bridges) {
        const cx = (bridge.x1 + bridge.x2) / 2;
        const len = bridge.x2 - bridge.x1;
        const wid = bridge.z2 - bridge.z1;
        // Main deck beams
        draw("box", [cx, -0.14, 0], [len, 0.24, wid], PALETTE.wood);
        draw("box", [cx, -0.30, -wid * 0.36], [len, 0.18, 0.24], PALETTE.woodDark);
        draw("box", [cx, -0.30, wid * 0.36], [len, 0.18, 0.24], PALETTE.woodDark);
        // Under-bridge trestle pilings into the sea
        for (let px = bridge.x1 + 3; px <= bridge.x2 - 3; px += 4.5) {
          draw("cylinder", [px, -10, -wid * 0.36], [0.22, 9.8, 0.22], PALETTE.woodDark);
          draw("cylinder", [px, -10, wid * 0.36], [0.22, 9.8, 0.22], PALETTE.woodDark);
        }
        // Individual deck planks (flat, clean, unrailed!)
        for (let px = bridge.x1 + 0.6; px < bridge.x2; px += 1.05) {
          draw("box", [px, 0.0, 0], [0.76, 0.07, wid], (Math.round(px) % 2) ? PALETTE.wood : PALETTE.woodDark);
        }
      }

      // Launch Pads (glowing wind-rune platform)
      for (const pad of game.map.pads) {
        const [px, py, pz] = pad.pos;
        draw("octPillar", [px, py, pz], [1.35, 0.18, 1.35], PALETTE.rockDark);
        draw("octPillar", [px, py + 0.16, pz], [1.05, 0.12, 1.05], PALETTE.teal, { glow: 0.45 });
        draw("torusThin", [px, py + 0.32 + Math.sin(time * 4) * 0.08, pz], [0.92, 0.9, 0.92], PALETTE.goldBright, { rotY: time * 2, glow: 0.85 });
        queueAlpha(() => {
          const lift = (time * 1.4) % 1;
          draw("torusThin", [px, py + 0.2 + lift * 1.6, pz], [1.05 - lift * 0.25, 0.8, 1.05 - lift * 0.25], PALETTE.teal, { alpha: (1 - lift) * 0.65, flat: true });
        });
      }

      // Night 3 Three-Tier Sanctuary (exact match to sim.mjs!)
      if (game.night === 3) {
        // North half-ring Y = 3 (with vertical rock cliff face so tier boundary is crystal-clear!)
        draw("halfRingTier", [0, 0, 0], [1, 1, 1], PALETTE.rockDark);
        draw("halfRingTop", [0, 2.98, 0], [1, 1, 1], PALETTE.grassLight);
        // Stone support column UNDER the Y = 6 center disc (spawn [0,6,0] is completely unobstructed!)
        draw("octPillar", [0, 0, 0], [4.6, 5.7, 4.6], PALETTE.rockDark);
        draw("islandBase", [0, 5.55, 0], [8.0, 0.45, 8.0], PALETTE.sand);
        draw("islandBase", [0, 5.96, 0], [7.2, 0.05, 7.2], PALETTE.sandWarm);
        draw("torusThin", [0, 6.02, 0], [7.95, 0.8, 7.95], PALETTE.gold, { glow: 0.3 });
        // Two ramps at 30° and 150° connecting Y=0 → Y=3
        gl.disable(gl.CULL_FACE);
        draw("ramp30", [0, 0, 0], [1, 1, 1], PALETTE.sandWarm);
        draw("ramp150", [0, 0, 0], [1, 1, 1], PALETTE.sandWarm);
        gl.enable(gl.CULL_FACE);
      }

      // 4. TEMPLE LANTERNS
      for (const l of game.lanterns) drawTempleLantern(l, now, time, colorblind);

      // 5. MOTES (Đom đóm)
      for (const m of game.motes) {
        if (!m.active) continue;
        const idx = Number(m.id.slice(1)) || 1;
        const isDropped = m.kind === "dropped";
        const mx = m.pos[0], mz = m.pos[2];
        const my = m.pos[1] + 0.52 + (reducedMotion || benchMode ? 0 : Math.sin(time * 2.8 + idx * 1.3) * 0.16);
        const pulse = benchMode ? 0.2 : 0.19 + (reducedMotion ? 0 : 0.04 * Math.sin(time * 5 + idx));
        const coreCol = isDropped ? PALETTE.moteDrop : PALETTE.mote;
        const glowCol = isDropped ? PALETTE.teal : PALETTE.moteGlow;
        draw("sphere", [mx, my, mz], [pulse, pulse, pulse], coreCol, { glow: 1.5 });
        if (!benchMode) {
          const flap = reducedMotion ? 0.1 : Math.sin(time * 28 + idx) * 0.35;
          draw("box", [mx + 0.14, my + 0.08, mz], [0.18, 0.02, 0.1], PALETTE.core, { rotZ: flap, glow: 0.8 });
          draw("box", [mx - 0.14, my + 0.08, mz], [0.18, 0.02, 0.1], PALETTE.core, { rotZ: -flap, glow: 0.8 });
          queueAlpha(() => draw("sphere", [mx, my, mz], [pulse * 2.1, pulse * 2.1, pulse * 2.1], glowCol, { alpha: 0.24, flat: true }));
        }
      }

      // 6. CHARMS (Bùa Gió)
      for (const c of game.charms) {
        if (!c.available) continue;
        const [cx, baseY, cz] = c.pos;
        const cy = baseY + 0.78 + (reducedMotion ? 0 : Math.sin(time * 3) * 0.12);
        const spin = reducedMotion ? 0.4 : time * 1.9;
        draw("box", [cx, cy, cz], [0.46, 0.64, 0.06], PALETTE.charmRed, { rotY: spin, glow: 0.55 });
        draw("box", [cx, cy, cz], [0.32, 0.48, 0.08], PALETTE.goldBright, { rotY: spin, glow: 0.6 });
        draw("torusThin", [cx, cy, cz], [0.68, 0.8, 0.68], PALETTE.teal, { rotY: -spin, rotX: 0.45, glow: 0.8 });
      }

      // 7. SHADES & DRIFTERS
      for (const s of game.shades) drawShade(s, game, now, time, colorblind, benchMode, reducedMotion);
      for (const d of game.drifters) drawDrifter(d, reducedMotion ? 0 : time);

      // 8. HEROINE MÂY
      drawHeroMay(p, now, reducedMotion ? 0 : time, colorblind, game.wind.active);

      // 9. NIGHT 3 WIND GUST STREAKS
      if (game.night === 3 && (game.wind.active || game.wind.warning)) {
        const dirRad = game.wind.dirDeg * Math.PI / 180;
        const wx = Math.cos(dirRad), wz = Math.sin(dirRad);
        const streakYaw = Math.atan2(wx, wz);
        const alpha = game.wind.active ? 0.55 : 0.24;
        const speed = game.wind.active ? 26 : 12;
        queueAlpha(() => {
          for (let i = 0; i < 16; i++) {
            const offset = ((time * speed + i * 9.5) % 44) - 22;
            const side = ((i % 7) - 3) * 5.2;
            const px0 = p.pos[0] + wx * offset - wz * side;
            const pz0 = p.pos[2] + wz * offset + wx * side;
            const py0 = p.pos[1] + 0.8 + (i % 4) * 0.9;
            draw("box", [px0, py0, pz0], [0.07, 0.05, 3.8], PALETTE.core, { rotY: streakYaw, alpha, flat: true });
          }
        });
      }

      // 10. EVENT VFX (Tỏa Sáng 5 m shockwave + particle bursts)
      for (let i = vfx.pulses.length - 1; i >= 0; i--) {
        const fx = vfx.pulses[i];
        const u = (now - fx.born) / fx.duration;
        if (u >= 1) { vfx.pulses.splice(i, 1); continue; }
        const radius = 0.5 + u * 4.8;
        const alpha = (1 - u) * 0.72;
        queueAlpha(() => {
          draw("torusThin", [fx.pos[0], fx.pos[1] + 0.65, fx.pos[2]], [radius, 1.8, radius], PALETTE.goldBright, { alpha, flat: true });
          draw("sphere", [fx.pos[0], fx.pos[1] + 0.8, fx.pos[2]], [radius * 0.9, radius * 0.5, radius * 0.9], PALETTE.amber, { alpha: alpha * 0.22, flat: true });
        });
      }
      for (let i = vfx.bursts.length - 1; i >= 0; i--) {
        const b = vfx.bursts[i];
        const u = (now - b.born) / b.duration;
        if (u >= 1) { vfx.bursts.splice(i, 1); continue; }
        const dt = (now - b.born) * 0.001;
        const bx = b.pos[0] + b.vel[0] * dt;
        const by = b.pos[1] + b.vel[1] * dt - 4.5 * dt * dt;
        const bz = b.pos[2] + b.vel[2] * dt;
        const sz = (1 - u) * 0.14;
        queueAlpha(() => draw("sphere", [bx, by, bz], [sz, sz, sz], b.color, { alpha: 1 - u, flat: true }));
      }

      // 11. TRANSLUCENT PASS (alpha-blended, depth write disabled)
      if (transparentQueue.length) {
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        gl.depthMask(false);
        gl.disable(gl.CULL_FACE);
        for (const fn of transparentQueue) fn();
        gl.enable(gl.CULL_FACE);
        gl.depthMask(true);
        gl.disable(gl.BLEND);
      }
    },
  };
}
