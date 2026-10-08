/*
 * modal3.js — модальність за розділом, протилежності, «чим відрізняються», рядок «ширше за статтю»:
 * перемикач розділу в чіпі пише «@розділ» в адресу, розділ переживає зміну мови (і для текстової
 * рубрики теж), протилежна модальність позначена ✕ і має підставу, кнопка в таблиці відмінностей
 * додає рубрику, стаття лікувальника веде до ширшої рубрики «Клініки».
 * Запуск: node tools/uitest/modal3.js (сайт має бути піднятий — див. run.sh).
 * Змінні середовища: BASE, CHROME, SHOTS, PUPPETEER (див. README.md у цій теці).
 */
const fs = require('fs');
const path = require('path');
const puppeteer = require(process.env.PUPPETEER || '/home/ubuntu/node_modules/puppeteer');
const BASE = process.env.BASE || 'http://127.0.0.1:8765/';
const CHROME = process.env.CHROME || '/home/ubuntu/.cache/ms-playwright/chromium-1228/chrome-linux/chrome';
const OUT = path.join(process.env.SHOTS || path.join(__dirname, 'shots'), 'modal3');
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const browser = await puppeteer.launch({ headless: true, executablePath: CHROME, args: ['--no-sandbox', '--disable-gpu'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1100, height: 900 });
  const errors = [], failed = [];
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.type() + ': ' + m.text()); });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('requestfailed', r => failed.push(r.url()));
  page.on('response', r => { if (r.status() >= 400) failed.push(r.status() + ' ' + r.url()); });
  let fails = 0;
  const step = async (name, fn) => { try { await fn(); console.log('OK  ', name); } catch (e) { fails++; console.log('FAIL', name, '-', e.message); } };
  const shot = n => page.screenshot({ path: `${OUT}/${n}.png`, fullPage: false });
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const rows = () => page.waitForFunction(() => document.querySelectorAll('table.rep tr.row').length > 0, { timeout: 30000 });
  const hashR = () => page.evaluate(() => new URLSearchParams(location.hash.split('?')[1] || '').get('r') || '');
  const go = async (lang, specs) => {
    await page.goto('about:blank');
    await page.goto(BASE + '#/' + lang + '/rep?r=' + encodeURIComponent(specs.join('|')), { waitUntil: 'networkidle0' });
    await rows();
  };

  await step('перемикач розділу в чіпі модальності: «Обличчя» → адреса @Лицо, менше препаратів', async () => {
    await go('ua', ['m:b.heat']);
    const before = await page.$eval('#chips .chip .n', e => +e.textContent);
    const sel = await page.$('#chips select.chip-sec');
    if (!sel) throw new Error('немає перемикача розділу');
    await page.select('#chips select.chip-sec', 'Лицо');
    await page.waitForFunction(() => /@Лицо/.test(decodeURIComponent(location.hash)));
    await rows();
    const after = await page.$eval('#chips .chip .n', e => +e.textContent);
    if (!(after < before)) throw new Error(`препаратів ${after} ≥ ${before}`);
    const label = await page.$eval('#chips select.chip-sec', e => e.options[e.selectedIndex].textContent);
    if (!/^Обличчя/.test(label)) throw new Error('вибрано ' + label);
    await shot('01-chip-sec');
  });

  await step('розділ у полі пошуку звужує модальність, вибрану зі списку', async () => {
    await page.goto('about:blank');
    await page.goto(BASE + '#/ru/rep', { waitUntil: 'networkidle0' });
    await page.select('#repSection', 'Лицо');
    await page.click('#picker summary');
    const i = await page.evaluate(() => { const b = Array.from(document.querySelectorAll('#pickerBody button.pick')).find(x => /надавливание/.test(x.textContent) && x.closest('.picker-group').textContent.startsWith('Лучше')); return b ? b.dataset.i : null; });
    if (i == null) throw new Error('немає «Лучше: надавливание» у списку');
    await page.click(`#pickerBody button.pick[data-i="${i}"]`);
    await rows();
    const r = await hashR();
    if (r !== 'm:b.pressure@Лицо') throw new Error('рубрика ' + r);
  });

  await step('зміна мови UA → RU → UA зберігає розділи модальності й текстової рубрики', async () => {
    await go('ua', ['f:Обличчя~щелепа', 'm:b.heat@Лицо']);
    const n0 = await page.$eval('#results .results-head', e => +(e.textContent.match(/\d+/) || [0])[0]);
    for (const lang of ['ru', 'ua']) {
      await page.click('.menu-btn, #menuBtn').catch(() => {});
      await page.evaluate(l => { const b = document.querySelector('#langBtns button[data-lang="' + l + '"]'); if (b) b.click(); }, lang);
      await page.waitForFunction(l => location.hash.startsWith('#/' + l + '/'), {}, lang);
      await rows();
      await wait(300);
    }
    const r = await hashR();
    if (!r.includes('f:Обличчя~щелепа') || !r.includes('m:b.heat@Лицо')) throw new Error('після повернення: ' + r);
    const chips = await page.$$eval('#chips .chip', cs => cs.map(c => c.textContent));
    if (chips.some(t => /\s0\s*×1/.test(t))) throw new Error('рубрика з нулем після зміни мови: ' + chips.join(' | '));
    const n1 = await page.$eval('#results .results-head', e => +(e.textContent.match(/\d+/) || [0])[0]);
    if (n1 !== n0) throw new Error(`препаратів ${n1} ≠ ${n0}`);
  });

  await step('протилежна модальність: Mezereum у «Лучше: надавливание» позначено ✕, підстава — «надавливания»', async () => {
    await go('ru', ['m:b.pressure', 'f:~невралгия лица']);
    const sel = 'table.rep tr.row';
    let hit = null;
    for (let i = 0; i < 8 && !hit; i++) {
      hit = await page.evaluate(s => { const tr = Array.from(document.querySelectorAll(s)).find(x => /Mezereum/.test(x.textContent)); return tr ? tr.dataset.r : null; }, sel);
      if (!hit) { const more = await page.$('#moreBtn'); if (!more) break; await more.click(); await wait(200); }
    }
    if (!hit) throw new Error('Mezereum не в таблиці');
    const mark = await page.$eval(`tr.row[data-r="${hit}"]`, tr => ({ cell: !!tr.querySelector('td.cf .conf'), sum: tr.querySelector('td.sum').textContent }));
    if (!mark.cell) throw new Error('немає ✕ у клітинці');
    if (!/−1/.test(mark.sum)) throw new Error('у підсумку ' + mark.sum);
    await page.click(`tr.row[data-r="${hit}"] td.rem`);
    await page.waitForFunction(r => { const d = document.querySelector(`tr.detail[data-r="${r}"] .conf-ev`); return d && /надавлив/i.test(d.textContent); }, { timeout: 15000 }, hit);
    await shot('02-conflict');
  });

  await step('«Чим відрізняються перші 5»: кнопка «лучше/хуже» додає рубрику', async () => {
    await go('ru', ['f:Лицо~спазм тепло', 'f:Нос~водянистые выделения']);
    await page.waitForSelector('details.diff button.diff-add[data-i]');
    const before = (await hashR()).split('|').length;
    await page.click('details.diff button.diff-add[data-i]');
    await page.waitForFunction(n => (new URLSearchParams(location.hash.split('?')[1]).get('r') || '').split('|').length === n + 1, {}, before);
    const r = await hashR();
    if (!/\|m:[bw]\.[a-z-]+$/.test(r)) throw new Error('додано ' + r);
    await shot('03-diff');
  });

  await step('стаття «Насморк (острый ринит)»: рядок «шире статьи» веде на рубрику «Насморк»', async () => {
    await page.goto('about:blank');
    await page.goto(BASE + '#/ru/article/nasmork-ostryj-rinit', { waitUntil: 'networkidle0' });
    await page.waitForSelector('.art-wider a');
    const txt = await page.$eval('.art-wider a', a => a.textContent);
    if (!/«Насморк»/.test(txt)) throw new Error(txt);
    await page.click('.art-wider a');
    await rows();
    if ((await hashR()) !== 'n:Насморк') throw new Error('рубрика ' + (await hashR()));
  });

  console.log('console errors:', errors.length ? errors : 'none');
  console.log('failed requests:', failed.length ? failed : 'none');
  await browser.close();
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(1); });
