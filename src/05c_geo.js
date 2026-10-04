// =====================================================================
// GEO. Geysers (after Dream Light's wells: a vent that emits on a timer and
// chokes when something covers it), oil that burns slowly once fire finds
// it, and matter that turns back into ground: lava cools into rock, resting
// water slowly leaves mineral crust, water meeting lava flashes into steam
// and stone at once.
// =====================================================================
const GEYSER_TYPES = {
  water: { sys: () => P.water, flags: () => WATER_FLAGS(), v: 12, every: [.35, .9], life: 0, real: .03, col: [111, 182, 216] },
  oil:   { sys: () => P.oil,   flags: () => B.b2_viscousParticle, v: 13, every: [.2, .55], life: 120, real: .08, col: [42, 36, 24] },   // the strong one: a black fountain that feeds slicks
  steam: { sys: () => P.steam, flags: () => 0, v: 7, every: [.2, .6], life: 7, real: .02, col: [216, 221, 226] },
  lava:  { sys: () => P.lava,  flags: () => B.b2_viscousParticle, v: 8, every: [.5, 1.2], life: 60, real: .025, col: [255, 122, 42] }
};
// per burst: 15 spray droplets that only look (short-lived, no physics body), and 1 in 100 that becomes real matter
const Geo = {
  vents: [], acc: 0, fx: [],
  generate(seed, map) {
    this.vents = []; this.fx = []; const r = mulberry32(seed + 777), kinds = Object.keys(GEYSER_TYPES);
    for (const I of map.islands) {
      const n = I.home != null ? 1 : 1 + (r() < .5 ? 1 : 0);
      for (let k = 0; k < n; k++) {
        for (let tries = 0; tries < 12; tries++) {
          const a = r() * TAU, [x, y] = Grav.surfacePoint(I, a); if ((I.cr || []).some(c => Math.hypot(x - c.x, y - c.y) < c.rc + 5)) continue;
          const [nx, ny] = surfaceNormal(x, y), type = kinds[(r() * kinds.length) | 0], T = GEYSER_TYPES[type];
          this.vents.push({ x: x - nx * .3, y: y - ny * .3, nx, ny, type, t: r() * T.every[1], next: lerp(T.every[0], T.every[1], r()), power: .55 + r() * .45, real: 0 }); break;
        }
      }
    }
  },
  // vents that sit under a spawned tank would be unfair: move them off
  clearAround(x, y, R) { this.vents = this.vents.filter(v => Math.hypot(v.x - x, v.y - y) > R); },
  update(dt) {
    for (const f of this.fx) { const [gx, gy] = Grav.at(f.x, f.y), w = f.steam ? -.3 : 1; f.vx += gx * w * dt; f.vy += gy * w * dt; f.x += f.vx * dt; f.y += f.vy * dt; f.life -= dt; if (!f.steam && Terrain.solid(f.x, f.y)) f.life = 0; }
    this.fx = this.fx.filter(f => f.life > 0);
    for (const v of this.vents) {
      v.t += dt; if (v.t < v.next) continue; const T = GEYSER_TYPES[v.type]; v.t = 0; v.next = lerp(T.every[0], T.every[1], Math.random());
      if (Terrain.solid(v.x + v.nx * .9, v.y + v.ny * .9)) continue;                    // choked: soil or a stone lies on the vent
      const ps = T.sys(), base = T.v * v.power;
      for (let i = 0; i < (v.type === 'oil' ? 26 : 18); i++) {
        const sp = rnd(-.35, .35), vel = base * rnd(.45, 1.15), dx = v.nx * Math.cos(sp) - v.ny * Math.sin(sp), dy = v.nx * Math.sin(sp) + v.ny * Math.cos(sp), px = v.x + v.nx * .8 + rnd(-.3, .3), py = v.y + v.ny * .8 + rnd(-.3, .3);
        if ((v.real += T.real || .01) >= 1) { v.real -= 1; spawnParticle(ps, px, py, dx * vel, dy * vel, T.flags(), T.life ? T.life * rnd(.7, 1.2) : 0); }   // the one real drop
        else if (this.fx.length < 2400) this.fx.push({ x: px, y: py, vx: dx * vel, vy: dy * vel, life: rnd(.4, 1.4), max: 1.4, c: T.col, steam: v.type === 'steam' });
      }
    }
    // every 1/5 s: oil ignition, lava harm, hardening
    if ((this.acc += dt) < .2) return; const step = this.acc; this.acc = 0;
    // heat map: fire and lava cells (1.5 m)
    const hot = new Set(), key = (x, y) => ((x / 1.5) | 0) * 4096 + ((y / 1.5) | 0);
    for (const ps of [P.fire, P.lava]) { const { n, pos } = particleArrays(ps); for (let i = 0; i < n; i++) hot.add(key(pos[i * 2], pos[i * 2 + 1])); }
    const near = (x, y) => { for (let ox = -1.5; ox <= 1.5; ox += 1.5) for (let oy = -1.5; oy <= 1.5; oy += 1.5) if (hot.has(key(x + ox, y + oy))) return true; return false; };
    // oil catches slowly, then burns for a long time
    { const { n, pos } = particleArrays(P.oil), lit = []; for (let i = 0; i < n; i++) if (near(pos[i * 2], pos[i * 2 + 1]) && Math.random() < step * .9) lit.push(i);
      for (const i of lit) { const x = pos[i * 2], y = pos[i * 2 + 1]; P.oil.DestroyParticle(i); spawnParticle(P.fire, x, y, 0, 0, B.b2_viscousParticle, rnd(28, 45)); } }
    // lava: burns what it touches, lights grass, cools into rock; water on lava flashes to steam and stone
    const water = particleArrays(P.water), wet = new Map(); for (let i = 0; i < water.n; i++) wet.set(key(water.pos[i * 2], water.pos[i * 2 + 1]), i);
    { const { n, pos, vel } = particleArrays(P.lava), gone = [];
      for (let i = 0; i < n; i++) {
        const x = pos[i * 2], y = pos[i * 2 + 1], sp = Math.hypot(vel[i * 2], vel[i * 2 + 1]);
        for (const u of G.units) if (u.alive && u.def.main) { const [ux, uy] = unitPos(u); if (Math.hypot(ux - x, uy - y) < 3.2) damageUnit(u, 2.2 * step, 'fire', true); }
        const wk = wet.get(key(x, y)); if (wk != null) { gone.push([i, x, y, .8]); P.water.DestroyParticle(wk); wet.delete(key(x, y)); spawnParticle(P.steam, x, y, rnd(-1, 1), rnd(-1, 1), 0, 5); continue; }
        const [ux, uy] = Grav.up(x, y); if (Terrain.solid(x - ux * .6, y - uy * .6)) { Terrain.scorchAt(x - ux * .6, y - uy * .6, .2 * step); if (sp < 1.2 && Math.random() < step * .12) gone.push([i, x, y, .7]); }
      }
      for (const [i, x, y, sc] of gone) { P.lava.DestroyParticle(i); Terrain.deposit(x, y, .3, sc); }
    }
    // tiny drops that slipped through the ground's edge are gone (they would glint inside the rock)
    { const { n, pos } = water; for (let i = n - 1; i >= 0; i--) if (Terrain.sample(pos[i * 2], pos[i * 2 + 1]) > .8) P.water.DestroyParticle(i); }
    // resting water leaves a mineral crust, very slowly (geysers grow their own terraces)
    { const { n, pos, vel } = water; for (let i = 0; i < n; i++) { if (Math.random() > step * .0012) continue; const x = pos[i * 2], y = pos[i * 2 + 1]; if (Math.hypot(vel[i * 2], vel[i * 2 + 1]) > .3) continue; const [ux, uy] = Grav.up(x, y); if (!Terrain.solid(x - ux * .7, y - uy * .7)) continue; P.water.DestroyParticle(i); Terrain.deposit(x, y, .2, .1); } }
  },
  draw(ctx, V) {
    const k = Math.max(1.5, .3 * V.z);
    for (const f of this.fx) { const a = clamp(f.life / .6, 0, 1) * (f.steam ? .25 : .8), [r, g, b] = f.c, s = f.steam ? k * 2.5 : k; ctx.fillStyle = `rgba(${r},${g},${b},${a})`; ctx.fillRect(V.sx(f.x) - s / 2, V.sy(f.y) - s / 2, s, s); }
  }
};
// outward normal of the ground, averaged along the surface (structures stand on this, not on the line to the centre)
function surfaceNormal(x, y) {
  let sx = 0, sy = 0; const [ux, uy] = Grav.up(x, y), tx = uy, ty = -ux;
  for (const o of [-1.4, 0, 1.4]) { const g = Grav.dropToGround(x + tx * o + ux * 1.5, y + ty * o + uy * 1.5, 6) || [x, y], [nx, ny] = Terrain.normal(g[0] - ux * .3, g[1] - uy * .3); sx += nx; sy += ny; }
  const l = Math.hypot(sx, sy); return l > 1e-3 ? [sx / l, sy / l] : [ux, uy];
}
// oil floats on water and rides the surface, like the burning oil does
function floatOnWater(ps) {
  const { n, pos, vel } = particleArrays(ps);
  for (let i = 0; i < n; i++) { const x = pos[i * 2], y = pos[i * 2 + 1]; const [ux, uy] = Grav.up(x, y);
    if (Water.wet(x, y)) { vel[i * 2] = vel[i * 2] * .85 + ux * 3.2; vel[i * 2 + 1] = vel[i * 2 + 1] * .85 + uy * 3.2; }
    else if (Water.wet(x - ux * .45, y - uy * .45)) { const vn = vel[i * 2] * ux + vel[i * 2 + 1] * uy, keep = Math.max(vn, -.3) * .5 - vn; vel[i * 2] += ux * keep; vel[i * 2 + 1] += uy * keep; } }
}
