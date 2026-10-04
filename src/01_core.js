'use strict';
/* =====================================================================
   LIQUID WAR DRONES — single-file build
   Architecture: every content axis is a REGISTRY. Add an entry, the menu,
   AI and systems pick it up automatically. Nothing below hardcodes a list.
   ===================================================================== */

// ---------- math / rng ----------
const TAU = Math.PI * 2;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = t => t * t * (3 - 2 * t);
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
let RNG = mulberry32(1);
const rnd = (a = 0, b = 1) => a + (b - a) * RNG();
const gauss = () => { let u = 0, v = 0; while (!u) u = RNG(); while (!v) v = RNG(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * v); };
const pick = arr => arr[Math.floor(RNG() * arr.length)];
function makeNoise1D(seed) {
  const r = mulberry32(seed), N = 512, t = new Float32Array(N); for (let i = 0; i < N; i++) t[i] = r() * 2 - 1;
  const f = x => { const i = Math.floor(x), fr = x - i, a = t[i & (N - 1)], b = t[(i + 1) & (N - 1)]; return lerp(a, b, smooth(fr)); };
  return (x, oct = 4) => { let s = 0, amp = 1, fr = 1, n = 0; for (let o = 0; o < oct; o++) { s += f(x * fr + o * 37.1) * amp; n += amp; amp *= .5; fr *= 2; } return s / n; };
}

// ---------- registry ----------
function Registry(name) { const m = new Map(); return { name, add(id, def) { def.id = id; m.set(id, def); return def; }, get: id => m.get(id), all: () => [...m.values()], ids: () => [...m.keys()], has: id => m.has(id) }; }
const MODES = Registry('modes');
const MAPS = Registry('maps');
const WEATHER = Registry('weather');
const DAYTIME = Registry('daytime');
const MATERIALS = Registry('materials');
const STRUCTURES = Registry('structures');
const UNITS = Registry('units');
const WEAPON_CATS = Registry('weaponCategories');
const WEAPONS = Registry('weapons');
const RECON = Registry('recon');
const AI_PROFILES = Registry('ai');
const UPGRADES = Registry('upgrades');
const SETTINGS = Registry('settings');
const MUSIC = Registry('music');
const FOES = Registry('foes');

// ---------- storage (per-viewer only, always guarded) ----------
const Store = {
  get(k, d) { try { const v = localStorage.getItem('lwd:' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('lwd:' + k, JSON.stringify(v)); } catch (e) { } }
};

// ---------- settings registry ----------
SETTINGS.add('quality', { label: 'Качество жидкости', type: 'choice', options: [['low', 'Низкое'], ['mid', 'Среднее'], ['high', 'Высокое']], def: 'mid' });
SETTINGS.add('lighting', { label: 'Динамический свет', type: 'bool', def: true });
SETTINGS.add('terrainMask', { label: 'Рельеф закрывает обзор', type: 'bool', def: false, hint: 'Холмы режут линию видимости. Без этого видимость только атмосферная.' });
SETTINGS.add('aimHint', { label: 'Подсказка траектории', type: 'bool', def: false, hint: 'Первая секунда полёта, без учёта ветра.' });
SETTINGS.add('music', { label: 'Музыка', type: 'range', min: 0, max: 1, step: .05, def: .6 });
SETTINGS.add('sfx', { label: 'Звуки', type: 'range', min: 0, max: 1, step: .05, def: .8 });
SETTINGS.add('haptics', { label: 'Вибрация', type: 'bool', def: true });
SETTINGS.add('pixel', { label: 'Пиксельность', type: 'choice', options: [['1', 'Чётко'], ['2', 'Грубо'], ['3', 'PS1']], def: '2' });
const cfg = {};
for (const s of SETTINGS.all()) cfg[s.id] = Store.get('set:' + s.id, s.def);
function setCfg(id, v) { cfg[id] = v; Store.set('set:' + id, v); const s = SETTINGS.get(id); if (s.onChange) s.onChange(v); }
const QUALITY = { low: { r: .2, max: 14000, fx: .6 }, mid: { r: .14, max: 26000, fx: 1 }, high: { r: .12, max: 34000, fx: 1.4 } };   // small drops: water flows around bodies instead of prying them up

// ---------- progression ----------
const save = Store.get('save', { credits: 150, up: {}, wins: 0, losses: 0 });
const persist = () => Store.set('save', save);
const upLevel = id => save.up[id] || 0;

// ---------- event bus ----------
const Bus = (() => { const h = {}; return { on(e, f) { (h[e] = h[e] || []).push(f); }, emit(e, d) { (h[e] || []).forEach(f => f(d)); } }; })();

// ---------- game-time scheduler ----------
const Clock = { t: 0, waits: [] };
function wait(sec) { return new Promise(res => Clock.waits.push({ at: Clock.t + sec, res })); }
function tickWaits() { for (let i = Clock.waits.length - 1; i >= 0; i--) if (Clock.t >= Clock.waits[i].at) { const w = Clock.waits.splice(i, 1)[0]; w.res(); } }
function haptic(ms) { if (cfg.haptics && navigator.vibrate) try { navigator.vibrate(ms); } catch (e) { } }

