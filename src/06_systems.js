// =====================================================================
// WEAPONS. A weapon is data; its category owns the behaviour.
// `on` lists the platforms that carry it; `delayed` weapons hand the turn
// over the moment they launch (the enemy gets to react in real time).
// =====================================================================
const RT2 = Math.SQRT2;
WEAPONS.add('he', { name: 'Фугас', cat: 'shell', on: ['tank'], speed: 64 * RT2, drag: .0021 / SC, blast: 3.6 * SC, dmg: 176, gN: 1.2, gF: 1.1, ammo: Infinity, glyph: '●' });
// rocket: leaves the tube slow, then its motor burns for a time set by the power lever; after burnout it coasts through the islands' gravity
WEAPONS.add('rocket', { name: 'Ракета', cat: 'rocket', on: ['tank'], speed: 16, thrust: 46, burnMin: .15, burnMax: 1.3, drag: .0016 / SC, gN: 1.1, gF: .9, tscale: 4, blast: 3.4 * SC, dmg: 50, ammo: 3, glyph: '➶' });
// lantern: no motor, no warhead, flies as launched; a Dream Light lamp that keeps shining where it lands
// guided rocket: the motor burns long and its thrust vector is steered by hand (two buttons); tap = a nudge, hold = faster, 2 s = it tumbles
WEAPONS.add('guided', { name: 'Управляемая ракета', cat: 'rocket', on: ['tank'], guided: true, ai: false, speed: 14, thrust: 30, burnMin: 7, burnMax: 15, drag: .012, gN: 1.1, gF: .9, tscale: 2, blast: 3.2 * SC, dmg: 60, ammo: 2, glyph: '↝' });
WEAPONS.add('lantern', { name: 'Ракета-фонарь', cat: 'shell', on: ['tank'], speed: 60 * RT2, drag: .0021 / SC, lamp: true, ammo: 3, glyph: '✺' });
WEAPONS.add('laser', { name: 'Лазер-резак', cat: 'laser', on: ['tank', 'sub'], dps: 46, dur: 2.2, ammo: 2, ammoSub: Infinity, glyph: '∿' });
WEAPONS.add('flamer', { name: 'Огнемёт', cat: 'stream', on: ['tank'], speed: 22.6 * SC, dur: 3.6, rate: 90, spread: .014, dmgMul: 2, ammo: 3, glyph: '≋' });
const AIR_DRAG_WATER = .09 / SC;
const DEBRIS = { blast: .8 * SC, dmg: 8 };
const ROCKET_FX = { t: 0 };        // what a downed drone's warhead does

function muzzleSpeed(u, w) { return w.speed * (u.side === 0 || G.mode.id === 'hotseat' ? 1 + upLevel('barrel') * .05 : 1); }
const buffed = u => u.side === 0 || G.mode.id === 'hotseat';

const SR = { cb: null, hit: null, self: null };
function shellRay(x0, y0, x1, y1, self, owner = null) {
  if (!SR.cb) SR.cb = Object.assign(new B.JSRayCastCallback(), {
    ReportFixture(fp, pp, np, fr) { const f = B.wrapPointer(fp, B.b2Fixture), b = f.GetBody(); if (B.getPointer(b) === B.getPointer(SR.self)) return -1; const info = P.bodyMap.get(B.getPointer(b)); if (!info || info.kind === 'shot' || (SR.owner && info.kind === 'unit' && info.u === SR.owner)) return -1; SR.hit = info; const q = B.wrapPointer(pp, B.b2Vec2); SR.px = q.x; SR.py = q.y; return fr; },
    ReportParticle() { return -1; }, ShouldQueryParticleSystem() { return false; }
  });
  SR.hit = null; SR.px = SR.py = null; SR.self = self; SR.owner = owner; P.V1.Set(x0, y0); P.V2.Set(x1, y1); if (Math.hypot(x1 - x0, y1 - y0) > .01) P.world.RayCast(SR.cb, P.V1, P.V2); return SR.hit;
}
WEAPON_CATS.add('shell', {
  name: 'Снаряды', desc: 'Тело с аэродинамическим сопротивлением и ветром',
  fire(u, w, ang, pow, extra = {}) {
    let [mx, my] = u.def.muzzle(u); mx += Math.cos(ang) * .45; my += Math.sin(ang) * .45; const sp = muzzleSpeed(u, w) * pow;
    const b = mkBody(B.b2_dynamicBody, mx, my, { bullet: true }); addFix(b, circleShape(.16 * SC), 9, .3); setGroup(b, -(u.side + 1));
    P.V1.Set(Math.cos(ang) * sp, Math.sin(ang) * sp); b.SetLinearVelocity(P.V1);
    const s = Object.assign({ kind: 'shell', w, owner: u, body: b, t: 0, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, trail: [] }, extra);
    P.bodyMap.set(B.getPointer(b), { kind: 'shot', s }); G.shots.push(s); if (w.lamp) s.lamp = Lamps.add(mx, my, u.side, { follow: b, turns: 4 }); SFX.shot('shell'); return s;
  },
  prestep(s, dt) { // quadratic drag relative to moving air, then remember expected velocity
    const v = s.body.GetLinearVelocity(), p = s.body.GetPosition(), inW = Water.wet(p.x, p.y), k = inW ? AIR_DRAG_WATER : s.w.drag;
    const rx = v.x - (inW ? 0 : G.wind), ry = v.y, sp = Math.hypot(rx, ry), nvx = v.x - k * sp * rx * dt, nvy = v.y - k * sp * ry * dt;
    P.V1.Set(nvx, nvy); s.body.SetLinearVelocity(P.V1); const [gx, gy] = Grav.atP(p.x, p.y, s.w); s.ex = nvx + gx * dt; s.ey = nvy + gy * dt;
    
  },
  poststep(s, dt) {
    s.t += dt; if (s.oob) return this.remove(s); const p = s.body.GetPosition(), v = s.body.GetLinearVelocity(); s.trail.push(p.x, p.y); if (s.trail.length > 80) s.trail.splice(0, 2);
    const jolt = Math.hypot(v.x - s.ex, v.y - s.ey), wet = Water.wet(p.x, p.y);
    if (wet && !s.splashed) { s.splashed = true; SFX.splash(1); pushParticles(p.x, p.y, 2.2 * SC, 7); }
    let hit = (wet && s.t > .15) || Terrain.solid(p.x, p.y);
    if (!hit && jolt > 5) {
      // a jolt is a hit only if a solid fixture is really there; clouds and smoke particles just get ignored
      const sp = Math.hypot(s.ex, s.ey) || 1, L = sp * dt + .6 * SC; hit = !!shellRay(s.lx ?? p.x, s.ly ?? p.y, p.x + s.ex / sp * L, p.y + s.ey / sp * L, s.body, s.owner);
      if (!hit) { P.V1.Set(s.ex, s.ey); s.body.SetLinearVelocity(P.V1); }
    } else if (!hit && jolt > .02) { P.V1.Set(s.ex, s.ey); s.body.SetLinearVelocity(P.V1); }   // particles (dust, smoke) never nudge a shell; it parts them instead
    if (hit && s.w.lamp) { Lamps.land(s, s.lx ?? p.x, s.ly ?? p.y); return this.remove(s); }
    if (hit) { explode(p.x, p.y, s.w, s.owner, Math.atan2(v.y, v.x)); return this.remove(s); }
    s.lx = p.x; s.ly = p.y;
    if (s.t > 40) { if (s.w.lamp) { Lamps.land(s, p.x, p.y); return this.remove(s); } explode(p.x, p.y, s.w, s.owner); return this.remove(s); }       // an orbiting shell gives up eventually
    if (p.x < -250 || p.x > WORLD_W + 250 || p.y < -250 || p.y > WORLD_H + 250) this.remove(s);
  },
  remove(s) { if (s.lamp && s.lamp.follow) Lamps.remove(s.lamp); s.dead = true; P.bodyMap.delete(B.getPointer(s.body)); P.world.DestroyBody(s.body); },
  draw(ctx, s, V) { const t = s.trail; ctx.strokeStyle = 'rgba(230,190,120,.55)'; ctx.lineWidth = 1.2; ctx.beginPath(); for (let i = 0; i < t.length; i += 2) (i ? ctx.lineTo : ctx.moveTo).call(ctx, V.sx(t[i]), V.sy(t[i + 1])); ctx.stroke(); const p = s.body.GetPosition(); ctx.fillStyle = '#f2e2b8'; ctx.fillRect(V.sx(p.x) - 2, V.sy(p.y) - 2, 4, 4); }
});

WEAPON_CATS.add('rocket', {
  name: 'Ракеты', desc: 'Своё время ×4: тот же путь, в четыре раза быстрее',
  fire(u, w, ang, pow) {
    const s = WEAPON_CATS.get('shell').fire(u, w, ang, 1, { kind: 'rocket', burn: lerp(w.burnMin, w.burnMax, pow), loop: SFX.loop('flame'), rt: 0, vec: 0 }); s.loop.set(.3);
    for (let f = s.body.GetFixtureList(); f && B.getPointer(f); f = f.GetNext()) f.SetSensor(true);          // moved by its own integrator, never shoved by Box2D
    const v = s.body.GetLinearVelocity(), p = s.body.GetPosition(); s.x = p.x; s.y = p.y; s.vx = v.x; s.vy = v.y; P.V1.Set(0, 0); s.body.SetLinearVelocity(P.V1); return s;
  },
  prestep(s, dt) {
    const w = s.w, K = w.tscale || 4;
    for (let k = 0; k < K && !s.dead; k++) {
      let sp = Math.hypot(s.vx, s.vy) || 1;
      if (s.rt < s.burn) { const ta = Math.atan2(s.vy, s.vx) + (s.vec || 0); s.vx += Math.cos(ta) * w.thrust * dt; s.vy += Math.sin(ta) * w.thrust * dt; }
      const inW = Water.wet(s.x, s.y), kd = inW ? AIR_DRAG_WATER : w.drag, rx = s.vx - (inW ? 0 : G.wind); sp = Math.hypot(rx, s.vy); s.vx -= kd * sp * rx * dt; s.vy -= kd * sp * s.vy * dt;
      const [gx, gy] = Grav.atP(s.x, s.y, w); s.vx += gx * dt; s.vy += gy * dt;
      const nx = s.x + s.vx * dt, ny = s.y + s.vy * dt; s.rt += dt;
      const hit = s.rt > .12 && (Terrain.solid(nx, ny) || Water.wet(nx, ny) || shellRay(s.x, s.y, nx, ny, s.body, s.owner));
      s.x = nx; s.y = ny; if (k % 2 === 0) { s.trail.push(nx, ny); if (s.trail.length > 160) s.trail.splice(0, 2); }
      if (hit) { explode(nx, ny, w, s.owner, Math.atan2(s.vy, s.vx)); WEAPON_CATS.get('shell').remove(s); break; }
      if (s.rt > 40 || nx < -250 || nx > WORLD_W + 250 || ny < -250 || ny > WORLD_H + 250) { WEAPON_CATS.get('shell').remove(s); break; }
    }
    if (s.dead) { if (s.loop) { s.loop.stop(); s.loop = null; } return; }
    const sp = Math.hypot(s.vx, s.vy) || 1; P.V1.Set(s.x, s.y); s.body.SetTransform(P.V1, Math.atan2(s.vy, s.vx)); P.V2.Set(0, 0); s.body.SetLinearVelocity(P.V2);
    if (s.rt < s.burn) { const ta = Math.atan2(s.vy, s.vx) + (s.vec || 0), tx = Math.cos(ta), ty = Math.sin(ta);
      if (s.rt > .12 && Math.random() < .9) spawnParticle(P.fire, s.x - tx * 1.3, s.y - ty * 1.3, -tx * 9 + rnd(-2, 2), -ty * 9 + rnd(-2, 2), 0, rnd(.35, .8));
      if (Math.random() < .35) Smoke.puff(s.x - tx * 1.2, s.y - ty * 1.2, 1, 7, 0);
    } else if (s.loop) { s.loop.stop(); s.loop = null; }
  },
  poststep() { },
  draw(ctx, s, V) {
    const t = s.trail; ctx.strokeStyle = 'rgba(200,190,170,.35)'; ctx.lineWidth = 1.2; ctx.beginPath(); for (let i = 0; i < t.length; i += 2) (i ? ctx.lineTo : ctx.moveTo).call(ctx, V.sx(t[i]), V.sy(t[i + 1])); ctx.stroke();
    const sp = Math.hypot(s.vx, s.vy) || 1, dx = s.vx / sp, dy = s.vy / sp, L = .9 * SC;
    ctx.strokeStyle = '#e8e0cc'; ctx.lineWidth = Math.max(2, .22 * SC * V.z); ctx.beginPath(); ctx.moveTo(V.sx(s.x - dx * L), V.sy(s.y - dy * L)); ctx.lineTo(V.sx(s.x + dx * L * .6), V.sy(s.y + dy * L * .6)); ctx.stroke();
    if (s.rt < s.burn) { const fl = L * (1 + Math.random() * .8), ta = Math.atan2(dy, dx) + (s.vec || 0), tx = Math.cos(ta), ty = Math.sin(ta); ctx.strokeStyle = 'rgba(255,170,80,.9)'; ctx.lineWidth = Math.max(2, .3 * SC * V.z); ctx.beginPath(); ctx.moveTo(V.sx(s.x - dx * L), V.sy(s.y - dy * L)); ctx.lineTo(V.sx(s.x - dx * L - tx * fl), V.sy(s.y - dy * L - ty * fl)); ctx.stroke(); }
  }
});

WEAPON_CATS.add('stream', {
  name: 'Струи', desc: 'Непрерывный поток частиц, пока держится импульс',
  fire(u, w, ang, pow) { const s = { kind: 'stream', w, owner: u, t: 0, acc: 0, pow, loop: SFX.loop('flame') }; s.loop.set(.35); G.shots.push(s); },
  prestep(s, dt) {
    s.t += dt; if (s.t > s.w.dur || !s.owner.alive) { s.dead = true; s.loop.stop(); G.shots.push({ kind: 'timer', t: 0, dur: 2.5 }); return; }
    s.acc += dt * s.w.rate; const [mx, my] = s.owner.def.muzzle(s.owner), sp = s.w.speed * (.55 + s.pow * .45);
    const n = Math.floor(s.acc); s.acc -= n;                                   /* spread the step's drops along the path they cover in it: stacked drops repel each other and the jet sprays wide */
    for (let i = 0; i < n; i++) { const a = aimW(s.owner) + gauss() * s.w.spread, v = sp * rnd(.9, 1.06), d = .6 + v * dt * (i + Math.random()) / n; spawnParticle(P.fire, mx + Math.cos(a) * d, my + Math.sin(a) * d, Math.cos(a) * v, Math.sin(a) * v, 0, rnd(12, 20)); }
    FX.flash(mx, my, 6 * SC, .7, .1);
  }
});

// does the drone circle cover something this side knows about? (makes the sight beep faster)
function droneBeepHot(u) { if (u.droneTx == null) return false; for (const rec of Intel.data[u.side].values()) if (rec.u.alive && rec.u.def.main && Math.abs(rec.x - u.droneTx) < DRONE_SEEK) return true; return false; }
// ---------- delayed: attack drones. Launch = turn handed over. ----------
WEAPON_CATS.add('drone', {
  name: 'Дроны', desc: 'Медленные шумные носители. Ход переходит сразу, их можно сбить или уйти.',
  target(u, w, ang, pow) { const [mx] = u.def.muzzle(u), dir = Math.cos(ang) >= 0 ? 1 : -1; return clamp(mx + dir * (20 + pow * WORLD_W * .8), 6, WORLD_W - 6); },
  fire(u, w, ang, pow, opt = {}) {
    const [mx, my] = u.def.muzzle(u), tx = opt.tx ?? this.target(u, w, ang, pow), side = u.side;
    for (let k = 0; k < w.count; k++) wait(k * .45).then(() => { if (!u.alive && k) return; const [ax, ay] = u.alive ? u.def.muzzle(u) : [mx, my]; spawnUnit('strike', side, ax, ay + .8, { tx: clamp(tx + (k ? (k % 2 ? -1 : 1) * w.spread * Math.ceil(k / 2) : 0), 4, WORLD_W - 4), w, owner: u, hp: w.hp, maxHp: w.hp }); SFX.shot('drone'); });
    return null;
  }
});

WEAPON_CATS.add('laser', {
  name: 'Лучи', desc: 'Волновой луч: проявляется, отражается, преломляется на воде и в облаках',
  fire(u, w, ang, pow) { const s = { kind: 'laser', w, owner: u, t: 0, beams: [], id: (Math.random() * 1e6) | 0, aim: ang, loop: SFX.loop('laser') }; s.loop.set(.2); G.shots.push(s); return s; },
  env(s) { return smooth(clamp(s.t / .55, 0, 1)) * (1 - smooth(clamp((s.t - s.w.dur + .45) / .45, 0, 1))); },
  prestep(s, dt) {
    s.t += dt; if (s.t > s.w.dur || !s.owner.alive) { s.dead = true; s.loop.stop(); return; }
    const m = this.env(s); s.loop.set(.08 + .18 * m); const dps = s.w.dps * (1 + (buffed(s.owner) ? upLevel('emitter') * .2 : 0)) * m;
    const [mx, my] = s.owner.def.muzzle(s.owner); s.aim = aimW(s.owner);
    if (!s.beams.length || (s.frame = (s.frame || 0) + 1) % 2 === 0) s.beams = traceLaser(mx, my, Math.cos(s.aim), Math.sin(s.aim), s.owner, s.id);
    for (const b of s.beams) for (const h of b.hits) {
      const e = h.I * dps * dt;
      if (h.kind === 'unit') damageUnit(h.u, e, 'laser');
      else if (h.kind === 'block') {
        // the cutter: heat builds up where the beam holds; at red heat the block parts along the beam
        const bk = h.blk; bk.heat = (bk.heat || 0) + e * .09; damageBlock(bk, e * .5); if (bk.mat.flammable && Math.random() < dt * 2 * h.I) bk.burning = 1;
        if (bk.alive && bk.heat > 1 && bk.mat.hp !== Infinity) { bk.heat = 0; cutBlock(bk, h.x, h.y, h.dx, h.dy); }
      }
      else if (h.kind === 'terrain') { if (Math.random() < dt * 8 * h.I) { Terrain.scorchAt(h.x - h.dx * .3, h.y - h.dy * .3, .25); FX.sparks.push({ x: h.x, y: h.y, vx: rnd(-3, 3), vy: rnd(1, 5), life: .5, col: '#ffb070' }); if (Math.random() < .3) Smoke.puff(h.x, h.y + .5, 1, 6, 1); } }
      else if (h.kind === 'water' && Math.random() < dt * 10 * h.I) boilAt(h.x, h.y);
    }
  }
});
function boilAt(x, y) { const { n, pos } = particleArrays(P.water); let best = -1, bd = 1.6; for (let i = 0; i < n; i++) { const d = Math.hypot(pos[i * 2] - x, pos[i * 2 + 1] - y); if (d < bd) { bd = d; best = i; } } if (best >= 0) { P.water.DestroyParticle(best); Smoke.puff(x, y + .6, 1, 9, 1.5); } }

// ---------- explosions ----------
function pushParticles(x, y, R, strength) {
  for (const ps of [P.water, P.fire, P.dirt, P.smoke, P.cloud]) { const { n, pos, vel } = particleArrays(ps); for (let i = 0; i < n; i++) { const dx = pos[i * 2] - x, dy = pos[i * 2 + 1] - y; if (Math.abs(dx) > R || Math.abs(dy) > R) continue; const d = Math.hypot(dx, dy); if (d < R && d > .01) { const f = (1 - d / R) * strength; vel[i * 2] += dx / d * f; vel[i * 2 + 1] += dy / d * f; } } }
}
// ---------- LAMPS (Dream Light's light source): a fan of real raycast rays, stopped by the first body.
// Whatever a lamp's ray touches is seen by the lamp's owner. Rays are the light and the recon at once.
const Lamps = {
  list: [], cb: null, hit: null, self: 0,
  reset() { this.list = []; },
  add(x, y, side, o = {}) { const L = { x, y, side, rays: o.rays || 180, dist: o.dist || 36 * SC, col: o.col || [255, 236, 190], hp: 30, turns: o.turns ?? Infinity, follow: o.follow || null, body: null, ends: null, lit: new Set(), frame: 0 }; if (!L.follow) this.anchor(L); this.list.push(L); return L; },
  anchor(L, vx = 0, vy = 0) { const b = mkBody(B.b2_dynamicBody, L.x, L.y, { linearDamping: .8, angularDamping: 2 }); addFix(b, circleShape(.45 * SC), 1, .5); P.V1.Set(vx, vy); b.SetLinearVelocity(P.V1); L.body = b; P.bodyMap.set(B.getPointer(b), { kind: 'lamp', lamp: L }); },
  land(s, x, y) { const L = s.lamp; if (!L) return; L.follow = null; L.x = x; L.y = y; this.anchor(L); SFX.click(); },
  hurt(L, d) { L.hp -= d; if (L.hp <= 0) this.remove(L); },
  remove(L) { if (L.body) { P.bodyMap.delete(B.getPointer(L.body)); P.world.DestroyBody(L.body); } L.dead = true; FX.burst(L.x, L.y, 12, '#fff2cc', .5); this.list = this.list.filter(q => q !== L); },
  tickTurn(side) { for (const L of [...this.list]) if (L.side === side && --L.turns < 0) this.remove(L); },
  ray(x0, y0, x1, y1, selfPtr) {
    if (!this.cb) this.cb = Object.assign(new B.JSRayCastCallback(), {
      ReportFixture: (fp, pp, np, fr) => { const b = B.wrapPointer(fp, B.b2Fixture).GetBody(), ptr = B.getPointer(b); if (ptr === this.self) return -1; const info = P.bodyMap.get(ptr); if (info && info.kind === 'shot') return -1; this.hit = { fr, info }; return fr; },
      ReportParticle() { return -1; }, ShouldQueryParticleSystem() { return false; }
    });
    this.hit = null; this.self = selfPtr; P.V1.Set(x0, y0); P.V2.Set(x1, y1); P.world.RayCast(this.cb, P.V1, P.V2); return this.hit;
  },
  update() {
    for (const L of this.list) {
      { const p = (L.follow || L.body).GetPosition(); L.x = p.x; L.y = p.y; }
      if ((L.frame++ % 4) !== 0 && L.ends) continue;
      const N = L.rays, e = L.ends || (L.ends = new Float32Array(N * 2)), selfPtr = L.follow ? B.getPointer(L.follow) : L.body ? B.getPointer(L.body) : 0; L.lit.clear();
      for (let i = 0; i < N; i++) {
        const a = i / N * TAU, dx = Math.cos(a), dy = Math.sin(a), h = this.ray(L.x, L.y, L.x + dx * L.dist, L.y + dy * L.dist, selfPtr), d = h ? h.fr * L.dist : L.dist;
        e[i * 2] = L.x + dx * d; e[i * 2 + 1] = L.y + dy * d;
        if (h && h.info && h.info.kind === 'unit' && h.info.u.side !== L.side && h.info.u.alive) L.lit.add(h.info.u.id);
      }
      for (const id of L.lit) { const u = G.units.find(q => q.id === id); if (u) Intel.snapshot(L.side, u, 'visual'); }
    }
  },
  litFor(side) { const out = new Set(); for (const L of this.list) if (L.side === side) for (const id of L.lit) out.add(id); return out; },
  draw(ctx, V) {
    const night = G.day.lum < .5, al = night ? .16 : .07;
    ctx.globalCompositeOperation = 'lighter';
    for (const L of this.list) {
      if (!L.ends) continue; const [r, g, b] = L.col, px = V.sx(L.x), py = V.sy(L.y);
      ctx.strokeStyle = `rgba(${r},${g},${b},${al})`; ctx.lineWidth = Math.max(1, .09 * V.z); ctx.beginPath();
      for (let i = 0; i < L.rays; i++) { ctx.moveTo(px, py); ctx.lineTo(V.sx(L.ends[i * 2]), V.sy(L.ends[i * 2 + 1])); }
      ctx.stroke();
      const gr = ctx.createRadialGradient(px, py, 0, px, py, 3 * SC * V.z); gr.addColorStop(0, `rgba(${r},${g},${b},.9)`); gr.addColorStop(1, `rgba(${r},${g},${b},0)`); ctx.fillStyle = gr; ctx.fillRect(px - 3 * SC * V.z, py - 3 * SC * V.z, 6 * SC * V.z, 6 * SC * V.z);
    }
    ctx.globalCompositeOperation = 'source-over';
    for (const L of this.list) { ctx.fillStyle = SIDE_COL[L.side]; ctx.beginPath(); ctx.arc(V.sx(L.x), V.sy(L.y), Math.max(2.5, .35 * SC * V.z), 0, TAU); ctx.fill(); }
  }
};

// ---------- RAY BURST (after Dream Light's "pew" light: ray count and fan angle bloom exponentially, rate 8) ----------
// An explosion is a fan of rays, each a real raycast. What a ray reaches first takes its share of damage
// and impulse, falling off with distance. Cover works: stone, a wall, a hill or another tank eat the rays.
const BRQ = { cb: null, best: null };
function burstRay(x0, y0, x1, y1) {
  if (!BRQ.cb) BRQ.cb = Object.assign(new B.JSRayCastCallback(), {
    ReportFixture(fp, pp, np, fr) { const f = B.wrapPointer(fp, B.b2Fixture), info = P.bodyMap.get(B.getPointer(f.GetBody())); if (!info || info.kind === 'shot') return -1; const p = B.wrapPointer(pp, B.b2Vec2); BRQ.best = { fr, x: p.x, y: p.y, info, body: f.GetBody() }; return fr; },
    ReportParticle() { return -1; }, ShouldQueryParticleSystem() { return false; }
  });
  BRQ.best = null; P.V1.Set(x0, y0); P.V2.Set(x1, y1); P.world.RayCast(BRQ.cb, P.V1, P.V2); return BRQ.best;
}
function rayBurst(x, y, w, dir, owner) {
  const N = w.rays || 90, reach = w.reach || w.blast * 2.3, [ux, uy] = Grav.up(x, y), ox = x + ux * .6, oy = y + uy * .6;
  const rays = []; for (let i = 0; i < N; i++) { const off = (i % 2 ? 1 : -1) * Math.ceil(i / 2) * TAU / N; rays.push({ a: dir + off, off: Math.abs(off), done: false, ex: 0, ey: 0 }); }
  G.shots.push({ kind: 'burst', x: ox, y: oy, w, owner, rays, reach, t: 0, life: w.rays ? .9 : .55, col: w.rayCol || [255, 205, 150], perRay: w.dmg / (w.rayShare || 24) });
}
WEAPON_CATS.add('burst', {
  prestep(s, dt) {
    s.t += dt; const open = Math.PI * (1 - Math.exp(-8 * s.t)) + .02;        // the fan opens from the flight direction
    for (const r of s.rays) {
      if (r.done || r.off > open) continue; r.done = true;
      const dx = Math.cos(r.a), dy = Math.sin(r.a), h = burstRay(s.x, s.y, s.x + dx * s.reach, s.y + dy * s.reach);
      const d = h ? h.fr * s.reach : s.reach; r.ex = s.x + dx * d; r.ey = s.y + dy * d; if (!h) continue;
      const f = Math.pow(clamp(1 - d / s.reach, 0, 1), .8), info = h.info, m = h.body.GetMass();
      if (info.kind === 'unit') { damageUnit(info.u, s.perRay * f, 'blast', true); const k = (info.u.def.main ? 1.1 : 3) * Math.sqrt(SC) * f; P.V1.Set(dx * m * k, dy * m * k); P.V2.Set(h.x, h.y); h.body.ApplyLinearImpulse(P.V1, P.V2, true); }
      else if (info.kind === 'block') { damageBlock(info.blk, s.perRay * 1.3 * f); if (s.w.fire && info.blk.mat.flammable) info.blk.burning = 1; if (info.blk.alive) { const k = 3.2 * Math.sqrt(SC) * f; P.V1.Set(dx * m * k, dy * m * k); P.V2.Set(h.x, h.y); h.body.ApplyLinearImpulse(P.V1, P.V2, true); } }
      else if (info.kind === 'lamp') { Lamps.hurt(info.lamp, s.perRay * 2 * f); }
      else if (info.kind === 'rock' && !info.rock.buried) { const k = 2.4 * Math.sqrt(SC) * f; P.V1.Set(dx * m * k, dy * m * k); P.V2.Set(h.x, h.y); h.body.ApplyLinearImpulse(P.V1, P.V2, true); }
      else if (info.kind === 'terrain' && s.w.rays) Terrain.scorchAt(h.x - dx * .3, h.y - dy * .3, .5 * f);   // light burns the ground it touches
    }
    if (s.t > s.life) s.dead = true;
  },
  draw(ctx, s, V) {
    const k = clamp(1 - s.t / s.life, 0, 1), [r, g, b] = s.col; if (k <= 0) return;
    ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
    for (const [wd, al] of [[Math.max(2, .35 * V.z), .12], [Math.max(1, .1 * V.z), .5]]) {
      ctx.strokeStyle = `rgba(${r},${g},${b},${al * k * k})`; ctx.lineWidth = wd; ctx.beginPath();
      for (const ray of s.rays) if (ray.done) { ctx.moveTo(V.sx(s.x), V.sy(s.y)); ctx.lineTo(V.sx(ray.ex), V.sy(ray.ey)); }
      ctx.stroke();
    }
    ctx.globalCompositeOperation = 'source-over'; ctx.lineCap = 'butt';
  }
});
function explode(x, y, w, owner, dir) {
  const BU = Grav.up(x, y).slice();
  const wet = Water.wet(x, y) || Water.wet(x - BU[0] * SC, y - BU[1] * SC), R = w.blast * 2.3;
  if (!Water.wet(x + BU[0], y + BU[1])) Dirt.eject(x, y, Terrain.displace(x, y, w.blast), .6); else Dirt.eject(x, y, Terrain.displace(x, y, w.blast * .6), .2);
  rayBurst(x, y, w, dir ?? Math.atan2(BU[1], BU[0]), owner);
  Nature.blast && Nature.blast(x, y, R, !!w.fire);
  pushParticles(x, y, R * 1.3, 16 * Math.sqrt(SC));
  Smoke.puff(x, y, Math.round(8 + w.blast * 3), 50, 2);          // black soot settles into the crater and lingers
  if (wet) for (let i = 0; i < w.blast * 3; i++) Smoke.puff(x + rnd(-2, 2), y + rnd(-2, 2), 1, 10, 2);
  if (w.fire) for (let i = 0; i < w.fire; i++) { const a = Math.atan2(BU[1], BU[0]) + rnd(-1.4, 1.4), v = rnd(3, 12) * RT2; spawnParticle(P.fire, x + Math.cos(a) * 1.6, y + Math.sin(a) * 1.6, Math.cos(a) * v, Math.sin(a) * v, B.b2_viscousParticle, rnd(15, 32)); }
  const col = w.rayCol ? '#ff8a70' : '#e7b36e';
  FX.burst(x, y, 34, col, RT2); FX.burst(x, y, 20, '#6b5a48', .9); FX.flash(x, y, w.blast * 7 + (w.rays ? 20 : 0), 2.4, w.rays ? .9 : .5, w.rayCol || [255, 190, 120]);
  G.shake = Math.max(G.shake, w.blast * 1.4 / (1 + camDist(x, y) * .015)); SFX.boom(Math.min(1.6, w.blast / 5), camDist(x, y)); haptic(30);
  if (owner && owner.side != null) G.lastImpact[owner.side] = { x, y, t: Clock.t, turn: G.turn, aimAt: owner.lastAimAt };
  Bus.emit('impact', { x, y, owner });
}

// ---------- fire: an oil mix. Burns long, floats and keeps burning on water, blackens soil, eats grass ----------
const FireSys = {
  update(dt) {
    for (const bk of G.blocks) if (bk.alive && bk.heat) bk.heat = Math.max(0, bk.heat - dt * .35);
    const ps = P.fire, { n, pos, vel } = particleArrays(ps);
    for (const blk of G.blocks) if (blk.alive && blk.burning) { damageBlock(blk, 1.6 * dt); const p = blk.body.GetPosition(); if (Math.random() < dt * 3) spawnParticle(P.fire, p.x + rnd(-.3, .3), p.y + blk.h / 2, rnd(-1, 1), rnd(1, 3), B.b2_viscousParticle, rnd(6, 10)); if (Math.random() < dt * 2) Smoke.puff(p.x, p.y + blk.h / 2 + 1, 1, 12, 1); }
    if (!n) return;
    P.V1.Set(G.wind * .02, 0); ps.ApplyForce(0, n - 1, P.V1);
    const burn = new Map(), rain = G.weather.rain > 0;
    for (let i = 0; i < n; i++) {
      const x = pos[i * 2], y = pos[i * 2 + 1];
      const [ux, uy] = Grav.up(x, y);
      if (Water.wet(x, y)) { vel[i * 2] = vel[i * 2] * .85 + ux * 3.2; vel[i * 2 + 1] = vel[i * 2 + 1] * .85 + uy * 3.2; }          // lighter than water: rises to the surface
      else if (Water.wet(x - ux * .45, y - uy * .45)) { const vn = vel[i * 2] * ux + vel[i * 2 + 1] * uy, keep = Math.max(vn, -.3) * .5 - vn; vel[i * 2] = (vel[i * 2] + ux * keep) * .96 + G.wind * .012 + (Math.random() - .5) * .25 * uy; vel[i * 2 + 1] = (vel[i * 2 + 1] + uy * keep) * .96 - (Math.random() - .5) * .25 * ux; } // rides the surface, spreads
      if (vel[i * 2] * vel[i * 2] + vel[i * 2 + 1] * vel[i * 2 + 1] < 324) for (const u of G.units) { if (!u.alive) continue; const [qx, qy] = unitPos(u);   /* a drop still flying in the jet does not scorch: the flamer no longer cooks its own tank at the muzzle */ if (Math.hypot(qx - x, qy - y) < (u.def.main ? 3.4 : 1.2)) burn.set(u, (burn.get(u) || 0) + 1); }
      if (i % 5 === 0) {
        for (const blk of G.blocks) { if (!blk.alive || !blk.mat.flammable) continue; const p = blk.body.GetPosition(); if (Math.abs(p.x - x) < blk.w / 2 + .8 && Math.abs(p.y - y) < blk.h / 2 + .8) blk.burning = 1; }
      }
      if (i % 3 === 0 && Terrain.solid(x - ux * .7, y - uy * .7)) {
        const was = Terrain.scorchAt(x - ux * .6, y - uy * .6, .12 * dt * 3);
        if (was != null && was < .3 && !rain && n < ps.GetMaxParticleCount() * .5 && Math.random() < dt * .6) { // grass fire creeps along the ground into living grass
          const sgn = Math.random() < .5 ? -1 : 1, off = rnd(1, 2.2), nx = x + uy * off * sgn, ny = y - ux * off * sgn, g = Grav.dropToGround(nx + ux * 2, ny + uy * 2, 5);
          if (g && !Water.wet(g[0] + ux * .5, g[1] + uy * .5)) { const k = Math.round(g[1] / CELL) * NX + Math.round(g[0] / CELL); if (Terrain.sc[k] < .3 && !Terrain.lo[k]) spawnParticle(P.fire, g[0] + ux * .8, g[1] + uy * .8, ux * .6, uy * .6, B.b2_viscousParticle, rnd(5, 9)); }
        }
      }
      if (i % 9 === 0 && Math.random() < dt * 1.5) Smoke.puff(x, y + 1, 1, 10, 1);
    }
    for (const [u, c] of burn) damageUnit(u, (u.type === 'sub' ? Math.min(c * .25, 3.5) : Math.min(c * .9, 14)) * dt, 'fire', true);
  }
};

// ---------- lights: one list serves rendering AND the visibility model ----------
const Lights = {
  list: [],
  collect() {
    const L = this.list = [];
    for (const f of FX.flashes) L.push({ x: f.x, y: f.y, r: f.r, i: f.i * (f.life / f.max), col: f.col });
    for (const lp of Lamps.list) L.push({ x: lp.x, y: lp.y, r: lp.dist * .8, i: 1, col: lp.col });
    for (const f of G.flares) L.push({ x: f.x, y: f.y, r: 34 * SC, i: 1.1 * clamp(f.life / 4, 0, 1), col: [235, 238, 220] });
    { const l = particleArrays(P.lava), st = Math.max(3, Math.floor(l.n / 25)); for (let i = 0; i < l.n; i += st) L.push({ x: l.pos[i * 2], y: l.pos[i * 2 + 1], r: 5 * SC, i: .5, col: [255, 110, 40] }); }
    const { n, pos } = particleArrays(P.fire); const stride = Math.max(4, Math.floor(n / 40));
    for (let i = 0; i < n; i += stride) L.push({ x: pos[i * 2], y: pos[i * 2 + 1], r: 6.5 * SC, i: .45, col: [255, 130, 50] });
    for (const s of G.shots) if (s.kind === 'burst' && s.w.rays) { const k = clamp(1 - s.t / s.life, 0, 1); if (k > 0) for (let i = 0; i < s.rays.length; i += 15) { const r = s.rays[i]; if (r.done) L.push({ x: lerp(s.x, r.ex, .6), y: lerp(s.y, r.ey, .6), r: 8 * SC, i: .9 * k, col: s.w.rayCol }); } }
    for (const s of G.shots) if (s.kind === 'laser') { const m = WEAPON_CATS.get('laser').env(s); for (const b of s.beams) { const p = b.pts; for (let j = 0; j < p.length; j += 36) L.push({ x: p[j], y: p[j + 1], r: 5 * SC, i: .6 * p[j + 2] * m, col: [255, 90, 70] }); for (const g of b.glow) L.push({ x: g[0], y: g[1], r: 7 * SC, i: g[2] * m * 2, col: [255, 110, 90] }); } }
    for (const u of G.units) if (u.alive && (u.type === 'drone' || u.type === 'strike') && (Clock.t * 1.5 % 1) < .12) { const [x, y] = unitPos(u); L.push({ x, y, r: 3 * SC, i: .5, col: [255, 60, 50] }); }
    if (L.length > 110) L.length = 110;
  },
  illumAt(x, y) { let e = G.day.lum; for (const l of this.list) { const d = Math.hypot(l.x - x, l.y - y); if (d < l.r) e += l.i * (1 - d / l.r) ** 2; } return e; }
};

// ---------- visibility & intel ----------
function waterSurfaceAbove(x, y) { let s = y; while (Water.wet(x, s) && s < WORLD_H) s += .5; return s; }
const VIS = {
  vatm() { return G.weather.vKm * 1000 / VIS_SCALE; },      // meteorological range, game metres
  rangeFor(target, obs) {
    const [x, y] = unitPos(target); let sig = target.def.sig;
    if (target.def.medium === 'water' ? subWet(target) : Water.wet(x, y + 1.6 * SC)) { const depth = waterSurfaceAbove(x, y + 1.2 * SC) - y; sig *= Math.exp(-depth / (1.8 * SC)); }     // light dies in water
    const opt = obs && buffed(obs) ? 1 + upLevel('optics') * .1 : 1;
    return Math.min(this.vatm(), DETECT_DAY * Math.sqrt(Lights.illumAt(x, y + 1)) * opt) * sig;
  },
  eye(obs) { const [x, y] = unitPos(obs), a = obs.body.GetAngle(), e = obs.def.eye; return [x - Math.sin(a) * e, y + Math.cos(a) * e]; },
  sees(obs, target) {
    const [ox, oy] = this.eye(obs), [tx, ty] = unitPos(target), d = Math.hypot(tx - ox, ty - oy);
    if (Water.wet(ox, oy) && d > 6 * SC) return false;                                    // eye under water: murk
    if (d > this.rangeFor(target, obs)) return false;
    if (Smoke.tau(ox, oy, tx, ty + 1) > 2.3) return false;                                // smoke screen
    if (cfg.terrainMask && d > 4) { const dx = (tx - ox) / d, dy = (ty + 1.2 - oy) / d; if (Terrain.march(ox, oy, dx, dy, d - 2.4, .6) >= 0) return false; }
    return true;
  }
};
const Intel = {
  data: [new Map(), new Map()], vis: [new Set(), new Set()], frame: 0,
  reset() { this.data = [new Map(), new Map()]; this.vis = [new Set(), new Set()]; },
  update() {
    if ((this.frame++ % 3) !== 0) return;
    for (let s = 0; s < 2; s++) {
      const vis = new Set(), obs = G.units.filter(u => u.alive && u.side === s && u.def.eye > 0);
      for (const e of G.units) { if (!e.alive || e.side === s) continue; if (obs.some(o => VIS.sees(o, e))) { vis.add(e.id); const [x, y] = unitPos(e); this.data[s].set(e.id, { u: e, x, y, t: Clock.t, turn: G.turn, src: 'visual', err: 0, hp: e.hp }); } }
      for (const id of Lamps.litFor(s)) vis.add(id);
      for (const id of vis) if (!this.vis[s].has(id) && G.phase !== 'menu') Bus.emit('spotted', { side: s, id });
      this.vis[s] = vis;
    }
  },
  snapshot(side, u, src, err = 0) { const [x, y] = unitPos(u); this.data[side].set(u.id, { u, x: x + gauss() * err, y: y + gauss() * err * .3, t: Clock.t, turn: G.turn, src, err, hp: u.hp }); },
  noisy(side, u, src, err) { if (this.vis[side].has(u.id)) return; const prev = this.data[side].get(u.id); if (prev && prev.turn === G.turn && prev.err < err && Clock.t - prev.t < 3) return; this.snapshot(side, u, src, err); },
  forget(u) { this.data.forEach(m => m.delete(u.id)); },
  best(side) { let r = null; for (const rec of this.data[side].values()) if (rec.u.alive && rec.u.def.main) r = rec; return r; },
  threats(side) { return [...this.data[side].values()].filter(r => r.u.alive && r.u.type === 'strike' && Clock.t - r.t < 3); },
  age(rec) { return rec ? G.turn - rec.turn : Infinity; }
};
// passive sound ranging: firing gives away an approximate position
function acousticReveal(u) { const [x, y] = unitPos(u), other = 1 - u.side, obs = G.units.filter(o => o.alive && o.side === other); if (!obs.length) return; const d = Math.min(...obs.map(o => Math.hypot(unitPos(o)[0] - x, unitPos(o)[1] - y))); Intel.noisy(other, u, 'sound', 2 + d * .035); }
// continuous hearing: engines, rotors. Listener range = def.hear, source loudness = def.noise(u)
const Acoustics = {
  acc: 0, heard: [new Set(), new Set()],
  update(dt) {
    if ((this.acc += dt) < .5) return; this.acc = 0;
    for (const e of G.units) {
      if (!e.alive || !e.def.noise) continue; const loud = e.def.noise(e); if (loud <= 0) continue; const [x, y] = unitPos(e), other = 1 - e.side;
      let best = Infinity, dist = 0; for (const o of G.units) if (o.alive && o.side === other && o.def.hear) { const d = Math.hypot(unitPos(o)[0] - x, unitPos(o)[1] - y); if (d / o.def.hear < best) { best = d / o.def.hear; dist = d; } }
      if (best < loud) { Intel.noisy(other, e, 'sound', 1.5 * SC + dist * .04); if (!this.heard[other].has(e.id) && G.phase !== 'menu') { this.heard[other].add(e.id); Bus.emit('log', { side: other, text: e.type === 'strike' ? 'Слышу дрон на подлёте' : 'Слышу двигатель', warn: e.type === 'strike' }); } }
    }
  }
};

// =====================================================================
// RECON. Each entry spends the turn's recon action. `on` = platforms.
// =====================================================================
// (recon drone and spotter are parked for now)
RECON.add('hop', {
  name: 'Прыжок', glyph: '⤴', charges: 3, ai: false, desc: 'Машина прыгает по направлению ствола; сила — фейдер. Можно перелететь на другой остров.',
  run(u) {
    const d = aimW(u), v = 4 + u.power * 11;   /* a hop, not a launch: the island still pulls you back */ SFX.boom(.35, camDist(...unitPos(u)));
    for (const b of u.bodies) { const m = b.GetMass(); P.V1.Set(Math.cos(d) * v * m, Math.sin(d) * v * m); b.ApplyLinearImpulseToCenter(P.V1, true); }
    const [x, y] = unitPos(u); Smoke.puff(x, y, 8, 10, 1); FX.burst(x, y, 14, '#d8c8a8', .5); return 1;
  }
});
