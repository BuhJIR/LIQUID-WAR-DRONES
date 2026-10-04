// =====================================================================
// WORLD: LiquidFun world, density-grid terrain (marching squares -> edge
// fixtures per chunk), particle systems, water occupancy field.
// =====================================================================
let B = null;                                   // Box2D module
const P = { world: null, water: null, fire: null, dirt: null, smoke: null, cloud: null, oil: null, steam: null, lava: null, V1: null, V2: null, edge: null, walls: null, bodyMap: new Map() };
const CELL = .5, GX = WORLD_W / CELL, GY = WORLD_H / CELL, NX = GX + 1, NY = GY + 1, CH = 16;
const CX = Math.ceil(GX / CH), CY = Math.ceil(GY / CH);

const Terrain = {
  d: new Float32Array(NX * NY), sc: new Float32Array(NX * NY), lo: new Uint8Array(NX * NY), top: new Float32Array(GX + 1), bodies: new Array(CX * CY).fill(null), dirty: new Set(), paintCols: null,
  canvas: document.createElement('canvas'), PPM: 4,
  // islands: blobs with a harmonic rim and bitten craters; density = distance to the rim
  build(islands) {
    const d = this.d; d.fill(0);
    for (const I of islands) {
      const r = mulberry32(I.seed), H = []; for (let k = 2; k <= 7; k++) H.push([k, (r() - .5) * 2 * I.rough / (k * .8), r() * TAU]); H.push([11, (r() - .5) * .025, r() * TAU]);   // big lobes, small rocky grain
      I.rimAt = a => { let v = 1; for (const [k, amp, ph] of H) v += amp * Math.sin(k * a + ph); return I.r * v; };
      I.cr = I.craters.map(c => { const R = I.rimAt(c.a); return { x: I.x + Math.cos(c.a) * (R - c.rc * .35), y: I.y + Math.sin(c.a) * (R - c.rc * .35), rc: c.rc }; });
      const ext = I.r * (1 + I.rough * 2) + 2, i0 = Math.max(0, Math.floor((I.x - ext) / CELL)), i1 = Math.min(GX, Math.ceil((I.x + ext) / CELL)), j0 = Math.max(0, Math.floor((I.y - ext) / CELL)), j1 = Math.min(GY, Math.ceil((I.y + ext) / CELL));
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
        const x = i * CELL, y = j * CELL, dx = x - I.x, dy = y - I.y, dist = Math.hypot(dx, dy); let v = I.rimAt(Math.atan2(dy, dx)) - dist;
        for (const c of I.cr) v = Math.min(v, Math.hypot(x - c.x, y - c.y) - c.rc);
        const k = j * NX + i; d[k] = Math.max(d[k], clamp(.5 + v * .7, 0, 1));
      }
    }
    this.sc.fill(0); this.lo.fill(0);
    this.bodies.fill(null);
    for (let cy = 0; cy < CY; cy++) for (let cx = 0; cx < CX; cx++) this.rebuildChunk(cx, cy);
    this.PPM = { 1: 4, 2: 3, 3: 2 }[cfg.pixel] || 3; this.tops(0, GX);
    this.canvas.width = WORLD_W * this.PPM; this.canvas.height = WORLD_H * this.PPM; this.ctx = this.canvas.getContext('2d'); this.img = this.ctx.createImageData(this.canvas.width, this.canvas.height);
    this.hash = new Uint8Array(this.canvas.width * this.canvas.height); for (let i = 0; i < this.hash.length; i++) this.hash[i] = (Math.sin(i * 12.9898) * 43758.5453 % 1 + 1) % 1 * 255;
  },
  at(i, j) { return (i < 0 || j < 0 || i > GX || j > GY) ? 0 : this.d[j * NX + i]; },
  sample(x, y) {
    const fx = x / CELL, fy = y / CELL, i = Math.floor(fx), j = Math.floor(fy);
    if (i < 0 || j < 0 || i >= GX || j >= GY) return 0;           // the void
    const u = fx - i, v = fy - j, d = this.d, k = j * NX + i;
    return (d[k] * (1 - u) + d[k + 1] * u) * (1 - v) + (d[k + NX] * (1 - u) + d[k + NX + 1] * u) * v;
  },
  solid(x, y) { return this.sample(x, y) > .5; },
  surfaceY(x) { for (let y = WORLD_H - .5; y > 0; y -= .25) if (this.solid(x, y)) return y; return 0; },
  normal(x, y) { const e = .35, gx = this.sample(x + e, y) - this.sample(x - e, y), gy = this.sample(x, y + e) - this.sample(x, y - e), l = Math.hypot(gx, gy) || 1; return [-gx / l, -gy / l]; },
  carve(x, y, r) {
    const i0 = Math.max(0, Math.floor((x - r) / CELL)), i1 = Math.min(GX, Math.ceil((x + r) / CELL)), j0 = Math.max(0, Math.floor((y - r) / CELL)), j1 = Math.min(GY, Math.ceil((y + r) / CELL));
    let any = false;
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const wy = j * CELL; if (wy < BED) continue;
      const dist = Math.hypot(i * CELL - x, wy - y); if (dist > r + CELL) continue;
      const tgt = clamp(.5 + (dist - r) * .7, 0, 1), k = j * NX + i; if (tgt < this.d[k]) { this.d[k] = tgt; any = true; }
    }
    if (!any) return;
    for (let cy = Math.floor(Math.max(0, j0 - 1) / CH); cy <= Math.floor(Math.min(GY - 1, j1) / CH); cy++) for (let cx = Math.floor(Math.max(0, i0 - 1) / CH); cx <= Math.floor(Math.min(GX - 1, i1) / CH); cx++) this.dirty.add(cy * CX + cx);
    this.dirtyPaint(x - r, x + r);
  },
  flush() {
    if (!this.dirty.size) return; let a = GX, b = 0;
    for (const k of this.dirty) { const cx = k % CX; this.rebuildChunk(cx, (k / CX) | 0); a = Math.min(a, cx * CH); b = Math.max(b, cx * CH + CH); } this.dirty.clear(); this.tops(a, b); Grav.dirty = true;
  },
  repaint() { if (this.paintCols) { this.paint(this.paintCols[0], this.paintCols[1]); this.paintCols = null; } },
  markDirty(x0, y0, x1, y1) {
    const i0 = Math.max(0, Math.floor(x0 / CELL) - 1), i1 = Math.min(GX - 1, Math.ceil(x1 / CELL)), j0 = Math.max(0, Math.floor(y0 / CELL) - 1), j1 = Math.min(GY - 1, Math.ceil(y1 / CELL));
    for (let cy = Math.floor(j0 / CH); cy <= Math.floor(j1 / CH); cy++) for (let cx = Math.floor(i0 / CH); cx <= Math.floor(i1 / CH); cx++) this.dirty.add(cy * CX + cx);
    this.dirtyPaint(x0, x1);
  },
  dirtyPaint(x0, x1) { const p0 = Math.floor((x0 - 1) * this.PPM), p1 = Math.ceil((x1 + 1) * this.PPM); this.paintCols = this.paintCols ? [Math.min(this.paintCols[0], p0), Math.max(this.paintCols[1], p1)] : [p0, p1]; },
  // highest solid node per column: grass line and cheap surface queries
  tops(i0, i1) { const d = this.d; for (let i = Math.max(0, i0); i <= Math.min(GX, i1); i++) { let j = GY; while (j > 0 && d[j * NX + i] <= .5) j--; this.top[i] = j; } },
  // TECTONICS. An explosion never deletes soil: it lifts it out of the crater,
  // scorches the walls, and returns the mass as ejecta that settles elsewhere.
  displace(x, y, r) {
    const R2 = r * 1.5, i0 = Math.max(0, Math.floor((x - R2) / CELL)), i1 = Math.min(GX, Math.ceil((x + R2) / CELL)), j0 = Math.max(0, Math.floor((y - R2) / CELL)), j1 = Math.min(GY, Math.ceil((y + R2) / CELL));
    let mass = 0; const pts = [], d = this.d, sc = this.sc;
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const wy = j * CELL, k = j * NX + i, dist = Math.hypot(i * CELL - x, wy - y);
      const burn = clamp(1 - (dist - r * .7) / (r * .8), 0, 1); if (burn > 0 && d[k] > .05) sc[k] = Math.max(sc[k], burn * .95);
      if (wy < BED || dist > r + CELL) continue;
      const tgt = clamp(.5 + (dist - r) * .7, 0, 1); if (tgt < d[k]) { const rem = d[k] - tgt; mass += rem * CELL * CELL; d[k] = tgt; if (rem > .45) pts.push(i * CELL, wy); }
    }
    if (mass > 0) this.markDirty(x - R2, y - R2, x + R2, y + R2); else this.dirtyPaint(x - R2, x + R2);
    return { mass, pts };
  },
  // put soil back: fill the node the grain rests in, then its neighbours, then upward
  // put soil back where it lands: slide along local gravity to the ground, fill the nearest open nodes
  deposit(x, y, area, scorch = 0) {
    const [ux, uy] = Grav.up(x, y); let px = x, py = y;
    for (let k = 0; k < 12 && !this.solid(px - ux * .5, py - uy * .5); k++) { px -= ux * .5; py -= uy * .5; }
    let rem = area / (CELL * CELL); const d = this.d, ci = Math.round(px / CELL), cj = Math.round(py / CELL), cand = [];
    for (let j = cj - 3; j <= cj + 3; j++) for (let i = ci - 3; i <= ci + 3; i++) { if (i < 0 || j < 0 || i > GX || j > GY) continue; const k = j * NX + i; if (d[k] >= .99) continue; const dx = i * CELL - px, dy = j * CELL - py; cand.push([dx * dx + dy * dy + (dx * ux + dy * uy) * 1.5, k]); }
    cand.sort((a, b) => a[0] - b[0]);
    for (const [, k] of cand) { if (rem <= 1e-3) break; const add = Math.min(1 - d[k], rem); d[k] += add; rem -= add; this.lo[k] = 1; this.sc[k] = Math.max(this.sc[k] * .6, scorch); }
    this.markDirty(px - 2, py - 2, px + 2, py + 2);
  },
  scorchAt(x, y, amt) { const i = Math.round(x / CELL), j = Math.round(y / CELL); if (i < 0 || j < 0 || i > GX || j > GY) return; const k = j * NX + i; if (this.d[k] < .3) return; const was = this.sc[k]; this.sc[k] = Math.min(1, was + amt); if ((was * 8 | 0) !== (this.sc[k] * 8 | 0)) this.dirtyPaint(x - .5, x + .5); return was; },
  topAt(x) { const i = clamp(Math.round(x / CELL), 0, GX); return this.top[i] * CELL; },
  rebuildChunk(cx, cy) {
    const k = cy * CX + cx; if (this.bodies[k]) { P.bodyMap.delete(B.getPointer(this.bodies[k])); P.world.DestroyBody(this.bodies[k]); this.bodies[k] = null; }
    const T = .5, segs = [];
    for (let j = cy * CH; j < Math.min(GY, cy * CH + CH); j++) for (let i = cx * CH; i < Math.min(GX, cx * CH + CH); i++) {
      const a = this.at(i, j), b = this.at(i + 1, j), c = this.at(i + 1, j + 1), d = this.at(i, j + 1);
      const idx = (a > T) | ((b > T) << 1) | ((c > T) << 2) | ((d > T) << 3); if (idx === 0 || idx === 15) continue;
      const x0 = i * CELL, y0 = j * CELL, t = (p, q) => (T - p) / (q - p);
      const E = [[x0 + t(a, b) * CELL, y0], [x0 + CELL, y0 + t(b, c) * CELL], [x0 + t(d, c) * CELL, y0 + CELL], [x0, y0 + t(a, d) * CELL]];
      for (const [e1, e2] of MS_TABLE[idx]) segs.push(E[e1], E[e2]);
    }
    if (!segs.length) return;
    const body = P.world.CreateBody(new B.b2BodyDef()); this.bodies[k] = body; P.bodyMap.set(B.getPointer(body), { kind: 'terrain' });
    for (let s = 0; s < segs.length; s += 2) {
      const [ax, ay] = segs[s], [bx, by] = segs[s + 1]; if (Math.hypot(ax - bx, ay - by) < .01) continue;
      P.V1.Set(ax, ay); P.V2.Set(bx, by); P.edge.SetTwoSided(P.V1, P.V2); const f = body.CreateFixture(P.edge, 0); f.SetFriction(.95);
    }
  },
  paint(px0, px1) {
    const W = this.canvas.width, H = this.canvas.height, ppm = this.PPM, data = this.img.data, hash = this.hash;
    px0 = clamp(px0, 0, W - 1); px1 = clamp(px1, 0, W - 1);
    for (let px = px0; px <= px1; px++) {
      const x = (px + .5) / ppm;
      for (let py = 0; py < H; py++) {
        const y = WORLD_H - (py + .5) / ppm, d = this.sample(x, y), o = (py * W + px) * 4;
        if (d <= .5) { data[o + 3] = 0; continue; }
        const nk = Math.round(y / CELL) * NX + Math.round(x / CELL), scv = this.sc[nk] || 0, loose = this.lo[nk];
        const [ux, uy] = Grav.up(x, y); let depth = 16; for (const s of [.9, 1.8, 3.5, 7, 12]) if (this.sample(x + ux * s, y + uy * s) <= .5) { depth = s; break; }
        const n = hash[py * W + px] / 255 - .5, strata = Math.sin((x * ux + y * uy) * 1.7 + Math.sin((x * uy - y * ux) * .13) * 2) * .5 + .5;
        let v = 44 - Math.min(depth, 14) * 1.6 + n * 9 + strata * 4, r = v * 1.02, g = v * .98, b = v * .93;
        if (loose) { r += 10; g += 5; b -= 2; if (((px * 7 + py * 13) & 7) === 0) { r -= 8; g -= 8; b -= 8; } }  // turned earth, clods
        if (d < .62) { r += 30; g += 26; b += 20; }                                 // rim
        else if (depth < 1.8 && !loose) { r += 12; g += 13; b += 8; }              // topsoil
        const k = 1 - scv * .8; r = r * k + scv * 6; g = g * k + scv * 4; b = b * k + scv * 3; // soot
        data[o] = r; data[o + 1] = g; data[o + 2] = b; data[o + 3] = 255;
      }
    }
    this.ctx.putImageData(this.img, 0, 0, px0, 0, px1 - px0 + 1, H);
  },
  // march a ray through the density field; returns distance to first solid or -1
  march(x, y, dx, dy, len, step = .2) { for (let s = 0; s < len; s += step) if (this.solid(x + dx * s, y + dy * s)) return s; return -1; }
};
// edges: 0 bottom, 1 right, 2 top, 3 left
const MS_TABLE = [[], [[3, 0]], [[0, 1]], [[3, 1]], [[1, 2]], [[3, 2], [1, 0]], [[0, 2]], [[3, 2]], [[2, 3]], [[2, 0]], [[0, 3], [2, 1]], [[2, 1]], [[1, 3]], [[1, 0]], [[0, 3]], []];

// ---------- water occupancy field (also the water image) ----------
const Water = {
  canvas: document.createElement('canvas'), grid: null, W: 0, H: 0, bbox: null,
  init() { const ppm = Terrain.PPM; this.ppm = ppm; this.W = WORLD_W * ppm; this.H = WORLD_H * ppm; this.canvas.width = this.W; this.canvas.height = this.H; this.ctx = this.canvas.getContext('2d'); this.img = this.ctx.createImageData(this.W, this.H); this.grid = new Float32Array(this.W * this.H); this.bbox = null; },
  update() {
    const g = this.grid, W = this.W, H = this.H, ppm = this.ppm, data = this.img.data;
    if (this.bbox) { const [x0, y0, x1, y1] = this.bbox; for (let y = y0; y <= y1; y++) { g.fill(0, y * W + x0, y * W + x1 + 1); for (let x = x0; x <= x1; x++) data[(y * W + x) * 4 + 3] = 0; } }
    const ps = P.water, n = ps.GetParticleCount(); if (!n) { this.ctx.putImageData(this.img, 0, 0); this.bbox = null; return; }
    const pos = new Float32Array(B.HEAPF32.buffer, B.getPointer(ps.GetPositionBuffer()), n * 2);
    const rad = Math.max(1, Math.round(P.water.GetRadius() * ppm * 1.25)); let bx0 = W, by0 = H, bx1 = 0, by1 = 0;
    for (let i = 0; i < n; i++) {
      const cx = Math.round(pos[i * 2] * ppm), cy = Math.round((WORLD_H - pos[i * 2 + 1]) * ppm);
      for (let oy = -rad; oy <= rad; oy++) { const y = cy + oy; if (y < 0 || y >= H) continue; for (let ox = -rad; ox <= rad; ox++) { const x = cx + ox; if (x < 0 || x >= W) continue; const w = 1 - (ox * ox + oy * oy) / ((rad + 1) * (rad + 1)); if (w > 0) g[y * W + x] += w; } }
      if (cx - rad < bx0) bx0 = cx - rad; if (cx + rad > bx1) bx1 = cx + rad; if (cy - rad < by0) by0 = cy - rad; if (cy + rad > by1) by1 = cy + rad;
    }
    bx0 = clamp(bx0, 0, W - 1); bx1 = clamp(bx1, 0, W - 1); by0 = clamp(by0, 0, H - 1); by1 = clamp(by1, 0, H - 1);
    for (let y = by0; y <= by1; y++) for (let x = bx0; x <= bx1; x++) {
      const v = g[y * W + x]; if (v < .9) continue; const o = (y * W + x) * 4, surf = (y > 0 && g[(y - 1) * W + x] < .9) || (y < H - 1 && g[(y + 1) * W + x] < .9) || (x > 0 && g[y * W + x - 1] < .9) || (x < W - 1 && g[y * W + x + 1] < .9);
      const deep = Math.min(v, 4) / 4; data[o] = surf ? 110 : 20 + 10 * (1 - deep); data[o + 1] = surf ? 150 : 44 + 14 * (1 - deep); data[o + 2] = surf ? 158 : 56 + 12 * (1 - deep); data[o + 3] = surf ? 230 : 205;
    }
    const u = this.bbox ? [Math.min(this.bbox[0], bx0), Math.min(this.bbox[1], by0), Math.max(this.bbox[2], bx1), Math.max(this.bbox[3], by1)] : [bx0, by0, bx1, by1];
    this.ctx.putImageData(this.img, 0, 0, u[0], u[1], u[2] - u[0] + 1, u[3] - u[1] + 1); this.bbox = [bx0, by0, bx1, by1];
  },
  at(x, y) { const px = Math.floor(x * this.ppm), py = Math.floor((WORLD_H - y) * this.ppm); if (px < 0 || py < 0 || px >= this.W || py >= this.H) return 0; return this.grid[py * this.W + px]; },
  wet(x, y) { return this.at(x, y) >= .9; },
  normal(x, y) { const e = .4, gx = this.at(x + e, y) - this.at(x - e, y), gy = this.at(x, y + e) - this.at(x, y - e), l = Math.hypot(gx, gy) || 1; return [-gx / l, -gy / l]; },
  depthAt(x, y) { let d = 0; for (let s = 0; s < 12 && this.wet(x, y + s * .5); s++) d = s * .5 + .5; return d; }
};

// ---------- particle helpers ----------
function particleArrays(ps) {
  const n = ps.GetParticleCount(); if (!n) return { n, pos: null, vel: null };
  return { n, pos: new Float32Array(B.HEAPF32.buffer, B.getPointer(ps.GetPositionBuffer()), n * 2), vel: new Float32Array(B.HEAPF32.buffer, B.getPointer(ps.GetVelocityBuffer()), n * 2) };
}
const PD = { def: null };
function spawnParticle(ps, x, y, vx, vy, flags, life) {
  if (ps.GetParticleCount() >= ps.GetMaxParticleCount() - 2) return -1;
  if (ps === P.water || ps === P.dirt) flags |= B.b2_fixtureContactFilterParticle;   // lets the running gear stay dry
  const d = PD.def; d.flags = flags; P.V1.Set(x, y); d.position = P.V1; P.V2.Set(vx, vy); d.velocity = P.V2; d.lifetime = life || 0;
  return ps.CreateParticle(d);
}

// ---------- world lifecycle ----------
function createPhysics(q) {
  if (P.world) { B.destroy(P.world); }
  P.bodyMap.clear();
  P.world = new B.b2World(new B.b2Vec2(0, 0));            // no global down: gravity is the islands' own
  // contact filter: Box2D's usual group/category rule for bodies, plus fixtures that water and loose soil pass through (tank running gear)
  P.clear = new Set();
  if (!P.cf) P.cf = Object.assign(new B.JSContactFilter(), {
    ShouldCollide(fa, fb) { const A = B.wrapPointer(fa, B.b2Fixture).GetFilterData(), gA = A.get_groupIndex(), cA = A.get_categoryBits(), mA = A.get_maskBits(), Bf = B.wrapPointer(fb, B.b2Fixture).GetFilterData(), gB = Bf.get_groupIndex();
      if (gA === gB && gA !== 0) return gA > 0; return (mA & Bf.get_categoryBits()) !== 0 && (Bf.get_maskBits() & cA) !== 0; },
    ShouldCollideFixtureParticleSystemIndex(fp) { return !P.clear.has(fp); },
    ShouldCollideParticleSystemIndexIndex() { return true; }
  });
  P.world.SetContactFilter(P.cf);
  if (!P.V1) { P.V1 = new B.b2Vec2(0, 0); P.V2 = new B.b2Vec2(0, 0); P.edge = new B.b2EdgeShape(); PD.def = new B.b2ParticleDef(); }
  const wd = new B.b2ParticleSystemDef(); wd.radius = q.r; wd.dampingStrength = .2; wd.maxCount = q.max; wd.destroyByAge = true; wd.pressureStrength = .0125; wd.surfaceTensionNormalStrength = .22; wd.surfaceTensionPressureStrength = .22;   // soft (compressible) and cohesive: it lies and beads, as in Dream Light
  P.water = P.world.CreateParticleSystem(wd);
  const fd = new B.b2ParticleSystemDef(); fd.radius = .3; fd.maxCount = Math.round(1400 * q.fx); fd.destroyByAge = true; fd.viscousStrength = .4; fd.dampingStrength = .4;
  P.fire = P.world.CreateParticleSystem(fd);
  const dd = new B.b2ParticleSystemDef(); dd.radius = .32; dd.maxCount = Math.round(1100 * q.fx); dd.destroyByAge = false; dd.dampingStrength = .15;
  P.dirt = P.world.CreateParticleSystem(dd);
  const sd = new B.b2ParticleSystemDef(); sd.radius = .6; sd.maxCount = Math.round(900 * q.fx); sd.destroyByAge = true; sd.gravityScale = -.035; sd.dampingStrength = .9; sd.pressureStrength = .02;
  P.smoke = P.world.CreateParticleSystem(sd);
  const cd = new B.b2ParticleSystemDef(); cd.radius = .8; cd.maxCount = Math.round(520 * q.fx); cd.destroyByAge = false; cd.gravityScale = 0; cd.dampingStrength = .6; cd.pressureStrength = .01;
  P.cloud = P.world.CreateParticleSystem(cd);
  // geyser matter: raw oil (burns when fire touches it), steam (rises), lava (heavy, hardens into rock)
  const od = new B.b2ParticleSystemDef(); od.radius = .3; od.maxCount = Math.round(800 * q.fx); od.destroyByAge = true; od.viscousStrength = .5; od.dampingStrength = .4; P.oil = P.world.CreateParticleSystem(od);
  const td = new B.b2ParticleSystemDef(); td.radius = .5; td.maxCount = Math.round(420 * q.fx); td.destroyByAge = true; td.dampingStrength = .9; P.steam = P.world.CreateParticleSystem(td);
  const ld = new B.b2ParticleSystemDef(); ld.radius = .34; ld.maxCount = Math.round(600 * q.fx); ld.destroyByAge = true; ld.viscousStrength = .8; ld.dampingStrength = .5; P.lava = P.world.CreateParticleSystem(ld);
  const wb = P.world.CreateBody(new B.b2BodyDef()); P.walls = wb; P.bodyMap.set(B.getPointer(wb), { kind: 'terrain' });
  // no walls, no floor: whatever leaves the rock falls into the void
}
// water: fill each crater below the island's rim line
const WATER_FLAGS = () => B.b2_waterParticle | B.b2_tensileParticle;
// water clings to vehicles: drops touching a tank take up its motion and are pulled onto it,
// so a wet tread carries water round and the sprockets fling it off
function waterCling() {
  const ps = P.water, n = ps.GetBodyContactCount(); if (!n) return; const own = new Map();
  for (const u of G.units) if (u.alive && u.def.main) for (const b of u.bodies) own.set(B.getPointer(b), b);
  const base = B.getPointer(ps.GetBodyContacts()), H32 = B.HEAP32, F32 = B.HEAPF32, { pos, vel } = particleArrays(ps);
  for (let i = 0; i < n; i++) { const o = (base + i * 28) >> 2, b = own.get(H32[o + 1]); if (!b) continue; const k = H32[o], nx = F32[o + 4], ny = F32[o + 5];
    P.V1.Set(pos[k * 2], pos[k * 2 + 1]); const bv = b.GetLinearVelocityFromWorldPoint(P.V1); vel[k * 2] += (bv.x - vel[k * 2]) * .3 + nx * .25; vel[k * 2 + 1] += (bv.y - vel[k * 2 + 1]) * .3 + ny * .25; }
}
function fillWater(islands) {
  const r = P.water.GetRadius(), st = r * 1.7;
  for (const I of islands) for (const c of I.cr || []) {
    for (let x = c.x - c.rc; x <= c.x + c.rc; x += st) for (let y = c.y - c.rc; y <= c.y + c.rc; y += st) {
      if (Math.hypot(x - c.x, y - c.y) > c.rc - .3 || Terrain.sample(x, y) > .3) continue;
      const dx = x - I.x, dy = y - I.y; if (Math.hypot(dx, dy) > I.rimAt(Math.atan2(dy, dx)) - c.rc * .32 - 1.2) continue;   // well below the lip: a lake, not a flood
      spawnParticle(P.water, x, y, 0, 0, WATER_FLAGS());
    }
  }
}

