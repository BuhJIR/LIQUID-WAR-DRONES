// =====================================================================
// AUDIO. One bus graph; music tracks are registry entries with start()
// returning {stop, tension(x)}. Everything is synthesized, nothing sampled.
// =====================================================================
const PHI = 1.6180339887;
const AU = {
  ctx: null, ready: false, musicId: null, track: null, tension: 0,
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    const c = this.ctx = new AC();
    this.master = c.createDynamicsCompressor(); this.master.threshold.value = -14; this.master.ratio.value = 4; this.master.connect(c.destination);
    this.music = c.createGain(); this.sfx = c.createGain(); this.music.connect(this.master); this.sfx.connect(this.master);
    // reverb: generated exponentially decaying noise IR
    const len = c.sampleRate * 3.2, ir = c.createBuffer(2, len, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2); }
    this.rev = c.createConvolver(); this.rev.buffer = ir; this.revIn = c.createGain(); this.revIn.gain.value = .5; this.revIn.connect(this.rev); this.rev.connect(this.master);
    // white noise buffer
    const nb = c.createBuffer(1, c.sampleRate * 2, c.sampleRate), nd = nb.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1; this.noiseBuf = nb;
    const bb = c.createBuffer(1, c.sampleRate * 4, c.sampleRate), bd = bb.getChannelData(0); let last = 0; for (let i = 0; i < bd.length; i++) { last = (last + .02 * (Math.random() * 2 - 1)) / 1.02; bd[i] = last * 3.5; } this.brownBuf = bb;
    // 25% duty pulse (Game Boy channel 1 timbre)
    const N = 32, re = new Float32Array(N), im = new Float32Array(N); for (let n = 1; n < N; n++) im[n] = 2 / (n * Math.PI) * Math.sin(n * Math.PI * .25); this.pulse = c.createPeriodicWave(re, im);
    this.ready = true; this.applyVolumes();
    if (this.pendingMusic) { const m = this.pendingMusic; this.pendingMusic = null; this.playMusic(m); }
  },
  applyVolumes() { if (!this.ready) return; const t = this.ctx.currentTime; this.music.gain.setTargetAtTime(cfg.music * .55, t, .1); this.sfx.gain.setTargetAtTime(cfg.sfx, t, .05); },
  playMusic(id) {
    if (!this.ready) { this.pendingMusic = id; return; }
    if (this.musicId === id) return; this.musicId = id;
    if (this.track) this.track.stop(); this.track = MUSIC.get(id).start(this);
  },
  setTension(x) { this.tension = x; if (this.track && this.track.tension) this.track.tension(x); },
  noise(brown) { const s = this.ctx.createBufferSource(); s.buffer = brown ? this.brownBuf : this.noiseBuf; s.loop = true; return s; },
  now() { return this.ctx.currentTime; }
};
SETTINGS.get('music').onChange = () => AU.applyVolumes();
SETTINGS.get('sfx').onChange = () => AU.applyVolumes();

// step sequencer helper with lookahead
function sequencer(au, stepDur, onStep) {
  let next = au.now() + .1, step = 0, alive = true;
  const id = setInterval(() => { if (!alive) return; while (next < au.now() + .15) { onStep(step++, next); next += stepDur(); } }, 30);
  return () => { alive = false; clearInterval(id); };
}
function euclid(k, n, rot = 0) { const p = []; for (let i = 0; i < n; i++) p.push(((i + rot) * k) % n < k ? 1 : 0); return p; }
function env(g, t, a, peak, d) { g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); }
function fadeOut(nodes, g, au, time = 1.5) { const t = au.now(); g.gain.cancelScheduledValues(t); g.gain.setTargetAtTime(0, t, time / 4); setTimeout(() => nodes.forEach(n => { try { n.stop(); } catch (e) { } try { n.disconnect(); } catch (e) { } }), time * 1000 + 200); }

// ---------- MENU: dark drone in three lanes ----------
MUSIC.add('menu', {
  start(au) {
    const c = au.ctx, out = c.createGain(); out.gain.value = 0; out.connect(au.music); out.connect(au.revIn); out.gain.setTargetAtTime(1, au.now(), 1.2);
    const srcs = [];
    // lane 1: bass drone, two detuned triangles + sub
    const bassG = c.createGain(); bassG.gain.value = .22; const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 220; bassG.connect(lp); lp.connect(out);
    const b1 = c.createOscillator(), b2 = c.createOscillator(), b3 = c.createOscillator(); b1.type = b2.type = 'triangle'; b3.type = 'sine';
    b1.frequency.value = 55; b2.frequency.value = 55 * 1.5; b2.detune.value = 7; b3.frequency.value = 27.5;
    const g2 = c.createGain(); g2.gain.value = .45; b2.connect(g2); g2.connect(bassG); b1.connect(bassG); b3.connect(bassG); [b1, b2, b3].forEach(o => { o.start(); srcs.push(o); });
    // lane 2: pulse melody through dotted echo
    const del = c.createDelay(2); del.delayTime.value = .804; const fb = c.createGain(); fb.gain.value = .38; del.connect(fb); fb.connect(del); const dl = c.createBiquadFilter(); dl.type = 'lowpass'; dl.frequency.value = 1600; del.connect(dl); dl.connect(out);
    const melBus = c.createGain(); melBus.gain.value = .09; melBus.connect(out); melBus.connect(del);
    // lane 3: wind band + whistle
    const nz = au.noise(false), bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 9; bp.frequency.value = 600; const ng = c.createGain(); ng.gain.value = .07; nz.connect(bp); bp.connect(ng); ng.connect(out); nz.start(); srcs.push(nz);
    const lfo = c.createOscillator(), lg = c.createGain(); lfo.frequency.value = .031; lg.gain.value = 420; lfo.connect(lg); lg.connect(bp.frequency); lfo.start(); srcs.push(lfo);
    const roots = [55, 43.654, 65.406, 41.203], scale = [0, 3, 5, 7, 10, 12, 15]; let deg = 2;
    const stop = sequencer(au, () => .536, (s, t) => {
      if (s % 16 === 0) { const r = roots[(s / 16 | 0) % roots.length]; b1.frequency.setTargetAtTime(r, t, 1.4); b2.frequency.setTargetAtTime(r * 1.5, t, 1.6); b3.frequency.setTargetAtTime(r / 2, t, 1.8); }
      if (Math.random() < .34) {
        deg = clamp(deg + Math.round((Math.random() - .5) * 3), 0, scale.length - 1);
        const r = roots[(s / 16 | 0) % roots.length], f = r * 4 * Math.pow(2, scale[deg] / 12);
        const o = c.createOscillator(), g = c.createGain(); o.setPeriodicWave(au.pulse); o.frequency.value = f; o.connect(g); g.connect(melBus); env(g, t, .008, 1, .45 + Math.random() * .4); o.start(t); o.stop(t + 1.2);
      }
      if (s % 32 === 23 && Math.random() < .6) { // high whistle, golden-ratio glide
        const o = c.createOscillator(), g = c.createGain(); o.type = 'sine'; const f = 880 * PHI; o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f / PHI, t + 3); o.connect(g); g.connect(out); env(g, t, 1.2, .025, 2.5); o.start(t); o.stop(t + 4);
      }
    });
    return { stop() { stop(); fadeOut(srcs, out, au); } };
  }
});

// ---------- FIELD: tactical cacophony (hum, resonant noise, euclidean metal) ----------
MUSIC.add('field', {
  start(au) {
    const c = au.ctx, out = c.createGain(); out.gain.value = 0; out.connect(au.music); out.connect(au.revIn); out.gain.setTargetAtTime(1, au.now(), 1.5);
    const srcs = []; let tension = 0;
    // mains hum 50 Hz and its odd harmonics, as a contact-mic field recording
    const hum = c.createOscillator(); hum.type = 'sawtooth'; hum.frequency.value = 50; const hlp = c.createBiquadFilter(); hlp.type = 'lowpass'; hlp.frequency.value = 330; hlp.Q.value = 4; const hg = c.createGain(); hg.gain.value = .035; hum.connect(hlp); hlp.connect(hg); hg.connect(out); hum.start(); srcs.push(hum);
    const am = c.createOscillator(), amg = c.createGain(); am.frequency.value = .17; amg.gain.value = .02; am.connect(amg); amg.connect(hg.gain); am.start(); srcs.push(am);
    // brown noise through a golden-ratio resonator bank
    const br = au.noise(true); br.start(); srcs.push(br);
    [110, 110 * PHI, 110 * PHI * PHI].forEach((f, i) => { const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = 30; const g = c.createGain(); g.gain.value = .18 / (i + 1); br.connect(bp); bp.connect(g); g.connect(out); });
    const pat = { a: euclid(5, 16), b: euclid(3, 8), c: euclid(7, 16, 2) }; const harm = [7, 9, 11, 13, 15].map(h => 55 * h / 2);
    const stop = sequencer(au, () => 60 / (84 + tension * 40) / 4, (s, t) => {
      const i = s % 16; if (i === 0 && (s / 16 | 0) % 4 === 3) { pat.a = euclid(5 + (tension > .5 ? 2 : 0), 16, Math.random() * 16 | 0); pat.c = euclid(7, 16, Math.random() * 16 | 0); }
      if (pat.a[i] && Math.random() < .35 + tension * .5) { // FM metal ping, inharmonic √2 ratio
        const f = pick(harm), car = c.createOscillator(), mod = c.createOscillator(), mg = c.createGain(), g = c.createGain();
        car.frequency.value = f; mod.frequency.value = f * Math.SQRT2; mg.gain.setValueAtTime(f * 3, t); mg.gain.exponentialRampToValueAtTime(1, t + .4); mod.connect(mg); mg.connect(car.frequency); car.connect(g); g.connect(out); env(g, t, .002, .06, .5); car.start(t); mod.start(t); car.stop(t + .6); mod.stop(t + .6);
      }
      if (pat.b[i % 8] && i % 2 === 0 && Math.random() < .6) { const o = c.createOscillator(), g = c.createGain(); o.frequency.setValueAtTime(95, t); o.frequency.exponentialRampToValueAtTime(38, t + .25); o.connect(g); g.connect(out); env(g, t, .004, .22, .35); o.start(t); o.stop(t + .4); }
      if (pat.c[i] && Math.random() < .5) { const n = au.noise(false), hp = c.createBiquadFilter(), g = c.createGain(); hp.type = 'highpass'; hp.frequency.value = 5200; n.connect(hp); hp.connect(g); g.connect(out); env(g, t, .001, .05, .04); n.start(t); n.stop(t + .08); }
      if (Math.random() < .004 + tension * .02) { // radio static burst
        const n = au.noise(false), bp = c.createBiquadFilter(), g = c.createGain(); bp.type = 'bandpass'; bp.frequency.value = 1800 + Math.random() * 900; bp.Q.value = 2; n.connect(bp); bp.connect(g); g.connect(out); env(g, t, .02, .05, .6 + Math.random()); n.start(t); n.stop(t + 1.8);
      }
    });
    return { stop() { stop(); fadeOut(srcs, out, au); }, tension(x) { tension = x; hlp.frequency.setTargetAtTime(330 + x * 500, au.now(), .5); } };
  }
});

// ---------- SFX ----------
const SFX = {
  _ok() { return AU.ready && cfg.sfx > 0; },
  boom(size = 1, dist = 0) {
    if (!this._ok()) return; const c = AU.ctx, t = AU.now() + dist * .003, att = 1 / (1 + dist * .02);
    const n = AU.noise(false), lp = c.createBiquadFilter(), g = c.createGain(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(2400 * att + 200, t); lp.frequency.exponentialRampToValueAtTime(90, t + .9 * size); n.connect(lp); lp.connect(g); g.connect(AU.sfx); g.connect(AU.revIn); env(g, t, .004, .9 * att, 1.1 * size); n.start(t); n.stop(t + 1.6 * size);
    const o = c.createOscillator(), og = c.createGain(); o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(28, t + .6); o.connect(og); og.connect(AU.sfx); env(og, t, .003, .9 * att, .8 * size); o.start(t); o.stop(t + 1);
  },
  shot(kind = 'shell') {
    if (!this._ok()) return; const c = AU.ctx, t = AU.now();
    const n = AU.noise(false), bp = c.createBiquadFilter(), g = c.createGain(); bp.type = 'bandpass'; bp.frequency.value = kind === 'blob' ? 320 : kind === 'drone' ? 2600 : 900; bp.Q.value = .8; n.connect(bp); bp.connect(g); g.connect(AU.sfx); g.connect(AU.revIn); env(g, t, .002, .7, kind === 'blob' ? .35 : .5); n.start(t); n.stop(t + .7);
    const o = c.createOscillator(), og = c.createGain(); o.type = 'square'; o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(40, t + .18); o.connect(og); og.connect(AU.sfx); env(og, t, .002, .25, .2); o.start(t); o.stop(t + .3);
  },
  splash(v = 1) { if (!this._ok()) return; const c = AU.ctx, t = AU.now(), n = AU.noise(false), hp = c.createBiquadFilter(), g = c.createGain(); hp.type = 'bandpass'; hp.frequency.value = 1400; hp.Q.value = .6; n.connect(hp); hp.connect(g); g.connect(AU.sfx); env(g, t, .01, .25 * v, .6); n.start(t); n.stop(t + .8); },
  ping(echoes = []) {
    if (!this._ok()) return; const c = AU.ctx, t = AU.now();
    const one = (at, f, a) => { const o = c.createOscillator(), g = c.createGain(); o.frequency.value = f; o.connect(g); g.connect(AU.sfx); g.connect(AU.revIn); env(g, at, .003, a, 1.4); o.start(at); o.stop(at + 1.6); };
    one(t, 1320, .3); echoes.forEach(d => one(t + d * .012, 1320 / PHI, .14));
  },
  radio() { if (!this._ok()) return; const c = AU.ctx, t = AU.now(), n = AU.noise(false), bp = c.createBiquadFilter(), g = c.createGain(); bp.type = 'bandpass'; bp.frequency.value = 2200; bp.Q.value = 3; n.connect(bp); bp.connect(g); g.connect(AU.sfx); env(g, t, .01, .12, .35); n.start(t); n.stop(t + .5); },
  click() { if (!this._ok()) return; const c = AU.ctx, t = AU.now(), o = c.createOscillator(), g = c.createGain(); o.type = 'square'; o.frequency.value = 2400; o.connect(g); g.connect(AU.sfx); env(g, t, .001, .05, .03); o.start(t); o.stop(t + .05); },
  flare() { if (!this._ok()) return; const c = AU.ctx, t = AU.now(), o = c.createOscillator(), g = c.createGain(); o.type = 'sawtooth'; o.frequency.setValueAtTime(200, t); o.frequency.exponentialRampToValueAtTime(1600, t + .5); o.connect(g); g.connect(AU.sfx); env(g, t, .01, .08, .6); o.start(t); o.stop(t + .7); },
  // drone sight: short sonar-like pip, higher when a known target is inside the circle
  beep(hot) { if (!this._ok()) return; const c = AU.ctx, t = AU.now(), o = c.createOscillator(), g = c.createGain(); o.type = 'sine'; o.frequency.value = hot ? 1760 : 1175; o.connect(g); g.connect(AU.sfx); env(g, t, .003, hot ? .16 : .1, .09); o.start(t); o.stop(t + .14); },
  // continuous loops return {set(x), stop()}
  loop(kind) {
    if (!this._ok()) return { set() { }, stop() { } }; const c = AU.ctx, g = c.createGain(); g.gain.value = 0; g.connect(AU.sfx); const srcs = [];
    if (kind === 'laser') { const o = c.createOscillator(), m = c.createOscillator(), mg = c.createGain(); o.type = 'sawtooth'; o.frequency.value = 220 * PHI; m.frequency.value = 55; mg.gain.value = 60; m.connect(mg); mg.connect(o.frequency); const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1400; f.Q.value = 3; o.connect(f); f.connect(g); o.start(); m.start(); srcs.push(o, m); }
    if (kind === 'flame') { const n = AU.noise(false), f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 700; n.connect(f); f.connect(g); n.start(); srcs.push(n); }
    if (kind === 'buzz') { const o = c.createOscillator(), o2 = c.createOscillator(), f = c.createBiquadFilter(), am = c.createOscillator(), ag = c.createGain(); o.type = o2.type = 'sawtooth'; o.frequency.value = 164; o2.frequency.value = 164 * 1.012; am.frequency.value = 23; ag.gain.value = .35; am.connect(ag); ag.connect(g.gain); f.type = 'bandpass'; f.frequency.value = 900; f.Q.value = 1.4; o.connect(f); o2.connect(f); f.connect(g); o.start(); o2.start(); am.start(); srcs.push(o, o2, am); }
    if (kind === 'spring') { const o = c.createOscillator(), f = c.createBiquadFilter(); o.type = 'sawtooth'; o.frequency.value = 76; f.type = 'lowpass'; f.frequency.value = 520; f.Q.value = 2.5; o.connect(f); f.connect(g); o.start(); srcs.push(o); g._o = o; g._mul = 2; }   // the engine, an octave up
    if (kind === 'engine') { const o = c.createOscillator(), f = c.createBiquadFilter(); o.type = 'sawtooth'; o.frequency.value = 38; f.type = 'lowpass'; f.frequency.value = 240; o.connect(f); f.connect(g); o.start(); srcs.push(o); g._o = o; }
    return { set(x) { g.gain.setTargetAtTime(x, AU.now(), .05); if (g._o) g._o.frequency.setTargetAtTime((34 + x * 60) * (g._mul || 1), AU.now(), .1); }, stop() { g.gain.setTargetAtTime(0, AU.now(), .06); setTimeout(() => srcs.forEach(s => { try { s.stop(); } catch (e) { } }), 400); } };
  }
};

