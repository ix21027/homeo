/*
 * repertory.js — логіка реперторію без DOM: пошук по індексу речень, підказки рубрик,
 * зведення таблиці реперторизації (ваги, елімінативні та виключні рубрики, сортування).
 * Тестується у Node, використовується в app.js.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Repertory = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const SC = (typeof module !== 'undefined' && module.exports) ? require('./search-core.js') : globalThis.SearchCore;

  // Вага розділу Materia Medica у повнотекстовому підборі (решта розділів — 1)
  const SECTION_WEIGHT = { 'Характеристика': 0.5, 'Тип': 0.5, 'Взаимосвязи': 0.3, 'Взаємозв’язки': 0.3, 'Общее': 0.7, 'Загальне': 0.7 };

  // ---- індекс -----------------------------------------------------------
  // Формат v3: одиниця індексу — речення; абзаци описано масивами pd (документ), ps (розділ),
  // pp (номер абзацу в розділі), pr (препарат або -1), pn (кількість речень).
  function makeIndex(json) {
    if (json.v !== 3) throw new Error('index format v' + json.v);
    const idx = Object.assign({}, json);
    const nP = json.pd.length;
    const pstart = new Int32Array(nP + 1);
    for (let p = 0; p < nP; p++) pstart[p + 1] = pstart[p] + json.pn[p];
    const nU = pstart[nP];
    const u2p = new Int32Array(nU);
    for (let p = 0; p < nP; p++) for (let u = pstart[p]; u < pstart[p + 1]; u++) u2p[u] = p;
    const remParas = new Map();
    for (let p = 0; p < nP; p++) { const r = json.pr[p]; if (r >= 0 && json.docs[json.pd[p]].t === 'r') remParas.set(r, (remParas.get(r) || 0) + 1); }
    const cache = new Map();
    idx.pstart = pstart; idx.u2p = u2p; idx.nUnits = nU; idx.remParas = remParas;
    idx.getPostings = function (i) {
      let v = cache.get(i);
      if (!v) { v = SC.decodeList(json.post[i]); cache.set(i, v); }
      return v;
    };
    return idx;
  }

  function vocabRange(vocab, prefix) {
    let lo = 0, hi = vocab.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (vocab[mid] < prefix) lo = mid + 1; else hi = mid;
    }
    const out = [];
    for (let i = lo; i < vocab.length && vocab[i].startsWith(prefix); i++) out.push(i);
    return out;
  }

  function unitsForStem(idx, st) {
    let ids = vocabRange(idx.vocab, st);
    if (st.length < 4) ids = ids.filter(i => idx.vocab[i] === st);
    else if (ids.length > 80) ids = ids.slice(0, 80);
    if (!ids.length) return [];
    if (ids.length === 1) return idx.getPostings(ids[0]);
    const seen = new Set();
    for (const i of ids) for (const u of idx.getPostings(i)) seen.add(u);
    return Array.from(seen).sort((a, b) => a - b);
  }

  function intersect(a, b) {
    const out = [];
    let i = 0, j = 0;
    while (i < a.length && j < b.length) {
      if (a[i] === b[j]) { out.push(a[i]); i++; j++; }
      else if (a[i] < b[j]) i++; else j++;
    }
    return out;
  }

  function union(lists) {
    if (lists.length === 1) return lists[0];
    const seen = new Set();
    for (const l of lists) for (const u of l) seen.add(u);
    return Array.from(seen).sort((a, b) => a - b);
  }

  // Стем тексту s вважається збігом зі стемом запиту a за тим самим правилом, що й у
  // unitsForStem: точний збіг або префікс від 4 літер. Розмітка markdown — як у збірці.
  function matchStem(s, a) { return s === a || (a.length >= 4 && s.startsWith(a)); }
  const stripMd = s => s.replace(/\*\*|_/g, ' ');

  // Відстань Левенштейна з обмеженням (для виправлення одруків за словником індексу)
  function lev(a, b, max) {
    const m = a.length, n = b.length;
    if (Math.abs(m - n) > max) return max + 1;
    let prev = new Array(n + 1), cur = new Array(n + 1);
    for (let j = 0; j <= n; j++) prev[j] = j;
    for (let i = 1; i <= m; i++) {
      cur[0] = i;
      let rowMin = cur[0];
      for (let j = 1; j <= n; j++) {
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
        if (cur[j] < rowMin) rowMin = cur[j];
      }
      if (rowMin > max) return max + 1;
      [prev, cur] = [cur, prev];
    }
    return prev[n];
  }
  function fuzzyStems(idx, st) {
    if (st.length < 5) return [];
    const maxD = st.length <= 7 ? 1 : 2;
    const out = [];
    for (const i of vocabRange(idx.vocab, st[0])) {
      const v = idx.vocab[i];
      if (Math.abs(v.length - st.length) > maxD) continue;
      const d = lev(v, st, maxD);
      if (d <= maxD) out.push({ i, d, df: idx.post[i].length });
    }
    out.sort((a, b) => a.d - b.d || b.df - a.df);
    return out.slice(0, 3).map(x => idx.vocab[x.i]);
  }

  function gradeScore(score) { return score >= 6 ? 3 : score >= 3 ? 2 : score > 0 ? 1 : 0; }

  // Зведення res.paras у res.byRemedy / res.byArticle. Викликається після кожної зміни
  // списку абзаців (пошук, підтвердження фраз), бо e.paras зберігає індекси в res.paras.
  function aggregate(idx, res) {
    res.byRemedy = new Map();
    res.byArticle = new Map();
    res.paras.forEach((x, k) => {
      const d = idx.docs[idx.pd[x.p]];
      const r = idx.pr[x.p];
      if (r >= 0) {
        let e = res.byRemedy.get(r);
        if (!e) res.byRemedy.set(r, e = { hits: 0, raw: 0, score: 0, best: 0, g: 0, paras: [] });
        e.hits++; e.raw += x.score; if (x.score > e.best) e.best = x.score; e.paras.push(k);
      }
      if (d.t === 'a') {
        let e = res.byArticle.get(d.a);
        if (!e) res.byArticle.set(d.a, e = { hits: 0, paras: [] });
        e.hits++; e.paras.push(k);
      }
    });
    for (const [r, e] of res.byRemedy) {
      const np = idx.remParas.get(r) || 60;
      e.score = e.raw / (1 + Math.log10(1 + np / 80));
      e.g = gradeScore(e.score);
    }
    return res;
  }

  // Повнотекстовий пошук. Сильний збіг — усі слова запиту в одному реченні (2 бали),
  // слабкий — в одному абзаці (1 бал); бал множиться на вагу розділу і на частку idf,
  // що зібралась у найкращому реченні абзацу (рідкісні слова поруч важать більше за
  // розкидані); сума по препарату ділиться на м'яку поправку за обсяг опису.
  // idf слова = log((N+1)/(df+1)), N — кількість речень індексу, df — кількість речень
  // зі словом (за об'єднанням його альтернативних стемів).
  // Слова з «-» попереду виключають абзаци. Слово без збігів замінюється найближчим за
  // словником індексу (res.corrections). Якщо слів ≥3, а повний AND дає менше ніж три
  // абзаци по препаратах, найзагальніше слово (найменший idf) відкидається — до двох
  // разів (res.dropped); слова фрази не відкидаються ніколи.
  // Слова в лапках (res.phraseTerms) на цьому кроці дають лише кандидатів — усі слова
  // фрази в одному реченні; порядок «підряд» перевіряє confirmPhrases за текстом.
  function freeText(idx, query, sectionFilter, lang, opts) {
    const withArticles = !(opts && opts.articles === false);
    lang = lang || 'ru';
    const { inc, exc, phrases } = SC.queryTerms(query, lang);
    const res = { stems: [], paras: [], byRemedy: new Map(), byArticle: new Map(), corrections: [], dropped: [], phrases: [], phraseTerms: [] };
    if (!inc.length) return res;
    // слова запиту розв'язуємо один раз: постинги, виправлення одруків, idf
    const slots = inc.map(term => {
      let alts = term.alts;
      let u = union(alts.map(st => unitsForStem(idx, st)));
      if (!u.length) {
        const fz = fuzzyStems(idx, alts[0]);
        if (fz.length) { res.corrections.push({ word: term.word, to: fz }); alts = fz; u = union(fz.map(st => unitsForStem(idx, st))); }
      }
      return { word: term.word, ph: term.ph, alts, units: u, idf: Math.log((idx.nUnits + 1) / (u.length + 1)) };
    });
    const excUnits = exc.length ? union(exc.map(t => union(t.alts.map(st => unitsForStem(idx, st))))) : [];
    const toParas = units => { const s = new Set(); for (const u of units) s.add(idx.u2p[u]); return s; };
    // фрази: кандидати — речення, де зійшлися всі слова фрази (слова фрази не відкидаються)
    const groups = phrases.map(ph => {
      const mem = ph.terms.map(i => slots[i]);
      let u = mem[0].units;
      for (let i = 1; i < mem.length && u.length; i++) u = intersect(u, mem[i].units);
      return { text: ph.text, alts: mem.map(s => s.alts), units: u };
    });
    res.phrases = groups.map(g => g.text);
    res.phraseTerms = groups.map(g => g.alts);

    function run(active) {
      const out = { stems: [], paras: [] };
      const stemSet = new Set();
      for (const s of active) for (const a of s.alts) stemSet.add(a);
      out.stems = Array.from(stemSet);
      const idfTotal = active.reduce((a, s) => a + s.idf, 0) || 1;
      let strong = active[0].units;
      for (let i = 1; i < active.length && strong.length; i++) strong = intersect(strong, active[i].units);
      let paraSet = toParas(active[0].units);
      for (let i = 1; i < active.length && paraSet.size; i++) {
        const other = toParas(active[i].units);
        paraSet = new Set(Array.from(paraSet).filter(p => other.has(p)));
      }
      for (const g of groups) {
        if (!paraSet.size) break;
        const ps = toParas(g.units);
        paraSet = new Set(Array.from(paraSet).filter(p => ps.has(p)));
      }
      if (excUnits.length && paraSet.size) for (const u of excUnits) paraSet.delete(idx.u2p[u]);
      const phByPara = groups.map(g => {
        const m = new Map();
        for (const u of g.units) { const p = idx.u2p[u]; if (!paraSet.has(p)) continue; let a = m.get(p); if (!a) m.set(p, a = []); a.push(u); }
        return m;
      });
      const strongByPara = new Map();
      for (const u of strong) { const p = idx.u2p[u]; if (!paraSet.has(p)) continue; let a = strongByPara.get(p); if (!a) strongByPara.set(p, a = []); a.push(u); }
      const unitsByPara = new Map();
      const idfByUnit = new Map();
      for (const s of active) for (const u of s.units) {
        const p = idx.u2p[u];
        if (!paraSet.has(p) || strongByPara.has(p)) continue;
        let a = unitsByPara.get(p); if (!a) unitsByPara.set(p, a = new Set()); a.add(u);
        idfByUnit.set(u, (idfByUnit.get(u) || 0) + s.idf);
      }
      for (const p of Array.from(paraSet).sort((a, b) => a - b)) {
        const d = idx.docs[idx.pd[p]];
        if (sectionFilter && !(d.t === 'r' && d.s[idx.ps[p]] === sectionFilter)) continue;
        if (!withArticles && d.t === 'a') continue;
        const su = strongByPara.get(p);
        const units = su ? su : Array.from(unitsByPara.get(p) || []).sort((a, b) => a - b);
        const w = d.t === 'r' ? (SECTION_WEIGHT[d.s[idx.ps[p]]] || 1) : 1;
        // частка idf, що зібралась у найкращому реченні абзацу (для сильного збігу — уся)
        let ratio = 1;
        if (!su) {
          let best = 0;
          for (const u of units) { const v = idfByUnit.get(u) || 0; if (v > best) best = v; }
          ratio = best / idfTotal;
        }
        const x = { p, strong: !!su, units, w, ratio, score: (su ? 2 : 1) * w * ratio };
        if (groups.length) x.pc = phByPara.map(m => m.get(p) || []);
        out.paras.push(x);
      }
      return out;
    }

    // слово, якого немає в індексі навіть після синонімів і виправлення одруків, не обнуляє
    // запит (найчастіше це побутове слово на кшталт «зводить»): відкидаємо його, чіп покаже «без: …»
    let active = slots;
    const dead = slots.filter(s => !s.units.length && s.ph == null);
    if (dead.length && dead.length < slots.length) {
      active = slots.filter(s => !dead.includes(s));
      for (const s of dead) res.dropped.push(s.word);
    }
    let out = run(active);
    let soft = 0;
    while (inc.length >= 3 && soft < 2 && active.length >= 2) {
      let n = 0;
      for (const x of out.paras) if (idx.pr[x.p] >= 0) n++;
      if (n >= 3) break;
      const cand = active.filter(s => s.ph == null);
      if (!cand.length) break;
      let worst = cand[0];
      for (const s of cand) if (s.idf < worst.idf) worst = s;
      active = active.filter(s => s !== worst);
      res.dropped.push(worst.word);
      soft++;
      out = run(active);
    }
    res.stems = out.stems;
    res.paras = out.paras;
    return aggregate(idx, res);
  }

  // Фраза в реченні: стеми слів ідуть підряд (між сусідніми допускається одне стоп-слово,
  // бо «страх перед смертью» — та сама фраза, що й «страх смерти»). Повертає null, якщо
  // якогось слова у власному тексті речення немає взагалі: в українському індексі збіг міг
  // дати російський стем вирівняного перекладу, де позицій слів немає, — таке речення
  // зараховується як сильний збіг (див. confirmPhrases).
  function phraseInSentence(sent, termAlts, lang) {
    const toks = SC.tokenizeMarked(stripMd(sent), lang);
    const st = toks.map(x => (x.stop ? null : SC.stem(x.w, lang)));
    const hit = (k, alts) => st[k] != null && alts.some(a => matchStem(st[k], a));
    for (const alts of termAlts) if (!st.some((s, k) => hit(k, alts))) return null;
    for (let k = 0; k < st.length; k++) {
      if (!hit(k, termAlts[0])) continue;
      let pos = k, ok = true;
      for (let t = 1; t < termAlts.length; t++) {
        let next = -1;
        for (let j = pos + 1; j <= pos + 2 && j < st.length; j++) {
          if (hit(j, termAlts[t])) { next = j; break; }
          if (!toks[j].stop) break;
        }
        if (next < 0) { ok = false; break; }
        pos = next;
      }
      if (ok) return true;
    }
    return false;
  }

  // Підтвердження фраз за текстом абзаців: індекс не зберігає позицій слів (формат v3),
  // тому freeText дає лише кандидатів, а порядок слів перевіряється тут по завантажених
  // документах. texts — Map(номер абзацу → markdown абзацу); абзац без тексту відкидається.
  // res.unverified — скільки речень не вдалося перевірити за власним текстом (для ua це
  // збіг через російський стем перекладу і речення лишається, для ru — ознака розбіжності
  // з конвеєром збірки).
  function confirmPhrases(idx, res, lang, texts) {
    if (!res.phraseTerms || !res.phraseTerms.length) return res;
    const kept = [];
    res.unverified = 0;
    for (const x of res.paras) {
      const md = texts.get(x.p);
      if (md == null) continue;
      const sents = SC.splitSentences(md);
      const base = idx.pstart[x.p];
      const oks = [];
      for (let g = 0; g < res.phraseTerms.length; g++) {
        const hit = ((x.pc && x.pc[g]) || []).filter(u => {
          const s = sents[u - base];
          if (s == null) return false;
          const v = phraseInSentence(s, res.phraseTerms[g], lang);
          if (v === null) { res.unverified++; return lang === 'ua'; }
          return v;
        });
        if (!hit.length) { oks.length = 0; break; }
        oks.push(hit);
      }
      if (!oks.length) continue;
      const all = union(oks);
      const both = intersect(all, x.units);
      x.units = both.length ? both : all;
      if (!both.length && x.strong) { x.strong = false; x.score = x.w * x.ratio; }
      kept.push(x);
    }
    res.paras = kept;
    return aggregate(idx, res);
  }

  // ---- рубрики каталогу --------------------------------------------------
  // Map(remedy → {g, hits}); для «Клініки» ступінь з каталогу, дочірні рубрики (ієрархія) — ступінь 1.
  function rubricRemedies(catalog, i) {
    const rb = catalog.rubrics[i];
    if (rb._rem) return rb._rem;
    const m = new Map();
    rb.r.forEach((r, k) => m.set(r, { g: rb.g ? rb.g[k] : 2, hits: 1 }));
    if (rb.ch) {
      const seen = new Set([i]);
      const walk = (j, depth) => {
        if (seen.has(j) || depth > 3) return;
        seen.add(j);
        const c = catalog.rubrics[j];
        for (const r of c.r) if (!m.has(r)) m.set(r, { g: 1, hits: 1, child: j });
        if (c.ch) for (const k of c.ch) walk(k, depth + 1);
      };
      for (const j of rb.ch) walk(j, 1);
    }
    rb._rem = m;
    return m;
  }

  // ---- модальності: місце дії, протилежності, рідкість --------------------
  // Модальність, звужена до розділу (sec — номер у catalog.msec): видобута з речень цього розділу —
  // ступінь 2; клауза розділу «Модальности» (загальна для препарату) — ступінь 1; видобута лише
  // з інших розділів не рахується. Без розділу — звичайна рубрика каталогу.
  function modRemedies(catalog, i, sec) {
    if (sec == null || sec < 0) return rubricRemedies(catalog, i);
    const rb = catalog.rubrics[i];
    const m = new Map();
    rb.r.forEach((r, k) => {
      if (rb.s && rb.s[k] && rb.s[k].includes(sec)) m.set(r, { g: 2, hits: 1, local: true });
      else if (rb.g[k] === 2) m.set(r, { g: 1, hits: 1 });
    });
    return m;
  }
  // Протилежна модальність: Map(препарат → підпис протилежної рубрики) для тих, у кого зворотний
  // напрям стоїть у розділі «Модальности» (для звуженої рубрики — ще й видобутий з того самого
  // розділу), а запитаного напряму того ж рівня немає. Видобуте з інших розділів не рахується:
  // «хуже в постели» у «Зубах» не скасовує «лучше от тепла» в «Модальностях».
  function modOpposites(catalog, i, sec, own) {
    const rb = catalog.rubrics[i];
    const key = (rb.key[0] === 'w' ? 'b' : 'w') + rb.key.slice(1);
    const out = new Map();
    const ob = catalog.rubrics.find(x => x.k === 'mod' && x.key === key);
    if (!ob) return out;
    const local = sec != null && sec >= 0;
    ob.r.forEach((r, k) => {
      if (!(ob.g[k] === 2 || (local && ob.s && ob.s[k] && ob.s[k].includes(sec)))) return;
      const v = own.get(r);
      if (v && v.g === 2) return;
      out.set(r, ob.t);
    });
    return out;
  }
  // Вага рідкості рубрики модальності чи причини: idf відносно рубрики на чверть препаратів
  // (множник 1), у межах 0.5…2 — «Хуже: ночью» (половина препаратів) ≈0.5, «Лучше: надавливание» ≈1.
  function rarity(catalog, n) {
    const N = (catalog.stats && catalog.stats.remedies) || catalog.remedies.length;
    const f = Math.log((N + 1) / (n + 1)) / Math.log((N + 1) / (N / 4 + 1));
    return Math.max(0.5, Math.min(2, f));
  }
  // Чим відрізняються препарати ids: категорії модальностей розділу «Модальности» (ступінь 2), у
  // яких вони розходяться. Клітинки: '' | 'b' | 'w' | 'bw'. Спершу прямо протилежні (в одного «краще»,
  // в іншого «гірше»), далі ті, що є лише в частини препаратів. skip — Set категорій ('heat'), уже
  // взятих у рубрики.
  function diffModalities(catalog, ids, skip, limit) {
    const per = new Map();
    catalog.rubrics.forEach(rb => {
      if (rb.k !== 'mod') return;
      const d = rb.key[0], c = rb.key.slice(2);
      if (skip && skip.has(c)) return;
      rb.r.forEach((r, k) => {
        if (rb.g[k] !== 2) return;
        const j = ids.indexOf(r);
        if (j < 0) return;
        if (!per.has(c)) per.set(c, ids.map(() => ''));
        const a = per.get(c);
        if (!a[j].includes(d)) a[j] = (a[j] + d).split('').sort().join('');
      });
    });
    const out = [];
    let order = 0;
    for (const [c, cells] of per) {
      order++;
      const filled = cells.filter(Boolean).length;
      if (filled < 2 && cells.length > 2) continue;   // ознака одного препарату з багатьох мало що розрізняє
      if (cells.every(x => x === cells[0])) continue;
      const opposed = cells.includes('b') && cells.includes('w');
      out.push({ c, cells, opposed, filled, order });
    }
    out.sort((a, b) => (b.opposed - a.opposed) || (b.filled - a.filled) || (a.order - b.order));
    return out.slice(0, limit || 8);
  }

  // ---- зведення ---------------------------------------------------------
  // rubrics: [{ remedies: Map(remedy → {g, hits, score?} | number), weight?, elim?, excl?,
  //             rarity? (множник балів), opp? (Map(remedy → підпис протилежної модальності)) }]
  // opts.sort: 'cover' (типово) | 'total' | 'name' (потрібен opts.nameOf)
  // Протилежність не зменшує показане покриття (row.cover), але сортування за покриттям іде за
  // row.cover − row.conflicts, а бали втрачають по одиниці (× вага × рідкість) за кожну.
  // Рубрика з neg («Ні» на уточнювальне питання) не входить у покриття: препарат, що її має, лише
  // трохи опускається (−0.5 у сортуванні, −0.5·ступінь у балах) — відсутність симптому в описі не доказ.
  function repertorize(rubrics, opts) {
    opts = opts || {};
    const rows = new Map();
    const excl = new Set();
    let nElim = 0;
    rubrics.forEach((rb, k) => {
      if (!rb.remedies) return;
      if (rb.excl) { for (const r of rb.remedies.keys()) excl.add(r); return; }
      if (rb.neg) return;
      const w = (rb.weight || 1) * (rb.rarity || 1);
      if (rb.elim) nElim++;
      for (const [r, v] of rb.remedies) {
        const g = typeof v === 'number' ? v : v.g;
        const hits = typeof v === 'number' ? 1 : (v.hits || 1);
        const sc = typeof v === 'number' ? g : (v.score != null ? v.score : g);
        let row = rows.get(r);
        if (!row) rows.set(r, row = { r, cover: 0, conflicts: 0, negs: 0, together: 0, total: 0, sumHits: 0, sumScore: 0, elimOk: 0, grades: new Array(rubrics.length).fill(0), hits: new Array(rubrics.length).fill(0), conf: new Array(rubrics.length).fill(null), neg: new Array(rubrics.length).fill(false) });
        row.grades[k] = g; row.hits[k] = hits; row.cover++; row.total += g * w; row.sumHits += hits; row.sumScore += sc * w;
        if (rb.elim) row.elimOk++;
      }
    });
    rubrics.forEach((rb, k) => {
      if (!rb.remedies || rb.excl || !rb.neg) return;
      const w = (rb.weight || 1) * (rb.rarity || 1);
      for (const [r, v] of rb.remedies) {
        const row = rows.get(r);
        if (!row) continue;
        row.neg[k] = true; row.negs++; row.total -= 0.5 * (typeof v === 'number' ? v : v.g) * w;
      }
    });
    rubrics.forEach((rb, k) => {
      if (!rb.remedies || rb.excl || rb.neg || !rb.opp) return;
      const w = (rb.weight || 1) * (rb.rarity || 1);
      for (const [r, label] of rb.opp) {
        const row = rows.get(r);
        if (!row) continue;
        row.conf[k] = label; row.conflicts++; row.total -= w;
      }
    });
    // Ознаки одного місця, описані в одному реченні («заложенность… и выделения… жидких белых масс»), —
    // сильніший збіг, ніж ті самі ознаки, розкидані по великому розділу (так само, як слова в одному
    // реченні текстового пошуку). row.together — сума по місцях (найбільше ознак в одному реченні − 1);
    // у сортуванні важить як пів рубрики, у балах — як одиниця. Без цього нагорі опиняються препарати з
    // найдовшими описами, що згадують майже все.
    const byPlace = new Map();
    rubrics.forEach(rb => {
      if (!rb.pos || !rb.remedies || rb.excl || rb.neg) return;
      if (!byPlace.has(rb.place)) byPlace.set(rb.place, []);
      byPlace.get(rb.place).push(rb);
    });
    for (const list of byPlace.values()) {
      if (list.length < 2) continue;
      for (const row of rows.values()) {
        const cnt = new Map();
        let best = 0;
        for (const rb of list) {
          const ps = rb.pos.get(row.r);
          if (!ps) continue;
          for (const p of ps) { const c = (cnt.get(p) || 0) + 1; cnt.set(p, c); if (c > best) best = c; }
        }
        if (best > 1) { row.together += best - 1; row.total += best - 1; }
      }
    }
    const out = Array.from(rows.values()).filter(row => !excl.has(row.r) && row.elimOk === nElim);
    const net = row => row.cover - row.conflicts - 0.5 * row.negs + 0.5 * row.together;
    const byCover = (a, b) => net(b) - net(a) || b.cover - a.cover || b.total - a.total || b.sumScore - a.sumScore || a.r - b.r;
    const byTotal = (a, b) => b.total - a.total || net(b) - net(a) || b.sumScore - a.sumScore || a.r - b.r;
    const byName = (a, b) => opts.nameOf(a.r).localeCompare(opts.nameOf(b.r)) || a.r - b.r;
    return out.sort(opts.sort === 'total' ? byTotal : opts.sort === 'name' && opts.nameOf ? byName : byCover);
  }

  // Рубрика-ознака покрокового підбору: препарати, місце і речення (Map(препарат → ['абзац.речення', …]))
  // для бонусу «в одному реченні». facets — вміст data/<мова>/facets.json ({ e: {ключ: [пари на препарат]} });
  // без нього pos порожній (бонусу немає, поки файл не завантажився).
  function facetRubric(catalog, i, facets) {
    const rb = catalog.rubrics[i];
    const pos = new Map();
    const all = facets && facets.e && facets.e[rb.key];
    rb.r.forEach((r, k) => {
      const e = all && all[k];
      if (!e || !e.length) return;
      const keys = new Set();
      for (let j = 0; j < e.length; j += 2) keys.add(e[j] + '.' + e[j + 1]);
      pos.set(r, Array.from(keys));
    });
    return { remedies: rubricRemedies(catalog, i), pos, place: rb.key.slice(0, rb.key.indexOf('.')) };
  }

  // ---- уточнювальне питання ----------------------------------------------
  // Близькі до лідера кандидати: рядки, чий «чистий» бал покриття не нижчий за лідерів більш ніж на 1, до cap.
  function nearLeaders(rows, cap) {
    if (!rows.length) return [];
    const net = row => row.cover - row.conflicts - 0.5 * (row.negs || 0) + 0.5 * (row.together || 0);
    const top = Math.max.apply(null, rows.map(net));
    return rows.filter(row => net(row) >= top - 1).slice(0, cap || 25);
  }
  // Наступне питання: рубрика каталогу з pool (номери; ознаки відкритих місць і модальності), яка ділить
  // близьких до лідера кандидатів найближче до навпіл. Модальність рахується лише з розділу «Модальности»
  // (ступінь 2). Не питаємо про рубрику, яку мають менше двох кандидатів або всі, крім одного.
  // skip — Set номерів, про які вже питали чи які вже в рубриках. Повертає { i, count, of } або null.
  function nextQuestion(catalog, rows, pool, skip, cap) {
    const cand = nearLeaders(rows, cap);
    const C = cand.length;
    if (C < 3) return null;
    const ids = cand.map(row => row.r);
    const min = C >= 6 ? 2 : 1;
    let best = null;
    for (const i of pool) {
      if (skip && skip.has(i)) continue;
      const rb = catalog.rubrics[i];
      const m = rubricRemedies(catalog, i);
      let n = 0;
      for (const r of ids) { const v = m.get(r); if (v && (rb.k !== 'mod' || v.g === 2)) n++; }
      if (n < min || C - n < min) continue;
      const score = Math.min(n, C - n) / C + (rb.k === 'fac' ? 0.01 : 0);
      if (!best || score > best.score) best = { i, count: n, of: C, score };
    }
    return best;
  }

  // ---- підказки рубрик --------------------------------------------------
  function foldForMatch(s, lang) {
    if (lang === 'ua') return s.toLowerCase().split(/\s+/).map(w => SC.foldLetters(w, 'ua')).join(' ').replace(/[^a-zа-яіїє0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
    return s.toLowerCase().split(/\s+/).map(w => SC.UA_RU[w] || w).map(w => SC.foldLetters(w, 'ru')).join(' ').replace(/э/g, 'е').replace(/[^a-zа-я0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
  }

  const KIND_RANK = { nos: 0, mod: 1, etio: 1, art: 2, line: 3 };
  function suggest(catalog, query, limit, lang) {
    const q = foldForMatch(query, lang);
    if (q.length < 2) return [];
    const stop = lang === 'ua' ? SC.STOP_UA : SC.STOP;
    const words = q.split(' ').filter(w => w && !stop.has(w));
    if (!words.length) return [];
    const slots = SC.queryTerms(query, lang).inc.map(t => t.alts);
    const stemHit = (st, a) => st.has(a) || (a.length >= 4 && Array.from(st).some(s => s.startsWith(a)));
    const out = [];
    catalog.rubrics.forEach((rb, i) => {
      const t = rb._f || (rb._f = foldForMatch(rb.t, lang));
      let score = 0;
      if (t.startsWith(q)) score = 5;
      else if (t.includes(' ' + q)) score = 4;
      else if (words.every(w => t.startsWith(w) || t.includes(' ' + w))) score = 3;
      else if (words.every(w => t.includes(w))) score = 2;
      else if (slots.length) {
        // збіг за стемами й синонімами (нудота ↔ Тошнота, діарея ↔ Понос)
        const st = rb._st || (rb._st = new Set(SC.stems(rb.t, lang)));
        if (slots.every(alts => alts.some(a => stemHit(st, a)))) {
          // повний збіг (усі стеми рубрики покриті запитом, напр. «діарея» ↔ «Понос») важить як збіг слова
          const full = Array.from(st).every(s => slots.some(alts => alts.some(a => s === a || (a.length >= 4 && s.startsWith(a)))));
          score = full ? 4.5 : 1;
        }
      }
      if (score) out.push({ i, score, rb, n: rubricRemedies(catalog, i).size });
    });
    out.sort((a, b) => b.score - a.score || KIND_RANK[a.rb.k] - KIND_RANK[b.rb.k] || b.n - a.n || a.rb.t.length - b.rb.t.length);
    // не більше 3 рядкових рубрик однієї статті, щоб вони не витісняли решту підказок
    const perArt = new Map();
    const res = [];
    for (const x of out) {
      if (x.rb.k === 'line') { const n = (perArt.get(x.rb.a) || 0) + 1; perArt.set(x.rb.a, n); if (n > 3) continue; }
      res.push(x);
      if (res.length >= (limit || 12)) break;
    }
    return res;
  }

  // Пошук назв препаратів (для каталогу та переходу за назвою)
  function matchRemedies(catalog, query, limit, lang) {
    const q = foldForMatch(query, lang);
    if (!q) return [];
    const out = [];
    catalog.remedies.forEach((r, i) => {
      if (r.ext) return;
      const f = r._f || (r._f = foldForMatch([r.latin, r.alt, r.translit, r.common].join(' '), lang));
      let score = 0;
      if (f.startsWith(q)) score = 3;
      else if (f.includes(' ' + q)) score = 2;
      else if (f.includes(q)) score = 1;
      if (score) out.push({ i, score, r });
    });
    out.sort((a, b) => b.score - a.score || a.r.latin.localeCompare(b.r.latin));
    return out.slice(0, limit || 8);
  }

  return { makeIndex, freeText, confirmPhrases, phraseInSentence, gradeScore, repertorize, rubricRemedies, modRemedies, modOpposites, rarity, diffModalities, nearLeaders, nextQuestion, facetRubric, suggest, matchRemedies, foldForMatch, vocabRange, SECTION_WEIGHT };
});
