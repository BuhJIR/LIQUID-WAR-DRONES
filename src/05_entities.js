// =====================================================================
// ENTITIES. Unit types are registry entries: create / update / draw.
// Every unit is also an observer with an eye height and a signature.
// =====================================================================
let UID = 1;
const SIDE_COL = ['#c9a45c', '#9a4a3c'];     // sodium amber vs oxide red
function boxShape(hx, hy, cx = 0, cy = 0, a = 0) { const s = new B.b2PolygonShape(); P.V1.Set(cx, cy); s.SetAsBox(hx, hy, P.V1, a); return s; }
function circleShape(r) { const s = new B.b2CircleShape(); s.set_m_radius(r); return s; }
function mkBody(type, x, y, opts = {}) {
  const bd = new B.b2BodyDef(); bd.type = type; P.V1.Set(x, y); bd.position = P.V1; if (opts.bullet) bd.bullet = true; if (opts.fixedRotation) bd.fixedRotation = true;
  if (opts.gravityScale != null) bd.gravityScale = opts.gravityScale; if (opts.linearDamping) bd.linearDamping = opts.linearDamping; if (opts.angularDamping) bd.angularDamping = opts.angularDamping;
  const b = P.world.CreateBody(bd); B.destroy(bd); return b;
}
function addFix(body, shape, density, friction = .6, restitution = 0) { const fd = new B.b2FixtureDef(); fd.shape = shape; fd.density = density; fd.friction = friction; fd.restitution = restitution; const f = body.CreateFixture(fd); B.destroy(fd); return f; }

function spawnUnit(type, side, x, y, extra = {}) {
  const def = UNITS.get(type), u = Object.assign({ id: UID++, type, def, side, alive: true, hp: def.hp, maxHp: def.hp, bodies: [] }, extra);
  def.create(u, x, y); u.bodies.forEach(b => P.bodyMap.set(B.getPointer(b), { kind: 'unit', u })); G.units.push(u); return u;
}
// move a whole multi-body unit rigidly: chassis to (x,y) with angle ang, the rest keeps its offsets
function placeUnit(u, x, y, ang) {
  const c = u.body.GetPosition(), ca = u.body.GetAngle(), cx = c.x, cy = c.y, parts = u.bodies.map(b => { const p = b.GetPosition(), dx = p.x - cx, dy = p.y - cy, co = Math.cos(-ca), si = Math.sin(-ca); return [b, dx * co - dy * si, dx * si + dy * co, b.GetAngle() - ca]; });
  const co = Math.cos(ang), si = Math.sin(ang);
  for (const [b, lx, ly, da] of parts) { P.V1.Set(x + lx * co - ly * si, y + lx * si + ly * co); b.SetTransform(P.V1, ang + da); P.V2.Set(0, 0); b.SetLinearVelocity(P.V2); b.SetAngularVelocity(0); b.SetAwake(true); }
}
function unitPos(u) { const p = u.body.GetPosition(); return [p.x, p.y]; }
function killUnit(u, why) {
  if (!u.alive) return; u.alive = false; const [x, y] = unitPos(u);
  (u.clearFx || []).forEach(f => P.clear.delete(f)); u.bodies.forEach(b => { P.bodyMap.delete(B.getPointer(b)); P.world.DestroyBody(b); }); u.bodies = [];
  u.deadAt = [x, y]; Intel.forget(u); FX.burst(x, y, 40, '#e8c07a'); FX.flash(x, y, 14, 2.2); SFX.boom(1.2, camDist(x, y));
  if (u.def.onDeath) u.def.onDeath(u);
  Bus.emit('unitDied', { u, why });
}
const DMG_COL = { fire: '#ff8a3a', medium: '#6fb6d8', water: '#6fb6d8' };   // colour says what hurts, no words
function damageUnit(u, dmg, src, silent) {
  if (!u.alive || dmg <= 0) return; u.hp -= dmg; u.lastHit = Clock.t;
  if (silent) { u.dmgAcc = (u.dmgAcc || 0) + dmg; if (u.dmgAcc >= 4) { FX.text(...unitPos(u), '-' + Math.round(u.dmgAcc), DMG_COL[src] || (u.side === G.viewSide ? '#d98870' : '#e8d3a0'), u.dmgAcc); u.dmgAcc = 0; } }
  else FX.text(...unitPos(u), '-' + Math.round(dmg), u.side === G.viewSide ? '#d98870' : '#e8d3a0', dmg);
  if (u.hp <= 0) killUnit(u, src);
}
// "wrong medium" damage: a tank under water, a submarine in air. Mirror rules.
function mediumDrain(u, dt, bad, rate, msg) {
  if (!bad) { u.drainT = 0; return; } damageUnit(u, rate * dt, 'medium', true);
  if (!u.drainT || Clock.t - u.drainT > 6) { u.drainT = Clock.t; Bus.emit('log', { side: u.side, text: msg, warn: true }); }
}
// the barrel angle lives in the hull frame; the world angle is hull + barrel
const aimW = u => u.barrel ? u.barrel.GetAngle() + (u.barrelFlip || 0) : u.aim + u.body.GetAngle();   // where the barrel really points (a physical body for tanks)
// one collision group per side: a side's own shells never touch its own hull or barrel
function setGroup(b, g) { for (let f = b.GetFixtureList(); f && B.getPointer(f); f = f.GetNext()) { const fd = f.GetFilterData(); fd.set_groupIndex(g); f.SetFilterData(fd); } }
const rot = (a, x, y) => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];

// ---------- tank (SC-scaled). Ballast plate low in the hull keeps it upright ----------
const TK = { k: .8, hx: 3.2, hy: .8, wr: .27, piv: 1.1, barrel: 3.2 };   // R.U.B.E. tank at scale k (hull ≈ 6.6 m)
// Build a vehicle from a R.U.B.E. blueprint at (x,y), scaled by k; mirror flips it to face left.
// Returns every body with its role and drawable shapes, plus the joints by kind.
const V2 = (x, y) => { P.V1.Set(x, y); return P.V1; };
// Box2D 2.4 springs: stiffness and damping from a frequency (Hz) and damping ratio, as b2LinearStiffness does
function springOn(jd, hz, zeta, A, Bb) { const mA = A.GetMass(), mB = Bb.GetMass(), m = mA > 0 && mB > 0 ? mA * mB / (mA + mB) : mA || mB, w = TAU * hz; jd.stiffness = m * w * w; jd.damping = 2 * m * zeta * w; }
function buildVehicle(bp, x, y, k, mirror, side) {
  const m = mirror ? -1 : 1, out = { bodies: [], parts: [], joints: [], byRole: {}, clearFx: [] };
  for (const bd of bp.bodies) {
    const b = mkBody(B.b2_dynamicBody, x + bd.p[0] * k * m, y + bd.p[1] * k, { angularDamping: bd.k === 'hull' ? 1.2 : bd.k === 'barrel' ? 4 : .2 }); b.SetTransform(V2(x + bd.p[0] * k * m, y + bd.p[1] * k), bd.a * m);
    const shapes = [];
    for (const f of bd.fx) {
      let sh, draw;
      if (f.p) { let v = f.p.map(([vx, vy]) => [vx * k * m, vy * k]); if (mirror) v.reverse(); sh = polyShape(v); draw = { p: v }; }
      else { sh = circleShape(f.c[2] * k); draw = { r: f.c[2] * k }; }
      const fd = new B.b2FixtureDef(); fd.shape = sh; fd.density = f.d; fd.friction = f.f; fd.restitution = f.r || 0; const fx = b.CreateFixture(fd); B.destroy(fd);
      if (f.g) { const fl = fx.GetFilterData(); fl.set_groupIndex(-(10 + side)); fx.SetFilterData(fl); }
      if (bd.k === 'link' || bd.k === 'wheel' || bd.k === 'sprocket' || (bd.k === 'hull' && f.p && Math.max(...f.p.map(q => q[1])) < .35)) { const fp = B.getPointer(fx); P.clear.add(fp); out.clearFx.push(fp); }   // the running gear: water and loose soil pass through it          // tread links never touch each other or the lower hull
      shapes.push(draw);
    }
    const part = { b, k: bd.k, shapes }; out.bodies.push(b); out.parts.push(part); (out.byRole[bd.k] = out.byRole[bd.k] || []).push(part);
  }
  for (const j of bp.joints) {
    const A = out.bodies[j.a], Bb = out.bodies[j.b], la = [j.la[0] * k * m, j.la[1] * k], lb = [j.lb[0] * k * m, j.lb[1] * k]; let jd, cast;
    if (j.t === 'r') { jd = new B.b2RevoluteJointDef(); jd.referenceAngle = j.ref * m; jd.enableLimit = false; jd.enableMotor = j.mot; jd.motorSpeed = j.ms * m; jd.maxMotorTorque = j.mt * k * k * k; cast = B.b2RevoluteJoint; }
    else if (j.t === 'w') { jd = new B.b2WheelJointDef(); P.V2.Set(j.ax[0] * m, j.ax[1]); jd.localAxisA = P.V2; springOn(jd, j.hz, j.dr, A, Bb); jd.enableMotor = false; jd.maxMotorTorque = j.mt * k * k * k; cast = B.b2WheelJoint; }
    else { jd = new B.b2DistanceJointDef(); jd.length = j.len * k; jd.minLength = 0; jd.maxLength = j.len * k * 3; springOn(jd, j.hz, j.dr, A, Bb); cast = B.b2DistanceJoint; }
    jd.bodyA = A; jd.bodyB = Bb; jd.localAnchorA = V2(la[0], la[1]); jd.localAnchorB = V2(lb[0], lb[1]); jd.collideConnected = false;
    const jj = B.castObject(P.world.CreateJoint(jd), cast); B.destroy(jd); out.joints.push({ t: j.t, j: jj, a: out.parts[j.a], b: out.parts[j.b], lb });
  }
  return out;
}
UNITS.add('tank', {
  name: 'Танк', hp: 100, eye: 3 * SC, sig: 1, r0: .25, main: true, hear: 70 * SC,
  noise(u) { return u.drive ? 1 : 0; },
  // the R.U.B.E. tank: sprung road wheels, a real tread of 43 links, a hinged gun and a whip antenna
  create(u, x, y) {
    const K = TK.k, mir = u.side === 1, v = buildVehicle(VEHICLES.tank, x, y, K, mir, u.side);
    u.veh = v; u.clearFx = v.clearFx; u.body = v.byRole.hull[0].b; u.bodies = v.bodies; u.wheels = v.byRole.wheel.map(p => p.b);
    u.drives = v.joints.filter(j => j.t === 'w').map(j => j.j);
    const bj = v.joints.find(j => j.t === 'r' && j.b.k === 'barrel'); u.barrel = bj.b.b; u.barrelJ = bj.j; u.barrelJ.EnableLimit(false); u.barrelJ.EnableMotor(true); u.barrelJ.SetMaxMotorTorque(260 * K * K * K);
    u.barrelFlip = mir ? Math.PI : 0; u.barrelPivB = bj.lb; u.barrelLen = 3.98 * K;
    u.aim = u.side === 0 ? .9 : Math.PI - .9; u.power = .62; u.drive = 0;
    u.mass = u.bodies.reduce((a, b) => a + b.GetMass(), 0); u.torque = 60 * K * K * K;
  },
  muzzle(u) { const q = u.barrelJ.GetAnchorA(), px = q.x, py = q.y, w = aimW(u); return [px + Math.cos(w) * u.barrelLen, py + Math.sin(w) * u.barrelLen, px, py]; },
  update(u, dt) {
    { const rel = u.barrel.GetAngle() + u.barrelFlip - u.body.GetAngle(), e = Math.atan2(Math.sin(u.aim - rel), Math.cos(u.aim - rel)); u.barrelJ.SetMotorSpeed(clamp(e * 14, -5, 5)); if (Math.abs(e) > .01) u.barrel.SetAwake(true); }   // the hinge chases the commanded angle
    const drv = u.drive; for (const j of u.drives) { j.EnableMotor(true); j.SetMotorSpeed(-drv * 14); j.SetMaxMotorTorque(drv ? u.torque : u.torque * 1.5); }   // idle = brakes on
    if (drv) u.body.SetAwake(true);
    const [x, y] = unitPos(u), a = u.body.GetAngle(), [tx, ty] = rot(a, 0, TK.piv + .3 * SC + .7);
    const [lx, ly] = rot(a, -TK.hx, 0), [rx, ry] = rot(a, TK.hx, 0);
    const [lux, luy] = Grav.up(x, y), rel = a + Math.PI / 2 - Math.atan2(luy, lux), wa = Math.atan2(Math.sin(rel), Math.cos(rel)), sp = u.body.GetLinearVelocity();   // tilt relative to the local up
    if (Math.abs(wa) > 1.25 && Math.hypot(sp.x, sp.y) < 2) { u.flipT = (u.flipT || 0) + dt; if (u.flipT > 1.2) { u.flipT = 0; placeUnit(u, x + lux * 2.5, y + luy * 2.5, Math.atan2(luy, lux) - Math.PI / 2); } } else u.flipT = 0;
    mediumDrain(u, dt, Water.wet(x + tx, y + ty) && Water.wet(x + lx - .6, y + ly) && Water.wet(x + rx + .6, y + ry), 1.3, 'Машина под водой: течь');
    if (y < -250 || y > WORLD_H + 250 || x < -250 || x > WORLD_W + 250) killUnit(u, 'bounds');   // lost in the void
  },
  right(u) { const [x, y] = unitPos(u); placeUnit(u, x, y + 1.5 * SC, 0); },
  draw(ctx, u, V) {
    const col = SIDE_COL[u.side], lw = 1.3 / V.z;
    for (const part of u.veh.parts) {
      const p = part.b.GetPosition(); ctx.save(); ctx.translate(V.sx(p.x), V.sy(p.y)); ctx.rotate(-part.b.GetAngle()); ctx.scale(V.z, -V.z); ctx.lineWidth = lw;
      const k = part.k; ctx.fillStyle = k === 'link' ? '#5d6168' : k === 'wheel' || k === 'sprocket' ? '#15171a' : k === 'barrel' ? '#2c2f33' : k === 'antenna' ? 'rgba(0,0,0,0)' : '#23262a'; ctx.strokeStyle = k === 'link' ? '#7a7f86' : k === 'wheel' || k === 'sprocket' ? '#555' : col;
      for (const sh of part.shapes) { ctx.beginPath(); if (sh.p) { sh.p.forEach(([vx, vy], i) => i ? ctx.lineTo(vx, vy) : ctx.moveTo(vx, vy)); ctx.closePath(); } else { ctx.arc(0, 0, sh.r, 0, TAU); } ctx.fill(); if (k !== 'link') ctx.stroke(); if (sh.r) { ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(sh.r, 0); ctx.stroke(); } }
      ctx.restore();
    }
  }
});

// ---------- submarine: water is its air. Buoyancy + depth keeping + thrust ----------
const SB = { hx: 3.4 * SC * .5, hy: .8 * SC * .5 };
// the hull pushes water particles away, so probe just outside it
function subWet(u) { const [x, y] = unitPos(u); return Water.wet(x, y + SB.hy + .7) || Water.wet(x - SB.hx - .8, y) || Water.wet(x + SB.hx + .8, y); }
UNITS.add('sub', {
  name: 'Субмарина', hp: 110, eye: 2.4 * SC, sig: 1.1, r0: .3, main: true, medium: 'water', hear: 150 * SC,
  noise(u) { return u.drive ? .45 : 0; },
  create(u, x, y) {
    const b = mkBody(B.b2_dynamicBody, x, y, { angularDamping: 2.5 });
    addFix(b, boxShape(SB.hx, SB.hy), 4, .4); addFix(b, boxShape(.5 * SC, .55 * SC, .3 * SC, SB.hy + .45 * SC), 2, .4);
    u.body = b; u.bodies.push(b); u.mass = b.GetMass(); u.aim = u.side ? Math.PI - .7 : .7; u.power = .6; u.drive = 0; u.depth = 1.2 * SC;
  },
  muzzle(u) { const p = u.body.GetPosition(), a = u.body.GetAngle(), [ox, oy] = rot(a, .3 * SC, SB.hy + 1.1 * SC), px = p.x + ox, py = p.y + oy; const w = a + u.aim; return [px + Math.cos(w) * .6 * SC, py + Math.sin(w) * .6 * SC, px, py]; },
  update(u, dt) {
    const b = u.body, [x, y] = unitPos(u), v = b.GetLinearVelocity(), m = u.mass, wet = subWet(u), a = b.GetAngle();
    const wetLow = Water.wet(x, y - SB.hy - .8) || Water.wet(x - SB.hx, y - SB.hy - .6) || Water.wet(x + SB.hx, y - SB.hy - .6);
    if (!wet && wetLow) { P.V1.Set(-v.x * m * .8, -m * 9.81 * .6); b.ApplyForceToCenter(P.V1, true); }   // flood the tanks, get under
    if (u.dive) { const s0 = waterSurfaceAbove(x, y + SB.hy + .7), maxD = Math.max(.3 * SC, s0 - Terrain.topAt(x) - SB.hy * 2 - 1.5); u.depth = clamp(u.depth + u.dive * 2.2 * SC * dt, .3 * SC, maxD); }
    if (wet) {
      const surf = waterSurfaceAbove(x, y + SB.hy + .7), ty = surf - u.depth - SB.hy, drag = 2.2;
      const fy = m * 9.81 + clamp(ty - y, -3, 3) * m * 2.2 - v.y * m * drag;
      const ahead = x + (u.drive || 0) * (SB.hx + 1.5), canGo = Water.wet(ahead, y) && Water.wet(ahead, y - SB.hy);
      const fx = (u.drive && canGo ? u.drive * m * 3.2 : 0) - v.x * m * 1.4;
      P.V1.Set(fx, fy); b.ApplyForceToCenter(P.V1, true); b.ApplyTorque(-a * m * 14 - b.GetAngularVelocity() * m * 5, true);
      if (u.drive && !canGo) u.blocked = true; else u.blocked = false;
    }
    mediumDrain(u, dt, !wet && !wetLow, 3, 'Лодка на воздухе: теряет прочность');
    if (y < -250 || y > WORLD_H + 250 || x < -250 || x > WORLD_W + 250) killUnit(u, 'bounds');   // lost in the void
  },
  right(u) { const [x, y] = unitPos(u); P.V1.Set(x, y); u.body.SetTransform(P.V1, 0); },
  draw(ctx, u, V) {
    const [x, y] = unitPos(u), a = u.body.GetAngle(), col = SIDE_COL[u.side];
    ctx.save(); ctx.translate(V.sx(x), V.sy(y)); ctx.scale(V.z, V.z); ctx.rotate(-a); ctx.fillStyle = '#1b1e21'; ctx.strokeStyle = col; ctx.lineWidth = 1.4 / V.z;
    ctx.beginPath(); ctx.moveTo(-SB.hx, -SB.hy * .6); ctx.lineTo(-SB.hx - .8 * SC, 0); ctx.lineTo(-SB.hx, SB.hy * .6); ctx.lineTo(-SB.hx * .2, SB.hy); ctx.lineTo(SB.hx * .7, SB.hy); ctx.quadraticCurveTo(SB.hx + SB.hy * 1.4, 0, SB.hx * .7, -SB.hy); ctx.lineTo(-SB.hx * .2, -SB.hy); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-.2 * SC, SB.hy); ctx.lineTo(0, SB.hy + 1 * SC); ctx.lineTo(.8 * SC, SB.hy + 1 * SC); ctx.lineTo(.8 * SC, SB.hy); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(.3 * SC, SB.hy + 1 * SC); ctx.lineTo(.3 * SC, SB.hy + 1.5 * SC); ctx.lineTo(.55 * SC, SB.hy + 1.5 * SC); ctx.stroke();
    ctx.restore();
    const [mx, my, px, py] = this.muzzle(u); ctx.strokeStyle = col; ctx.setLineDash([2, 3]); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(V.sx(px), V.sy(py)); ctx.lineTo(V.sx(mx + Math.cos(aimW(u)) * 2 * SC), V.sy(my + Math.sin(aimW(u)) * 2 * SC)); ctx.stroke(); ctx.setLineDash([]);
  }
});

// ---------- recon drone ----------
UNITS.add('drone', {
  name: 'Дрон', hp: 12, eye: .1, sig: .45, r0: .15, hear: 40 * SC,
  noise() { return .5; },
  create(u, x, y) { const b = mkBody(B.b2_dynamicBody, x, y, { gravityScale: 0, linearDamping: 1.2, fixedRotation: true }); addFix(b, circleShape(.45 * SC), .4, .3); u.body = b; u.bodies.push(b); u.born = Clock.t; },
  update(u, dt) {
    const [x, y] = unitPos(u), ground = Terrain.topAt(clamp(x, 0, WORLD_W - .1)), alt = Math.max(ground + 16 * SC, 30 * SC);
    const tx = u.tx, dx = clamp(tx - x, -1, 1) * 7 * RT2, dy = clamp(alt - y, -1, 1) * 5 * RT2; const v = u.body.GetLinearVelocity();
    P.V1.Set((dx - v.x) * u.body.GetMass() * 3 + G.wind * .25 * u.body.GetMass(), (dy - v.y) * u.body.GetMass() * 3); u.body.ApplyForceToCenter(P.V1, true);
    if (Clock.t - u.born > 1.5 && (Terrain.solid(x, y - 1) || Water.wet(x, y))) damageUnit(u, 40 * dt, 'crash', true);
  },
  draw(ctx, u, V) { drawRotor(ctx, u, V, .9 * SC, false); }
});
function drawRotor(ctx, u, V, span, strike) {
  const [x, y] = unitPos(u), s = V.z, cx = V.sx(x), cy = V.sy(y); ctx.strokeStyle = SIDE_COL[u.side]; ctx.lineWidth = Math.max(1, .12 * s * SC * .6);
  if (strike) { ctx.fillStyle = '#1a1c1f'; const d = Math.sign(u.vx || 1); ctx.beginPath(); ctx.moveTo(cx + d * span * s, cy); ctx.lineTo(cx - d * span * .7 * s, cy - span * .5 * s); ctx.lineTo(cx - d * span * .4 * s, cy); ctx.lineTo(cx - d * span * .7 * s, cy + span * .5 * s); ctx.closePath(); ctx.fill(); ctx.stroke(); }
  else { ctx.beginPath(); ctx.moveTo(cx - span * s, cy - .1 * s); ctx.lineTo(cx + span * s, cy - .1 * s); ctx.moveTo(cx - span * .55 * s, cy + .25 * s * SC); ctx.lineTo(cx + span * .55 * s, cy + .25 * s * SC); ctx.stroke(); }
  const r = Clock.t * 40; for (const ox of strike ? [-.55] : [-1, 1]) { const px = cx + ox * span * s * (strike ? Math.sign(u.vx || 1) : 1); ctx.beginPath(); ctx.moveTo(px - Math.cos(r) * .35 * s * SC, cy - .2 * s * SC); ctx.lineTo(px + Math.cos(r) * .35 * s * SC, cy - .2 * s * SC); ctx.stroke(); }
  if ((Clock.t * 1.5 % 1) < .12) { ctx.fillStyle = '#ff4a3a'; ctx.fillRect(cx - 1.5, cy + .25 * s, 3, 3); }
}

const DRONE_SEEK = 16 * SC;                     // seeker capture radius around the aim point (= the yellow circle)
// ---------- attack drone: climb, cruise over the terrain, dive. Loud. Its seeker is an eye. ----------
UNITS.add('strike', {
  name: 'Ударный дрон', hp: 10, eye: .2, sig: 1.25, r0: .15, hear: 0,
  noise() { return 1.8; },
  create(u, x, y) {
    const b = mkBody(B.b2_dynamicBody, x, y, { gravityScale: 0, linearDamping: .3, fixedRotation: true }); addFix(b, circleShape(.5 * SC), .5, .2); u.body = b; u.bodies.push(b);
    u.phase = 'climb'; u.born = Clock.t; u.dir = Math.sign(u.tx - x) || 1; let top = 0; for (let px = Math.min(x, u.tx); px <= Math.max(x, u.tx); px += 4) top = Math.max(top, Terrain.topAt(px));
    u.cruise = Math.min(WORLD_H - 8, top + 14 * SC); u.loop = SFX.loop('buzz'); u.wet0 = Water.wet(x, y);
  },
  update(u, dt) {
    const b = u.body, [x, y] = unitPos(u), v = b.GetLinearVelocity(), m = b.GetMass(); u.vx = v.x; const w = u.w;
    let tx = x + u.dir * 3, ty = u.cruise, sp = w.speed * .7;
    if (u.phase === 'climb') { if (y > u.cruise - 3 * SC || Clock.t - u.born > 6) u.phase = 'cruise'; }
    else if (u.phase === 'cruise') { tx = u.tx; sp = w.speed; const gy = Terrain.topAt(u.tx); if (Math.abs(u.tx - x) < Math.max(5 * SC, (y - gy) * .8)) u.phase = 'dive'; }
    if (u.phase === 'dive') {
      // terminal seeker: whatever it can actually see near the aim point
      if (!u.lock) { let bd = DRONE_SEEK; for (const e of G.units) { if (!e.alive || e.side === u.side || !e.def.main) continue; const [ex, ey] = unitPos(e), d = Math.abs(ex - u.tx); if (d < bd && Smoke.tau(x, y, ex, ey + 1) < 2.3 && !(e.type === 'sub' && waterSurfaceAbove(ex, ey + SB.hy + .7) - ey > 3 * SC)) { bd = d; u.lock = e; } } if (u.lock) SFX.click(); }
      if (u.lock) { if (!u.lock.alive) u.lock = null; else { const [ex, ey] = unitPos(u.lock); u.tx = lerp(u.tx, ex, .25); u.ty = ey + .5; } }
      tx = u.tx; ty = u.ty ?? Terrain.topAt(u.tx); sp = w.speed * 2.3;
    }
    const dx = tx - x, dy = ty - y, d = Math.hypot(dx, dy) || 1;
    P.V1.Set((dx / d * sp - v.x) * m * 3 + G.wind * .3 * m, (dy / d * sp - v.y) * m * 3); b.ApplyForceToCenter(P.V1, true);
    const wet = Water.wet(x, y); if (!wet) u.wet0 = false;
    const near = G.units.some(e => e.alive && e !== u && e.side !== u.side && e.def.main && Math.hypot(unitPos(e)[0] - x, unitPos(e)[1] - y) < 2.4 * SC)
    const armed = u.phase === 'dive' || Clock.t - u.born > 2.5, nearBlk = u.phase === 'dive' && G.blocks.some(k => k.alive && Math.hypot(k.body.GetPosition().x - x, k.body.GetPosition().y - y) < 1.2 * SC);
    if (armed && (Terrain.solid(x, y - .9 * SC) || Terrain.solid(x + u.dir * .9 * SC, y) || (wet && !u.wet0) || near || nearBlk)) { u.detonated = true; explode(x, y, w, u.owner || u); killUnit(u, 'detonated'); return; }
    if (Clock.t - u.born > 70) { u.detonated = true; explode(x, y, w, u.owner || u); killUnit(u, 'battery'); return; }
    if (u.loop) u.loop.set(clamp(.22 / (1 + camDist(x, y) * .02), 0, .22));
  },
  onDeath(u) { if (u.loop) u.loop.stop(); if (!u.detonated) { const [x, y] = u.deadAt; explode(x, y, Object.assign({}, DEBRIS), u.owner || u); } },
  draw(ctx, u, V) { drawRotor(ctx, u, V, .9 * SC, true); }
});

// ---------- forward observer on foot ----------
UNITS.add('spotter', {
  name: 'Наблюдатель', hp: 16, eye: 1.6 * SC, sig: .35, r0: .02, hear: 50 * SC,
  create(u, x, y) { const b = mkBody(B.b2_dynamicBody, x, y, { fixedRotation: true }); addFix(b, boxShape(.22 * SC, .5 * SC), 1.1, .9); u.body = b; u.bodies.push(b); },
  update(u, dt) {
    const [x] = unitPos(u), v = u.body.GetLinearVelocity(); u.walking = G.cur === u.side && Math.abs(u.tx - x) > 1.2 && !Water.wet(x, unitPos(u)[1]);
    if (u.walking) { P.V1.Set(Math.sign(u.tx - x) * 1.7 * RT2, Math.max(v.y, Terrain.solid(x + Math.sign(u.tx - x) * 1.2, unitPos(u)[1] - .4) ? 3.1 : v.y)); u.body.SetLinearVelocity(P.V1); }
    if (Water.depthAt(x, unitPos(u)[1]) > 2.4) damageUnit(u, 6 * dt, 'water', true);
  },
  draw(ctx, u, V) {
    const [x, y] = unitPos(u), s = V.z * SC, cx = V.sx(x), cy = V.sy(y), step = u.walking ? Math.sin(Clock.t * 9) * .25 : 0; ctx.strokeStyle = SIDE_COL[u.side]; ctx.lineWidth = Math.max(1, .1 * s);
    ctx.beginPath(); ctx.arc(cx, cy - .38 * s, .13 * s, 0, TAU); ctx.moveTo(cx, cy - .25 * s); ctx.lineTo(cx, cy + .1 * s); ctx.lineTo(cx - (.18 + step) * s, cy + .5 * s); ctx.moveTo(cx, cy + .1 * s); ctx.lineTo(cx + (.18 + step) * s, cy + .5 * s); ctx.moveTo(cx, cy - .1 * s); ctx.lineTo(cx + .3 * s, cy - .2 * s); ctx.stroke();
  }
});

// ---------- blocks ----------
function spawnBlock(matId, x, y, w, h) {
  const m = MATERIALS.get(matId), b = mkBody(B.b2_dynamicBody, x, y); addFix(b, boxShape(w / 2, h / 2), m.density, m.friction);
  const blk = { mat: m, body: b, w, h, hp: m.hp * Math.max(.4, w * h / 1.1), alive: true, burning: 0, heat: 0 }; blk.maxHp = blk.hp; P.bodyMap.set(B.getPointer(b), { kind: 'block', blk }); G.blocks.push(blk); return blk;
}
function placeStructure(id, gx) { const gy = Terrain.surfaceY(gx); STRUCTURES.get(id).blocks.forEach(([m, ox, oy, w, h]) => spawnBlock(m, gx + ox * SC, gy + oy * SC + .1, w * SC, h * SC)); }
function damageBlock(blk, dmg) {
  if (!blk.alive) return; blk.hp -= dmg; if (blk.hp > 0) return; blk.alive = false; const p = blk.body.GetPosition();
  FX.burst(p.x, p.y, 16, blk.mat.color, .6); P.bodyMap.delete(B.getPointer(blk.body)); P.world.DestroyBody(blk.body);
  if (blk.mat.spill === 'oil') for (let i = 0; i < 70; i++) { const a = Math.random() * TAU, v = rnd(1, 6); spawnParticle(blk.burning ? P.fire : P.oil, p.x + Math.cos(a) * .4, p.y + Math.sin(a) * .4, Math.cos(a) * v, Math.sin(a) * v, B.b2_viscousParticle, rnd(60, 110)); }
}
function drawBlock(ctx, blk, V) {
  const p = blk.body.GetPosition(), a = blk.body.GetAngle(); ctx.save(); ctx.translate(V.sx(p.x), V.sy(p.y)); ctx.rotate(-a); ctx.scale(V.z, V.z);
  const path = () => { ctx.beginPath(); if (blk.poly) { blk.poly.forEach((v, i) => i ? ctx.lineTo(v[0], -v[1]) : ctx.moveTo(v[0], -v[1])); ctx.closePath(); } else ctx.rect(-blk.w / 2, -blk.h / 2, blk.w, blk.h); };
  path(); ctx.fillStyle = blk.mat.color; ctx.fill();
  if (blk.poly) { ctx.strokeStyle = 'rgba(255,200,150,.35)'; ctx.lineWidth = .05; ctx.stroke(); }             // a fresh cut shines at the edges
  const dmg = 1 - blk.hp / blk.maxHp; if (dmg > .3 && !blk.poly) { ctx.strokeStyle = 'rgba(0,0,0,.5)'; ctx.lineWidth = .06; ctx.beginPath(); ctx.moveTo(-blk.w / 3, -blk.h / 2); ctx.lineTo(0, 0); ctx.lineTo(blk.w / 4, blk.h / 2); ctx.stroke(); }
  if (blk.mat.metal && !blk.poly) { ctx.fillStyle = 'rgba(210,225,235,.35)'; ctx.fillRect(-blk.w / 2, -blk.h / 2, blk.w, Math.min(.08, blk.h * .3)); }
  if (blk.burning) { path(); ctx.fillStyle = 'rgba(40,20,10,.5)'; ctx.fill(); }
  if (blk.heat > .05) { path(); ctx.fillStyle = `rgba(255,120,60,${Math.min(.55, blk.heat * .6)})`; ctx.fill(); }
  ctx.restore();
}

// ---------- CUTTING (after Dream Light's line slicer): a convex block splits along a line into two convex bodies ----------
function polyShape(verts) {                                 // verts: [[x,y],...] local, convex, CCW, <= 8
  const sh = new B.b2PolygonShape(), n = Math.min(8, verts.length), ptr = B._malloc(n * 8);
  for (let i = 0; i < n; i++) { B.HEAPF32[(ptr >> 2) + i * 2] = verts[i][0]; B.HEAPF32[(ptr >> 2) + i * 2 + 1] = verts[i][1]; }
  if (typeof sh._Set === 'function') sh._Set(ptr, n); else sh.Set(B.wrapPointer(ptr, B.b2Vec2), n); B._free(ptr); return sh;
}
const polyArea = v => { let a = 0; for (let i = 0; i < v.length; i++) { const p = v[i], q = v[(i + 1) % v.length]; a += p[0] * q[1] - q[0] * p[1]; } return a / 2; };
function slicePoly(poly, ax, ay, dx, dy) {                 // split by the line through (ax,ay) along (dx,dy)
  const nx = -dy, ny = dx, A = [], Bv = [], n = poly.length, side = p => (p[0] - ax) * nx + (p[1] - ay) * ny;
  for (let i = 0; i < n; i++) { const p = poly[i], q = poly[(i + 1) % n], sp = side(p), sq = side(q); (sp >= 0 ? A : Bv).push(p); if ((sp > 0 && sq < 0) || (sp < 0 && sq > 0)) { const t = sp / (sp - sq), c = [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]; A.push(c); Bv.push(c); } }
  return A.length >= 3 && Bv.length >= 3 ? [A, Bv] : null;
}
function blockWorldPoly(blk) {
  const p = blk.body.GetPosition(), a = blk.body.GetAngle(), c = Math.cos(a), si = Math.sin(a), loc = blk.poly || [[-blk.w / 2, -blk.h / 2], [blk.w / 2, -blk.h / 2], [blk.w / 2, blk.h / 2], [-blk.w / 2, blk.h / 2]];
  return loc.map(([x, y]) => [p.x + x * c - y * si, p.y + x * si + y * c]);
}
function spawnPolyBlock(mat, world, vel, av, hp) {
  let cx = 0, cy = 0; for (const [x, y] of world) { cx += x; cy += y; } cx /= world.length; cy /= world.length;
  let loc = world.map(([x, y]) => [x - cx, y - cy]); if (polyArea(loc) < 0) loc.reverse();
  const b = mkBody(B.b2_dynamicBody, cx, cy); addFix(b, polyShape(loc), mat.density, mat.friction); P.V1.Set(vel.x, vel.y); b.SetLinearVelocity(P.V1); b.SetAngularVelocity(av);
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9; for (const [x, y] of loc) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  const blk = { mat, body: b, poly: loc, w: x1 - x0, h: y1 - y0, hp, maxHp: hp, alive: true, burning: 0, heat: 0 }; P.bodyMap.set(B.getPointer(b), { kind: 'block', blk }); G.blocks.push(blk); return blk;
}
function cutBlock(blk, x, y, dx, dy) {
  if (!blk.alive) return false; const w = blockWorldPoly(blk), parts = slicePoly(w, x, y, dx, dy); if (!parts) return false;
  const areas = parts.map(p => Math.abs(polyArea(p))); if (Math.min(...areas) < .06 || parts.some(p => p.length > 8)) return false;
  const v = blk.body.GetLinearVelocity(), vel = { x: v.x, y: v.y }, av = blk.body.GetAngularVelocity(), tot = areas[0] + areas[1];
  blk.alive = false; P.bodyMap.delete(B.getPointer(blk.body)); P.world.DestroyBody(blk.body);
  parts.forEach((pt, i) => { const nb = spawnPolyBlock(blk.mat, pt, vel, av, Math.max(8, blk.hp * areas[i] / tot)); nb.burning = blk.burning; });
  FX.burst(x, y, 10, '#ffb070', .4); SFX.splash(.4); return true;
}

// ---------- pure-visual effects ----------
const FX = {
  sparks: [], flashes: [], rings: [], texts: [],
  burst(x, y, n, col, sp = 1) { for (let i = 0; i < n; i++) { const a = rnd(0, TAU), v = rnd(3, 16) * sp * RT2; this.sparks.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v + 4, life: rnd(.4, 1.3), col }); } },
  flash(x, y, r, i, life = .45, col = [255, 190, 120]) { this.flashes.push({ x, y, r, i, life, max: life, col }); },
  ring(x, y, max, col, speed = 60, life = 3) { this.rings.push({ x, y, r: 0, max, col, speed, life }); },
  text(x, y, s, col, size = 10) { this.texts.push({ x, y: y + 2, s, col, life: 1.4, size: clamp(10 + size * .15, 11, 20) }); },
  update(dt) {
    for (const s of this.sparks) { const [gx, gy] = Grav.M ? Grav.at(s.x, s.y) : [0, -16]; s.vx += gx * dt; s.vy += gy * dt; s.x += s.vx * dt; s.y += s.vy * dt; s.life -= dt; if (Terrain.solid(s.x, s.y)) { s.vx *= -.3; s.vy *= -.3; } }
    this.sparks = this.sparks.filter(s => s.life > 0).slice(-600);
    this.flashes.forEach(f => f.life -= dt); this.flashes = this.flashes.filter(f => f.life > 0);
    this.rings.forEach(r => { r.r += r.speed * dt; r.life -= dt; }); this.rings = this.rings.filter(r => r.life > 0 && r.r < r.max + 4);
    this.texts.forEach(t => { t.y += dt * 1.6; t.life -= dt; }); this.texts = this.texts.filter(t => t.life > 0);
  },
  clear() { this.sparks = []; this.flashes = []; this.rings = []; this.texts = []; }
};

