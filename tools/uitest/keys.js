/*
 * keys.js — тези відмінностей: перемикач «Повністю / Скорочено» у статті (пам'ятається), стара адреса вкладки
 * #/…/keys/<id> веде на скорочену статтю, «Ключові особливості» з опису на сторінці препарату, мова RU.
 * Запуск: node tools/uitest/keys.js (сайт має бути піднятий — див. run.sh).
 * Змінні середовища: BASE, CHROME, SHOTS, PUPPETEER (див. README.md у цій теці).
 */
const fs = require('fs');
const path = require('path');
const puppeteer = require(process.env.PUPPETEER || '/home/ubuntu/node_modules/puppeteer');
const BASE = process.env.BASE || 'http://127.0.0.1:8765/';
const CHROME = process.env.CHROME || '/home/ubuntu/.cache/ms-playwright/chromium-1228/chrome-linux/chrome';
const OUT = path.join(process.env.SHOTS || path.join(__dirname, 'shots'), 'keys');
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
  const ID = 'chuvstvitelnost-k-holodu-i-predraspolozhennost-k-prostudam';

  await step('вкладки «Відмінності» в меню немає; стара адреса веде на скорочену статтю', async () => {
    await page.goto(BASE + '#/ua/rep', { waitUntil: 'networkidle0' });
    await page.evaluate(() => { try { localStorage.removeItem('artMode'); } catch (e) {} });
    if (await page.$('#nav a[data-route="keys"]')) throw new Error('вкладка лишилась');
    await page.goto(BASE + '#/ua/keys/' + ID, { waitUntil: 'networkidle0' });
    await page.waitForSelector('.art-mode a.on');
    if (!/#\/ua\/article\/.+\?v=s/.test(await page.evaluate(() => location.hash))) throw new Error(await page.evaluate(() => location.hash));
    const d = await page.evaluate(() => ({ on: document.querySelector('.art-mode a.on').dataset.v, ul: document.querySelectorAll('.block ul.keynotes').length, blocks: document.querySelectorAll('.block').length }));
    if (d.on !== 's' || d.ul < 10) throw new Error(JSON.stringify(d));
    await shot('01-short');
  });

  await step('«Повністю» показує текст і запам’ятовується; «Скорочено» — навпаки', async () => {
    await page.click('.art-mode a[data-v="f"]');
    await page.waitForFunction(() => document.querySelector('.art-mode a.on') && document.querySelector('.art-mode a.on').dataset.v === 'f');
    if (await page.$('.block ul.keynotes')) throw new Error('тези в повному режимі');
    await page.goto(BASE + '#/ua/article/' + ID, { waitUntil: 'networkidle0' });
    await page.waitForSelector('.art-mode a.on');
    if (await page.$eval('.art-mode a.on', a => a.dataset.v) !== 'f') throw new Error('не запам’ятався повний режим');
    await page.click('.art-mode a[data-v="s"]');
    await page.waitForSelector('.block ul.keynotes');
    await page.goto(BASE + '#/ua/article/prostuda-gripp', { waitUntil: 'networkidle0' });
    await page.waitForSelector('.block ul.keynotes');
  });

  await step('стаття з препаратом у фокусі: скорочений режим підсвічує його блок', async () => {
    await page.goto(BASE + '#/ua/article/' + ID + '?v=s&r=209', { waitUntil: 'networkidle0' });
    await page.waitForSelector('.block.hl ul.keynotes');
    if (!/Hepar/.test(await page.$eval('.block.hl h3', e => e.textContent))) throw new Error('не той блок');
  });

  await step('сторінка препарату: «Ключові особливості» з власного опису, групи ведуть до розділів', async () => {
    await page.goto(BASE + '#/ua/remedy/dulcamara', { waitUntil: 'networkidle0' });
    await page.waitForSelector('details.rem-keys dl.keys dt');
    const d = await page.evaluate(() => {
      const dts = Array.from(document.querySelectorAll('details.rem-keys dt'));
      return { n: dts.length, sum: document.querySelector('details.rem-keys summary').textContent,
        links: dts.map(dt => (dt.querySelector('a') || {}).getAttribute ? dt.querySelector('a').getAttribute('href') : null).filter(Boolean),
        notes: document.querySelectorAll('details.rem-keys dd li').length };
    });
    if (d.n < 2 || d.notes < 5 || !/Ключові особливості \(\d+\)/.test(d.sum)) throw new Error(JSON.stringify(d).slice(0, 300));
    if (!d.links.length || !d.links.every(h => /^#sec-/.test(h))) throw new Error('посилання ' + d.links.join(' '));
    const ok = await page.evaluate(h => !!document.getElementById(h.slice(1)), d.links[0]);
    if (!ok) throw new Error('немає розділу ' + d.links[0]);
    await shot('02-remedy');
  });

  await step('RU: «Кратко / Полностью» і «Ключевые особенности»', async () => {
    await page.goto(BASE + '#/ru/article/' + ID + '?v=s', { waitUntil: 'networkidle0' });
    await page.waitForSelector('.art-mode a.on');
    const lbl = await page.$$eval('.art-mode a', as => as.map(a => a.textContent).join('/'));
    if (lbl !== 'Полностью/Кратко') throw new Error(lbl);
    const txt = await page.$$eval('.doc ul.keynotes', us => us.map(u => u.textContent).join(' '));
    if (!txt || /[іїєґ]/i.test(txt)) throw new Error('українські літери в RU-тезах');
    await page.goto(BASE + '#/ru/remedy/hepar-sulphur', { waitUntil: 'networkidle0' });
    await page.waitForSelector('details.rem-keys summary');
    if (!/Ключевые особенности/.test(await page.$eval('details.rem-keys summary', e => e.textContent))) throw new Error('summary');
    await shot('03-ru');
  });

  console.log('console errors:', errors.length ? errors : 'none');
  console.log('failed requests:', failed.length ? failed : 'none');
  if (errors.length || failed.length) fails++;
  await browser.close();
  process.exit(fails ? 1 : 0);
})();
