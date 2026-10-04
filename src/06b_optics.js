// =====================================================================
// OPTICS. The laser is not a projectile: it is a field that manifests.
// A beam is marched in small steps through every medium on the map:
//  - water: Fresnel split at the surface (Snell refraction, total internal
//    reflection coming out), exponential absorption inside;
//  - smoke/cloud density: refraction toward the density gradient (thin
//    edges bend it), extinction and random scattering into new branches
//    (thick cores split it). Nothing is scripted: the shape of the cloud
//    at this instant decides where light goes;
//  - bodies: Schlick reflection off units, blocks, rocks (metal mirrors);
//  - soil absorbs.
// =====================================================================
const N_WATER = 1.33, LASER_RANGE = 200 * SC;
const OPT = { rc: null, best: null, ignore: null };
function rayBodies(x0, y0, x1, y1, ignore) {
  if (!OPT.rc) OPT.rc = Object.assign(new B.JSRayCastCallback(), {
    ReportFixture(fp, pp, np, fr) { const f = B.wrapPointer(fp, B.b2Fixture), info = P.bodyMap.get(B.getPointer(f.GetBody())); if (!info || info.kind === 'shot' || info.kind === 'terrain' || (info.kind === 'unit' && info.u === OPT.ignore) || (info.kind === 'rock' && info.rock.buried)) return -1; const p = B.wrapPointer(pp, B.b2Vec2), n = B.wrapPointer(np, B.b2Vec2); OPT.best = { fr, x: p.x, y: p.y, nx: n.x, ny: n.y, info }; return fr; },
    ReportParticle() { return -1; }, ShouldQueryParticleSystem() { return false; }
  });
  OPT.best = null; OPT.ignore = ignore; P.V1.Set(x0, y0); P.V2.Set(x1, y1); if (Math.hypot(x1 - x0, y1 - y0) > .01) P.world.RayCast(OPT.rc, P.V1, P.V2); return OPT.best;
}
const schlick = (r0, cos) => r0 + (1 - r0) * Math.pow(1 - clamp(cos, 0, 1), 5);
const r0Of = info => info.kind === 'block' ? info.blk.mat.r0 : info.kind === 'unit' ? info.u.def.r0 : info.r0 || .05;

function traceLaser(x, y, dx, dy, owner, seed) {
  const rng = mulberry32((seed * 131 + Math.floor(Clock.t * 5)) | 0), beams = [], ds = .35, LOOK = 7;
  const stack = [{ x, y, dx, dy, I: 1, ign: owner, len: 0 }]; let budget = 3200;
  while (stack.length && beams.length < 26 && budget > 0) {
    const b = stack.pop(); let { x, y, dx, dy, I } = b, len = b.len, inW = Water.wet(x, y), ign = b.ign;
    const beam = { pts: [x, y, I], hits: [], glow: [] }; beams.push(beam);
    let look = null, lx = x, ly = y, ldx = dx, ldy = dy, lookLen = 0, sinceRec = 0;
    const relook = () => { lx = x; ly = y; ldx = dx; ldy = dy; lookLen = 0; look = rayBodies(x, y, x + dx * LOOK, y + dy * LOOK, ign); };
    relook();
    while (budget-- > 0 && I > .025 && len < LASER_RANGE) {
      // if the direction drifted, the cached body ray is stale
      if (lookLen > LOOK - ds || Math.abs(dx * ldy - dy * ldx) > .015) relook();
      const hitD = look ? look.fr * LOOK - lookLen : Infinity;
      if (hitD <= ds) {
        const h = look, k = h.info.kind; x = h.x; y = h.y; beam.pts.push(x, y, I);
        const cos = -(dx * h.nx + dy * h.ny), R = schlick(r0Of(h.info), cos);
        beam.hits.push(Object.assign({ kind: k, x, y, I: I * (1 - R), dx, dy }, h.info, { kind: k })); FX.flash(x, y, 2 * SC, .5 * I, .06, [255, 160, 110]);
        const dot = dx * h.nx + dy * h.ny; dx -= 2 * dot * h.nx; dy -= 2 * dot * h.ny; x += h.nx * .06; y += h.ny * .06; I *= R; ign = null; relook(); continue;
      }
      const nx = x + dx * ds, ny = y + dy * ds; len += ds; lookLen += ds; sinceRec += ds;
      if (nx < -150 || nx > WORLD_W + 150 || ny < -150 || ny > WORLD_H + 150) { x = nx; y = ny; break; }
      if (Terrain.solid(nx, ny)) { beam.pts.push(nx, ny, I); beam.hits.push({ kind: 'terrain', x: nx, y: ny, dx, dy, I }); FX.flash(nx, ny, 3 * SC, .6 * I, .08, [255, 140, 90]); I = 0; x = nx; y = ny; break; }
      // --- water interface ---
      const wetN = Water.wet(nx, ny);
      if (wetN !== inW) {
        let [wnx, wny] = Water.normal(nx, ny); if (wnx * dx + wny * dy > 0) { wnx = -wnx; wny = -wny; }
        const ci = clamp(-(dx * wnx + dy * wny), 0, 1), eta = inW ? N_WATER : 1 / N_WATER, k = 1 - eta * eta * (1 - ci * ci);
        const R = k < 0 ? 1 : schlick(.02, inW ? Math.sqrt(k) : ci);
        const rdx = dx + 2 * ci * wnx, rdy = dy + 2 * ci * wny;
        beam.pts.push(nx, ny, I); if (!inW) beam.hits.push({ kind: 'water', x: nx, y: ny, I: I * (1 - R) * .5 });
        if (k >= 0) {
          const tdx = eta * dx + (eta * ci - Math.sqrt(k)) * wnx, tdy = eta * dy + (eta * ci - Math.sqrt(k)) * wny, T = 1 - R;
          // follow the stronger ray, branch the weaker if it still matters
          if (T >= R) { if (R * I > .06 && stack.length < 10) stack.push({ x: nx + wnx * .2, y: ny + wny * .2, dx: rdx, dy: rdy, I: R * I, len }); dx = tdx; dy = tdy; I *= T; inW = wetN; x = nx; y = ny; }
          else { if (T * I > .06 && stack.length < 10) stack.push({ x: nx + tdx * .2, y: ny + tdy * .2, dx: tdx, dy: tdy, I: T * I, len }); dx = rdx; dy = rdy; I *= R; x = nx + wnx * .2; y = ny + wny * .2; }
        } else { dx = rdx; dy = rdy; x = nx + wnx * .2; y = ny + wny * .2; }          // total internal reflection
        const l = Math.hypot(dx, dy); dx /= l; dy /= l; relook(); sinceRec = 0; continue;
      }
      x = nx; y = ny;
      if (inW) { I *= Math.exp(-ds / (4.5 * SC)); if (rng() < ds * .05) beam.hits.push({ kind: 'water', x, y, I: I * .2 }); }
      // --- participating media ---
      if (Smoke.any) {
        const rho = Smoke.at(x, y);
        if (rho > .03) {
          const [gx, gy] = Smoke.grad(x, y), along = gx * dx + gy * dy, bend = .16 / (1 + rho);
          dx += (gx - along * dx) * bend * ds; dy += (gy - along * dy) * bend * ds; const l = Math.hypot(dx, dy); dx /= l; dy /= l;
          const ext = 1 - Math.exp(-.3 * rho * ds), lost = I * ext; I -= lost;
          if (lost > .004 && rng() < .35) beam.glow.push([x, y, lost * 6]);
          if (rho > .75 && I > .1 && beams.length + stack.length < 24 && rng() < ext * 1.8 * (rho - .6)) {
            const a = gauss() * .75 * Math.min(1.5, rho), c = Math.cos(a), s = Math.sin(a), share = .3 + rng() * .15;
            stack.push({ x, y, dx: dx * c - dy * s, dy: dx * s + dy * c, I: I * share, len }); I *= 1 - share;
          }
        }
      }
      if (sinceRec >= 1.75) { beam.pts.push(x, y, I); sinceRec = 0; }
    }
    if (beam.pts[beam.pts.length - 3] !== x) beam.pts.push(x, y, I);
  }
  return beams;
}

// render: a beam is drawn as short straight strokes whose thickness follows a
// standing wave (spatial sine × slow temporal cosine), so it breathes without
// travelling; while it manifests, strokes switch on in hashed order.
function drawLaser(ctx, s, V) {
  const m = WEAPON_CATS.get('laser').env(s), t = s.t, om = Math.cos(t * 5.3), om2 = Math.cos(t * 3.1 + 1);
  ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'butt';
  s.beams.forEach((b, bi) => {
    const p = b.pts; let sAcc = 0;
    for (let i = 0; i + 5 < p.length; i += 3) {
      const x0 = p[i], y0 = p[i + 1], x1 = p[i + 3], y1 = p[i + 4], I = p[i + 2]; const L = Math.hypot(x1 - x0, y1 - y0); sAcc += L;
      const h = ((i * 2654435761 + bi * 97 + s.id) >>> 0) % 1000 / 1000, on = clamp((m * 1.4 - h * .5) * 2, 0, 1); if (on <= 0 || I < .02) continue;
      const wave = .2 + .8 * Math.abs(.62 * Math.sin(sAcc * .9) * om + .38 * Math.sin(sAcc * 2.3 + 2) * om2 + .25);
      const w = Math.max(.5, (1.8 + .5 * V.z) * I * wave * on), X0 = V.sx(x0), Y0 = V.sy(y0), X1 = V.sx(x1), Y1 = V.sy(y1);
      for (const [k, col] of [[3.2, `rgba(255,60,50,${.07 * on})`], [1.5, `rgba(255,90,70,${.3 * on})`], [.7, `rgba(255,225,205,${.9 * on})`]]) { ctx.strokeStyle = col; ctx.lineWidth = w * k; ctx.beginPath(); ctx.moveTo(X0, Y0); ctx.lineTo(X1, Y1); ctx.stroke(); }
    }
    for (const [gx, gy, gi] of b.glow) { const r = (1.2 + gi * 3) * V.z; const gr = ctx.createRadialGradient(V.sx(gx), V.sy(gy), 0, V.sx(gx), V.sy(gy), r); gr.addColorStop(0, `rgba(255,110,90,${clamp(gi * m * .9, 0, .5)})`); gr.addColorStop(1, 'rgba(255,110,90,0)'); ctx.fillStyle = gr; ctx.fillRect(V.sx(gx) - r, V.sy(gy) - r, r * 2, r * 2); }
  });
  ctx.globalCompositeOperation = 'source-over'; ctx.lineCap = 'butt';
}

