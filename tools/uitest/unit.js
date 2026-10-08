/*
 * unit.js — перевірки пошуку та реперторизації в Node, без браузера й без сервера.
 * Працює прямо з repertory.js і зібраними data/<lang>/, тож придатний для CI.
 * Запуск: node tools/uitest/unit.js
 * Код виходу: 0 — усі перевірки пройшли, 1 — є провал.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const R = require(path.join(ROOT, 'repertory.js'));
const SC = require(path.join(ROOT, 'search-core.js'));
const read = p => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));

const idxRu = R.makeIndex(read('data/ru/index.json'));
const catRu = read('data/ru/catalog.json');
const catUa = read('data/ua/catalog.json');
const name = r => catRu.remedies[r].latin;

let ok = 0, fails = 0;
function check(title, fn) {
  try {
    const note = fn();
    ok++;
    console.log('OK   ' + title + (note ? ' — ' + note : ''));
  } catch (e) {
    fails++;
    console.log('FAIL ' + title + ' — ' + e.message);
  }
}
function assert(cond, msg) { if (!cond) throw new Error(msg); }

// Український індекс вантажимо лише за потреби (2,5 МБ JSON).
let _idxUa = null;
const idxUa = () => _idxUa || (_idxUa = R.makeIndex(read('data/ua/index.json')));

// Повнотекстовий пошук: рядки таблиці, відсортовані як в UI (бал, потім кількість збігів).
// Фрази в лапках підтверджуються за текстами документів — так само, як це робить app.js.
function top(q, lang, sec) {
  const idx = lang === 'ua' ? idxUa() : idxRu;
  const res = R.freeText(idx, q, sec || '', lang || 'ru');
  if (res.phraseTerms.length) R.confirmPhrases(idx, res, lang || 'ru', paraTexts(idx, lang || 'ru', res.paras));
  const rows = Array.from(res.byRemedy, ([r, e]) => ({ r, ...e }))
    .sort((a, b) => b.score - a.score || b.hits - a.hits);
  return { res, rows };
}

// Тексти абзаців для підтвердження фраз і для перевірок підстав (кеш документів, як state.docs).
const _docs = new Map();
function getDoc(lang, kind, id) {
  const k = lang + '/' + kind + '/' + id;
  if (!_docs.has(k)) _docs.set(k, read('data/' + lang + '/' + kind + '/' + id + '.json'));
  return _docs.get(k);
}
function paraMd(idx, lang, p) {
  const d = idx.docs[idx.pd[p]];
  const doc = getDoc(lang, d.t === 'r' ? 'remedies' : 'articles', d.id);
  const b = (d.t === 'r' ? doc.sections : doc.blocks)[idx.ps[p]];
  return b ? b.paras[idx.pp[p]] : null;
}
function paraTexts(idx, lang, paras) {
  const m = new Map();
  for (const x of paras) { const md = paraMd(idx, lang, x.p); if (md != null) m.set(x.p, md); }
  return m;
}

// ---- пошук -------------------------------------------------------------

check('«страх смерти» → перший Aconitum napellus', () => {
  const { res, rows } = top('страх смерти');
  assert(rows.length > 0, 'порожня видача');
  assert(/^Aconitum napellus/.test(name(rows[0].r)), 'перший ' + name(rows[0].r));
  return `препаратів ${res.byRemedy.size}, речень ${res.paras.length}`;
});

check('«ухудшение от движения» = «хуже от движения» (однакова перша десятка)', () => {
  const a = top('ухудшение от движения').rows.slice(0, 10).map(x => x.r);
  const b = top('хуже от движения').rows.slice(0, 10).map(x => x.r);
  assert(a.length === 10 && b.length === 10, `рядків ${a.length}/${b.length}`);
  const sa = a.slice().sort((x, y) => x - y), sb = b.slice().sort((x, y) => x - y);
  assert(sa.join() === sb.join(),
    'різні набори: ' + a.map(name).join(', ') + ' ≠ ' + b.map(name).join(', '));
  return a.slice(0, 3).map(name).join(', ') + '…';
});

check('«голвная боль» → виправлення одруку', () => {
  const { res } = top('голвная боль');
  assert(res.corrections.length > 0, 'corrections порожні');
  const c = res.corrections[0];
  assert(/головн/.test(JSON.stringify(c)), 'дивне виправлення ' + JSON.stringify(c));
  return JSON.stringify(res.corrections);
});

check('зайве слово відкидається (res.dropped) і видача перестає бути порожньою', () => {
  const strict = R.freeText(idxRu, 'страх смерти во время лихорадки ночью', '', 'ru');
  assert(strict.dropped.length > 0, 'dropped порожній');
  const { rows } = top('страх смерти');
  assert(rows.length > 0, 'базовий запит порожній');
  assert(strict.byRemedy.size > 0, 'після відкидання лишилось 0 препаратів');
  assert(strict.byRemedy.size < rows.length, `${strict.byRemedy.size} ≥ ${rows.length}: відкинули забагато`);
  return `без «${strict.dropped.join(', ')}» → препаратів ${strict.byRemedy.size}`;
});

check('«страх смерти» в лапках — підмножина звичайного запиту, слова стоять поруч', () => {
  const ph = top('"страх смерти"');
  const plain = top('страх смерти');
  assert(ph.rows.length > 0, 'фраза не знайшла нічого');
  assert(ph.rows.length < plain.rows.length, `фраза ${ph.rows.length} ≥ вільний пошук ${plain.rows.length}`);
  const set = new Set(plain.rows.map(x => x.r));
  const extra = ph.rows.filter(x => !set.has(x.r));
  assert(!extra.length, 'поза вільним пошуком: ' + extra.map(x => name(x.r)).join(', '));
  assert(ph.res.unverified === 0, `ru: ${ph.res.unverified} речень не перевірено за власним текстом`);
  // незалежна перевірка сусідства: розбиваємо речення простим регулярним виразом
  const near = sent => {
    const w = sent.replace(/\*\*|_/g, ' ').toLowerCase().replace(/ё/g, 'е').match(/[а-яa-z]+/g) || [];
    for (let i = 0; i < w.length; i++) {
      if (!w[i].startsWith('страх')) continue;
      if ((w[i + 1] || '').startsWith('смерт')) return true;
      if (w[i + 1] && (SC.STOP.has(w[i + 1]) || w[i + 1].length < 2) && (w[i + 2] || '').startsWith('смерт')) return true;
    }
    return false;
  };
  const pool = ph.res.paras.slice();
  for (let i = pool.length - 1; i > 0; i--) { const j = (i * 7919 + 13) % (i + 1); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  const bad = [];
  let seen = 0;
  for (const x of pool.slice(0, 20)) {
    const sents = SC.splitSentences(paraMd(idxRu, 'ru', x.p));
    seen += x.units.length;
    // кожне підтверджене речення абзацу має містити пару поруч, а не хоч одне з них
    const off = x.units.filter(u => !near(sents[u - idxRu.pstart[x.p]] || ''));
    if (off.length) bad.push(sents[off[0] - idxRu.pstart[x.p]]);
  }
  assert(!bad.length, `${bad.length} абзаців із реченням без пари поруч: ` + bad[0]);
  return `препаратів ${ph.rows.length} проти ${plain.rows.length}; перевірено 20 абзаців / ${seen} речень`;
});

check('підказка «діарея» на ua-каталозі містить «Пронос»', () => {
  const s = R.suggest(catUa, 'діарея', 6, 'ua');
  assert(s.length > 0, 'немає підказок');
  assert(s.some(x => /^Пронос/.test(x.rb.t)), 'підказки: ' + s.map(x => x.rb.t).join(' | '));
  return s.map(x => x.rb.t + '(' + x.n + ')').join(' | ');
});

// ---- реперторизація ----------------------------------------------------

const iAstma = catRu.rubrics.findIndex(r => r.k === 'nos' && /^Астма$/i.test(r.t));
const iNight = catRu.rubrics.findIndex(r => r.k === 'mod' && r.key === 'w.night');

check('рубрики «Астма» і «Хуже: ночью» є в каталозі', () => {
  assert(iAstma >= 0, 'немає нозології «Астма»');
  assert(iNight >= 0, 'немає модальності w.night');
  return `астма ${R.rubricRemedies(catRu, iAstma).size} препаратів, w.night ${R.rubricRemedies(catRu, iNight).size}`;
});

const rub = i => ({ remedies: R.rubricRemedies(catRu, i) });

check('elim (обов’язкова рубрика) зменшує кількість рядків', () => {
  assert(iAstma >= 0 && iNight >= 0, 'рубрики не знайдено');
  const base = R.repertorize([rub(iAstma), rub(iNight)], { sort: 'total' }).length;
  const elim = R.repertorize([rub(iAstma), Object.assign(rub(iNight), { elim: true })], { sort: 'total' }).length;
  assert(elim > 0, 'elim лишив 0 рядків');
  assert(elim < base, `${base} → ${elim}`);
  return `${base} → ${elim}`;
});

check('excl (виключна рубрика) зменшує кількість рядків', () => {
  assert(iAstma >= 0 && iNight >= 0, 'рубрики не знайдено');
  const base = R.repertorize([rub(iAstma)], { sort: 'total' }).length;
  const excl = R.repertorize([rub(iAstma), Object.assign(rub(iNight), { excl: true })], { sort: 'total' }).length;
  assert(excl > 0, 'excl лишив 0 рядків');
  assert(excl < base, `${base} → ${excl}`);
  return `${base} → ${excl}`;
});

// ---- модальності фази 2 (видобуті з речень симптомних розділів) --------

const iMotion = catRu.rubrics.findIndex(r => r.k === 'mod' && r.key === 'w.motion');
// Скільки препаратів мали «Хуже: движение, усилие» з самого розділу «Модальности»
// (ступінь 2) у збірці 13.09.2026, коли додавали фазу 2. Видобуті клаузи ступеня 1
// не входять сюди, тож це число має лише зростати — падіння означає, що зламано
// розбір розділу або таблицю MOD_CATS.
const MOTION_SECTIONAL = 178;

check('рубрика «Хуже: движение, усилие» має препарати обох ступенів', () => {
  assert(iMotion >= 0, 'немає модальності w.motion');
  const rb = catRu.rubrics[iMotion];
  assert(Array.isArray(rb.g) && rb.g.length === rb.r.length, 'немає масиву ступенів g');
  const grades = Array.from(R.rubricRemedies(catRu, iMotion).values()).map(v => v.g);
  const g2 = grades.filter(g => g === 2).length, g1 = grades.filter(g => g === 1).length;
  assert(g2 > 0 && g1 > 0, `секційних ${g2}, видобутих ${g1}`);
  return `секційних ${g2}, видобутих ${g1}`;
});

check('секційних препаратів у w.motion не менше, ніж було до фази 2', () => {
  assert(iMotion >= 0, 'немає модальності w.motion');
  const g2 = catRu.rubrics[iMotion].g.filter(g => g === 2).length;
  assert(g2 >= MOTION_SECTIONAL, `${g2} < ${MOTION_SECTIONAL}`);
  const ua = catUa.rubrics.find(r => r.k === 'mod' && r.key === 'w.motion');
  assert(ua && ua.g.filter(g => g === 2).length === g2, 'ua розходиться з ru');
  return `${g2} ≥ ${MOTION_SECTIONAL}, ua збігається`;
});

// ---- український індекс ------------------------------------------------

check('ua: «нудота вранці» знаходить препарати', () => {
  const { res, rows } = top('нудота вранці', 'ua');
  assert(rows.length > 0, 'порожня видача');
  return `препаратів ${res.byRemedy.size}, перший ${name(rows[0].r)}`;
});

check('ua: фраза «страх смерті» — підмножина звичайного запиту', () => {
  const ph = top('"страх смерті"', 'ua');
  const plain = top('страх смерті', 'ua');
  assert(ph.rows.length > 0, 'фраза не знайшла нічого');
  assert(ph.rows.length < plain.rows.length, `фраза ${ph.rows.length} ≥ вільний пошук ${plain.rows.length}`);
  const set = new Set(plain.rows.map(x => x.r));
  assert(ph.rows.every(x => set.has(x.r)), 'фраза дала препарати поза вільним пошуком');
  // у власному тексті слова немає — збіг прийшов із російського стему перекладу
  return `препаратів ${ph.rows.length} проти ${plain.rows.length}; речень із RU-стемів ${ph.res.unverified}`;
});

// ---- модальності за розділом, протилежності, рідкість, синоніми (випадок 08.10) ----
// Випадок, як його набрав би користувач: прозорі водянисті виділення при закладеному носі, щелепу
// «зводить», краще від тепла (в обличчі) і натискання, гірше вночі. За Кларком підходить Mag-phos
// (спазматична невралгія обличчя, «чередование заложенности и профузных… жидких выделений», лучше от
// тепла і надавливания). Ночі в нього немає — рубрика лишається, бо її назвав би користувач.
function modRub(cat, key, sec) {
  const i = cat.rubrics.findIndex(x => x.k === 'mod' && x.key === key);
  const si = sec ? cat.msec.indexOf(sec) : -1;
  const remedies = R.modRemedies(cat, i, si);
  return { remedies, rarity: R.rarity(cat, remedies.size), opp: R.modOpposites(cat, i, si, remedies) };
}
function freeRub(idx, q, sec, lang) {
  const res = R.freeText(idx, q, sec, lang, { articles: false });
  return { res, remedies: new Map(Array.from(res.byRemedy, ([r, v]) => [r, { g: v.g, hits: v.hits, score: v.score }])) };
}
const CASE = {
  ua: { idx: () => idxUa(), cat: catUa, nose: ['Ніс', 'водянисті виділення закладеність'], face: ['Обличчя', 'зводить щелепу'] },
  ru: { idx: () => idxRu, cat: catRu, nose: ['Нос', 'водянистые выделения заложенность'], face: ['Лицо', 'сводит челюсть'] },
};
for (const lang of ['ua', 'ru']) {
  check(lang + ': випадок «зводить щелепу» — Magnesium phosphoricum у перших трьох', () => {
    const C = CASE[lang];
    const rubs = [freeRub(C.idx(), C.nose[1], C.nose[0], lang), freeRub(C.idx(), C.face[1], C.face[0], lang),
      modRub(C.cat, 'b.heat', 'Лицо'), modRub(C.cat, 'b.pressure'), modRub(C.cat, 'w.night')];
    const rows = R.repertorize(rubs, {});
    const k = rows.findIndex(x => C.cat.remedies[x.r].id === 'magnesium-phosphoricum');
    assert(k >= 0 && k < 3, `Mag-phos на місці ${k + 1}; перші: ${rows.slice(0, 3).map(x => C.cat.remedies[x.r].latin).join(', ')}`);
    return `місце ${k + 1} з ${rows.length}`;
  });
}
check('ua: побутове слово без постингів не обнуляє запит («без: …»)', () => {
  const { res, remedies } = freeRub(idxUa(), 'щелепу ззззводить', 'Обличчя', 'ua');
  assert(remedies.size > 0, 'нічого не знайдено');
  assert(res.dropped.includes('ззззводить'), 'слово не відкинуто: ' + res.dropped.join(','));
  return `препаратів ${remedies.size}`;
});
check('синоніми односторонні: «сводит» шукає «спазм», а «спазм» — не «сводит»', () => {
  const alts = q => SC.queryTerms(q, 'ru').inc[0].alts;
  assert(alts('сводит').includes('спазм'), alts('сводит').join(','));
  assert(!alts('спазм').includes('свод'), alts('спазм').join(','));
  assert(!alts('скула').includes('челюст'), 'скула тягне челюсть: ' + alts('скула').join(','));
  assert(!alts('водянистые').includes('понос'), 'водянистый тягне понос через «жидкий»');
});
check('модальність за розділом: видобута в розділі — 2, із «Модальностей» — 1, з інших розділів — немає', () => {
  const rb = catRu.rubrics.find(x => x.k === 'mod' && x.key === 'b.heat');
  const si = catRu.msec.indexOf('Лицо');
  assert(si >= 0 && rb.s, 'немає розділів у каталозі');
  const m = R.modRemedies(catRu, catRu.rubrics.indexOf(rb), si);
  rb.r.forEach((r, k) => {
    const local = rb.s[k] && rb.s[k].includes(si);
    const want = local ? 2 : (rb.g[k] === 2 ? 1 : 0);
    const got = m.has(r) ? m.get(r).g : 0;
    assert(got === want, `${name(r)}: ${got} ≠ ${want}`);
  });
  return `${m.size} препаратів, з них у «Лице» ${Array.from(m.values()).filter(v => v.local).length}`;
});
check('протилежність лише з розділу «Модальности»: видобуте «хуже в постели» не знімає «лучше от тепла»', () => {
  const i = catRu.rubrics.findIndex(x => x.k === 'mod' && x.key === 'b.heat');
  const own = R.rubricRemedies(catRu, i);
  const opp = R.modOpposites(catRu, i, -1, own);
  const mp = catRu.remedies.findIndex(r => r.id === 'magnesium-phosphoricum');
  assert(!opp.has(mp), 'Mag-phos позначено протилежним');
  const mez = catRu.remedies.findIndex(r => r.id === 'mezereum');
  const ip = catRu.rubrics.findIndex(x => x.k === 'mod' && x.key === 'b.pressure');
  assert(R.modOpposites(catRu, ip, -1, R.rubricRemedies(catRu, ip)).has(mez), 'Mezereum («хуже от надавливания») не позначено');
});
check('рідкість: «Хуже: ночью» важить менше за «Лучше: надавливание»', () => {
  const n = key => catRu.rubrics.find(x => x.k === 'mod' && x.key === key).r.length;
  const a = R.rarity(catRu, n('w.night')), b = R.rarity(catRu, n('b.pressure'));
  assert(a < b, `${a} ≥ ${b}`);
  return `${a.toFixed(2)} проти ${b.toFixed(2)}`;
});
check('чим відрізняються: протилежні категорії йдуть першими, взяті в рубрики пропущено', () => {
  const ids = ['magnesium-phosphoricum', 'mezereum', 'nux-vomica'].map(id => catRu.remedies.findIndex(r => r.id === id));
  const list = R.diffModalities(catRu, ids, new Set(['heat']), 8);
  assert(list.length, 'порожньо');
  assert(!list.some(x => x.c === 'heat'), 'heat не пропущено');
  const firstPlain = list.findIndex(x => !x.opposed);
  assert(firstPlain < 0 || list.slice(firstPlain).every(x => !x.opposed), 'порядок порушено');
  const pr = list.find(x => x.c === 'pressure');
  assert(pr && pr.opposed, 'натискання (Mag-phos краще, Mezereum гірше) не серед протилежних');
  return list.map(x => x.c + (x.opposed ? '!' : '')).join(' ');
});

// ---- покроковий підбір: ознаки місць, «ні», «в одному реченні», уточнювальні питання ----
const facRu = read('data/ru/facets.json'), facUa = read('data/ua/facets.json');
const facIdx = (cat, key) => cat.rubrics.findIndex(x => (x.k === 'fac' || x.k === 'mod') && x.key === key);
function guideRub(cat, key, neg) {
  const i = facIdx(cat, key), rb = cat.rubrics[i];
  if (rb.k === 'fac') return Object.assign(R.facetRubric(cat, i, cat === catUa ? facUa : facRu), { neg });
  const m = R.rubricRemedies(cat, i);
  return { remedies: m, rarity: R.rarity(cat, m.size), opp: R.modOpposites(cat, i, -1, m), neg };
}
const remIdx = (cat, id) => cat.remedies.findIndex(r => r.id === id);
check('ознаки: заперечення не рахується («Неедкий насморк» — м’які, не їдкі)', () => {
  const ich = remIdx(catRu, 'ichthyolum');
  const has = key => R.rubricRemedies(catRu, facIdx(catRu, key)).has(ich);
  assert(ich >= 0, 'немає Ichthyolum');
  assert(has('nose.bland'), 'не в «мягкие»');
  assert(!has('nose.acrid'), 'потрапив в «едкие»');
});
check('ознаки: ua і ru — ті самі препарати (перенесення за id)', () => {
  for (const pl of catRu.places) for (const g of pl.groups) for (const i of g.items) {
    const key = catRu.rubrics[i].key, j = facIdx(catUa, key);
    const a = catRu.rubrics[i].r.map(r => catRu.remedies[r].id).sort().join(), b = catUa.rubrics[j].r.map(r => catUa.remedies[r].id).sort().join();
    assert(a === b, key + ': ua ≠ ru');
  }
});
check('«в одному реченні»: у Mag-phos «закладеність + рідкі» — одне речення (together ≥ 1)', () => {
  const rows = R.repertorize([guideRub(catRu, 'nose.thin'), guideRub(catRu, 'nose.blocked')], {});
  const row = rows.find(x => catRu.remedies[x.r].id === 'magnesium-phosphoricum');
  assert(row && row.together >= 1, 'together ' + (row && row.together));
});
check('«Ні» — м’який штраф: не в покритті, але нижче за рівного без неї', () => {
  const base = [guideRub(catRu, 'nose.thin'), guideRub(catRu, 'nose.blocked')];
  const rows0 = R.repertorize(base, {});
  const rows1 = R.repertorize(base.concat(guideRub(catRu, 'nose.sneeze', true)), {});
  const a = rows0[0], b = rows1.find(x => x.r === a.r);
  assert(b.cover === a.cover, 'покриття змінилось');
  const sneeze = R.rubricRemedies(catRu, facIdx(catRu, 'nose.sneeze'));
  const hit = rows1.find(x => sneeze.has(x.r)), miss = rows1.find(x => !sneeze.has(x.r) && x.cover === hit.cover && x.together === hit.together);
  if (miss) assert(rows1.indexOf(miss) < rows1.indexOf(hit), 'препарат із «ні» не нижче');
  assert(rows1.length === rows0.length, 'рядки викинуто');
});
for (const lang of ['ua', 'ru']) {
  check(lang + ': підбір — факти з розмови (рідкі, закладений, щелепа, спазм, тепло, ніч, натискання): Mag-phos у топ-5', () => {
    const cat = lang === 'ua' ? catUa : catRu;
    const keys = ['nose.thin', 'nose.blocked', 'face.jaw', 'face.cramp', 'b.heat', 'w.night', 'b.pressure'];
    const rows = R.repertorize(keys.map(k => guideRub(cat, k)), {});
    const k = rows.findIndex(x => cat.remedies[x.r].id === 'magnesium-phosphoricum');
    assert(k >= 0 && k < 5, `місце ${k + 1}: ${rows.slice(0, 5).map(x => cat.remedies[x.r].latin).join(', ')}`);
    return `місце ${k + 1}; поруч ${rows.slice(0, 5).map(x => cat.remedies[x.r].latin.split(' ')[0]).join(', ')}`;
  });
}
function guideSanity(placeKey) {
  const pl = catRu.places.find(p => p.key === placeKey);
  const facets = pl.groups.flatMap(g => g.items);
  const pool = facets.concat(catRu.rubrics.map((r, i) => (r.k === 'mod' ? i : -1)).filter(i => i >= 0));
  const has = (i, r) => { const v = R.rubricRemedies(catRu, i).get(r); return v && (catRu.rubrics[i].k !== 'mod' || v.g === 2); };
  const mk = i => (catRu.rubrics[i].k === 'fac' ? R.facetRubric(catRu, i, facRu) : guideRub(catRu, catRu.rubrics[i].key));
  let n = 0, start5 = 0, end5 = 0;
  for (let r = 0; r < catRu.remedies.length; r++) {
    const own = facets.filter(i => has(i, r));
    if (own.length < 4) continue;
    n++;
    const start = own.slice().sort((a, b) => catRu.rubrics[a].r.length - catRu.rubrics[b].r.length).slice(0, 2);
    const rubs = start.map(mk), asked = new Set(start);
    let rows = R.repertorize(rubs, {});
    if (rows.findIndex(x => x.r === r) < 5) start5++;
    for (let q = 0; q < 6; q++) {
      const nq = R.nextQuestion(catRu, rows, pool, asked, 25);
      if (!nq) break;
      asked.add(nq.i);
      if (has(nq.i, r)) { rubs.push(mk(nq.i)); rows = R.repertorize(rubs, {}); }
    }
    if (rows.findIndex(x => x.r === r) < 5) end5++;
  }
  return { n, start5, end5 };
}
check('питання допомагають: «пацієнт» = опис препарату (Ніс), «так»/«не знаю», ≤ 6 питань', () => {
  const { n, start5, end5 } = guideSanity('nose');
  assert(end5 / n >= 0.75, `у топ-5 лише ${end5}/${n}`);
  assert(end5 > start5, 'питання не допомогли');
  return `у топ-5: на старті ${start5}/${n}, після питань ${end5}/${n}`;
});
check('питання допомагають у кожному місці (після питань більше, ніж на старті)', () => {
  const out = [];
  for (const pl of catRu.places) {
    const { n, start5, end5 } = guideSanity(pl.key);
    if (n < 10) continue;
    assert(end5 > start5, pl.key + `: ${start5} → ${end5} з ${n}`);
    out.push(`${pl.key} ${Math.round(100 * start5 / n)}→${Math.round(100 * end5 / n)}%`);
  }
  return out.join(', ');
});

console.log(`\nПідсумок: OK ${ok}, FAIL ${fails}`);
process.exit(fails ? 1 : 0);
