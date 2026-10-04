// =====================================================================
// UI. The menu is generated from registries: adding a map, weather,
// AI profile, upgrade or setting extends it with no UI code.
// =====================================================================
const $ = s => document.querySelector(s), el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
// ---------- line icons (no words on the play screen) ----------
const ICON = {
  he: '<circle cx="12" cy="13" r="4.5" fill="currentColor"/><path d="M12 2.5v4M4.6 5.6l2.8 2.8M19.4 5.6l-2.8 2.8M2.5 13h4M17.5 13h4"/>',
  incendiary: '<path d="M12 2.5c1.5 4 6 5.5 6 11a6 6 0 0 1-12 0c0-3.2 2-4.5 2.5-7.5 1.8 1.2 3 3 3 5.2 1.4-2.2 1.6-5.4.5-8.7z"/>',
  flamer: '<path d="M2 10h6v4H2z"/><path d="M10 12c2-3 3.5 3 5.5 0s3.5 3 6 0"/><path d="M10 7.5c2-2 3 1.5 5-.5M10 16.5c2 2 3-1.5 5 .5"/>',
  laser: '<circle cx="3" cy="12" r="1.8" fill="currentColor"/><path d="M5 12c2.2-5.5 4.4-5.5 6.2 0s4.2 5.5 6.2 0 3.2-3.4 4.6-1.6"/>',
  strike: '<path d="M6 6l12 12M18 6L6 18"/><circle cx="5" cy="5" r="2.6"/><circle cx="19" cy="5" r="2.6"/><circle cx="5" cy="19" r="2.6"/><circle cx="19" cy="19" r="2.6"/><circle cx="12" cy="12" r="2.4" fill="currentColor"/>',
  swarm: '<path d="M3 3.5l5 5M8 3.5l-5 5M16 3.5l5 5M21 3.5l-5 5M9.5 14.5l5 5M14.5 14.5l-5 5"/>',
  r_drone: '<path d="M2.5 7h7.5M14 7h7.5M8 7v3.5h8V7"/><circle cx="12" cy="16" r="3.4"/><circle cx="12" cy="16" r="1.1" fill="currentColor"/>',
  r_spotter: '<path d="M2 12s3.8-6 10-6 10 6 10 6-3.8 6-10 6S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  pass: '<path d="M4 8h14l-3.5-3.5M20 16H6l3.5 3.5"/>',
  play: '<path d="M7 4.5l12.5 7.5L7 19.5z" fill="currentColor"/>',
  exit: '<path d="M14 4h5v16h-5M10 8l-4 4 4 4M6 12h10"/>',
  tank: '<path d="M2.5 15.5h19l-2 4h-15z" fill="currentColor"/><path d="M7.5 15.5v-4h8v4" fill="currentColor"/><path d="M15.5 12.5l7-4.5"/>',
  sub: '<path d="M1.5 14.5c0-3 3.5-4.5 8.5-4.5h6.5c4 0 6 2 6 4.5s-2 4.5-6 4.5H10c-5 0-8.5-1.5-8.5-4.5z" fill="currentColor"/><path d="M11 10V6h4.5v4M13 6V3.5h2"/>',
  star: '<path d="M12 2.5l2.9 6.2 6.6.8-4.9 4.6 1.3 6.6L12 17.4l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8z" fill="currentColor"/>',
  w_clear: '<circle cx="12" cy="12" r="4.5"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2"/>',
  w_haze: '<path d="M3 8h18M5 12h14M3 16h18"/>',
  w_fog: '<path d="M3 7h12M6 11h15M3 15h14M7 19h11"/>',
  w_rain: '<path d="M6 13a5 5 0 0 1 1-9.8A6 6 0 0 1 18.5 6 4 4 0 0 1 18 13z"/><path d="M8 16l-1.5 4M13 16l-1.5 4M18 16l-1.5 4"/>',
  w_storm: '<path d="M3 8c4-2 8 2 12 0s5-1 6 0M3 13c4-2 8 2 12 0s5-1 6 0M3 18c4-2 8 2 12 0"/>',
  // fullscreen: arrows out to the corners / arrows in to the centre
  fsOn: '<path d="M3 9V3h6M21 9V3h-6M3 15v6h6M21 15v6h-6"/><path d="M3 3l6 6M21 3l-6 6M3 21l6-6M21 21l-6-6"/>',
  fsOff: '<path d="M9 3v6H3M15 3v6h6M9 21v-6H3M15 21v-6h6"/><path d="M3 3l6 6M21 3l-6 6M3 21l6-6M21 21l-6-6"/>',
  r_hop: '<path d="M4 20c1-9 6-14 13-14"/><path d="M13 3l4 3-3 4"/><path d="M3 21h7"/>',
  lantern: '<path d="M9 3h6M10 3v3h4V3M8 6h8l-1 9H9z"/><path d="M12 18v3M5 10H3M21 10h-2M6 5L4.5 3.5M18 5l1.5-1.5"/>',
  photon: '<circle cx="12" cy="12" r="3" fill="currentColor"/><path d="M12 2v5M12 17v5M2 12h5M17 12h5M5 5l3.5 3.5M15.5 15.5L19 19M19 5l-3.5 3.5M8.5 15.5L5 19"/>',
  rotL: '<path d="M4 10a8 8 0 1 1 1.5 7"/><path d="M4 4v6h6"/>',
  rotR: '<path d="M20 10a8 8 0 1 0-1.5 7"/><path d="M20 4v6h-6"/>',
  arrL: '<path d="M15 4l-8 8 8 8"/>',
  arrR: '<path d="M9 4l8 8-8 8"/>',
  guided: '<path d="M3 21c2-6 5-8 9-8s6-3 5-7"/><path d="M14 4l3 2 2-3"/><circle cx="12" cy="13" r="1.4"/>',
  rocket: '<path d="M4 20l4-4M14.5 3.5c3 0 6 3 6 6l-8.5 8.5-6-6z"/><path d="M8.5 12.5L5 13l-2 3 4 1M11.5 15.5L11 19l-3 2-1-4"/><circle cx="15" cy="9" r="1.6"/>',
  s_tower: '<path d="M8 21V3h8v18zM8 8.5h8M8 14.5h8"/>',
  s_wall: '<path d="M10 21V4h4v17zM10 9.5h4M10 15h4"/>',
  s_arch: '<path d="M3 8h18M5 8v13h4V8M15 8v13h4V8"/>',
  s_pyramid: '<path d="M3 20h18L12 5z"/><path d="M7.5 14h9M10 9.5h4"/>',
  s_shield: '<path d="M10 20V4h4v16z" fill="currentColor"/>',
  s_fence: '<path d="M5 20V6M10 20V5M15 20V5M20 20V6M3 10h19M3 15h19"/>',
  ok: '<path d="M4 12.5l5 5L20 6.5"/>',
  night: '<path d="M18 15.5A8 8 0 0 1 8.5 6a8 8 0 1 0 9.5 9.5z"/>'
};
const icon = k => `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true">${ICON[k] || ''}</svg>`;
const UI = {
  weapon: 'he', logs: [],
  init() {
    $('#bPause').onclick = () => this.togglePause();
    $('#bMenu').onclick = () => { if (G.phase === 'menu') return; this.confirmLeave(); };
    // fullscreen toggle (standard + Safari prefix). Hidden where the browser has no element fullscreen (iPhone Safari).
    const de = document.documentElement, fsEl = () => document.fullscreenElement || document.webkitFullscreenElement, bF = $('#bFull');
    const fsSync = () => { bF.innerHTML = icon(fsEl() ? 'fsOff' : 'fsOn'); bF.setAttribute('aria-label', fsEl() ? 'Выйти из полного экрана' : 'Полный экран'); setTimeout(() => { V.resize && V.resize(); }, 120); };
    if (!(de.requestFullscreen || de.webkitRequestFullscreen)) bF.hidden = true;
    bF.onclick = () => { AU.init(); try { if (fsEl()) (document.exitFullscreen || document.webkitExitFullscreen).call(document); else { const r = (de.requestFullscreen || de.webkitRequestFullscreen).call(de, { navigationUI: 'hide' }); if (r && r.catch) r.catch(() => { }); } } catch (e) { } };
    document.addEventListener('fullscreenchange', fsSync); document.addEventListener('webkitfullscreenchange', fsSync); fsSync();
    const row = $('#chipRow');
    WEAPONS.all().forEach(w => { const b = el('button', 'chip', icon(w.id) + '<em></em>'); b.dataset.id = w.id; b.dataset.k = 'w'; b.setAttribute('aria-label', w.name); b.onclick = () => { this.weapon = w.id; SFX.click(); this.refresh(); }; row.appendChild(b); });
    if (RECON.all().length) row.appendChild(el('i', 'sep'));
    // recon acts on one tap: one action per turn, the chip dims after
    RECON.all().forEach(r => { const b = el('button', 'chip rc', icon('r_' + r.id) + '<em></em>'); b.dataset.id = r.id; b.dataset.k = 'r'; b.setAttribute('aria-label', r.name); b.onclick = () => { AU.init(); G.doRecon(G.cur, r.id); this.refresh(); }; row.appendChild(b); });
    $('#bFire').onclick = () => { AU.init(); if (G.phase === 'review') { G.pass(); return; } const u = G.sides[G.cur] && G.sides[G.cur].tank; G.doFire(G.cur, this.weapon, u && u.droneTx != null && WEAPONS.get(this.weapon).cat === 'drone' ? { tx: u.droneTx } : undefined); this.refresh(); };
    $('#bEnd').innerHTML = icon('pass'); $('#bEnd').onclick = () => { if (G.phase === 'review') G.pass(); else G.endTurn(); };
    // deploy bar: the tank and the structure catalogue
    const dr = $('#depRow'); [['tank', 'tank'], ['lamp', 'lantern'], ...STRUCTURES.ids().map(id => [id, 's_' + id])].forEach(([id, ic]) => { const b = el('button', 'chip' + (id === 'tank' ? '' : ' rc'), icon(ic) + '<em></em>'); b.dataset.id = id; b.setAttribute('aria-label', id === 'tank' ? 'Машина' : id === 'lamp' ? 'Светильник' : STRUCTURES.get(id).name); b.onclick = () => { this.deployTool = id; SFX.click(); this.refresh(); }; dr.appendChild(b); });
    const rot = (btn, dir) => { let raf = 0, last = 0; const go = t => { G.deployTurn(dir, last ? Math.min(.05, (t - last) / 1000) : .016); last = t; raf = requestAnimationFrame(go); }; btn.addEventListener('pointerdown', e => { e.preventDefault(); btn.setPointerCapture(e.pointerId); last = 0; raf = requestAnimationFrame(go); }); const stop = () => cancelAnimationFrame(raf); btn.addEventListener('pointerup', stop); btn.addEventListener('pointercancel', stop); };
    $('#rotL').innerHTML = icon('rotL'); $('#rotR').innerHTML = icon('rotR'); rot($('#rotL'), 1); rot($('#rotR'), -1);
    $('#depGo').innerHTML = icon('ok'); $('#depGo').onclick = () => { AU.init(); G.deployDone(); };
    this.stickDrive($('#stickL'));
    this.levA = this.lever($('#levA'), 'h'); this.levP = this.lever($('#levP'), 'v');
    $('#dL').innerHTML = icon('arrL'); $('#dR').innerHTML = icon('arrR'); this.hold($('#dL'), -1); this.hold($('#dR'), 1);
    Bus.on('log', e => { if (G.phase === 'menu' || e.side !== G.viewSide) return; if (e.warn) SFX.radio(); });
    this.buildMenu();
  },
  myUnit() { const S = G.sides[G.cur]; return S && S.ctrl === 'human' && G.phase === 'play' && S.tank.alive ? S.tank : null; },
  // left stick: horizontal drive, fuel shown as the ring
  stickDrive(st) {
    const knob = st.querySelector('.knob'); let id = null, cx = 0;
    // a submarine also gets the vertical axis: down = dive, up = surface
    let cy = 0; const set = (dx, dy) => { const R = st.clientWidth / 2 - 22, u = this.myUnit(), S = G.sides[G.cur], sub = u && u.type === 'sub'; dx = clamp(dx, -R, R); dy = sub ? clamp(dy, -R, R) : 0; knob.style.transform = `translate(${dx}px,${dy}px)`; const d = Math.abs(dx) > 14 ? Math.sign(dx) : 0, v = Math.abs(dy) > 14 ? dy / R : 0; if (u && S.fuel > 0) { u.drive = d; u.dive = v; this.engine = this.engine || SFX.loop('engine'); this.engine.set(d || v ? .18 : 0); } };
    st.addEventListener('pointerdown', e => { e.preventDefault(); AU.init(); st.setPointerCapture(e.pointerId); id = e.pointerId; const r = st.getBoundingClientRect(); cx = r.left + r.width / 2; cy = r.top + r.height / 2; set(e.clientX - cx, e.clientY - cy); });
    st.addEventListener('pointermove', e => { if (e.pointerId === id) set(e.clientX - cx, e.clientY - cy); });
    const up = e => { if (e.pointerId !== id) return; id = null; knob.style.transform = ''; const S = G.sides[G.cur]; if (S) { S.tank.drive = 0; S.tank.dive = 0; } if (this.engine) this.engine.set(0); };
    st.addEventListener('pointerup', up); st.addEventListener('pointercancel', up);
  },
  // spring lever: deflection sets a RATE (tempo), release springs it back to zero
  lever(el, axis) {
    const tilt = el.classList.contains('tilt'), part = el.querySelector(tilt ? '.arm' : '.cap'), st = { d: 0 }; let id = null, c = 0;
    const show = off => { part.style.transform = tilt ? `rotate(${st.d * 32}deg)` : `translateY(${off}px)`; };
    const set = pos => { const r = tilt ? el.clientWidth / 2 : el.clientHeight / 2 - 18, off = clamp(pos - c, -r, r); st.d = off / r; show(off); };
    el.addEventListener('pointerdown', e => { e.preventDefault(); AU.init(); el.setPointerCapture(e.pointerId); id = e.pointerId; const r = el.getBoundingClientRect(); c = axis === 'h' ? r.left + r.width / 2 : r.top + r.height / 2; part.style.transition = 'none'; set(axis === 'h' ? e.clientX : e.clientY); });
    el.addEventListener('pointermove', e => { if (e.pointerId === id) set(axis === 'h' ? e.clientX : e.clientY); });
    const up = e => { if (e.pointerId !== id) return; id = null; st.d = 0; part.style.transition = ''; part.style.transform = ''; };
    el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
    return st;
  },
  // drone sight arrows: hold to slide the yellow circle, speeding up the longer you hold
  hold(btn, dir) {
    const on = e => { e.preventDefault(); AU.init(); btn.setPointerCapture(e.pointerId); this.dHold = { dir, t0: performance.now(), acc: 0 }; const g = this.guided(); if (g) { g.vec += dir * .06; SFX.click(); haptic(8); } };
    const off = () => { this.dHold = null; };
    btn.addEventListener('pointerdown', on); btn.addEventListener('pointerup', off); btn.addEventListener('pointercancel', off);
  },
  // the live hand-steered rocket of the side whose turn it is (fired by a human)
  guided() { const S = G.sides[G.cur]; if (!S || S.ctrl !== 'human' || G.phase === 'review') return null; return G.shots.find(s => s.w && s.w.guided && !s.dead && s.owner === S.tank && s.rt < s.burn) || null; },
  pip(u) { this.beepAt = performance.now(); SFX.beep(droneBeepHot(u)); },
  togglePause() { G.paused = !G.paused; $('#bPause').textContent = G.paused ? '▶' : '❚❚'; $('#bPause').setAttribute('aria-label', G.paused ? 'Продолжить' : 'Пауза'); document.body.classList.toggle('paused', G.paused); },
  refresh() {
    const S = G.sides[G.cur]; if (!S) return; const review = G.phase === 'review', mine = S.ctrl === 'human' && G.phase === 'play', dep = G.phase === 'deploy';
    document.body.classList.toggle('deploying', dep); $('#deployBar').hidden = !dep;
    if (dep) { const D = G.sides[G.deploySide], left = DEPLOY_STRUCTS - D.structs.length; document.querySelectorAll('#depRow .chip').forEach(b => { b.classList.toggle('on', b.dataset.id === this.deployTool); b.querySelector('em').textContent = b.dataset.id === 'tank' || b.dataset.id === 'lamp' ? '' : Math.max(0, left); }); } document.body.classList.toggle('tooltank', dep && this.deployTool === 'tank');
    document.body.classList.toggle('their-turn', !mine && !review); document.body.classList.toggle('review', review);
    const ws = mine || review ? S : (G.sides[G.viewSide] || S), plat = ws.tank.type;
    const wOk = id => (WEAPONS.get(id).on || ['tank']).includes(plat), rOk = id => (RECON.get(id).on || ['tank']).includes(plat);
    if (!wOk(this.weapon) || !(ws.ammo[this.weapon] > 0)) this.weapon = WEAPONS.ids().find(id => wOk(id) && ws.ammo[id] > 0) || WEAPONS.ids().find(wOk);
    document.querySelectorAll('#chipRow .chip').forEach(b => {
      const id = b.dataset.id, isW = b.dataset.k === 'w', n = isW ? ws.ammo[id] : ws.recon[id]; b.hidden = !(isW ? wOk(id) : rOk(id));
      b.classList.toggle('on', isW && id === this.weapon); b.disabled = !(n > 0) || (!isW && (ws.reconned || !mine)); b.classList.toggle('done', !isW && ws.reconned);
      b.querySelector('em').textContent = n === Infinity ? '' : n;
    });
    const dm = WEAPONS.get(this.weapon).cat === 'drone'; document.body.classList.toggle('dronemode', dm);
    if (dm && mine && S.tank.droneTx == null) { const u = S.tank, [mx] = u.def.muzzle(u), dir = Math.cos(aimW(u)) >= 0 ? 1 : -1; u.droneTx = clamp(mx + dir * 90, 6, WORLD_W - 6); }
    const f = $('#bFire'), key = review ? 'pass' : this.weapon; if (f.dataset.k !== key) { f.innerHTML = icon(key); f.dataset.k = key; }
    f.disabled = review ? false : (!mine || S.fired || !(S.ammo[this.weapon] > 0)); $('#bEnd').disabled = !mine && !review;
    const tb = $('#turnBadge'), ti = S.tank.type; tb.style.color = SIDE_COL[G.cur]; if (tb.dataset.k !== ti) { $('#turnIcon').innerHTML = icon(ti); tb.dataset.k = ti; }
    $('#turnNo').textContent = G.turn; $('#stickL').classList.toggle('sub', ws.tank.type === 'sub');
    const wk = 'w_' + G.weather.id + (G.day.lum < .5 ? 'n' : ''); if ($('#wxIcon').dataset.k !== wk) { $('#wxIcon').innerHTML = icon(G.day.lum < .5 && G.weather.id === 'clear' ? 'night' : 'w_' + G.weather.id); $('#wxIcon').dataset.k = wk; }
  },
  tick() {
    if (!G.sides.length) return; const S = G.sides[G.cur];
    $('#stickL').style.setProperty('--fuel', S ? clamp(S.fuel / S.fuelMax, 0, 1) : 0);
    const wv = Math.round(G.wind * 10) / 10; $('#windLbl').textContent = Math.abs(wv).toFixed(1); $('#windArrow').style.transform = `scaleX(${wv < 0 ? -1 : 1})`; $('#windArrow').style.opacity = clamp(.35 + Math.abs(wv) / 8, .35, 1);
    const now = performance.now(), dt = Math.min(.05, (now - (this.lastT || now)) / 1000); this.lastT = now;
    const me = this.myUnit(), a = this.levA ? this.levA.d : 0, p = this.levP ? -this.levP.d : 0, ten = Math.max(Math.abs(a), Math.abs(p));
    if (ten > .05 && me) { this.spring = this.spring || SFX.loop('spring'); this.spring.set(.05 + ten * .13); } else if (this.spring) this.spring.set(0);
    const g = this.guided(); document.body.classList.toggle('guiding', !!g);
    if (g && this.dHold) {                                    // nonlinear: rate grows with the square of hold time; past 2 s the vector tumbles
      const h = this.dHold, held = (now - h.t0) / 1000; g.vec += h.dir * (.12 + 1.1 * held * held) * dt;
      if (held > 2) { const c = Math.min(1, (held - 2) / .6); g.vec += (Math.random() - .5) * 60 * c * dt; if (Math.random() < 3 * c * dt) g.vec += (Math.random() < .5 ? -1 : 1) * rnd(1, 3); }
      g.vec = Math.atan2(Math.sin(g.vec), Math.cos(g.vec));
    }
    if (me) {
      me.levering = Math.abs(a) > .05;
      if (me.levering) { if (me.aimT == null) me.aimT = me.aim; me.aimT -= Math.sign(a) * Math.pow(Math.abs(a), 1.7) * 1.15 * dt; if (me.type === 'tank') me.aimT = clamp(me.aimT, -.35, Math.PI + .35); }
      if (Math.abs(p) > .05) me.power = clamp(me.power + Math.sign(p) * Math.pow(Math.abs(p), 1.7) * .55 * dt, .05, 1);
      const w = WEAPONS.get(this.weapon);
      if (w && w.cat === 'drone' && me.droneTx != null) {
        if (this.dHold) { const h = this.dHold, held = (now - h.t0) / 1000, v = Math.min(150, 22 + held * 95), before = me.droneTx; me.droneTx = clamp(me.droneTx + h.dir * v * dt, 6, WORLD_W - 6); h.acc += Math.abs(me.droneTx - before); if (h.acc > 8) { h.acc = 0; this.pip(me); } }
        if (now - (this.beepAt || 0) > (droneBeepHot(me) ? 1500 : 4750)) this.pip(me);   // slow sonar pulse
      }
    }
    { const u = S && S.tank; if (u && u.alive) { $('#levP').style.setProperty('--pow', u.power.toFixed(3)); const gl = $('#gaugeLine'); gl.setAttribute('x2', (Math.cos(u.aim) * 9).toFixed(2)); gl.setAttribute('y2', (-Math.sin(u.aim) * 9).toFixed(2)); } }

    if (G.phase === 'play' && S.ctrl === 'human' && S.fuel <= 0 && this.engine) this.engine.set(0);
  },
  // ----- menu -----
  buildMenu() {
    const seg = (host, label, reg, key, withRandom, onPick) => {
      const box = el('div', 'field'), h = el('div', 'flabel', label), row = el('div', 'seg'); box.append(h, row);
      const opts = reg.all().map(d => [d.id, d.name, d.desc]); if (withRandom) opts.push(['random', 'Случайно', '']);
      opts.forEach(([id, name, desc]) => { const b = el('button', 'segb', name); b.dataset.id = id; if (desc) b.title = desc; b.onclick = () => { G.pick[key] = id; Store.set('pick', G.pick); SFX.click(); row.querySelectorAll('.segb').forEach(x => x.classList.toggle('on', x.dataset.id === id)); onPick && onPick(id); }; b.classList.toggle('on', G.pick[key] === id); row.appendChild(b); });
      host.appendChild(box);
    };
    const tabBattle = $('#tabBattle');
    seg(tabBattle, 'Режим', MODES, 'mode', false, () => this.menuInfo());
    seg(tabBattle, 'Местность', MAPS, 'map', true, () => previewWorld());
    seg(tabBattle, 'Погода', WEATHER, 'weather', true, () => previewWorld());
    seg(tabBattle, 'Время суток', DAYTIME, 'day', true, () => previewWorld());
    seg(tabBattle, 'Техника противника', FOES, 'foe', false, () => this.menuInfo());
    seg(tabBattle, 'Характер ИИ', AI_PROFILES, 'ai', false);
    const tabUp = $('#tabUp');
    UPGRADES.all().forEach(up => { const row = el('div', 'uprow'), l = upLevel(up.id); row.innerHTML = `<div><b>${up.name}</b><span>${up.desc}</span></div><div class="pips">${Array.from({ length: up.max }, (_, i) => `<i class="${i < l ? 'on' : ''}"></i>`).join('')}</div>`; const b = el('button', 'buy'); const upd = () => { const lv = upLevel(up.id); b.textContent = lv >= up.max ? 'Максимум' : `${up.cost(lv)} ¤`; b.disabled = lv >= up.max || save.credits < up.cost(lv); row.querySelectorAll('.pips i').forEach((p, i) => p.classList.toggle('on', i < lv)); }; b.onclick = () => { const lv = upLevel(up.id); if (lv >= up.max || save.credits < up.cost(lv)) return; save.credits -= up.cost(lv); save.up[up.id] = lv + 1; persist(); SFX.click(); this.menuInfo(); tabUp.querySelectorAll('.buy').forEach(x => x._upd && x._upd()); }; b._upd = upd; upd(); row.appendChild(b); tabUp.appendChild(row); });
    const tabSet = $('#tabSet');
    SETTINGS.all().forEach(s => {
      const row = el('label', 'setrow'), name = el('span', '', s.label + (s.hint ? `<small>${s.hint}</small>` : '')); row.appendChild(name); let inp;
      if (s.type === 'bool') { inp = el('input'); inp.type = 'checkbox'; inp.checked = !!cfg[s.id]; inp.onchange = () => { setCfg(s.id, inp.checked); }; }
      if (s.type === 'range') { inp = el('input'); inp.type = 'range'; inp.min = s.min; inp.max = s.max; inp.step = s.step; inp.value = cfg[s.id]; inp.oninput = () => setCfg(s.id, +inp.value); }
      if (s.type === 'choice') { inp = el('select'); s.options.forEach(([v, n]) => { const o = el('option', '', n); o.value = v; inp.appendChild(o); }); inp.value = cfg[s.id]; inp.onchange = () => { setCfg(s.id, inp.value); if (['quality', 'pixel'].includes(s.id) && G.phase === 'menu') previewWorld(); }; }
      row.appendChild(inp); tabSet.appendChild(row);
    });
    document.querySelectorAll('.tab').forEach(t => t.onclick = () => { SFX.click(); document.querySelectorAll('.tab').forEach(x => x.classList.toggle('on', x === t)); document.querySelectorAll('.tabpane').forEach(p => p.hidden = p.id !== t.dataset.tab); });
    $('#bStart').onclick = () => { AU.init(); newMatch(); };
    $('#menu').addEventListener('pointerdown', () => { AU.init(); AU.playMusic('menu'); }, { once: false });
  },
  menuInfo() {
    $('#credits').textContent = save.credits + ' ¤'; $('#record').textContent = `побед ${save.wins}, поражений ${save.losses}`;
    const m = MODES.get(G.pick.mode), f = FOES.get(G.pick.foe); $('#modeDesc').textContent = m.desc + (f && f.id !== 'tank' ? ' ' + f.desc : '');
    if (G.weather && G.mapId) $('#nowWx').textContent = `${MAPS.get(G.mapId).name}. ${G.weather.name}, ${G.day.name.toLowerCase()}, видимость ${G.weather.vKm >= 10 ? 'более 10 км' : G.weather.vKm >= 1 ? G.weather.vKm + ' км' : Math.round(G.weather.vKm * 1000) + ' м'}`;
  },
  showMenu(on) { $('#menu').hidden = !on; $('#hud').hidden = on; document.body.classList.toggle('in-menu', on); if (on) { AU.playMusic('menu'); this.menuInfo(); } },
  cover(side) { const c = $('#cover'); c.hidden = false; const ic = $('#coverIcon'); ic.innerHTML = icon(G.sides[side].tank.type); ic.style.color = SIDE_COL[side]; $('#coverGo').innerHTML = icon('play'); G.paused = true; $('#coverGo').onclick = () => { c.hidden = true; G.paused = false; G.banner(side); }; },
  result(winner, earned) {
    const r = $('#result'); r.hidden = false; const ic = $('#resIcon'); ic.innerHTML = icon('star') + icon(G.sides[winner].tank.type); ic.style.color = SIDE_COL[winner];
    $('#resText').textContent = earned ? `+${earned} ¤` : ''; $('#resGo').innerHTML = icon('play');
    $('#resGo').onclick = () => { r.hidden = true; previewWorld(); this.showMenu(true); };
  },
  confirmLeave() { const c = $('#leave'); c.hidden = false; G.paused = true; $('#leaveIcon').innerHTML = icon('exit'); $('#leaveNo').innerHTML = icon('play'); $('#leaveYes').innerHTML = icon('exit'); $('#leaveYes').onclick = () => { c.hidden = true; G.paused = false; previewWorld(); this.showMenu(true); }; $('#leaveNo').onclick = () => { c.hidden = true; G.paused = false; }; }
};

// ---------- boot ----------
async function boot() {
  try {
    const bin = Uint8Array.from(atob(WASM_B64), c => c.charCodeAt(0));
    B = await Box2D({ wasmBinary: bin });
  } catch (e) { $('#bootMsg').textContent = 'Физический движок не загрузился: ' + (e && e.message || e) + '. Обновите страницу.'; return; }
  V.resize(); UI.init(); UI.showMenu(true); previewWorld(); $('#boot').hidden = true;
  requestAnimationFrame(t => { last = t; requestAnimationFrame(frame); });
}
boot();
// title water line drifts like a settling lake
setInterval(() => { if (G.phase !== 'menu') return; document.querySelectorAll('.title .w').forEach((w, i) => w.style.setProperty('--lvl', (38 + Math.sin(Clock.t * .4 + i * 1.7) * 14 + Math.random() * 6).toFixed(1) + '%')); }, 2400);



