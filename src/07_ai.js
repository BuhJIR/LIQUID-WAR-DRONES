// =====================================================================
// AI. Acts only on its own Intel (belief), never on true positions.
// Same rules as the player: one recon, one shot, a fuel budget.
// =====================================================================
// shared ballistic simulator (the same drag model as the shells)
// shared ballistic simulator: same drag, the islands' gravity field, optional rocket burn
// beam = true: the "gravity beam" — the same arc, but every step is a real Box2D ray against everything in the world
// (walls, stones, lamps, tanks), so one pass from the muzzle checks it all. Without it only soil, water and blocks are seen.
const BEAM_SELF = {};
function simulate(x, y, ang, speed, drag, wind, maxT = 24, rocket = null, dt = 1 / 30, w = null, beam = false, owner = null) {
  let vx = Math.cos(ang) * speed, vy = Math.sin(ang) * speed, t = 0, hit = null; const pts = [];
  while (t < maxT) {
    if (rocket && t < rocket.burn) { const sp = Math.hypot(vx, vy) || 1; vx += vx / sp * rocket.thrust * dt; vy += vy / sp * rocket.thrust * dt; }
    const rx = vx - wind, sp = Math.hypot(rx, vy); vx -= drag * sp * rx * dt; vy -= drag * sp * vy * dt;
    const [gx, gy] = Grav.atP(x, y, w); vx += gx * dt; vy += gy * dt; const x0 = x, y0 = y; x += vx * dt; y += vy * dt; t += dt;
    if (beam) { const h = shellRay(x0, y0, x, y, BEAM_SELF, owner); if (h) { hit = h; x = SR.px ?? x; y = SR.py ?? y; pts.push(x, y); break; } } else if (Obst.hit(x, y)) { pts.push(x, y); break; }
    pts.push(x, y);
    if (x < -150 || x > WORLD_W + 150 || y < -150 || y > WORLD_H + 150) break; if (t > .12 && (Terrain.solid(x, y) || Water.wet(x, y))) break;
  }
  return { x, y, t, pts, hit };
}
// one imagined shot from this hull: returns where it lands and when (flamer: one burning drop of the jet)
function shotSim(u, w, windEst, beam = false) {
  const [, , px, py] = u.def.muzzle(u), BL = u.barrelLen || .6 * SC, rocket = w.cat === 'rocket', stream = w.cat === 'stream', gw = stream ? { gN: .9, gF: 0 } : w;
  return (ang, pow, wind = windEst) => simulate(px + Math.cos(ang) * BL, py + Math.sin(ang) * BL, ang, stream ? w.speed * (.55 + pow * .45) : rocket ? w.speed : muzzleSpeed(u, w) * pow, stream ? 0 : w.drag, stream ? 0 : wind, rocket ? 40 : stream ? 16 : 24, rocket ? { burn: lerp(w.burnMin, w.burnMax, pow), thrust: w.thrust } : null, 1 / 20, gw, beam, u);
}
// danger zone around its own hull, per weapon (fire pools spread, so the flamer keeps a wider berth)
// does the path come back through its own danger zone (skip the first half second out of the barrel)
const selfPass = (r, px, py, R) => { if (Math.hypot(r.x - px, r.y - py) < R) return true; const p = r.pts; for (let i = 20; i < p.length; i += 2) if (Math.hypot(p[i] - px, p[i + 1] - py) < R) return true; return false; };
const selfR = w => w.cat === 'stream' ? 9 : (w.blast || 3) * 1.6 + 2;
const hitR = w => w.cat === 'stream' ? 5 : Math.max(2.5, (w.blast || 3) * .75) + 1.4;
// blocks (walls, towers, its own included) as the imagined shot sees them: rotated boxes on an 8 m grid, rebuilt once per frame
const Obst = {
  at: -1, grid: new Map(),
  build() { this.at = Clock.t; this.grid.clear(); for (const k of G.blocks) { if (!k.alive) continue; const p = k.body.GetPosition(), a = k.body.GetAngle(), o = { x: p.x, y: p.y, c: Math.cos(a), s: Math.sin(a), hw: k.w / 2 + .3, hh: k.h / 2 + .3 }, r = Math.hypot(o.hw, o.hh);
    for (let gx = Math.floor((p.x - r) / 8); gx <= Math.floor((p.x + r) / 8); gx++) for (let gy = Math.floor((p.y - r) / 8); gy <= Math.floor((p.y + r) / 8); gy++) { const key = gx * 4096 + gy; (this.grid.get(key) || this.grid.set(key, []).get(key)).push(o); } } },
  hit(x, y) { if (this.at !== Clock.t) this.build(); const L = this.grid.get(Math.floor(x / 8) * 4096 + Math.floor(y / 8)); if (!L) return false;
    for (const o of L) { const dx = x - o.x, dy = y - o.y, lx = dx * o.c + dy * o.s, ly = -dx * o.s + dy * o.c; if (Math.abs(lx) < o.hw && Math.abs(ly) < o.hh) return true; } return false; }
};
// search the whole half-plane above the hull: angle × power, then refine around the best.
// Yields between rows so the frame keeps running while the AI "thinks".
async function solveShotA(u, w, tx, ty, windEst) {
  const [, , px, py] = u.def.muzzle(u), [ux, uy] = Grav.up(px, py), base = Math.atan2(uy, ux), sim = shotSim(u, w, windEst), beam = shotSim(u, w, windEst, true), SR = selfR(w) * 1.5;
  const score = (r) => { const miss = Math.hypot(r.x - tx, r.y - ty), self = selfPass(r, px, py, SR) ? 1e4 : 0; return [miss + self + r.t * .08, miss]; };
  const cand = [];
  for (let da = -1.5; da <= 1.5; da += .075) { for (let pw = .1; pw <= 1.001; pw += .06) { const ang = base + da, r = sim(ang, pw), [sc, m] = score(r); if (sc < 5e3) cand.push({ ang, pow: pw, score: sc, miss: m, x: r.x, y: r.y }); } await new Promise(r => setTimeout(r, 0)); }
  cand.sort((a, b) => a.score - b.score);
  // the gravity beam checks the few best arcs for real: the first that is still good, refined, wins
  for (let i = 0; i < Math.min(10, cand.length); i++) {
    const c = cand[i], r = beam(c.ang, c.pow), [sc, m] = score(r); if (sc > 5e3 || m > c.miss + 4) continue;
    let best = { ang: c.ang, pow: c.pow, score: sc, miss: m, x: r.x, y: r.y };
    for (let k = 0; k < 24; k++) { const ang = best.ang + gauss() * (k < 12 ? .03 : .01), pw = clamp(best.pow + gauss() * (k < 12 ? .025 : .008), .05, 1), q = beam(ang, pw), [s2, m2] = score(q); if (s2 < best.score) best = { ang, pow: pw, score: s2, miss: m2, x: q.x, y: q.y }; }
    await new Promise(r => setTimeout(r, 0)); return best;
  }
  return { score: 1e9, miss: 1e9 };
}
// imagined volley: shake the shot by the AI's own hand, its wind guess and its doubt about the target.
// The AI is told only a coarse grade: 1 low, 2 medium, 3 above average. Any imagined round on itself → grade 0 (change tactics).
function hitGrade(u, w, best, tx, ty, P0, windEst, err, N = 16) {
  if (best.score > 5e3) return 0; const sim = shotSim(u, w, windEst, true), R = hitR(w), SR = selfR(w), [, , px, py] = u.def.muzzle(u); let hit = 0, self = 0;
  for (let k = 0; k < N; k++) { const r = sim(best.ang + gauss() * P0.aimErr, clamp(best.pow * (1 + gauss() * P0.powErr), .05, 1), windEst + gauss() * (G.weather.gust * .4 + .4)); if (selfPass(r, px, py, SR)) self++; if (Math.hypot(r.x - tx - gauss() * err * .5, r.y - ty - gauss() * err * .5) < R) hit++; }
  if (self) return 0; const c = hit / N; return c < .2 ? 1 : c < .5 ? 2 : 3;
}
const GRADE_P = [0, .1, .35, .65];
function laserClear(u, tx, ty) { const [mx, my] = u.def.muzzle(u), d = Math.hypot(tx - mx, ty - my), dx = (tx - mx) / d, dy = (ty - my) / d; return Terrain.march(mx, my, dx, dy, d - 3, .5) < 0 && !G.blocks.some(b => b.alive && Math.abs((b.body.GetPosition().x - mx) * dy - (b.body.GetPosition().y - my) * dx) < 1.5 && ((b.body.GetPosition().x - mx) * dx + (b.body.GetPosition().y - my) * dy) > 0 && Math.hypot(b.body.GetPosition().x - mx, b.body.GetPosition().y - my) < d); }
const canUse = (u, w) => (w.on || ['tank']).includes(u.type);

const AI = {
  mem: [{}, {}],
  reset() { this.mem = [{ misses: [] }, { misses: [] }]; },
  async run(side) {
    const P0 = G.aiProfile, me = G.sides[side].tank, mem = this.mem[side]; if (!me || !me.alive) return;
    const turnId = G.turnId, live = () => G.turnId === turnId && G.phase === 'play' && me.alive, S = G.sides[side];
    await wait(.7); if (!live()) return;
    // 0. incoming drones: shoot them down if the beam has a line, otherwise get out from under them
    const threats = Intel.threats(side);
    if (threats.length && !G.mode.passiveAI) {
      const th = threats.sort((a, b) => a.err - b.err)[0], [mx, my] = me.def.muzzle(me);
      if (S.ammo.laser > 0 && th.err < 4 * SC && laserClear(me, th.x, th.y) && Math.random() < .85) {
        const v = th.u.body.GetLinearVelocity(), lead = Math.hypot(th.x - mx, th.y - my) > 0 ? .5 : 0, ax = th.x + v.x * lead, ay = th.y + v.y * lead;
        await this.traverse(me, Math.atan2(ay - my, ax - mx) + gauss() * P0.aimErr * .12, live); if (!live()) return;
        const fresh = Intel.data[side].get(th.u.id); if (fresh && th.u.alive) { me.aim = -me.body.GetAngle() + Math.atan2(fresh.y + fresh.u.body.GetLinearVelocity().y * .3 - my, fresh.x + fresh.u.body.GetLinearVelocity().x * .3 - mx); }
        Bus.emit('log', { side: 1 - side, text: 'Противник бьёт лучом по дрону', warn: true }); G.doFire(side, 'laser'); return;
      }
      const tx = th.u.tx ?? th.x; await this.relocate(side, me, live, tx); if (!live()) return;
    }
    // 1. relocate if exposed (sound ranging / muzzle flash knowledge is legitimate)
    const exposed = (mem.exposedTurn ?? -9) >= G.turn - 1 || me.hp < me.maxHp * .45;
    if (exposed && Math.random() < P0.move && S.fuel > 0) { await this.relocate(side, me, live); if (!live()) return; }
    // 2. recon when intel is stale and the air is not clear
    let rec = Intel.best(side), age = Intel.age(rec), vis = rec && Intel.vis[side].has(rec.u.id);
    const worldClear = VIS.vatm() > WORLD_W * 1.2 && G.day.lum > .5;
    if (!vis && !worldClear && (age >= 1 || !rec) && Math.random() < P0.recon) {
      const opts = RECON.all().filter(r => r.ai !== false && S.recon[r.id] > 0 && (r.on || ['tank']).includes(me.type) && !(r.id === 'spotter' && G.units.some(o => o.alive && o.side === side && o.type === 'spotter')));
      const [mx] = unitPos(me), guessX = rec ? rec.x : (side ? 40 : WORLD_W - 40), dist = Math.abs(guessX - mx);
      const pickR = (dist > 70 * SC && opts.find(r => r.id === 'drone')) || opts.find(r => r.id === 'spotter') || opts[0];
      if (pickR) { me.aim = (guessX > mx ? .7 : Math.PI - .7) - me.body.GetAngle(); me.power = clamp((dist - 30) / 170, .1, 1); const dur = G.doRecon(side, pickR.id); if (dur > 0) await wait(dur + .4); if (!live()) return; }
      rec = Intel.best(side); age = Intel.age(rec); vis = rec && Intel.vis[side].has(rec.u.id);
    }
    if (G.mode.passiveAI) { await wait(.6); if (live()) G.endTurn(); return; }
    // no contact at all: blind fire at the face of the enemy's home island that looks our way (the map is public)
    if (!rec) { const I = G.sides[1 - side].home, [ex, ey] = unitPos(me), [gx, gy] = Grav.surfacePoint(I, Math.atan2(ey - I.y, ex - I.x) + gauss() * .35); rec = { x: gx, y: gy, err: 18, guess: true }; }
    // 3. aim point: the belief, corrected by what it saw of its last impact (bracketing)
    let tx = rec.x, ty = rec.y;
    const li = G.lastImpact[side]; if (li && li.aimAt && li.turn >= G.turn - 2 && Math.hypot(li.aimAt[0] - rec.x, li.aimAt[1] - rec.y) < 12 && this.impactSeen(side, li)) { tx -= (li.x - li.aimAt[0]) * P0.correct; ty -= (li.y - li.aimAt[1]) * P0.correct * .3; }
    const windEst = G.wind + gauss() * (G.weather.gust * .4 + .4);
    // 4. think: fire every weapon in its head along many paths, keep the best expected damage.
    //    If nothing can connect from here, drive a little and think again (both ways, fuel permitting).
    let plan = await this.plan(side, me, rec, tx, ty, windEst, live); if (!live()) return;
    if (plan) await this.traverse(me, plan.ang, live); if (!live()) return;
    const want = 2; let best = plan, dir = Math.random() < .5 ? -1 : 1, leg = 0;
    for (let tries = 0; tries < 3 && (!plan || plan.grade < want) && S.fuel > 0 && live(); tries++) {
      const T = rnd(.8, 1.4); await this.drive(side, me, live, dir, T); if (!live()) return; leg += dir * T;
      plan = await this.plan(side, me, Intel.best(side) || rec, tx, ty, windEst, live); if (!live()) return;
      if (plan) await this.traverse(me, plan.ang, live); if (!live()) return;
      if (plan && (!best || plan.ev > best.ev)) best = { ...plan, leg }; else dir = -dir;   // worse: turn around
    }
    // came out worse than a spot already seen: roll back there and re-aim
    if (best && plan && best.ev > plan.ev * 1.5 && best.leg != null && S.fuel > 0) { const back = best.leg - leg; await this.drive(side, me, live, Math.sign(back), Math.abs(back)); if (!live()) return; plan = await this.plan(side, me, rec, tx, ty, windEst, live) || plan; if (!live()) return; }
    if (!plan) { await wait(.4); if (live()) G.endTurn(); return; }
    // even a hopeless shot is fired: the impact it sees is the next turn's correction
    let { w, ang, pow } = plan; const opt = {};
    ang += gauss() * P0.aimErr * (w.cat === 'laser' ? .15 : 1); pow = clamp(pow * (1 + gauss() * P0.powErr), .05, 1);
    // 5. traverse the barrel visibly, then fire
    await this.traverse(me, ang, live); if (!live()) return;
    me.power = pow; me.lastAimAt = [rec.x, rec.y]; await wait(.35); if (!live()) return;
    // the barrel is physical: if a wall or the ground holds it off the solution, back off, think again
    const off = () => { const d = aimW(me) - ang; return Math.abs(Math.atan2(Math.sin(d), Math.cos(d))); };
    if (me.barrel && off() > .06 && S.fuel > 0) { await this.drive(side, me, live, Math.random() < .5 ? -1 : 1, .8); if (!live()) return; const p2 = await this.plan(side, me, rec, tx, ty, windEst, live); if (!live()) return;
      if (p2) { ({ w, ang, pow } = p2); ang += gauss() * P0.aimErr; pow = clamp(pow * (1 + gauss() * P0.powErr), .05, 1); await this.traverse(me, ang, live); if (!live()) return; me.power = pow; await wait(.35); if (!live()) return; } }
    G.doFire(side, w.id, opt);
  },
  // every usable weapon, imagined: chance to connect × damage × taste
  async plan(side, me, rec, tx, ty, windEst, live) {
    const P0 = G.aiProfile, S = G.sides[side], [mx, my] = me.def.muzzle(me), dist = Math.hypot(rec.x - mx, rec.y - my), targetWet = Water.wet(rec.x, rec.y); let best = null;
    for (const w of WEAPONS.all()) {
      if (!(S.ammo[w.id] > 0) || !canUse(me, w) || w.ai === false || w.lamp || w.cat === 'drone') continue; if (!live()) return null;
      const taste = Math.sqrt(P0.prefs[w.id] ?? 1); let c;
      if (w.cat === 'laser') { if (!laserClear(me, rec.x, rec.y + .6)) continue; c = { w, ang: Math.atan2(rec.y + .6 - my, rec.x - mx), pow: 1, grade: rec.err > 6 ? 1 : 3, dmg: (w.dps || 40) * (w.dur || 2), x: rec.x, y: rec.y, R: 2 }; }
      else { if (w.cat === 'stream' && (dist > 110 || targetWet)) continue; const s = await solveShotA(me, w, tx, ty, windEst); if (!live()) return null; if (s.score > 5e3) continue;
        c = { w, ang: s.ang, pow: s.pow, grade: hitGrade(me, w, s, tx, ty, P0, windEst, rec.err || 0), dmg: w.cat === 'stream' ? 90 : w.dmg || 60, miss: s.miss, x: s.x, y: s.y, R: hitR(w) };
        if (!c.grade) continue; }                     // its own shell would come down on it: drop this weapon
      c.ev = GRADE_P[c.grade] * c.dmg * taste + (c.miss != null ? 1 / (1 + c.miss) : 0);     // with no chance anywhere, the nearest miss wins
      if (!best || c.ev > best.ev) best = c;
    }
    if (best) G.aiMark = { side, x: best.x, y: best.y, R: best.R, grade: best.grade, t: Clock.t };
    return best;
  },
  async drive(side, me, live, dir, T) { const S = G.sides[side]; let t = 0; while (live() && S.fuel > 0 && t < T) { me.drive = dir; await wait(.1); t += .1; } me.drive = 0; await wait(.6); },
  async traverse(me, ang, live) { ang -= me.body.GetAngle(); const a0 = me.aim; for (let k = 1; k <= 20; k++) { me.aim = lerp(a0, ang, k / 20); await wait(.03); if (!live()) return; } },
  impactSeen(side, li) { return G.units.some(o => o.alive && o.side === side && Math.hypot(unitPos(o)[0] - li.x, unitPos(o)[1] - li.y) < Math.min(VIS.vatm(), DETECT_DAY * Math.sqrt(G.day.lum + 1.5))); },
  // move: tanks stay dry and away from edges, submarines stay in their lake
  async relocate(side, me, live) {
    const S = G.sides[side]; let dir = Math.random() < .5 ? -1 : 1, t = 0; const T = rnd(1.5, 3.5);
    while (live() && S.fuel > 0 && t < T) { me.drive = dir; await wait(.1); t += .1; }
    me.drive = 0; await wait(.5);
  }
};
Bus.on('log', e => { if (e.warn) AI.mem[e.side] && (AI.mem[e.side].exposedTurn = G.turn); });

