// =====================================================================
// GRAVITY. There is no global "down". Every island pulls with its own
// mass, 2D Newton (force falls as 1/r), so:
//  - near an island you are pressed to its surface, on top or underneath;
//  - far away all islands pull together and shots bend between them;
//  - soil thrown from one island onto another moves mass, and the field
//    follows: a stripped island pulls weaker.
// The field is kept on a 4 m grid and updated incrementally: when soil
// moves, only the changed mass blocks are re-added (a few thousand ops).
// =====================================================================
const Grav = {
  MB: 4, PAD: 64, EPS2: 9, K: 1, dirty: false, last: -1,
  init() {
    const MB = this.MB; this.MW = Math.ceil(WORLD_W / MB); this.MH = Math.ceil(WORLD_H / MB);
    this.FW = Math.ceil((WORLD_W + this.PAD * 2) / MB) + 1; this.FH = Math.ceil((WORLD_H + this.PAD * 2) / MB) + 1;
    this.mass = new Float32Array(this.MW * this.MH); this.gx = new Float32Array(this.FW * this.FH); this.gy = new Float32Array(this.FW * this.FH); this.fx = new Float32Array(this.FW * this.FH); this.fy = new Float32Array(this.FW * this.FH); this.K2 = 1; this.po = [0, 0];
    this.out = [0, -9.81]; this.uo = [0, 1]; this.K = 1; this.M = 0; this.cx = WORLD_W / 2; this.cy = WORLD_H / 2; this.last = -1; this.dirty = false;
  },
  // soil area inside one mass block (m²), from the terrain density nodes
  blockMass(bi, bj) {
    const n = this.MB / CELL, d = Terrain.d; let m = 0;
    for (let j = bj * n; j < bj * n + n; j++) { if (j > GY) break; for (let i = bi * n; i < bi * n + n; i++) { if (i > GX) break; const v = d[j * NX + i]; if (v > .5) m += 1; } }
    return m * CELL * CELL;
  },
  // add the pull of mass dm sitting in block (bi,bj) to every field cell
  splat(bi, bj, dm) {
    const MB = this.MB, bx = (bi + .5) * MB, by = (bj + .5) * MB, FW = this.FW, FH = this.FH, gx = this.gx, gy = this.gy, fx = this.fx, fy = this.fy, e2 = this.EPS2, x0 = -this.PAD, y0 = -this.PAD;
    for (let j = 0; j < FH; j++) { const dy = by - (y0 + j * MB); for (let i = 0; i < FW; i++) { const dx = bx - (x0 + i * MB), r2 = dx * dx + dy * dy + e2, q = dm / (r2 * Math.sqrt(r2)), k = j * FW + i, q2 = dm / r2; fx[k] += dx * q2; fy[k] += dy * q2; /* near field 1/r² holds vehicles; far field 1/r bends projectiles */ gx[k] += dx * q; gy[k] += dy * q; } }
  },
  build() {
    this.gx.fill(0); this.gy.fill(0); this.fx.fill(0); this.fy.fill(0); let M = 0, sx = 0, sy = 0;
    for (let bj = 0; bj < this.MH; bj++) for (let bi = 0; bi < this.MW; bi++) { const m = this.blockMass(bi, bj); this.mass[bj * this.MW + bi] = m; if (m > 0) { this.splat(bi, bj, m); M += m; sx += (bi + .5) * this.MB * m; sy += (bj + .5) * this.MB * m; } }
    this.M = M; this.cx = sx / (M || 1); this.cy = sy / (M || 1); this.last = Clock.t; this.dirty = false;
  },
  // make the surface of a home island feel like ordinary 9.81
  calibrate(x, y) { this.K = 1; this.K2 = 1; const [gx, gy] = this.raw(x, y); this.K = 9.81 / (Math.hypot(gx, gy) || 1); const [fx, fy] = this.far(x, y); this.K2 = 9.81 / (Math.hypot(fx, fy) || 1); },
  far(x, y) {
    const i0 = (x + this.PAD) / this.MB, j0 = (y + this.PAD) / this.MB, i = Math.floor(i0), j = Math.floor(j0), o = this.po;
    if (i < 0 || j < 0 || i >= this.FW - 1 || j >= this.FH - 1) { const dx = this.cx - x, dy = this.cy - y, q = this.M / (dx * dx + dy * dy + 1); o[0] = dx * q * this.K2; o[1] = dy * q * this.K2; return o; }
    const u = i0 - i, v = j0 - j, k = j * this.FW + i, FW = this.FW, a = this.fx, b = this.fy;
    o[0] = ((a[k] * (1 - u) + a[k + 1] * u) * (1 - v) + (a[k + FW] * (1 - u) + a[k + FW + 1] * u) * v) * this.K2;
    o[1] = ((b[k] * (1 - u) + b[k + 1] * u) * (1 - v) + (b[k + FW] * (1 - u) + b[k + FW + 1] * u) * v) * this.K2;
    return o;
  },
  // what a projectile feels: the near field plus a share of the long-reach field (per weapon: gN, gF)
  atP(x, y, w) { const [nx, ny] = this.raw(x, y), a = (w && w.gN) ?? 1, b = (w && w.gF) ?? .6; const [fx, fy] = this.far(x, y), o = this.out; o[0] = nx * a + fx * b; o[1] = ny * a + fy * b; return o; },
  // re-add only the blocks whose soil changed since the last pass
  update() {
    if (!this.dirty || Clock.t - this.last < .35) return; this.dirty = false; this.last = Clock.t; let M = 0, sx = 0, sy = 0;
    for (let bj = 0; bj < this.MH; bj++) for (let bi = 0; bi < this.MW; bi++) {
      const k = bj * this.MW + bi, m = this.blockMass(bi, bj), dm = m - this.mass[k]; if (Math.abs(dm) > .01) { this.splat(bi, bj, dm); this.mass[k] = m; }
      if (m > 0) { M += m; sx += (bi + .5) * this.MB * m; sy += (bj + .5) * this.MB * m; }
    }
    this.M = M; this.cx = sx / (M || 1); this.cy = sy / (M || 1); Grass.rebuild();
  },
  raw(x, y) {
    const fx = (x + this.PAD) / this.MB, fy = (y + this.PAD) / this.MB, i = Math.floor(fx), j = Math.floor(fy), o = this.out;
    if (i < 0 || j < 0 || i >= this.FW - 1 || j >= this.FH - 1) { const dx = this.cx - x, dy = this.cy - y, r2 = dx * dx + dy * dy + 1, q = this.M / (r2 * Math.sqrt(r2)); o[0] = dx * q * this.K; o[1] = dy * q * this.K; return o; }
    const u = fx - i, v = fy - j, k = j * this.FW + i, FW = this.FW, gx = this.gx, gy = this.gy;
    o[0] = ((gx[k] * (1 - u) + gx[k + 1] * u) * (1 - v) + (gx[k + FW] * (1 - u) + gx[k + FW + 1] * u) * v) * this.K;
    o[1] = ((gy[k] * (1 - u) + gy[k + 1] * u) * (1 - v) + (gy[k + FW] * (1 - u) + gy[k + FW + 1] * u) * v) * this.K;
    return o;
  },
  at(x, y) { return this.raw(x, y); },                       // shared array: read it right away
  up(x, y) { const [gx, gy] = this.raw(x, y), l = Math.hypot(gx, gy), o = this.uo; if (l < 1e-4) { o[0] = 0; o[1] = 1; } else { o[0] = -gx / l; o[1] = -gy / l; } return o; },
  // every step: bodies get m·g, particles get g·weight into their velocity buffers
  apply(dt) {
    const push = (b, wake) => { const p = b.GetPosition(), [gx, gy] = this.raw(p.x, p.y), m = b.GetMass(); P.V1.Set(gx * m, gy * m); b.ApplyForceToCenter(P.V1, wake); };
    if (G.phase !== 'deploy') for (const u of G.units) if (u.alive) for (const b of u.bodies) push(b, false);
    for (const k of G.blocks) if (k.alive) push(k.body, false);
    for (const r of Nature.rocks) if (!r.buried) push(r.body, false);
    for (const L of Lamps.list) if (L.body) { const p = L.body.GetPosition(), [gx, gy] = this.raw(p.x, p.y), m = L.body.GetMass() * .1; P.V1.Set(gx * m, gy * m); L.body.ApplyForceToCenter(P.V1, true); }
    for (const s of G.shots) if (s.body && !s.dead && s.kind !== 'rocket') { const p = s.body.GetPosition(), [gx, gy] = this.atP(p.x, p.y, s.w), m = s.body.GetMass(); P.V1.Set(gx * m, gy * m); s.body.ApplyForceToCenter(P.V1, true); }
    for (const [ps, w] of [[P.water, 1], [P.fire, .9], [P.dirt, 1], [P.smoke, .05], [P.oil, .9], [P.lava, 1.25], [P.steam, -.3]]) {
      const { n, pos, vel } = particleArrays(ps); if (!n) continue; const k = w * dt;
      for (let i = 0; i < n; i++) { const [gx, gy] = this.raw(pos[i * 2], pos[i * 2 + 1]); vel[i * 2] += gx * k; vel[i * 2 + 1] += gy * k; }
    }
  },
  // walk from an island's centre outward along an angle to its surface
  surfacePoint(I, a) { let d = 0; const c = Math.cos(a), s = Math.sin(a); while (d < I.r * 2.5 && (Terrain.solid(I.x + c * d, I.y + s * d) || d < 2)) d += .25; return [I.x + c * d, I.y + s * d]; },
  // from any point, fall along gravity until ground (for taps and placements)
  dropToGround(x, y, maxD = 60) { for (let k = 0; k < maxD / .4; k++) { const [ux, uy] = this.up(x, y); if (Terrain.solid(x - ux * .4, y - uy * .4)) return [x, y]; x -= ux * .4; y -= uy * .4; } return null; }
};
