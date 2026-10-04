// =====================================================================
// GAME. Match lifecycle, turn rules, main loop, input, HUD, menu.
// =====================================================================
const G = {
  phase: 'boot', units: [], blocks: [], shots: [], flares: [], sides: [], turn: 1, cur: 0, turnId: 0, viewSide: 0, wind: 0, shake: 0, lastImpact: [null, null],
  paused: false, speed: 1, weather: WEATHER.get('clear'), day: DAYTIME.get('day'), mode: MODES.get('duel'),
  pick: Object.assign({ mode: 'hotseat', map: 'valley', weather: 'random', day: 'day', ai: 'cautious', foe: 'tank' }, Store.get('pick', {})),
};
const STEP = 1 / 60;
G.ts = 1; G.tsT = 1;
// one device first: move stored picks to hot-seat once
if (!Store.get('v3')) { G.pick.mode = 'hotseat'; Store.set('pick', G.pick); Store.set('v3', 1); }
// turn banner: a coloured stripe with the vehicle, so a turn change is never silent
G.banner = function (side) { G.bannerAt = performance.now(); G.bannerSide = side; };
function resolvePick(reg, v) { return v === 'random' ? pick(reg.all()) : reg.get(v); }

function buildWorld(mapId, seed) {
  RNG = mulberry32(seed); createPhysics(QUALITY[cfg.quality] || QUALITY.mid);
  G.units = []; G.blocks = []; G.shots = []; G.flares = []; FX.clear(); Lamps.reset();
  const m = MAPS.get(mapId).gen(seed); G.map = m; Terrain.build(m.islands);
  Grav.init(); Grav.build(); { const home = m.islands.find(I => I.home === 0) || m.islands[0], [gx, gy] = Grav.surfacePoint(home, Math.PI / 2); Grav.calibrate(gx, gy + 1); }
  Terrain.paint(0, Terrain.canvas.width); Grass.rebuild(); Water.init(); Smoke.init(); fillWater(m.islands); buildBackground(seed);
  Nature.generate(seed, m); Geo.generate(seed, m); Smoke.seed();
  for (let i = 0; i < 120; i++) { Grav.apply(STEP); P.world.Step(STEP, 4, 2, 2); }      // let lakes and stones settle onto their islands
  Water.update(); Smoke.update(); Smoke.paint(); G.water0 = P.water.GetParticleCount();
}
function previewWorld() {
  G.phase = 'menu'; G.seed = (Math.random() * 1e9) | 0; G.weather = resolvePick(WEATHER, G.pick.weather); G.day = resolvePick(DAYTIME, G.pick.day); G.wind = G.weather.wind * (Math.random() < .5 ? -1 : 1); G.windT = null; G.ts = G.tsT = 1;
  const mapId = G.pick.map === 'random' || !MAPS.has(G.pick.map) ? pick(MAPS.ids()) : G.pick.map; G.mapId = mapId; buildWorld(mapId, G.seed); G.sides = []; Intel.reset();
  V.frame(0, WORLD_W, WORLD_H / 2); UI.menuInfo(); requestAnimationFrame(menuCam);
}
function menuCam() { const pl = document.querySelector('.menuplate'); if (!pl || G.phase !== 'menu') return; const top = pl.getBoundingClientRect().top; V.z = V.W / (WORLD_W * 1.05); V.cx = WORLD_W / 2; V.cy = WORLD_H / 2 - (V.py0() - top * .55) / V.z; }
// the surface point of an island closest to a given direction, skipping water and craters
function homeSpot(I, a0) {
  for (let k = 0; k < 80; k++) { const a = a0 + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * .07, [x, y] = Grav.surfacePoint(I, a), [ux, uy] = Grav.up(x, y); if ((I.cr || []).every(c => Math.hypot(x - c.x, y - c.y) > c.rc + 7) && !Water.wet(x + ux, y + uy) && !Water.wet(x + ux * 3, y + uy * 3) && !Water.wet(x + uy * 4, y - ux * 4) && !Water.wet(x - uy * 4, y + ux * 4)) return [x, y]; }
  return Grav.surfacePoint(I, a0);
}
function sitTank(u, x, y) { const [ux, uy] = Grav.up(x, y); placeUnit(u, x + ux * 2 * SC, y + uy * 2 * SC, Math.atan2(uy, ux) - Math.PI / 2); }
// a structure stands on the ground point (x,y), its local x along the ground, y along the local up
function placeStructureAt(id, x, y) {
  const [ux, uy] = surfaceNormal(x, y), tx = uy, ty = -ux, ang = Math.atan2(uy, ux) - Math.PI / 2, out = [];
  for (const [m, ox, oy, w, h] of STRUCTURES.get(id).blocks) { const bx = x + tx * ox * SC + ux * (oy * SC + .15), by = y + ty * ox * SC + uy * (oy * SC + .15), blk = spawnBlock(m, bx, by, w * SC, h * SC); P.V1.Set(bx, by); blk.body.SetTransform(P.V1, ang); out.push(blk); }
  return out;
}
function removeStructure(list) { for (const b of list) if (b.alive) { b.alive = false; P.bodyMap.delete(B.getPointer(b.body)); P.world.DestroyBody(b.body); } }
function islandOf(x, y) { let best = null, bd = 1e9; for (const I of G.map.islands) { const d = Math.hypot(x - I.x, y - I.y) / I.r; if (d < bd) { bd = d; best = I; } } return bd < 1.8 ? best : null; }
function newMatch() {
  G.mode = MODES.get(G.pick.mode); G.aiProfile = AI_PROFILES.get(G.pick.ai);
  buildWorld(G.mapId, G.seed); Intel.reset(); AI.reset(); G.lastImpact = [null, null]; G.turn = 1; G.turnId = 0; G.reveal = false;
  const m = G.map; G.sides = [0, 1].map(s => {
    const human = G.mode.sides[s] === 'human', buff = human && (s === 0 || G.mode.id === 'hotseat'), home = m.islands.find(I => I.home === s) || m.islands[s];
    const other = m.islands.find(I => I.home === 1 - s) || m.islands[1 - s], toward = Math.atan2(other.y - home.y, other.x - home.x), a0 = lerp(Math.PI / 2, toward, .35) + rnd(-.25, .25);
    const [x, y] = homeSpot(home, a0); for (const rk of Nature.rocks) { const p = rk.body.GetPosition(); if (!rk.buried && Math.hypot(p.x - x, p.y - y) < 7) { P.bodyMap.delete(B.getPointer(rk.body)); P.world.DestroyBody(rk.body); rk.gone = true; } } Nature.rocks = Nature.rocks.filter(r => !r.gone);
    const unit = spawnUnit('tank', s, x, y + 3); sitTank(unit, x, y);
    if (buff) { unit.maxHp = unit.hp = unit.def.hp + upLevel('armor') * 15; }
    const ammo = {}, recon = {}; WEAPONS.all().forEach(w => ammo[w.id] = canUse(unit, w) ? w.ammo : 0); RECON.all().forEach(r => recon[r.id] = r.charges);
    return { ctrl: G.mode.sides[s], tank: unit, ammo, recon, home, structs: [], fuelMax: 14 * SC * (buff ? 1 + upLevel('fuel') * .2 : 1), fuel: 0, fired: false, reconned: false };
  });
  // machines deploy themselves: two random pieces between them and the enemy
  for (const s of [0, 1]) if (G.sides[s].ctrl !== 'human') { const S = G.sides[s], ids = STRUCTURES.ids(), [tx, ty] = unitPos(S.tank), a = Math.atan2(ty - S.home.y, tx - S.home.x), dir = s ? 1 : -1; for (const off of [.22, .4]) { const [x, y] = homeSpot(S.home, a + dir * off * (60 / S.home.r) * .5); S.structs.push(placeStructureAt(pick(ids), x, y)); } }
  for (let i = 0; i < 60; i++) { Grav.apply(STEP); P.world.Step(STEP, 6, 2, 2); }
  UI.showMenu(false); V.insets(); AU.playMusic('field');
  const first = G.sides.findIndex(S => S.ctrl === 'human'); G.deploySide = first; G.viewSide = first; G.cur = first; G.phase = 'deploy'; UI.deployTool = 'tank'; G.focusHome(first); UI.refresh(); G.banner(first);
}
G.focusHome = function (s) { const I = G.sides[s].home, [x, y] = unitPos(G.sides[s].tank); V.z = V.W / (I.r * 2.6); V.cx = lerp(I.x, x, .5); V.cy = lerp(I.y, y, .5); const [ux, uy] = Grav.up(x, y); V.rotT = V.rot = Math.atan2(uy, ux) - Math.PI / 2; V.clampCam(); };
// before the battle: tap your island to move the tank or drop a structure (up to DEPLOY_STRUCTS; the oldest one gives way)
G.deployTap = function (X, Y) {
  if (G.phase !== 'deploy') return; const s = G.deploySide, S = G.sides[s], [wx, wy] = V.w2(X, Y);
  if (UI.deployTool === 'lamp') { if (Terrain.solid(wx, wy)) { SFX.beep(false); return; } if (S.lamp && !S.lamp.dead) Lamps.remove(S.lamp); S.lamp = Lamps.add(wx, wy, s, { dist: 44 * SC }); SFX.click(); UI.refresh(); return; }
  if (UI.deployTool === 'tank') { const I = islandOf(wx, wy); if (I !== S.home || Terrain.solid(wx, wy)) { SFX.beep(false); return; } placeUnit(S.tank, wx, wy, S.tank.body.GetAngle()); SFX.click(); UI.refresh(); return; }
  const gpt = Grav.dropToGround(wx, wy, 90); if (!gpt) return;
  const [x, y] = gpt, [ux, uy] = Grav.up(x, y); if (islandOf(x, y) !== S.home || Water.wet(x + ux, y + uy) || Water.wet(x + ux * 2.5, y + uy * 2.5)) { SFX.beep(false); return; }
  { if (S.structs.length >= DEPLOY_STRUCTS) removeStructure(S.structs.shift()); S.structs.push(placeStructureAt(UI.deployTool, x, y)); }
  SFX.click(); UI.refresh();
};
G.deployTurn = function (dir, dt) { if (G.phase !== 'deploy') return; const u = G.sides[G.deploySide].tank, [x, y] = unitPos(u); placeUnit(u, x, y, u.body.GetAngle() + dir * 1.6 * dt); };
G.deployDone = function () {
  if (G.phase !== 'deploy') return; const next = G.sides.findIndex((S, i) => i > G.deploySide && S.ctrl === 'human');
  if (next >= 0) { G.deploySide = next; G.viewSide = next; G.cur = next; UI.deployTool = 'tank'; G.focusHome(next); UI.refresh(); UI.cover(next); return; }
  Nature.dress(G.seed, G.map);                                   // only now: stones, barrels, crates, grass
  G.phase = 'play'; if (G.mode.id === 'hotseat') { G.turn = 0; G.startTurn(0, false); } else G.startTurn(0, true);
};
G.startTurn = function (side, first) {
  G.tsT = 1; if (G.aiMark && G.aiMark.side === side) G.aiMark = null;
  if (!first) Lamps.tickTurn(side);
  if (!first && side === 0) G.turn++; G.cur = side; G.turnId++; const S = G.sides[side]; S.fireAt = null; S.fuel = S.fuelMax; S.tank.droneTx = null; S.fired = false; S.reconned = false;
  const w = G.weather, w0 = G.windT ?? G.wind; G.windT = clamp(w0 * .55 + Math.sign(w0 || 1) * w.wind * .45 + gauss() * w.gust, -w.wind - w.gust * 2, w.wind + w.gust * 2);
  for (const u of G.units) {
    if (!u.alive || u.side !== side) continue;
    if (u.type === 'drone' && --u.life < 0) { u.hp = 0; killUnit(u, 'recalled'); continue; }
  }
  G.phase = 'play';
  const th = Intel.threats(side); if (th.length) log(side, th.length > 1 ? `Дроны на подлёте: ${th.length}` : 'Дрон на подлёте', true);
  if (S.ctrl === 'human') { if (G.mode.id === 'hotseat' && !first) { G.viewSide = side; UI.cover(side); } else G.banner(side); AU.setTension(.25); }
  else { G.banner(side); AU.setTension(.75); AI.run(side); }
  UI.refresh(); if (S.ctrl === 'human') { const u = S.tank; if (u.alive) { const [x, y] = unitPos(u); V.cx = x + (side ? -28 : 28); V.cy = y + 16; V.z = Math.max(V.z, V.W / 150); V.clampCam(); } }
};
// end of a human turn: the world freezes, the player looks around, then hands over
G.pass = function () { if (G.phase !== 'review') return; G.tsT = 1; SFX.click(); G.startTurn(1 - G.cur); };
G.endTurn = function (instant) { if (G.phase !== 'play') return; G.phase = 'resolve'; G.resolveAt = instant ? Clock.t - .6 : Clock.t; G.sides.forEach(s => s.tank.drive = 0); UI.refresh(); };
G.doFire = function (side, wid, opt) {
  const S = G.sides[side], u = S.tank, w = WEAPONS.get(wid); if (G.phase !== 'play' || G.cur !== side || S.fired || !u.alive || !(S.ammo[wid] > 0) || !canUse(u, w)) return false;
  u.drive = 0; S.fired = true; S.ammo[wid]--; const shot = WEAPON_CATS.get(w.cat).fire(u, w, aimW(u), u.power, opt);
  const [mx, my] = u.def.muzzle(u); FX.flash(mx, my, 22, 2.2, .6); FX.burst(mx, my, 8, '#f0d7a0', .5); acousticReveal(u); haptic(18);
  if (S.ctrl === 'ai') AI.mem[side].exposedTurn = G.turn; if (!u.lastAimAt || S.ctrl === 'human') u.lastAimAt = null;
  if (S.ctrl === 'human' && !w.delayed) { S.fireAt = Clock.t; UI.refresh(); return true; }   // 10 more seconds at the wheel, no camera jump
  Bus.emit('log', { side: 1 - side, text: w.delayed ? 'Запуск дрона, засечка' : Intel.vis[1 - side].has(u.id) ? 'Противник открыл огонь' : 'Звук выстрела, засечка', warn: true });
  if (w.delayed) Bus.emit('log', { side, text: 'Дрон ушёл. Ход передан' });
  G.endTurn(!!w.delayed); return true;
};
G.doRecon = function (side, rid) {
  const S = G.sides[side], u = S.tank; if (G.phase !== 'play' || G.cur !== side || S.reconned || !u.alive || !(S.recon[rid] > 0)) return -1;
  const dur = RECON.get(rid).run(u); if (dur < 0) return -1; S.reconned = true; S.recon[rid]--; UI.refresh(); return dur;
};
function quiet() {
  if (Clock.t - G.resolveAt < 1) return false; if (Clock.t - G.resolveAt > 16) return true;
  if (G.shots.length) return false; for (const s of G.sides) { const u = s.tank; if (u.alive && Math.hypot(u.body.GetLinearVelocity().x, u.body.GetLinearVelocity().y) > 1.2) return false; } return true;
}
Bus.on('unitDied', ({ u }) => { if (!G.sides[u.side] || G.sides[u.side].tank !== u || G.phase === 'over' || G.phase === 'menu') return; const winner = 1 - u.side; setTimeout(() => G.finish(winner), 1600); G.phase = 'resolve'; G.resolveAt = Clock.t + 999; });
G.finish = function (winner) {
  if (G.phase === 'over' || G.phase === 'menu') return; G.phase = 'over'; G.reveal = true; AU.setTension(0);
  let earned = 0; const humanWon = G.sides[winner].ctrl === 'human';
  if (G.mode.id === 'duel') { if (humanWon) { earned = 120 + Math.round(G.sides[0].tank.hp); save.wins++; } else { earned = 40; save.losses++; } }
  else if (G.mode.id === 'hotseat') earned = 30; else earned = humanWon ? 60 : 20;
  save.credits += earned; persist(); UI.result(winner, earned);
};

// ---------- main loop ----------
let last = performance.now(), acc = 0, stepN = 0, frameN = 0;
function physicsStep(dt) {
  for (const s of G.shots) { const c = WEAPON_CATS.get(s.kind); if (c && c.prestep && !s.dead) c.prestep(s, dt); }
  const S = G.sides[G.cur];
  if (S && G.phase === 'play') { const u = S.tank; if (u.alive && (u.drive || u.dive)) { const v = Math.abs(u.body.GetLinearVelocity().x); S.fuel -= Math.max(v, 1.2) * dt; if (S.fuel <= 0) { S.fuel = 0; u.drive = 0; u.dive = 0; } } }
  for (const u of G.units) if (u.alive) {
    // the barrel is a heavy thing: it turns toward the commanded angle at a finite rate
    if (u.aimT != null) { const d = Math.atan2(Math.sin(u.aimT - u.aim), Math.cos(u.aimT - u.aim)), m = 1.3 * dt; if (Math.abs(d) <= m) { u.aim = u.aimT; if (!u.levering) u.aimT = null; } else u.aim += Math.sign(d) * m; }
    u.def.update(u, dt);
  }
  if (G.weather.rain && Math.random() < G.weather.rain * dt && P.water.GetParticleCount() < Math.min(P.water.GetMaxParticleCount() * .8, (G.water0 || 0) * 1.3 + 150)) { // rain lands on the surface: accumulation without mid-air collisions
    const rx = rnd(2, WORLD_W - 2); let ry = Terrain.topAt(rx) + 1; while (Water.wet(rx, ry) && ry < WORLD_H - 2) ry += .4; if (ry > 2 && !G.units.some(u => u.alive && Math.abs(unitPos(u)[0] - rx) < 4.4)) spawnParticle(P.water, rx, ry + .3, G.wind * .1, -2, WATER_FLAGS()); }
  Grav.apply(dt); waterCling();
  if (G.phase === 'deploy') for (const S of G.sides) for (const b of S.tank.bodies) { P.V1.Set(0, 0); b.SetLinearVelocity(P.V1); b.SetAngularVelocity(0); }
  P.world.Step(dt, 6, 2, 2);
  for (const s of G.shots) { if ((s.kind === 'shell' || s.kind === 'rocket') && !s.dead) WEAPON_CATS.get(s.kind).poststep(s, dt); if (s.kind === 'timer') { s.t += dt; if (s.t > s.dur) s.dead = true; } }
  G.shots = G.shots.filter(s => !s.dead);
  for (const f of G.flares) { f.y -= .9 * dt; f.x += G.wind * .15 * dt; f.life -= dt; if (Terrain.solid(f.x, f.y) || Water.wet(f.x, f.y)) f.life = Math.min(f.life, 1); } G.flares = G.flares.filter(f => f.life > 0);
  { const S = G.sides[G.cur]; if (G.phase === 'play' && S && S.fired && S.fireAt != null && Clock.t - S.fireAt > 10) { S.fireAt = null; G.endTurn(); } }
  const k = stepN++; if (G.windT != null) G.wind += (G.windT - G.wind) * Math.min(1, dt * .6);
  if ((k & 1) === 0) { FireSys.update(dt * 2); Dirt.settle(); floatOnWater(P.oil); }
  Geo.update(dt);
  if ((k & 3) === 1) Smoke.herd();
  Nature.update(dt); Lamps.update(); if (G.phase !== 'menu') Acoustics.update(dt);
  if ((k % 30) === 7) for (const ps of [P.water, P.fire, P.smoke, P.oil, P.steam, P.lava]) { const { n, pos } = particleArrays(ps); for (let i = 0; i < n; i++) if (pos[i * 2 + 1] < -40 || pos[i * 2] < -150 || pos[i * 2] > WORLD_W + 150) ps.DestroyParticle(i); }   // the void eats what falls
  Terrain.flush(); Grav.update(); FX.update(dt); Clock.t += dt; tickWaits();
  if (G.phase === 'resolve' && quiet()) { if (G.sides[G.cur].ctrl === 'human') { G.phase = 'review'; G.tsT = .001; /* the world slows to a crawl, nothing is stopped or reset */ UI.refresh(); } else G.startTurn(1 - G.cur); }
}
function frame(ts) {
  const real = Math.min(.05, (ts - last) / 1000); last = ts;
  if (P.world && !G.paused) { G.ts += ((G.tsT ?? 1) - (G.ts ?? 1)) * Math.min(1, real * 3.5); acc += real * G.speed * G.ts; let n = 0; while (acc >= STEP && n < 5) { physicsStep(STEP); acc -= STEP; n++; } if (n === 5) acc = 0; Water.update(); Smoke.update(); Lights.collect(); if (G.phase !== 'menu') Intel.update(); }
  if ((frameN++ & 1) === 0 && P.world) Terrain.repaint();
  // camera
  if (V.follow) { try { const p = V.follow.GetPosition(); V.cx = lerp(V.cx, p.x, .12); V.cy = lerp(V.cy, p.y, .12); } catch (e) { V.follow = null; } if (!G.shots.some(s => s.body === V.follow)) V.follow = null; V.clampCam(); }
  if (G.phase !== 'menu' && G.sides[G.viewSide] && G.sides[G.viewSide].tank.alive) { const [x, y] = unitPos(G.sides[G.viewSide].tank), [ux, uy] = Grav.up(x, y); V.rotT = Math.atan2(uy, ux) - Math.PI / 2; } V.turn(real);
  // while your own machine moves, the camera keeps it in frame (panning away still works when it stands)
  { const S = G.sides[G.cur], u = S && S.tank; if (G.phase === 'play' && S.ctrl === 'human' && u.alive && !V.follow && (u.drive || Math.hypot(u.body.GetLinearVelocity().x, u.body.GetLinearVelocity().y) > 2)) { const [x, y] = unitPos(u), [ux, uy] = Grav.up(x, y), vv = u.body.GetLinearVelocity(), k = Math.min(1, real * 3); V.cx = lerp(V.cx, x + ux * 10 + vv.x * .4, k); V.cy = lerp(V.cy, y + uy * 10 + vv.y * .4, k); } }
  G.shake *= .88; V.shx = (Math.random() - .5) * G.shake; V.shy = (Math.random() - .5) * G.shake;
  V.insets(); if (G.phase !== 'menu') V.clampCam(); if (P.world) render(); UI.tick(); requestAnimationFrame(frame);
}
function log(side, text, warn) { Bus.emit('log', { side, text, warn }); }
Bus.on('contact', ({ side, e, d }) => log(side, `Контакт: ${UNITS.get(e.type).name.toLowerCase()}, ${Math.round(d)} м`));
Bus.on('spotted', ({ side, id }) => { const u = G.units.find(x => x.id === id); if (u) log(side, `Вижу: ${u.def.name.toLowerCase()}`); });

// ---------- input ----------
const ptrs = new Map(); let pinch = null;
cv.addEventListener('pointerdown', e => {
  AU.init(); cv.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY, mode: 'pan' });
  if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), z: V.z, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 }; ptrs.forEach(p => p.mode = 'pinch'); return; }
  /* no drag-to-aim: the levers are the only sight, a touch on the world always moves the camera */
});
cv.addEventListener('pointermove', e => {
  const p = ptrs.get(e.pointerId); if (!p) return; const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY; p.dist = (p.dist || 0) + Math.abs(dx) + Math.abs(dy); if (p.dist > 10) p.moved = true;
  if (p.mode === 'pan') { V.panBy(dx, dy); V.follow = null; V.clampCam(); }
  else if (p.mode === 'pinch' && ptrs.size === 2 && pinch) { const [a, b] = [...ptrs.values()], d = Math.hypot(a.x - b.x, a.y - b.y), mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2; const [wx, wy] = V.w2(pinch.mx, pinch.my); V.z = clamp(pinch.z * d / pinch.d, V.minZ(), 24); V.anchor(wx, wy, mx, my); pinch.mx = mx; pinch.my = my; pinch.z = V.z; pinch.d = d; V.follow = null; V.clampCam(); }
});
const up = e => {
  const p0 = ptrs.get(e.pointerId);
  if (p0 && p0.mode === 'pan' && ptrs.size === 1 && !p0.moved && G.phase === 'deploy') G.deployTap(e.clientX, e.clientY);
  else if (p0 && p0.mode === 'pan' && ptrs.size === 1 && !p0.moved) { const u = UI.myUnit(), w = WEAPONS.get(UI.weapon); if (u && w && w.cat === 'drone' && !G.sides[G.cur].fired) { u.droneTx = clamp(V.w2(e.clientX, e.clientY)[0], 6, WORLD_W - 6); SFX.beep(droneBeepHot(u) ? 1 : 0); } }
  ptrs.delete(e.pointerId); if (ptrs.size < 2) pinch = null; ptrs.forEach(p => { if (p.mode === 'pinch') p.mode = 'pan'; }); };
cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
cv.addEventListener('wheel', e => { e.preventDefault(); const [wx, wy] = V.w2(e.clientX, e.clientY); V.z = clamp(V.z * Math.exp(-e.deltaY * .0015), V.minZ(), 24); V.anchor(wx, wy, e.clientX, e.clientY); V.follow = null; V.clampCam(); }, { passive: false });
addEventListener('keydown', e => {
  if (G.phase !== 'play') return; const S = G.sides[G.cur]; if (!S || S.ctrl !== 'human') return; const u = S.tank;
  if (e.key === 'ArrowLeft' || e.key === 'a') u.drive = S.fuel > 0 ? -1 : 0; if (e.key === 'ArrowRight' || e.key === 'd') u.drive = S.fuel > 0 ? 1 : 0;
  if (e.key === 'ArrowUp') u.aim += (Math.cos(u.aim) >= 0 ? 1 : -1) * .02; if (e.key === 'ArrowDown') u.aim -= (Math.cos(u.aim) >= 0 ? 1 : -1) * .02;
  if (e.key === 'w') u.power = clamp(u.power + .01, .05, 1); if (e.key === 's') u.power = clamp(u.power - .01, .05, 1);
  if (e.key === ' ') G.doFire(G.cur, UI.weapon); if (e.key === 'r') G.doRecon(G.cur, UI.recon); UI.refresh();
});
addEventListener('keyup', e => { if (['ArrowLeft', 'ArrowRight', 'a', 'd'].includes(e.key) && G.sides[G.cur]) G.sides[G.cur].tank.drive = 0; });
addEventListener('keydown', e => { if (e.key === 'p' || e.key === 'Escape') UI.togglePause(); });

