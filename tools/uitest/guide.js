/*
 * guide.js — покроковий підбір у «Симптомах»: місця й ознаки (адреса p:…, pl=…), уточнювальне питання
 * («Так» додає рубрику, «Ні» — рубрику з ~ і позначкою «−» у таблиці, «Не знаю» — sk=… в адресі), підстави
 * ознаки (речення з опису), збережений випадок з ознакою й «ні» переживає UA → RU → UA і відновлюється з меню.
 * Запуск: node tools/uitest/guide.js (сайт має бути піднятий — див. run.sh).
 * Змінні середовища: BASE, CHROME, SHOTS, PUPPETEER (див. README.md у цій теці).
 */
const fs = require('fs');
const path = require('path');
const puppeteer = require(process.env.PUPPETEER || '/home/ubuntu/node_modules/puppeteer');
const BASE = process.env.BASE || 'http://127.0.0.1:8765/';
const CHROME = process.env.CHROME || '/home/ubuntu/.cache/ms-playwright/chromium-1228/chrome-linux/chrome';
const OUT = path.join(process.env.SHOTS || path.join(__dirname, 'shots'), 'guide');
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
  const qs = () => page.evaluate(() => new URLSearchParams(location.hash.split('?')[1] || ''));
  const param = k => page.evaluate(k => new URLSearchParams(location.hash.split('?')[1] || '').get(k) || '', k);
  const clickFac = async label => {
    const ok = await page.evaluate(l => { const b = Array.from(document.querySelectorAll('#guide button.fac')).find(x => x.textContent.trim().startsWith(l)); if (b) b.click(); return !!b; }, label);
    if (!ok) throw new Error('немає ознаки «' + label + '»');
    await wait(250);
  };

  await step('місце → ознаки: адреса p:…, pl=…, кількість біля ознаки', async () => {
    await page.goto(BASE + '#/ua/rep', { waitUntil: 'networkidle0' });
    await page.waitForSelector('#guide button.place[data-place="nose"]');
    await page.click('#guide button.place[data-place="nose"]');
    await page.waitForSelector('#guide .guide-place[data-place="nose"] button.fac');
    const n0 = await page.evaluate(() => +Array.from(document.querySelectorAll('#guide button.fac')).find(x => /^рідкі/.test(x.textContent.trim())).querySelector('.n').textContent);
    if (!(n0 > 50)) throw new Error('кількість «рідкі» ' + n0);
    await clickFac('рідкі');
    await clickFac('закладений');
    await rows();
    if ((await param('r')) !== 'p:nose.thin|p:nose.blocked') throw new Error('r=' + await param('r'));
    if ((await param('pl')) !== 'nose') throw new Error('pl=' + await param('pl'));
    const on = await page.$$eval('#guide button.fac.on', bs => bs.length);
    if (on !== 2) throw new Error('увімкнених ознак ' + on);
    // повторний клік прибирає ознаку
    await clickFac('закладений');
    if ((await param('r')) !== 'p:nose.thin') throw new Error('після зняття r=' + await param('r'));
    await clickFac('закладений');
    await shot('01-facets');
  });

  await step('питання: «Ні» — рубрика з ~ і «−» у таблиці; «Не знаю» — sk, питання змінюється; «Так» — рубрика', async () => {
    await page.waitForSelector('.guide-q button[data-ans]');
    const q1 = await page.$eval('.guide-q b', e => e.textContent);
    await page.click('.guide-q button[data-ans="n"]');
    await page.waitForFunction(() => /p~:|m~:/.test(decodeURIComponent(location.hash)));
    await rows();
    if (!(await page.$('table.rep td.ng .negm'))) throw new Error('немає позначки «−» у таблиці');
    if (!(await page.$('#chips .chip.neg'))) throw new Error('немає чіпа «ні»');
    await page.waitForSelector('.guide-q button[data-ans]');
    const q2 = await page.$eval('.guide-q b', e => e.textContent);
    if (q2 === q1) throw new Error('питання не змінилось: ' + q2);
    await page.click('.guide-q button[data-ans="d"]');
    await page.waitForFunction(() => /sk=/.test(location.hash));
    const q3 = await page.$eval('.guide-q b', e => e.textContent);
    if (q3 === q2) throw new Error('після «Не знаю» те саме питання');
    const before = (await param('r')).split('|').length;
    await page.click('.guide-q button[data-ans="y"]');
    await page.waitForFunction(n => (new URLSearchParams(location.hash.split('?')[1]).get('r') || '').split('|').length === n + 1, {}, before);
    await shot('02-question');
  });

  await step('підстави ознаки — речення з розділу «Ніс»', async () => {
    await rows();
    await page.click('table.rep tr.row td.rem');
    await page.waitForFunction(() => { const d = document.querySelector('tr.detail .detail-box'); return d && /Ніс:/.test(d.textContent); }, { timeout: 15000 });
  });

  await step('випадок з ознакою й «ні»: зберегти, UA → RU → UA, відновити з меню', async () => {
    const r0 = await param('r');
    await page.click('#caseBtn');
    await page.waitForSelector('#caseNameIn');
    await page.$eval('#caseNameIn', e => { e.value = 'Нежить тест'; });
    await page.click('#caseOk');
    await page.waitForFunction(() => /Оновити випадок/.test((document.querySelector('#caseBtn') || {}).textContent || ''));
    for (const lang of ['ru', 'ua']) {
      await page.click('#menuBtn');
      await page.waitForSelector('#menu:not([hidden])');
      await page.click(`#langBtns button[data-lang="${lang}"]`);
      await page.waitForFunction(l => location.hash.startsWith('#/' + l + '/'), {}, lang);
      await rows();
      await wait(300);
    }
    const r1 = await param('r');
    if (r1 !== r0) throw new Error(`після зміни мови r=${r1}, було ${r0}`);
    if (!(await param('pl')).includes('nose')) throw new Error('pl загубилось');
    if (!(await param('sk'))) throw new Error('sk загубилось');
    // скинути все й відновити з меню
    await page.click('#clearAll');
    await page.click('#menuBtn');
    await page.waitForSelector('#menu:not([hidden]) #casesList .case-open');
    await page.click('#casesList .case-open');
    await rows();
    if ((await param('r')) !== r0) throw new Error('відновлено r=' + await param('r'));
    if (!(await page.$('#chips .chip.neg'))) throw new Error('після відновлення немає «ні»');
  });

  await step('друк: панель підбору схована', async () => {
    await page.emulateMediaType('print');
    const vis = await page.$eval('#guide', e => getComputedStyle(e).display);
    await page.emulateMediaType('screen');
    if (vis !== 'none') throw new Error('display ' + vis);
  });

  console.log('console errors:', errors.length ? errors : 'none');
  console.log('failed requests:', failed.length ? failed : 'none');
  await browser.close();
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(1); });
