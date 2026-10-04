// =====================================================================
// NATURE. Rocks (indestructible, dynamic once dug out), grass (visual, burns, marks
// scorched earth), soil ejecta (tectonics), smoke and cloud particles.
// =====================================================================
const Nature = {
  rocks: [], tick: 0,
  reset() { this.rocks = []; this.tick = 0; },
  generate(seed, map) {           // only the stones inside the islands: the surface is dressed after the tanks are placed (Nature.dress)
    this.reset(); const r = mulberry32(seed + 404);
    for (const I of map.islands) {
      const k = I.r / 30;
      // buried stones inside the island body (they show in the cut when dug out)
      for (let n = 0; n < NATURE.buried * k; n++) { const a = r() * TAU, dd = r() * I.r * .7, x = I.x + Math.cos(a) * dd, y = I.y + Math.sin(a) * dd, rad = (.8 + r() * 1.7) * SC * .6; let ok = true; for (let q = 0; q < 8; q++) { const b = q / 8 * TAU; if (!Terrain.solid(x + Math.cos(b) * (rad + 1.5), y + Math.sin(b) * (rad + 1.5))) ok = false; } if (ok) this.addRock(x, y, rad, true, r); }
    }
  },
  // after deployment: stones, barrels and crates laid on the surface at rest (asleep, aligned to the ground),
  // kept clear of tanks, structures, lamps and vents so nothing lands on anyone's placement
  dress(seed, map) {
    const r = mulberry32(seed + 919), clear = (x, y, R) => { for (const u of G.units) if (u.alive) { const [ux, uy] = unitPos(u); if (Math.hypot(ux - x, uy - y) < 10 + R) return false; }
      for (const b of G.blocks) if (b.alive) { const p = b.body.GetPosition(); if (Math.hypot(p.x - x, p.y - y) < 5 + R) return false; }
      for (const L of Lamps.list) { const p = L.body ? L.body.GetPosition() : L; if (Math.hypot(p.x - x, p.y - y) < 4 + R) return false; }
      for (const v of Geo.vents) if (Math.hypot(v.x - x, v.y - y) < 3 + R) return false; return true; };
    const spot = (I, R) => { for (let t = 0; t < 14; t++) { const [sx, sy] = Grav.surfacePoint(I, r() * TAU); if (Water.wet(sx, sy) || Water.wet(sx, sy + 1) || !clear(sx, sy, R)) continue; const [nx, ny] = surfaceNormal(sx, sy); return [sx, sy, nx, ny]; } return null; };
    const rest = b => { P.V2.Set(0, 0); b.SetLinearVelocity(P.V2); b.SetAngularVelocity(0); b.SetAwake(false); };
    for (const I of map.islands) {
      const k = I.r / 30;
      for (let n = 0; n < NATURE.rocks * k; n++) { const rad = (.5 + r() * 1.2) * SC * .6, s = spot(I, rad); if (!s) continue; const [sx, sy, nx, ny] = s, rock = this.addRock(sx + nx * rad * .58, sy + ny * rad * .58, rad, false, r); const a = Math.atan2(ny, nx) - Math.PI / 2; rock.ang = a; rock.body.SetTransform((P.V1.Set(sx + nx * rad * .58, sy + ny * rad * .58), P.V1), a); rest(rock.body); }
      for (let n = 0; n < NATURE.barrels * k; n++) { const w = .7 * SC * .6, h = 1 * SC * .6, s = spot(I, h); if (!s) continue; const [sx, sy, nx, ny] = s, a = Math.atan2(ny, nx) - Math.PI / 2, blk = spawnBlock('barrel', sx + nx * (h / 2 + .05), sy + ny * (h / 2 + .05), w, h); blk.body.SetTransform((P.V1.Set(sx + nx * (h / 2 + .05), sy + ny * (h / 2 + .05)), P.V1), a); rest(blk.body); }
      for (let n = 0; n < NATURE.crates * k; n++) { const sz = (.8 + r() * .6) * SC * .6, s = spot(I, sz); if (!s) continue; const [sx, sy, nx, ny] = s, a = Math.atan2(ny, nx) - Math.PI / 2, blk = spawnBlock(r() < .6 ? 'wood' : 'concrete', sx + nx * (sz / 2 + .05), sy + ny * (sz / 2 + .05), sz, sz); blk.body.SetTransform((P.V1.Set(sx + nx * (sz / 2 + .05), sy + ny * (sz / 2 + .05)), P.V1), a); rest(blk.body); }
    }
    this.dressed = true;
  },
  addRock(x, y, rad, buried, r) {
    const verts = []; const nv = 7 + (r() * 4 | 0); for (let i = 0; i < nv; i++) { const a = i / nv * TAU + r() * .4; verts.push(Math.cos(a) * rad * (.75 + r() * .35), Math.sin(a) * rad * (.7 + r() * .3)); }
    const rock = { x, y, rad, verts, buried, body: null, ang: r() * TAU, shade: 30 + r() * 18 }; this.makeRockBody(rock, x, y, rock.ang); this.rocks.push(rock); return rock;
  },
  makeRockBody(rock, x, y, ang) {
    if (rock.body) { P.bodyMap.delete(B.getPointer(rock.body)); P.world.DestroyBody(rock.body); }
    const b = mkBody(rock.buried ? B.b2_staticBody : B.b2_dynamicBody, x, y, { angularDamping: .4 }); b.SetTransform(P.V1.Set(x, y) || P.V1, ang);
    addFix(b, boxShape(rock.rad * .72, rock.rad * .55), 2.6, .9); addFix(b, circleShape(rock.rad * .62), 2.6, .9);
    rock.body = b; P.bodyMap.set(B.getPointer(b), { kind: 'rock', rock, r0: .1 });
  },
  // stones stay locked in the soil until the soil around them is gone
  update(dt) {
    if ((this.tick++ % 30) !== 0) return;
    for (const rk of this.rocks) {
      const p = rk.body.GetPosition(); let open = 0;
      for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; if (!Terrain.solid(p.x + Math.cos(a) * (rk.rad + .5), p.y + Math.sin(a) * (rk.rad + .5))) open++; }
      if (rk.buried && open >= 3) { rk.buried = false; this.makeRockBody(rk, p.x, p.y, rk.body.GetAngle()); rk.body.SetAwake(true); }
      else if (!rk.buried && open === 0) { rk.buried = true; this.makeRockBody(rk, p.x, p.y, rk.body.GetAngle()); }
      if (p.x < -200 || p.x > WORLD_W + 200 || p.y < -200 || p.y > WORLD_H + 200) { P.bodyMap.delete(B.getPointer(rk.body)); P.world.DestroyBody(rk.body); rk.gone = true; }   // lost to the void
    }
    this.rocks = this.rocks.filter(r => !r.gone);
    const lift = (b, h, righten) => { const p = b.GetPosition(); if (!(Terrain.solid(p.x, p.y) && Terrain.solid(p.x, p.y) )) return; const [ux, uy] = Grav.up(p.x, p.y); let x = p.x, y = p.y, k = 0; while (Terrain.solid(x, y) && k++ < 80) { x += ux * .5; y += uy * .5; } P.V1.Set(x + ux * h, y + uy * h); b.SetTransform(P.V1, righten ? Math.atan2(uy, ux) - Math.PI / 2 : b.GetAngle()); P.V1.Set(0, 0); b.SetLinearVelocity(P.V1); };
    for (const blk of G.blocks) if (blk.alive) lift(blk.body, Math.max(blk.w, blk.h) * .5 + .2);
    for (const u of G.units) if (u.alive && u.def.main && u.type === 'tank' && Terrain.solid(...unitPos(u))) { const [x, y] = unitPos(u), [ux, uy] = Grav.up(x, y); let px = x, py = y, k = 0; while (Terrain.solid(px, py) && k++ < 80) { px += ux * .5; py += uy * .5; } placeUnit(u, px + ux * 1.4 * SC, py + uy * 1.4 * SC, Math.atan2(uy, ux) - Math.PI / 2); }
  },
  draw(ctx, V, buried) {
    const x0 = V.wx(-40), x1 = V.wx(V.W + 40);
    for (const rk of this.rocks) {
      if (!!rk.buried !== !!buried) continue; const p = rk.body.GetPosition(); if (p.x < x0 - 5 || p.x > x1 + 5) continue; const a = rk.body.GetAngle(), c = Math.cos(a), s = Math.sin(a);
      ctx.beginPath(); for (let i = 0; i < rk.verts.length; i += 2) { const vx = rk.verts[i], vy = rk.verts[i + 1], X = V.sx(p.x + vx * c - vy * s), Y = V.sy(p.y + vx * s + vy * c); i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y); } ctx.closePath();
      const g = rk.shade * (rk.buried ? .8 : 1); ctx.fillStyle = `rgb(${g + 6},${g + 4},${g + 2})`; ctx.fill(); ctx.strokeStyle = rk.buried ? 'rgba(0,0,0,.35)' : 'rgba(200,195,185,.18)'; ctx.lineWidth = 1; ctx.stroke();
    }
  }
};

// ---------- grass: on every open surface node, blades lean along the local "up" ----------
const Grass = {
  nodes: [],
  rebuild() {
    const d = Terrain.d, out = [];
    for (let j = 1; j < GY; j++) for (let i = 1; i < GX; i++) { const k = j * NX + i; if (d[k] <= .5) continue; if (d[k - 1] <= .5 || d[k + 1] <= .5 || d[k - NX] <= .5 || d[k + NX] <= .5) out.push(k); }
    this.nodes = out;
  },
  draw(ctx, V) {
    const t = Clock.t, wind = G.wind, x0 = V.cx - V.W / V.z, x1 = V.cx + V.W / V.z, y0 = V.cy - V.H / V.z, y1 = V.cy + V.H / V.z, skip = V.z < 3 ? 3 : V.z < 6 ? 2 : 1;
    ctx.lineWidth = Math.max(1, V.z * .08);
    for (const pass of [0, 1]) {
      ctx.strokeStyle = pass ? 'rgba(78,86,54,.85)' : 'rgba(44,52,34,.95)'; ctx.beginPath();
      for (let n = pass; n < this.nodes.length; n += skip * 2) {
        const k = this.nodes[n], i = k % NX, j = (k / NX) | 0, x = i * CELL, y = j * CELL; if (x < x0 || x > x1 || y < y0 || y > y1) continue;
        if (Terrain.sc[k] > .3 || Terrain.lo[k] || Terrain.d[k] <= .5) continue; const [ux, uy] = Grav.up(x, y); if (Terrain.solid(x + ux * .6, y + uy * .6) || Water.wet(x + ux * .6, y + uy * .6)) continue;
        const h = (.5 + ((i * 2654435761 + j * 97) >>> 0) % 100 / 100) * SC * .55, s = Math.sin(t * 1.7 + i * .37 + j * .21) * .2 + wind * .05, tx = uy, ty = -ux;
        ctx.moveTo(V.sx(x), V.sy(y)); ctx.lineTo(V.sx(x + (ux + tx * s) * h), V.sy(y + (uy + ty * s) * h));
      }
      ctx.stroke();
    }
  }
};

// ---------- soil ejecta: grains fly, land, and become terrain again ----------
const Dirt = {
  Q: .42,                                                  // m² of soil per grain
  eject(x, y, res, scorch) {
    const { mass, pts } = res; if (mass <= 0) return; let grains = Math.min(Math.floor(mass * .8 / this.Q), 220), rim = mass - grains * this.Q;
    for (let g = 0; g < grains; g++) {
      if (!pts.length) { rim += this.Q; continue; } const k = (Math.random() * pts.length / 2 | 0) * 2, px = pts[k] + rnd(-.2, .2), py = pts[k + 1] + rnd(-.2, .2);
      const [ux, uy] = Grav.up(x, y), lift = Math.sqrt(res.mass) * .5 + .6, dx = px - x + ux * lift, dy = py - y + uy * lift, d = Math.hypot(dx, dy) || 1, v = rnd(5, 17) * Math.sqrt(SC) * (1.2 - Math.min(1, d / 8) * .4), kick = rnd(2, 6);
      if (spawnParticle(P.dirt, px, py, dx / d * v + ux * kick, dy / d * v + uy * kick, B.b2_powderParticle) < 0) rim += this.Q;
    }
    // what could not fly is shoved into a rim
    const n = Math.max(0, Math.round(rim / this.Q)), [ux, uy] = Grav.up(x, y); for (let i = 0; i < n; i++) { const a = rnd(-1, 1) * (Math.sqrt(mass) * .9 + 1); Terrain.deposit(x + uy * a + ux * 2, y - ux * a + uy * 2, this.Q, scorch * .5); }
  },
  settle() {
    const { n, pos, vel } = particleArrays(P.dirt); if (!n) return; let touched = null;
    for (let i = 0; i < n; i++) {
      const x = pos[i * 2], y = pos[i * 2 + 1], vx = vel[i * 2], vy = vel[i * 2 + 1];
      if (x < -200 || x > WORLD_W + 200 || y < -200 || y > WORLD_H + 200) { P.dirt.DestroyParticle(i); continue; }
      if (vx * vx + vy * vy > 3 && !Terrain.solid(x, y)) continue;
      const [gx0, gy0] = Grav.up(x, y); if (!(Terrain.solid(x - gx0 * .55, y - gy0 * .55) || Terrain.solid(x, y))) continue;
      let onUnit = false; for (const u of G.units) { if (!u.alive || !u.def.main) continue; const [ux, uy] = unitPos(u); const ddx = x - ux, ddy = y - uy, dd = Math.hypot(ddx, ddy); if (dd < 3.8) { onUnit = true; vel[i * 2] += ddx / (dd || 1) * 3; vel[i * 2 + 1] += ddy / (dd || 1) * 3; break; } }
      if (onUnit) continue;
      Terrain.deposit(x, y, this.Q, .6); P.dirt.DestroyParticle(i); touched = touched ? [Math.min(touched[0], x), Math.max(touched[1], x)] : [x, x];
    }
    if (touched) unburyWater(touched[0] - 3, touched[1] + 3);
  }
};
// water trapped inside freshly deposited soil is lifted back to the surface
function unburyWater(x0, x1) {
  for (const ps of [P.water, P.fire]) { const { n, pos } = particleArrays(ps); for (let i = 0; i < n; i++) { let x = pos[i * 2], y = pos[i * 2 + 1]; if (x < x0 || x > x1 || !Terrain.solid(x, y)) continue; const [ux, uy] = Grav.up(x, y); let k = 0; while (Terrain.solid(x, y) && k++ < 40) { x += ux * .4; y += uy * .4; } pos[i * 2] = x + ux * .2; pos[i * 2 + 1] = y + uy * .2; } }
}

// ---------- smoke + clouds: one density field, used by optics, sight and render ----------
const Smoke = {
  W: 0, H: 0, g: null, gc: null, tmp: null, any: false, canvas: document.createElement('canvas'), frame: 0,
  init() { this.W = WORLD_W / 2 | 0; this.H = WORLD_H / 2 | 0; const N = this.W * this.H; this.g = new Float32Array(N); this.gc = new Float32Array(N); this.tmp = new Float32Array(N); this.canvas.width = this.W; this.canvas.height = this.H; this.ctx = this.canvas.getContext('2d'); this.img = this.ctx.createImageData(this.W, this.H); },
  puff(x, y, n, life, heat = 0) { const [ux, uy] = Grav.up(x, y); for (let i = 0; i < n; i++) { const v = rnd(.5, 2) + heat, s = rnd(-1, 1); spawnParticle(P.smoke, x + rnd(-.6, .6), y + rnd(-.6, .6), ux * v + uy * s + G.wind * .2, uy * v - ux * s, 0, life * rnd(.7, 1.3)); } },
  // cloud deck per weather; particles are herded toward a band and wrapped at the map edges
  // drifting dust clouds in the void between islands
  seed() {
    const w = G.weather, n = { clear: .2, haze: .45, storm: .8 }[w.id] ?? .3, cnt = Math.round(P.cloud.GetMaxParticleCount() * .85 * n); this.band = [0, WORLD_H];
    for (let i = 0; i < cnt; i++) { const cx = rnd(4, WORLD_W - 4), cy = rnd(4, WORLD_H - 4); if (Terrain.solid(cx, cy) || Terrain.sample(cx, cy) > .05) continue; spawnParticle(P.cloud, cx, cy, 0, 0, 0); }
  },
  // SOLAR WIND: light gas particles stream in from the upwind edge, flow around the islands, leave downwind
  herd() {
    const { n, pos, vel } = particleArrays(P.cloud), w = G.wind, target = Math.round(P.cloud.GetMaxParticleCount() * ({ clear: .35, haze: .6, storm: .95 }[G.weather.id] ?? .4));
    for (let i = 0; i < n; i++) { vel[i * 2] += (w * 1.4 - vel[i * 2]) * .04; vel[i * 2 + 1] *= .97; const x = pos[i * 2], y = pos[i * 2 + 1]; if (x < -12 || x > WORLD_W + 12 || y < -40 || y > WORLD_H + 40) P.cloud.DestroyParticle(i); }
    if (Math.abs(w) > .2) for (let k = 0; k < 5 && n + k < target; k++) { const x = w > 0 ? -8 : WORLD_W + 8, y = rnd(-20, WORLD_H + 20); if (!Terrain.solid(x, y)) spawnParticle(P.cloud, x, y, w * 1.4, 0, 0); }
  },
  update() {
    const W = this.W, H = this.H, g = this.g, gc = this.gc; g.fill(0); gc.fill(0); let any = 0;
    const splat = (ps, arr, wgt) => { const { n, pos } = particleArrays(ps); for (let i = 0; i < n; i++) { const fx = pos[i * 2] / 2 - .5, fy = pos[i * 2 + 1] / 2 - .5, ix = fx | 0, iy = fy | 0; if (ix < 0 || iy < 0 || ix >= W - 1 || iy >= H - 1) continue; const u = fx - ix, v = fy - iy, k = iy * W + ix; arr[k] += (1 - u) * (1 - v) * wgt; arr[k + 1] += u * (1 - v) * wgt; arr[k + W] += (1 - u) * v * wgt; arr[k + W + 1] += u * v * wgt; any++; } };
    splat(P.smoke, g, .55); splat(P.cloud, gc, .38); this.any = any > 0; if (!any) return;
    // one box blur keeps the field smooth enough for gradients
    const t = this.tmp; for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) { const k = y * W + x; t[k] = (g[k] * 4 + g[k - 1] + g[k + 1] + g[k - W] + g[k + W]) / 8; } g.set(t);
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) { const k = y * W + x; t[k] = (gc[k] * 4 + gc[k - 1] + gc[k + 1] + gc[k - W] + gc[k + W]) / 8; } gc.set(t);
    if ((this.frame++ & 1) === 0) this.paint();
  },
  paint() {
    const W = this.W, H = this.H, d = this.img.data, g = this.g, gc = this.gc, lum = G.day.lum > .5 ? 1 : G.day.lum > .05 ? .45 : .18, fog = G.weather.fog;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const k = y * W + x, o = ((H - 1 - y) * W + x) * 4, s = g[k], c = gc[k] * .12, tot = s + c; if (tot < .02) { d[o + 3] = 0; continue; }
      const m = c / tot; d[o] = (14 + (fog[0] * .8 - 14) * m) * lum; d[o + 1] = (13 + (fog[1] * .8 - 13) * m) * lum; d[o + 2] = (12 + (fog[2] * .8 - 12) * m) * lum; d[o + 3] = 255 * (1 - Math.exp(-tot * 1.3)) * .9;
    }
    this.ctx.putImageData(this.img, 0, 0);
  },
  at(x, y) {
    const fx = x / 2 - .5, fy = y / 2 - .5, ix = Math.floor(fx), iy = Math.floor(fy); if (ix < 0 || iy < 0 || ix >= this.W - 1 || iy >= this.H - 1) return 0;
    const u = fx - ix, v = fy - iy, k = iy * this.W + ix, g = this.g, c = this.gc;
    return ((g[k] + c[k]) * (1 - u) + (g[k + 1] + c[k + 1]) * u) * (1 - v) + ((g[k + this.W] + c[k + this.W]) * (1 - u) + (g[k + this.W + 1] + c[k + this.W + 1]) * u) * v;
  },
  grad(x, y) { const e = 1; return [(this.at(x + e, y) - this.at(x - e, y)) / (2 * e), (this.at(x, y + e) - this.at(x, y - e)) / (2 * e)]; },
  // optical depth along a sight line (smoke screens are emergent)
  tau(x0, y0, x1, y1) { if (!this.any) return 0; const d = Math.hypot(x1 - x0, y1 - y0), n = Math.max(1, Math.ceil(d / 2)); let t = 0; for (let i = 1; i < n; i++) t += this.at(lerp(x0, x1, i / n), lerp(y0, y1, i / n)) * (d / n) * .32; return t; }
};

