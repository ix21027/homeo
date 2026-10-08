// report-facets.mjs — звіт точності ознак покрокового підбору: кількість препаратів і приклади речень
// на кожну ознаку (за зібраними data/ru/remedies). Запуск: node tools/report-facets.mjs > tools/report-facets.txt
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { compileFacets, matchSentence } from './facets.mjs';
const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const SC = require(path.join(ROOT, 'search-core.js'));
const dir = path.join(ROOT, 'data/ru/remedies');
const docs = fs.readdirSync(dir).map(f => JSON.parse(fs.readFileSync(path.join(dir, f))));
const facets = compileFacets();
const SAMPLES = +(process.argv[2] || 5);
for (const f of facets) {
  const rem = new Set(); const ex = [];
  for (const d of docs) for (const s of d.sections) {
    if (!f.place.secs.includes(s.title)) continue;
    for (const p of s.paras) for (const sent of SC.splitSentences(p.replace(/\*\*|_/g, ''))) {
      if (!matchSentence(f, sent, s.title)) continue;
      rem.add(d.id);
      if (ex.length < 200) ex.push(d.latin + ': ' + sent.trim().slice(0, 170));
    }
  }
  // приклади з різних препаратів, рівномірно по списку
  const step = Math.max(1, Math.floor(ex.length / SAMPLES));
  console.log(`\n## ${f.key} — ${f.item.ru}: ${rem.size} препаратів`);
  for (let i = 0; i < ex.length && i / step < SAMPLES; i += step) console.log('  - ' + ex[i]);
}
