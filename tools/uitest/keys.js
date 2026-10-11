/*
 * keys.js — вкладка «Відмінності»: список станів із пошуком, сторінка стану (препарат — тези, посилання на
 * препарат і на його блок у статті), мова RU, без помилок у консолі.
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

  await step('пункт меню «Відмінності» веде до списку станів', async () => {
    await page.goto(BASE + '#/ua/rep', { waitUntil: 'networkidle0' });
    const a = await page.$eval('#nav a[data-route="keys"]', a => ({ t: a.textContent, h: a.getAttribute('href') }));
    if (a.t !== 'Відмінності' || a.h !== '#/ua/keys') throw new Error(JSON.stringify(a));
    await page.click('#nav a[data-route="keys"]');
    await page.waitForSelector('.keys-group li a');
    const n = await page.$$eval('.keys-group li', l => l.length);
    if (n < 100) throw new Error('станів ' + n);
    const active = await page.$eval('#nav a.active', a => a.dataset.route);
    if (active !== 'keys') throw new Error('активна вкладка ' + active);
    await shot('01-list');
  });

  await step('пошук звужує список; «нічого не знайдено» для порожнього збігу', async () => {
    await page.type('#keysFilter', 'холод');
    await wait(100);
    const vis = await page.$$eval('.keys-group li', l => l.filter(x => !x.hidden).map(x => x.querySelector('a').getAttribute('href')));
    if (!vis.length || vis.length > 10) throw new Error('видимих ' + vis.length);
    if (!vis.some(h => h.endsWith('/keys/' + ID))) throw new Error('немає статті про холод: ' + vis.join(' '));
    await page.type('#keysFilter', 'щщщщ');
    await wait(100);
    if (await page.$eval('#keysNone', e => e.hidden)) throw new Error('немає повідомлення «нічого не знайдено»');
  });

  await step('сторінка стану: препарати з тезами, посилання на препарат і на блок статті', async () => {
    await page.goto(BASE + '#/ua/keys/' + ID, { waitUntil: 'networkidle0' });
    await page.waitForSelector('dl.keys dt');
    const d = await page.evaluate(() => {
      const dts = Array.from(document.querySelectorAll('dl.keys dt'));
      const hep = dts.find(dt => /Hepar/.test(dt.textContent));
      return {
        n: dts.length,
        hep: !!hep,
        hepNotes: hep ? hep.nextElementSibling.querySelectorAll('li').length : 0,
        remLink: hep ? (hep.querySelector('a[href*="/remedy/"]') || {}).getAttribute?.call(hep.querySelector('a[href*="/remedy/"]'), 'href') : null,
        artLink: hep ? Array.from(hep.querySelectorAll('a')).map(a => a.getAttribute('href')).find(h => /\/article\/.*\?r=\d+/.test(h)) : null,
      };
    });
    if (d.n < 10 || !d.hep || d.hepNotes < 1) throw new Error(JSON.stringify(d));
    if (!d.remLink || !d.artLink) throw new Error('посилання ' + JSON.stringify(d));
    await shot('02-article');
    await page.goto(BASE + d.artLink, { waitUntil: 'networkidle0' });
    await page.waitForSelector('.block.hl');
    const h3 = await page.$eval('.block.hl h3', e => e.textContent);
    if (!/Hepar/.test(h3)) throw new Error('підсвічено ' + h3);
  });

  await step('RU: «Отличия», заголовок і тези російською', async () => {
    await page.goto(BASE + '#/ru/keys/' + ID, { waitUntil: 'networkidle0' });
    await page.waitForSelector('dl.keys dt');
    const t = await page.$eval('#nav a[data-route="keys"]', a => a.textContent);
    if (t !== 'Отличия') throw new Error('меню ' + t);
    const txt = await page.$eval('dl.keys', e => e.textContent);
    if (/[іїєґ]/i.test(txt)) throw new Error('українські літери в RU-тезах');
    await shot('03-ru');
  });

  console.log('console errors:', errors.length ? errors : 'none');
  console.log('failed requests:', failed.length ? failed : 'none');
  if (errors.length || failed.length) fails++;
  await browser.close();
  process.exit(fails ? 1 : 0);
})();
