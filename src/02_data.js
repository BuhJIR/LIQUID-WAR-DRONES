// =====================================================================
// DATA. Scale: 1 game metre ≈ 12.5 real metres for visibility (the map is
// ~4 km of front). Ballistics run in game metres directly.
// SC is the world scale factor: maps, vehicles and blasts are authored at
// SC=1 and multiplied, so the whole world can be grown in one place.
// =====================================================================
const SC = 2;
const VIS_SCALE = 25 / SC;                  // real metres per game metre
const WORLD_W = 160 * SC, WORLD_H = 120 * SC;
const BED = -1e9;                           // no indestructible floor: islands float in the void

// ---------- modes ----------
MODES.add('duel', { name: 'Дуэль с ИИ', sides: ['human', 'ai'], desc: 'Ты против машины.' });
MODES.add('hotseat', { name: 'Вдвоём', sides: ['human', 'human'], desc: 'Один телефон, передаёте друг другу.' });
MODES.add('drill', { name: 'Полигон', sides: ['human', 'ai'], desc: 'Противник не стреляет. Пристрелка.', passiveAI: true });

// ---------- ARCHIPELAGO. A map is a list of islands in the void; every island
// has real gravity from its own mass (see Grav). Homes: side 0 and side 1. ----------
// island: { x, y, r, rough, home?: side, craters: [{ a, rc }] } (a = angle of the crater on the rim)
function isle(r, x, y, rad, rough, extra = {}) { return Object.assign({ x: x + (r() - .5) * 8, y: y + (r() - .5) * 10, r: rad * (.92 + r() * .16), rough, seed: (r() * 1e9) | 0, craters: [] }, extra); }
MAPS.add('pair', {
  name: 'Двойка', desc: 'Два больших острова и камень между ними',
  gen(seed) { const r = mulberry32(seed); return { islands: [
    isle(r, 62, 112, 34, .16, { home: 0, craters: [{ a: 1.25 + r() * .3, rc: 11 }] }),
    isle(r, 258, 124, 34, .16, { home: 1, craters: [{ a: 1.9 - r() * .3, rc: 11 }] }),
    isle(r, 160, 70 + r() * 40, 11, .25)] }; }
});
MAPS.add('chain', {
  name: 'Цепь', desc: 'Дома по краям, между ними россыпь камней',
  gen(seed) { const r = mulberry32(seed); return { islands: [
    isle(r, 50, 120, 30, .18, { home: 0, craters: [{ a: 1.4, rc: 9 }] }),
    isle(r, 270, 120, 30, .18, { home: 1, craters: [{ a: 1.75, rc: 9 }] }),
    isle(r, 118, 60 + r() * 30, 10, .3), isle(r, 162, 150 + r() * 30, 13, .28), isle(r, 206, 70 + r() * 30, 9, .3)] }; }
});
MAPS.add('moon', {
  name: 'Луна', desc: 'Большая луна с озером посередине',
  gen(seed) { const r = mulberry32(seed); return { islands: [
    isle(r, 40, 175, 24, .2, { home: 0, craters: [{ a: 1.1, rc: 8 }] }),
    isle(r, 280, 170, 24, .2, { home: 1, craters: [{ a: 2.0, rc: 8 }] }),
    isle(r, 160, 88, 40, .12, { craters: [{ a: 1.57 + (r() - .5) * .6, rc: 17 }] })] }; }
});

// ---------- weather: real visual ranges (Koschmieder V = 3.912/σ) ----------
// vKm: meteorological visual range in km. wind: mean m/s. rain: particles/s.
WEATHER.add('clear', { name: 'Ясно', vKm: 40, wind: 2, gust: 1, rain: 0, fog: [150, 170, 185], dust: 0 });
WEATHER.add('haze', { name: 'Дымка', vKm: 5, wind: 4, gust: 2, rain: 0, fog: [120, 125, 130], dust: 0 });
WEATHER.add('storm', { name: 'Пыльная буря', vKm: .45, wind: 13, gust: 6, rain: 0, fog: [120, 96, 70], dust: 1 });
// time of day: relative illuminance used for detection range (range ∝ √E)
DAYTIME.add('day', { name: 'День', lum: 1, sky: [[74, 86, 96], [140, 146, 148]] });
DAYTIME.add('dusk', { name: 'Сумерки', lum: .09, sky: [[28, 30, 44], [96, 70, 64]] });
DAYTIME.add('night', { name: 'Ночь', lum: .004, sky: [[5, 7, 12], [16, 20, 28]] });
const DETECT_DAY = 260 * SC; // game metres: unaided daylight detection of a vehicle (~6.5 km real)

// ---------- materials for blocks ----------
// r0: normal-incidence reflectance for the laser (Schlick). water 0.02 is the real figure.
MATERIALS.add('wood', { name: 'Дерево', density: .6, friction: .8, hp: 40, color: '#5b4632', r0: .04, flammable: true });
MATERIALS.add('concrete', { name: 'Бетон', density: 2.4, friction: .9, hp: 110, color: '#6a6964', r0: .08 });
MATERIALS.add('stone', { name: 'Камень', density: 2.6, friction: .9, hp: Infinity, color: '#4a4744', r0: .1 });
MATERIALS.add('steel', { name: 'Сталь', density: 4.5, friction: .5, hp: 180, color: '#4e5961', r0: .62, metal: true });
const WATER_R0 = .02;

// ---------- structures: blocks relative to a ground point (x along the ground, y along "up") ----------
MATERIALS.add('barrel', { name: 'Бочка с маслом', density: .9, friction: .6, hp: 22, color: '#6b3a22', r0: .3, flammable: true, spill: 'oil' });   // breaks open into a slick of oil
MATERIALS.add('chalk', { name: 'Мел', density: 1.8, friction: .9, hp: 70, color: '#cfcac0', r0: .3 });
STRUCTURES.add('tower', { name: 'Башня', blocks: [0, 1, 2, 3, 4].map(k => ['chalk', 0, .55 + k * 1.1, 1.1, 1.1]) });
STRUCTURES.add('wall', { name: 'Стенка', blocks: [['concrete', 0, .6, .9, 1.2], ['concrete', 0, 1.8, .9, 1.2], ['concrete', 0, 3, .9, 1.2]] });
STRUCTURES.add('arch', { name: 'Арка', blocks: [['chalk', -2, .55, 1.1, 1.1], ['chalk', -2, 1.65, 1.1, 1.1], ['chalk', 2, .55, 1.1, 1.1], ['chalk', 2, 1.65, 1.1, 1.1], ['steel', 0, 2.4, 5.4, .35]] });
STRUCTURES.add('pyramid', { name: 'Пирамида', blocks: [['chalk', -1.1, .55, 1.1, 1.1], ['chalk', 0, .55, 1.1, 1.1], ['chalk', 1.1, .55, 1.1, 1.1], ['chalk', -.55, 1.65, 1.1, 1.1], ['chalk', .55, 1.65, 1.1, 1.1], ['chalk', 0, 2.75, 1.1, 1.1]] });
STRUCTURES.add('shield', { name: 'Щит', blocks: [['steel', 0, 1.3, .3, 2.6]] });
STRUCTURES.add('fence', { name: 'Забор', blocks: [['wood', -1.5, 1, .22, 2], ['wood', -.5, 1, .22, 2], ['wood', .5, 1, .22, 2], ['wood', 1.5, 1, .22, 2]] });
const DEPLOY_STRUCTS = 3;

// ---------- enemy platforms (which main unit side 2 gets) ----------
FOES.add('tank', { name: 'Самоходка', unit: 'tank', desc: 'Сухопутная машина. Вода для неё смертельна.' });
// (the submarine is parked for now)
if (false) FOES.add('sub', { name: 'Субмарина', unit: 'sub', desc: 'Живёт в воде. На воздухе теряет прочность, как танк под водой.' });

// ---------- nature density per map (per 100 m of front) ----------
const NATURE = { rocks: 5, buried: 6, barrels: 2, crates: 2 };   // per island, scaled by its size

// ---------- upgrades ----------
UPGRADES.add('armor', { name: 'Броня', desc: '+15 прочности', cost: l => 80 + l * 60, max: 5 });
UPGRADES.add('fuel', { name: 'Бак', desc: '+20% хода за ход', cost: l => 60 + l * 50, max: 5 });
UPGRADES.add('optics', { name: 'Оптика', desc: '+10% дальности обнаружения', cost: l => 70 + l * 60, max: 5 });
UPGRADES.add('barrel', { name: 'Ствол', desc: '+5% начальной скорости', cost: l => 90 + l * 70, max: 4 });
UPGRADES.add('emitter', { name: 'Излучатель', desc: '+20% мощности лазера', cost: l => 90 + l * 70, max: 4 });

// ---------- AI profiles ----------
// aimErr (rad σ), powErr (σ), correct: share of observed miss removed next shot,
// recon: willingness to scan stale intel, move: tendency to relocate when exposed
AI_PROFILES.add('cautious', { name: 'Осторожный', aimErr: .05, powErr: .05, correct: .7, recon: .95, move: .85, prefs: { he: 3, rocket: 2, flamer: 1.5, laser: 1.5 } });
AI_PROFILES.add('assault', { name: 'Штурмовик', aimErr: .07, powErr: .07, correct: .5, recon: .5, move: .35, prefs: { he: 3, rocket: 2, flamer: 1.5, laser: 1.5 } });
AI_PROFILES.add('sniper', { name: 'Снайпер', aimErr: .032, powErr: .035, correct: .9, recon: .8, move: .55, prefs: { he: 3, rocket: 2, flamer: 1.5, laser: 1.5 } });

