// =====================================================================
// RENDER. Canvas 2D. Order: sky, far silhouettes, terrain, bodies, water,
// fire, beams, sparks, weather, darkness+lights, fog, then intel overlay.
// =====================================================================
const cv = document.getElementById('cv'), ctx = cv.getContext('2d');
const shade = document.createElement('canvas'), sctx = shade.getContext('2d');
const V = {
  W: 0, H: 0, it: 0, ib: 0, dpr: 1, z: 6, cx: 80, cy: 30, shx: 0, shy: 0, follow: null, followHold: 0, rot: 0, rotT: 0,
  // the camera turns so that the local "up" of the island you stand on points up the screen.
  // World drawing happens inside a rotated ctx frame (sx/sy are that frame); proj()/w2() cross it.
  piv() { return [this.W / 2 + this.shx, this.py0() + this.shy]; },
  beginWorld(ctx) { const [px, py] = this.piv(); ctx.save(); ctx.translate(px, py); ctx.rotate(this.rot); ctx.translate(-px, -py); },
  proj(x, y) { const [px, py] = this.piv(), dx = this.sx(x) - px, dy = this.sy(y) - py, c = Math.cos(this.rot), s = Math.sin(this.rot); return [px + dx * c - dy * s, py + dx * s + dy * c]; },
  unrot(X, Y) { const [px, py] = this.piv(), dx = X - px, dy = Y - py, c = Math.cos(this.rot), s = Math.sin(this.rot); return [px + dx * c + dy * s, py - dx * s + dy * c]; },
  w2(X, Y) { const [a, b] = this.unrot(X, Y); return [this.wx(a), this.wy(b)]; },
  // keep world point (x,y) under screen point (X,Y) after a zoom
  anchor(x, y, X, Y) { const [a, b] = this.unrot(X, Y); this.cx = x - (a - this.W / 2 - this.shx) / this.z; this.cy = y + (b - this.py0() - this.shy) / this.z; },
  panBy(dX, dY) { const c = Math.cos(this.rot), s = Math.sin(this.rot), a = dX * c + dY * s, b = -dX * s + dY * c; this.cx -= a / this.z; this.cy += b / this.z; },
  turn(dt) { if (G.phase === 'menu') { this.rot = this.rotT = 0; return; } let d = this.rotT - this.rot; d = Math.atan2(Math.sin(d), Math.cos(d)); this.rot += d * Math.min(1, dt * 2.2); this.rot = Math.atan2(Math.sin(this.rot), Math.cos(this.rot)); },
  sx(x) { return (x - this.cx) * this.z + this.W / 2 + this.shx; }, py0() { return (this.H + this.it - this.ib) / 2; }, he() { return Math.max(120, this.H - this.it - this.ib); },
  sy(y) { return this.py0() - (y - this.cy) * this.z + this.shy; },
  wx(px) { return (px - this.W / 2) / this.z + this.cx; }, wy(py) { return (this.py0() - py) / this.z + this.cy; },
  insets() { const h = document.getElementById('hud'); if (!h || h.hidden) { this.it = this.ib = 0; return; } const t = document.getElementById('top').getBoundingClientRect(), bb = document.getElementById('deployBar'), b = (bb && !bb.hidden ? bb : document.getElementById('bottom')).getBoundingClientRect(); this.it = Math.max(0, t.bottom); this.ib = Math.max(0, this.H - b.top); },
  // free camera: zoom out until the whole rock floats small in the void, wander well past its tips
  minZ() { return Math.min(this.W / (WORLD_W * 1.7), this.he() / (WORLD_H * 1.5)); },
  clampCam() { if (G.phase === 'menu') return; this.z = clamp(this.z, this.minZ(), 24); this.cx = clamp(this.cx, -WORLD_W * .45, WORLD_W * 1.45); this.cy = clamp(this.cy, -WORLD_H * .45, WORLD_H * 1.3); },
  resize() { this.dpr = Math.min(window.devicePixelRatio || 1, 2); this.W = innerWidth; this.H = innerHeight; cv.width = this.W * this.dpr; cv.height = this.H * this.dpr; cv.style.width = this.W + 'px'; cv.style.height = this.H + 'px'; shade.width = Math.ceil(this.W / 3); shade.height = Math.ceil(this.H / 3); this.clampCam(); },
  frame(x0, x1, yc) { this.z = clamp(this.W / (Math.abs(x1 - x0) + 30), this.minZ(), 24); this.cx = (x0 + x1) / 2; this.cy = yc; this.clampCam(); }
};
function camDist(x, y) { return Math.hypot(x - V.cx, y - V.cy); }
addEventListener('resize', () => V.resize());

// ---------- far background ----------
const BG = { layers: [], stars: [] };
// distant rocks drifting in the void, two parallax depths
function buildBackground(seed) {
  const r = mulberry32(seed + 99); BG.layers = [];
  for (const [par, n, col] of [[.12, 18, [96, 104, 116]], [.26, 10, [84, 92, 104]]]) {
    const rocks = []; for (let i = 0; i < n; i++) { const rad = (2 + r() * 7) * SC, nv = 7 + (r() * 5 | 0), v = []; for (let k = 0; k < nv; k++) { const a = k / nv * TAU; v.push(Math.cos(a) * rad * (.7 + r() * .45), Math.sin(a) * rad * (.55 + r() * .35) - (k > nv / 2 ? rad * .25 * r() : 0)); } rocks.push({ x: -WORLD_W + r() * WORLD_W * 3, y: -WORLD_H * .4 + r() * WORLD_H * 1.6, v, drift: (r() - .5) * .6, sp: r() * TAU }); }
    BG.layers.push({ par, rocks, col });
  }
  BG.stars = Array.from({ length: 140 }, () => [r(), r() * .7, r()]);
}
function skyColors() {
  const [top, bot] = G.day.sky, fog = G.weather.fog, k = clamp(1 - G.weather.vKm / 12, 0, .85) * (G.day.lum > .5 ? 1 : .35);
  const mix = (a, b) => a.map((v, i) => Math.round(lerp(v, b[i] * (G.day.lum > .5 ? 1 : .25), k)));
  return [mix(top, fog), mix(bot, fog)];
}
const rgb = (c, a = 1) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;

function render() {
  const W = V.W, H = V.H; ctx.setTransform(V.dpr, 0, 0, V.dpr, 0, 0);
  // sky
  const [st, sb] = skyColors(), g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, rgb(st)); g.addColorStop(1, rgb(sb)); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  if (G.day.lum < .2 && G.weather.vKm > 3) { ctx.fillStyle = 'rgba(220,225,235,.55)'; for (const [a, b, c] of BG.stars) { const x = ((a * W * 1.3 - V.cx * V.z * .03) % W + W) % W; ctx.fillRect(x, b * H, c > .8 ? 2 : 1, c > .8 ? 2 : 1); } }
  V.beginWorld(ctx);
  for (const L of BG.layers) {
    const t = performance.now() / 1000, px = x => W / 2 + (x - V.cx) * V.z * L.par, py = y => V.py0() - (y - V.cy) * V.z * L.par;
    ctx.fillStyle = rgb(L.col.map((v, i) => lerp(v, sb[i], .72 - L.par)));   // far rocks sink into the haze, never mistaken for islands
    for (const k of L.rocks) { const ox = k.x + Math.sin(t * .05 + k.sp) * 6 * k.drift, oy = k.y + Math.cos(t * .04 + k.sp) * 4, s = V.z * L.par; ctx.beginPath(); for (let i = 0; i < k.v.length; i += 2) { const X = px(ox) + k.v[i] * s, Y = py(oy) - k.v[i + 1] * s; i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y); } ctx.closePath(); ctx.fill(); }
  }
  // terrain + water
  ctx.imageSmoothingEnabled = false;
  Nature.draw(ctx, V);
  ctx.drawImage(Terrain.canvas, V.sx(0), V.sy(WORLD_H), WORLD_W * V.z, WORLD_H * V.z);
  if (!G.units) { ctx.restore(); return; }
  Nature.draw(ctx, V, true); if (G.phase !== 'deploy' && G.phase !== 'menu') Grass.draw(ctx, V); Geo.draw(ctx, V);          // cross-section: buried stones show in the cut
  for (const b of G.blocks) if (b.alive) drawBlock(ctx, b, V);
  const vs = G.viewSide;
  for (const u of G.units) if (u.alive && (u.side === vs || Intel.vis[vs].has(u.id) || G.phase === 'over' || G.reveal)) u.def.draw(ctx, u, V);
  ctx.drawImage(Water.canvas, V.sx(0), V.sy(WORLD_H), WORLD_W * V.z, WORLD_H * V.z);
  ctx.imageSmoothingEnabled = true;
  // soil ejecta in flight
  { const { n, pos } = particleArrays(P.dirt); const k = Math.max(1.5, .6 * V.z); ctx.fillStyle = '#2e2924'; for (let i = 0; i < n; i++) ctx.fillRect(V.sx(pos[i * 2]) - k / 2, V.sy(pos[i * 2 + 1]) - k / 2, k, k); }
  // fire particles
  { const s = Math.max(2, .6 * V.z), o = particleArrays(P.oil); ctx.fillStyle = 'rgba(24,20,14,.92)'; for (let i = 0; i < o.n; i++) ctx.fillRect(V.sx(o.pos[i * 2]) - s / 2, V.sy(o.pos[i * 2 + 1]) - s / 2, s, s);
    const l = particleArrays(P.lava); for (let i = 0; i < l.n; i++) { const f = (i * 5 + (Clock.t * 6 | 0)) % 3; ctx.fillStyle = f ? 'rgba(255,110,30,.95)' : 'rgba(255,190,80,.95)'; ctx.fillRect(V.sx(l.pos[i * 2]) - s / 2, V.sy(l.pos[i * 2 + 1]) - s / 2, s, s); }
    const t = particleArrays(P.steam), ss = Math.max(3, 1.6 * V.z); ctx.fillStyle = 'rgba(225,230,236,.16)'; for (let i = 0; i < t.n; i++) ctx.fillRect(V.sx(t.pos[i * 2]) - ss / 2, V.sy(t.pos[i * 2 + 1]) - ss / 2, ss, ss); }
  { const { n, pos } = particleArrays(P.fire); ctx.globalCompositeOperation = 'lighter'; const s = Math.max(2, .62 * V.z);
    for (let i = 0; i < n; i++) { const flick = (i * 7 + (Clock.t * 30 | 0)) % 5; ctx.fillStyle = flick < 2 ? 'rgba(255,190,90,.8)' : flick < 4 ? 'rgba(230,100,40,.7)' : 'rgba(150,40,20,.6)'; ctx.fillRect(V.sx(pos[i * 2]) - s / 2, V.sy(pos[i * 2 + 1]) - s / 2, s, s); }
    ctx.globalCompositeOperation = 'source-over'; }
  // shots and beams
  // smoke and cloud field, drawn soft
  if (Smoke.any) { ctx.imageSmoothingEnabled = true; ctx.drawImage(Smoke.canvas, V.sx(0), V.sy(WORLD_H), WORLD_W * V.z, WORLD_H * V.z); }
  // solar wind: each gas particle is a thin streak along its own velocity
  { const { n, pos, vel } = particleArrays(P.cloud), lit = G.day.lum > .5 ? 1 : .45; ctx.strokeStyle = `rgba(${200 * lit | 0},${212 * lit | 0},${225 * lit | 0},.3)`; ctx.lineWidth = Math.max(1, V.z * .1); ctx.beginPath();
    for (let i = 0; i < n; i++) { const x = pos[i * 2], y = pos[i * 2 + 1], vx = vel[i * 2], vy = vel[i * 2 + 1], L = .35 + Math.min(1.2, Math.hypot(vx, vy) * .12); ctx.moveTo(V.sx(x), V.sy(y)); ctx.lineTo(V.sx(x - vx * L * .3), V.sy(y - vy * L * .3)); }
    ctx.stroke(); }
  Lamps.draw(ctx, V);
  for (const s of G.shots) { if (s.kind === 'shell' || s.kind === 'rocket') WEAPON_CATS.get(s.kind).draw(ctx, s, V); if (s.kind === 'laser') drawLaser(ctx, s, V); if (s.kind === 'burst') WEAPON_CATS.get('burst').draw(ctx, s, V); }
  for (const f of G.flares) { ctx.fillStyle = '#f4f2e6'; ctx.fillRect(V.sx(f.x) - 2, V.sy(f.y) - 2, 4, 4); ctx.strokeStyle = 'rgba(220,220,210,.3)'; ctx.beginPath(); ctx.moveTo(V.sx(f.x), V.sy(f.y)); ctx.lineTo(V.sx(f.x), V.sy(f.y + 2)); ctx.stroke(); }
  for (const s of FX.sparks) { ctx.fillStyle = s.col; const k = Math.max(1.5, V.z * .22); ctx.fillRect(V.sx(s.x), V.sy(s.y), k, k); }
  ctx.restore();
  drawWeather();
  if (cfg.lighting) drawDarkness(); else if (G.day.lum < .5) { ctx.fillStyle = `rgba(6,8,12,${(1 - Math.pow(G.day.lum, .25)) * .6})`; ctx.fillRect(0, 0, W, H); }
  drawFog();
  V.beginWorld(ctx);
  drawIntel();
  drawAim();
  drawAiMark();
  drawDrones();
  for (const r of FX.rings) { ctx.strokeStyle = r.col; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(V.sx(r.x), V.sy(r.y), r.r * V.z, 0, TAU); ctx.stroke(); }
  // hp strips for units the viewer can see
  for (const u of G.units) { if (!u.alive || !u.def.main || !(u.side === vs || Intel.vis[vs].has(u.id) || G.phase === 'over')) continue; const [x0, y0] = unitPos(u), [hx, hy] = Grav.up(x0, y0), x = x0 + hx * 2.6 * SC, y = y0 + hy * 2.6 * SC, w = Math.max(24, 3 * SC * V.z); ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.fillRect(V.sx(x) - w / 2, V.sy(y) - 2, w, 3); ctx.fillStyle = SIDE_COL[u.side]; ctx.fillRect(V.sx(x) - w / 2, V.sy(y) - 2, w * clamp(u.hp / u.maxHp, 0, 1), 3); }
  ctx.restore();
  // numbers stay upright whatever way the camera is turned
  ctx.textAlign = 'center'; for (const t of FX.texts) { const [X, Y] = V.proj(t.x, t.y); ctx.fillStyle = t.col; ctx.globalAlpha = clamp(t.life, 0, 1); ctx.font = `700 ${t.size}px "PT Mono", monospace`; ctx.fillText(t.s, X, Y); } ctx.globalAlpha = 1;
  drawBanner();
}
const RAIN = Array.from({ length: 160 }, () => [Math.random(), Math.random(), Math.random()]);
function drawWeather() {
  const w = G.weather, W = V.W, H = V.H;
  if (w.rain) { ctx.strokeStyle = 'rgba(170,185,200,.28)'; ctx.lineWidth = 1; ctx.beginPath(); const t = Clock.t; for (const [a, b, c] of RAIN) { const x = ((a * W + t * (G.wind * 12)) % W + W) % W, y = ((b * H + t * (500 + c * 200)) % H); ctx.moveTo(x, y); ctx.lineTo(x - G.wind * 1.2, y - 14); } ctx.stroke(); }
  if (w.dust) { ctx.fillStyle = 'rgba(150,120,85,.35)'; const t = Clock.t; for (const [a, b, c] of RAIN) { const x = ((a * W + t * G.wind * (30 + c * 40)) % W + W) % W, y = (b * H + Math.sin(t + a * 9) * 10); ctx.fillRect(x, y, 3 + c * 5, 1); } }
}
function drawDarkness() {
  const lum = G.day.lum; if (lum > .6 && !Lights.list.length) return;
  const dark = clamp(1 - Math.pow(lum, .22), 0, .9); const s = sctx, k = 1 / 3;
  s.globalCompositeOperation = 'source-over'; s.clearRect(0, 0, shade.width, shade.height); if (dark < .02) return;
  s.fillStyle = `rgba(5,7,12,${dark})`; s.fillRect(0, 0, shade.width, shade.height);
  s.globalCompositeOperation = 'destination-out';
  const hole = (x, y, r, i) => { const [X, Y] = V.proj(x, y), px = X * k, py = Y * k, pr = r * V.z * k; if (px < -pr || py < -pr || px > shade.width + pr || py > shade.height + pr) return; const gr = s.createRadialGradient(px, py, 0, px, py, pr); gr.addColorStop(0, `rgba(0,0,0,${clamp(i, 0, 1)})`); gr.addColorStop(1, 'rgba(0,0,0,0)'); s.fillStyle = gr; s.fillRect(px - pr, py - pr, pr * 2, pr * 2); };
  for (const l of Lights.list) hole(l.x, l.y, l.r, l.i);
  for (const u of G.units) if (u.alive && u.side === G.viewSide) { const [x, y] = unitPos(u); hole(x, y, 6 * SC, .55); }
  ctx.drawImage(shade, 0, 0, V.W, V.H);
  ctx.globalCompositeOperation = 'lighter';
  for (const l of Lights.list) { const [px, py] = V.proj(l.x, l.y), pr = l.r * V.z * .8; if (px < -pr || py < -pr || px > V.W + pr || py > V.H + pr) continue; const gr = ctx.createRadialGradient(px, py, 0, px, py, pr); gr.addColorStop(0, rgb(l.col, .22 * clamp(l.i, 0, 1.5))); gr.addColorStop(1, rgb(l.col, 0)); ctx.fillStyle = gr; ctx.fillRect(px - pr, py - pr, pr * 2, pr * 2); }
  ctx.globalCompositeOperation = 'source-over';
}
function drawFog() {
  const Va = VIS.vatm(); if (Va > 400) return; const me = G.sides && G.sides[G.viewSide] && G.sides[G.viewSide].tank;
  const [x, y] = me && me.alive ? unitPos(me) : [V.cx, V.cy], R = Va * 2 * V.z, [px, py] = V.proj(x, y), c = G.weather.fog.map(v => v * (G.day.lum > .5 ? 1 : .22));
  const gr = ctx.createRadialGradient(px, py, 0, px, py, R); [0, .125, .25, .5, 1].forEach(f => gr.addColorStop(f, rgb(c, .92 * (1 - Math.exp(-3.912 * f * 2))))); ctx.fillStyle = gr; ctx.fillRect(0, 0, V.W, V.H);
}
// intel ghosts carry no words: an eye (seen) or sound arcs (heard), and one pip per turn of age
function drawIntel() {
  const vs = G.viewSide; if (G.phase === 'menu') return;
  for (const rec of Intel.data[vs].values()) {
    if (!rec.u.alive || Intel.vis[vs].has(rec.u.id) || rec.u.type === 'strike') continue; const px = V.sx(rec.x), py = V.sy(rec.y), age = Math.max(0, G.turn - rec.turn);
    ctx.strokeStyle = 'rgba(127,183,164,.85)'; ctx.setLineDash([3, 3]); ctx.lineWidth = 1;
    const s = (rec.u.def.main ? 1.9 : .8) * SC, top = py - s * .6 * V.z; ctx.strokeRect(px - s * V.z, top, s * 2 * V.z, s * 1.2 * V.z);
    if (rec.err > .5) { ctx.beginPath(); ctx.arc(px, py, rec.err * V.z, 0, TAU); ctx.stroke(); }
    ctx.setLineDash([]); ctx.lineWidth = 1.4; const ix = px, iy = top - 12;
    if (rec.src === 'visual') { ctx.beginPath(); ctx.moveTo(ix - 8, iy); ctx.quadraticCurveTo(ix, iy - 7, ix + 8, iy); ctx.quadraticCurveTo(ix, iy + 7, ix - 8, iy); ctx.stroke(); ctx.beginPath(); ctx.arc(ix, iy, 2.2, 0, TAU); ctx.fillStyle = 'rgba(127,183,164,.95)'; ctx.fill(); }
    else for (let k = 1; k <= 3; k++) { ctx.beginPath(); ctx.arc(ix - 6, iy, k * 3.2, -.7, .7); ctx.stroke(); }
    ctx.fillStyle = 'rgba(127,183,164,.95)'; for (let k = 0; k < Math.min(age, 6); k++) ctx.fillRect(px - (Math.min(age, 6) * 6) / 2 + k * 6, top + s * 1.2 * V.z + 4, 4, 4);
  }
  const li = G.lastImpact[vs]; if (li) { ctx.strokeStyle = 'rgba(201,164,92,.7)'; ctx.lineWidth = 1.4; const px = V.sx(li.x), py = V.sy(li.y); ctx.beginPath(); ctx.moveTo(px - 6, py - 6); ctx.lineTo(px + 6, py + 6); ctx.moveTo(px + 6, py - 6); ctx.lineTo(px - 6, py + 6); ctx.stroke(); }
}
function reticle(px, py, r, col, spin) {
  ctx.strokeStyle = col; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(px, py, r, 0, TAU); ctx.stroke();
  for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + (spin || 0); ctx.beginPath(); ctx.moveTo(px + Math.cos(a) * (r + 3), py + Math.sin(a) * (r + 3)); ctx.lineTo(px + Math.cos(a) * (r + 11), py + Math.sin(a) * (r + 11)); ctx.stroke(); }
}
// attack drones: the owner sees route + target + lock; the defender sees red edge arrows for what it hears
function drawDrones() {
  const vs = G.viewSide, t = performance.now() / 1000;
  for (const u of G.units) {
    if (!u.alive || u.type !== 'strike') continue; const [x, y] = unitPos(u);
    if (u.side === vs) {
      const tx = u.tx, ty = u.ty ?? Terrain.topAt(tx), px = V.sx(tx), py = V.sy(ty); ctx.setLineDash([4, 6]); ctx.strokeStyle = 'rgba(201,164,92,.45)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(V.sx(x), V.sy(y)); ctx.lineTo(px, py); ctx.stroke(); ctx.setLineDash([]);
      reticle(px, py, u.lock ? 10 : 14, u.lock ? 'rgba(255,90,60,.95)' : 'rgba(201,164,92,.8)', u.lock ? t * 3 : 0);
    } else {
      const known = Intel.vis[vs].has(u.id) || Intel.data[vs].has(u.id); if (!known) continue;
      const sx = V.sx(x), sy = V.sy(y), m = 26, top = V.it + m, bot = V.H - V.ib - m, on = sx > m && sx < V.W - m && sy > top && sy < bot, pulse = .55 + .45 * Math.sin(t * 8);
      ctx.fillStyle = `rgba(255,70,50,${.5 + .5 * pulse})`; ctx.strokeStyle = ctx.fillStyle; ctx.lineWidth = 2;
      if (on) { ctx.beginPath(); ctx.arc(sx, sy, 16 + pulse * 5, 0, TAU); ctx.stroke(); continue; }
      const cx = V.W / 2, cy = (top + bot) / 2, a = Math.atan2(sy - cy, sx - cx), k = Math.min((V.W / 2 - m) / Math.abs(Math.cos(a) || 1e-6), ((bot - top) / 2) / Math.abs(Math.sin(a) || 1e-6)), ex = cx + Math.cos(a) * k, ey = cy + Math.sin(a) * k;
      ctx.save(); ctx.translate(ex, ey); ctx.rotate(a); ctx.beginPath(); ctx.moveTo(14, 0); ctx.lineTo(-8, -11); ctx.lineTo(-3, 0); ctx.lineTo(-8, 11); ctx.closePath(); ctx.fill(); ctx.restore();
    }
  }
}
// turn change: side-coloured stripe sweeping across with the vehicle silhouette
function drawBanner() {
  if (G.bannerAt == null) return; const k = (performance.now() - G.bannerAt) / 1300; if (k > 1) { G.bannerAt = null; return; }
  const a = k < .15 ? k / .15 : k > .75 ? (1 - k) / .25 : 1, h = 64, y = V.H * .36, col = SIDE_COL[G.bannerSide];
  ctx.globalAlpha = a * .9; ctx.fillStyle = 'rgba(8,10,12,.75)'; ctx.fillRect(0, y - h / 2, V.W, h); ctx.fillStyle = col; ctx.fillRect(0, y - h / 2, V.W, 3); ctx.fillRect(0, y + h / 2 - 3, V.W, 3);
  const x = lerp(-60, V.W + 60, smooth(clamp(k * 1.15, 0, 1))), sub = G.sides[G.bannerSide] && G.sides[G.bannerSide].tank.type === 'sub';
  ctx.save(); ctx.translate(V.W / 2 + (x - V.W / 2) * .25, y); ctx.scale(2, 2); ctx.fillStyle = col;
  if (sub) { ctx.beginPath(); ctx.ellipse(0, 3, 16, 6, 0, 0, TAU); ctx.fill(); ctx.fillRect(-2, -7, 7, 6); }
  else { ctx.fillRect(-14, 1, 28, 7); ctx.fillRect(-6, -5, 12, 6); ctx.fillRect(4, -5, 14, 2.5); ctx.fillStyle = '#15171a'; for (const wx of [-9, 0, 9]) { ctx.beginPath(); ctx.arc(wx, 10, 3.5, 0, TAU); ctx.fill(); } }
  ctx.restore(); ctx.globalAlpha = 1;
}
// where the enemy's imagined shot lands: a circle and 1–3 pips of its hit grade, shown to the player
function drawAiMark() {
  const m = G.aiMark; if (!m || G.phase === 'menu') return; const cols = ['#8a929c', '#8a929c', '#e0b050', '#e0503c'], c = cols[m.grade] || cols[0], x = V.sx(m.x), y = V.sy(m.y), r = Math.max(10, m.R * V.z), k = .6 + .4 * Math.sin((Clock.t - m.t) * 5);
  ctx.save(); ctx.globalAlpha = .5 + .4 * k; ctx.strokeStyle = c; ctx.lineWidth = 2; ctx.setLineDash([6, 5]); ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
  const [ux, uy] = Grav.up(m.x, m.y), ua = Math.atan2(-uy, ux);
  for (let i = 0; i < 3; i++) { const a = ua + (i - 1) * .32, px = x + Math.cos(a) * (r + 9), py = y + Math.sin(a) * (r + 9); ctx.beginPath(); ctx.arc(px, py, 4, 0, TAU); if (i < m.grade) { ctx.fillStyle = c; ctx.fill(); } else { ctx.lineWidth = 1.2; ctx.stroke(); } }
  ctx.restore();
}
function drawAim() {
  if (G.phase !== 'play' || G.sides[G.cur].ctrl !== 'human') return; const u = G.sides[G.cur].tank; if (!u || !u.alive) return;
  const w = WEAPONS.get(UI.weapon), [mx, my] = u.def.muzzle(u), len = (3 + u.power * 10) * SC;
  if (!w || w.cat !== 'drone') { ctx.strokeStyle = 'rgba(201,164,92,.8)'; ctx.setLineDash([2, 4]); ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(V.sx(mx), V.sy(my)); ctx.lineTo(V.sx(mx + Math.cos(aimW(u)) * len), V.sy(my + Math.sin(aimW(u)) * len)); ctx.stroke(); ctx.setLineDash([]); }
  if (w && w.cat === 'drone' && u.droneTx != null) { const tx = u.droneTx, ty = Terrain.topAt(tx), px = V.sx(tx), py = V.sy(ty), k = clamp(1 - (performance.now() - (UI.beepAt || 0)) / 350, 0, 1), hot = droneBeepHot(u); ctx.strokeStyle = `rgba(240,205,70,${.65 + .35 * k})`; ctx.lineWidth = 2 + k * 2; ctx.beginPath(); ctx.arc(px, py, DRONE_SEEK * V.z, 0, TAU); ctx.stroke(); ctx.fillStyle = `rgba(240,205,70,${(hot ? .16 : .07) + k * .12})`; ctx.fill(); ctx.fillStyle = 'rgba(240,205,70,.95)'; ctx.beginPath(); ctx.arc(px, py, 3.5, 0, TAU); ctx.fill(); }
  if (cfg.aimHint && w && w.cat === 'shell') { const r = simulate(mx, my, aimW(u), muzzleSpeed(u, w) * u.power, w.drag, 0, 1); ctx.fillStyle = 'rgba(201,164,92,.5)'; for (let i = 0; i < r.pts.length; i += 4) ctx.fillRect(V.sx(r.pts[i]) - 1, V.sy(r.pts[i + 1]) - 1, 2, 2); }
  if (w && w.cat === 'laser') { ctx.strokeStyle = 'rgba(255,90,70,.25)'; ctx.beginPath(); ctx.moveTo(V.sx(mx), V.sy(my)); ctx.lineTo(V.sx(mx + Math.cos(aimW(u)) * 200), V.sy(my + Math.sin(aimW(u)) * 200)); ctx.stroke(); }
}

