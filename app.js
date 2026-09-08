
function normalizeCyrillic(str) {
  if (!str) return '';
  return str.toLowerCase()
    .replace(/і/g, 'и')
    .replace(/є/g, 'е')
    .replace(/ї/g, 'и')
    .replace(/ґ/g, 'г')
    .replace(/й/g, 'и');
}
/**
 * Materia Medica Universal Multilingual Search Engine (UA + RU)
 * Powered by Snowball Stemmer, Medical Concept Thesaurus & Sentence Co-occurrence Scoring.
 * 100% Client-Side for GitHub Pages.
 */

let remediesData = [];

// ==========================================
// 1. UKRAINIAN SNOWBALL STEMMER & PALATALIZATION
// ==========================================
function stemUkrainian(word) {
  let w = word.toLowerCase().trim();
  if (w.length <= 2) return w;

  // Ukrainian vowel & historical root alternations
  w = w.replace(/мінь$/g, 'мен');
  w = w.replace(/біль$/g, 'бол');
  w = w.replace(/очі$/g, 'оч');
  w = w.replace(/око$/g, 'ок');
  w = w.replace(/вусі$/g, 'вух');
  w = w.replace(/нозі$/g, 'ног');
  w = w.replace(/руці$/g, 'рук');
  w = w.replace(/щоці$/g, 'щок');
  w = w.replace(/повіці$/g, 'повік');
  w = w.replace(/печінці$/g, 'печінк');
  w = w.replace(/нирці$/g, 'нирк');

  // Strip grammatical endings (noun, adjective, verb, cases)
  w = w.replace(/(ому|ими|ого|ою|ею|ям|ами|ях|ах|ів|ей|ий|ій|им|ім|ати|яти|увати|ювати|ються|тися|лося|лася|лось|лись|уть|ють|ять|ить|ешь|ете|имо|емо|ємо|ння|ення|ість|ості|івна|ович|а|я|у|ю|е|є|і|и|о|й)$/g, '');
  
  // 2nd palatalization strip: 'ці' -> 'к'
  if (w.endsWith('ц') && w.length > 3) {
    w = w.slice(0, -1) + 'к';
  }

  return w;
}

// ==========================================
// 2. COMPREHENSIVE MEDICAL & HOMEOPATHIC THESAURUS
// Maps Ukrainian clinical concepts to Russian equivalents
// ==========================================
const THESAURUS = {
  // Eye & Eyelid
  'ячмінь': ['ячмен', 'ячмін'],
  'ячмен': ['ячмен', 'ячмін'],
  'ячмін': ['ячмен', 'ячмін'],
  'повік': ['повік', 'повіц', 'век'],
  'повіц': ['повік', 'повіц', 'век'],
  'оч': ['оч', 'ок', 'глаз'],
  'ок': ['оч', 'ок', 'глаз'],
  'глаз': ['глаз', 'оч', 'ок'],
  'век': ['век', 'повік', 'повіц'],
  'зіниц': ['зрачок', 'зрачк'],
  'сльозотеч': ['слезотечен', 'слез'],
  'світлобоязн': ['светобоязн', 'свет'],
  'халязіон': ['халазион'],

  // Head, Brain & Senses
  'головн': ['головн', 'голов'],
  'головокруж': ['головокружен'],
  'запамороч': ['головокружен', 'круж'],
  'потилиц': ['затылок', 'затылочн'],
  'скрон': ['висок', 'височн'],
  'тім': ['темя', 'темен'],
  'лоб': ['лоб', 'лобн'],
  'мігрен': ['мигрен'],
  'мигрен': ['мигрен', 'мігрен'],

  // Pain & Sensations
  'бол': ['бол', 'болезнен'],
  'колюч': ['колющ', 'кол'],
  'пекуч': ['жгуч', 'жжен'],
  'ніюч': ['ноющ', 'ной'],
  'стріляюч': ['стреляющ', 'стрел'],
  'стискаюч': ['сжимающ', 'сжим'],
  'розпираюч': ['распирающ', 'распир'],
  'тягнуч': ['тянущ', 'тян'],
  'онімін': ['онеменен', 'неме'],
  'поколюван': ['покалыван', 'кол'],
  'свербіж': ['зуд', 'чес'],
  'зуд': ['зуд', 'свербіж'],
  'тремтін': ['дрожь', 'дрож'],
  'судом': ['судорог', 'спазм'],
  'слабк': ['слабост', 'слаб', 'упадок'],
  'виснажен': ['истощен'],
  'втом': ['усталост', 'утомлен'],

  // Respiratory & Throat
  'задишк': ['одышк', 'удушь', 'дыхан'],
  'задух': ['удушь', 'одышк', 'дыхан'],
  'одышк': ['одышк', 'удушь', 'задишк'],
  'кашл': ['кашл'],
  'горл': ['горл', 'глотк', 'гортан'],
  'мигдалик': ['миндалин'],
  'леген': ['легк'],
  'груд': ['груд'],

  // Digestive & Abdominal
  'шлунк': ['желудок', 'желудочн'],
  'желудок': ['желудок', 'шлунк'],
  'стравохід': ['пищевод'],
  'печінк': ['печен', 'печеночн'],
  'печін': ['печен', 'печеночн'],
  'печень': ['печен', 'печінк'],
  'печі': ['изжог'],
  'изжог': ['изжог', 'печі'],
  'нудот': ['тошнот'],
  'тошнот': ['тошнот', 'нудот'],
  'блюван': ['рвот'],
  'блювот': ['рвот'],
  'рвот': ['рвот', 'блюван'],
  'відрижк': ['отрыжк'],
  'отрыжк': ['отрыжк', 'відрижк'],
  'пронос': ['понос', 'диаре'],
  'діаре': ['диаре', 'понос'],
  'запор': ['запор'],
  'живіт': ['живот', 'брюшн'],
  'живот': ['живот', 'брюшн', 'живіт'],
  'кишківник': ['кишечник', 'кишк'],
  'кишечник': ['кишечник', 'кишк'],
  'анус': ['анус', 'прямой кишк'],

  // Back & Musculoskeletal
  'спин': ['спин'],
  'поперек': ['поясниц', 'поясничн', 'крестц'],
  'поясниц': ['поясниц', 'поперек'],
  'хребет': ['позвоночник', 'позвоноч'],
  'куприк': ['копчик'],
  'суглоб': ['сустав'],
  'сустав': ['сустав', 'суглоб'],
  'м яз': ['мышц'],
  'мышц': ['мышц', 'м яз'],
  'кістк': ['кост'],
  'кост': ['кост', 'кістк'],
  'стегн': ['бедр'],
  'бедр': ['бедр', 'стегн'],
  'колін': ['колен'],
  'литок': ['икр'],
  'стоп': ['стоп'],
  'п ят': ['пятк'],
  'кінцівк': ['конечност'],
  'рук': ['рук'],
  'пальц': ['пальц'],

  // Urinary & Genital
  'нирк': ['почк'],
  'почк': ['почк', 'нирк'],
  'сеч': ['моч'],
  'моч': ['моч', 'сеч'],
  'сечовид': ['мочеиспускан', 'мочев'],

  // Modalities & Conditions
  'гірш': ['хуж'],
  'хуж': ['хуж', 'гірш'],
  'кращ': ['лучш'],
  'лучш': ['лучш', 'кращ'],
  'полегшен': ['облегчен'],
  'погіршен': ['ухудшен'],
  'вранц': ['утр'],
  'утр': ['утр', 'вранц'],
  'ввечер': ['вечер'],
  'вечер': ['вечер', 'ввечер'],
  'вноч': ['ноч'],
  'ноч': ['ноч', 'вноч'],
  'сон': ['сон', 'сна'],
  'безсон': ['бессонниц'],
  'тепл': ['тепл', 'жар'],
  'холод': ['холод'],
  'рух': ['движен'],
  'споко': ['поко'],
  'ходьб': ['ходьб', 'ход'],
  'сход': ['лестниц', 'подъем', 'вверх', 'ступен'],
  'лежач': ['леж'],
  'сидяч': ['сид'],
  'стояч': ['сто'],
  'нахил': ['наклон'],
  'їж': ['ед', 'пищ'],
  'повітр': ['воздух'],
  'дотик': ['прикосновен'],

  // Directions & Spatial Sides
  'прав': ['прав'],
  'лів': ['лев'],
  'лев': ['лев', 'лів'],
  'нижн': ['нижн'],
  'верхн': ['верхн'],
  'відда': ['отда', 'иррадиир', 'стреля'],
  'віддає': ['отда', 'иррадиир', 'стреля']
};

// Section Ukrainian Titles Dictionary
const SECTION_NAMES_UA = {
  'ХАРАКТЕРИСТИКА': 'ХАРАКТЕРИСТИКА',
  'ХАРАКТРИСТИКА': 'ХАРАКТЕРИСТИКА',
  'ПСИХИКА': 'ПСИХІКА',
  'ТИП': 'КОНСТИТУЦІЙНИЙ ТИП',
  'ТРОПНОСТЬ': 'ТРОПНІСТЬ (ОРГАНИ-МІШЕНІ)',
  'КЛИНИКА': 'КЛІНІЧНІ ПОКАЗАННЯ / НОЗОЛОГІЇ',
  'НОЗОЛОГИИ': 'НОЗОЛОГІЇ ТА ДІАГНОЗИ',
  'ОБЩИЕ СИМПТОМЫ': 'ЗАГАЛЬНІ СИМПТОМИ',
  'ОБЩИЕ': 'ЗАГАЛЬНІ СИМПТОМИ',
  'КОЖА': 'ШКІРА',
  'СОН': 'СОН ТА СНОВИДІННЯ',
  'ЛИХОРАДКА': 'ЛИХОМАНКА ТА ЖАР',
  'ПОТ': 'ПІТ ТА ПІТЛИВІСТЬ',
  'ГОЛОВА': 'ГОЛОВА',
  'ГОЛОВОКРУЖЕНИЕ': 'ЗАПАМОРОЧЕННЯ',
  'ГОЛОВА СНАРУЖИ': 'ГОЛОВА ЗОВНІ (СКАЛЬП)',
  'ЛИЦО': 'ОБЛИЧЧЯ',
  'ГЛАЗА': 'ОЧІ ТА ЗІР',
  'УШИ': 'ВУХА ТА СЛУХ',
  'НОС': 'НІС ТА НЮХ',
  'РОТ': 'РОТОВА ПОРОЖНИНА',
  'ЗУБЫ': 'ЗУБИ ТА ЯСНА',
  'ГОРЛО': 'ГОРЛО ТА ГЛОТКА',
  'ГОРТАНЬ. ТРАХЕЯ': 'ГОРТАНЬ І ТРАХЕЯ',
  'ГРУДЬ': 'ГРУДИ ТА ГРУДНА КЛІТКА',
  'ГРУДНАЯ КЛЕТКА': 'ГРУДНА КЛІТКА',
  'КАШЕЛЬ': 'КАШЕЛЬ',
  'ДЫХАТЕЛЬНАЯ СИСТЕМА': 'ДИХАЛЬНА СИСТЕМА',
  'СЕРДЦЕ И КРОВООБРАЩЕНИЕ': 'СЕРЦЕ ТА КРОВООБІГ',
  'ЖЕЛУДОК': 'ШЛУНОК',
  'АППЕТИТ': 'АПЕТИТ ТА ПРИСТРАСТІ В ЇЖІ',
  'ЖЕЛУДОЧНО – КИШЕЧНЫЙ ТРАКТ': 'ШЛУНКОВО-КИШКОВИЙ ТРАКТ',
  'ЖИВОТ': 'ЖИВІТ',
  'АНУС И ПРЯМАЯ КИШКА': 'АНУС ТА ПРЯМА КИШКА',
  'МОЧЕВЫДЕЛИТЕЛЬНАЯ СИСТЕМА': 'СЕЧОВИВІДНА СИСТЕМА',
  'ЖЕНСКИЕ': 'ЖІНОЧА СФЕРА',
  'МЕНСТРУАЦИЯ': 'МЕНСТРУАЦІЯ',
  'МОЛОЧНЫЕ ЖЕЛЕЗЫ': 'МОЛОЧНІ ЗАЛОЗИ',
  'БЕРЕМЕННОСТЬ. РОДЫ.': 'ВАГІТНІСТЬ ТА ПОЛОГИ',
  'МУЖСКИЕ': 'ЧОЛОВІЧА СФЕРА',
  'ЛИМФАТИЧЕСКИЕ ЖЕЛЕЗЫ': 'ЛІМФАТИЧНІ ВУЗЛИ',
  'КОСТИ': 'КІСТКИ',
  'МЫШЦЫ': 'М\'ЯЗИ',
  'СУСТАВЫ': 'СУГЛОБИ',
  'ШЕЯ': 'ШИЯ',
  'СПИНА': 'СПИНА ТА ПОПЕРЕК',
  'ПОЗВОНОЧНИК': 'ХРЕБЕТ',
  'КОНЕЧНОСТИ': 'КІНЦІВКИ (РУКИ ТА НОГИ)',
  'ДЕТИ': 'ОСОБЛИВОСТІ У ДІТЕЙ',
  'ИНФЕКЦИИ': 'ІНФЕКЦІЙНІ ЗАХВОРЮВАННЯ',
  'МОДАЛЬНОСТИ': 'МОДАЛЬНОСТІ (ПОГІРШЕННЯ / ПОЛЕГШЕННЯ)',
  'ЭТИОЛОГИЯ': 'ЕТІОЛОГІЯ',
  'ВЗАИМОСВЯЗИ': 'ВЗАЄМОЗВ\'ЯЗКИ ТА АНТИДОТИ',
  'СКЛОННОСТИ': 'СХИЛЬНОСТІ',
  'РЕКОМЕНДАЦИИ': 'РЕКОМЕНДАЦІЇ'
};

// ==========================================
// 3. QUERY EXPANSION INTO MULTILINGUAL CONCEPTS
// ==========================================
function expandQueryToConcepts(query) {
  const words = query.match(/[A-Za-zА-Яа-яІіЇїЄєҐґ0-9]+/g) || [];
  const concepts = [];

  // Stop words to skip
  const stopWords = new Set(['в', 'у', 'на', 'та', 'і', 'й', 'до', 'від', 'при', 'що', 'як', 'під', 'час', 'для', 'по', 'за', 'над', 'из', 'от', 'к', 'с', 'со']);

  for (const w of words) {
    const wLower = w.toLowerCase();
    if (stopWords.has(wLower)) continue;
    const st = stemUkrainian(w);
    if (st.length < 2) continue;
    const stNorm = normalizeCyrillic(st);

    const equivs = new Set([st, stNorm, wLower]);

    // Ukrainian consonant/vowel palatalization & root alternations
    if (st.includes('повік')) equivs.add('повіц');
    if (st.includes('повіц')) equivs.add('повік');
    if (st.includes('ячмен')) equivs.add('ячмін');
    if (st.includes('ячмін')) equivs.add('ячмен');
    if (st.includes('бол')) equivs.add('біль');
    if (st.includes('біль')) equivs.add('бол');
    if (st.includes('рук')) { equivs.add('руц'); equivs.add('руч'); }
    if (st.includes('руц')) { equivs.add('рук'); equivs.add('руч'); }
    if (st.includes('ног')) { equivs.add('ноз'); equivs.add('нож'); }
    if (st.includes('ноз')) { equivs.add('ног'); equivs.add('нож'); }
    if (st.includes('вух')) { equivs.add('вус'); equivs.add('вуш'); }
    if (st.includes('вус')) { equivs.add('вух'); equivs.add('вуш'); }

    // Check direct match in thesaurus
    for (const [tUkr, tRuList] of Object.entries(THESAURUS)) {
      if (st === tUkr || st.startsWith(tUkr) || tUkr.startsWith(st)) {
        tRuList.forEach(item => {
          equivs.add(item);
          equivs.add(normalizeCyrillic(item));
        });
      }
    }

    concepts.push({
      originalWord: w,
      primaryStem: st,
      patterns: Array.from(equivs)
    });
  }

  return concepts;
}

// ==========================================
// 4. CORE SEARCH & RELEVANCE SCORING
// ==========================================
function searchRemedies(query) {
  const qTrim = query.trim();
  if (!qTrim) return [];

  const qLower = qTrim.toLowerCase();
  const concepts = expandQueryToConcepts(qTrim);
  if (concepts.length === 0) return [];

  const results = [];
  const totalConcepts = concepts.length;
  const primaryConcept = concepts[0];

  for (const remedy of remediesData) {
    const latinLower = (remedy.latin || '').toLowerCase();
    const cyrLower = (remedy.cyr || '').toLowerCase();
    const commonLower = (remedy.common || '').toLowerCase();
    const fullLower = `${latinLower} ${cyrLower} ${commonLower} ${remedy.clin || ''} ${JSON.stringify(remedy.sec || {})}`.toLowerCase();

    // Direct match by remedy name gets top tier priority!
    const qNorm = normalizeCyrillic(qLower);
    const cyrNorm = normalizeCyrillic(cyrLower);
    const commonNorm = normalizeCyrillic(commonLower);
    const isDirectNameMatch = 
      (latinLower && latinLower.includes(qLower)) || 
      (cyrLower && cyrLower.includes(qLower)) || 
      (commonLower && commonLower.includes(qLower)) ||
      (cyrNorm && qNorm.length >= 3 && cyrNorm.includes(qNorm)) ||
      (commonNorm && qNorm.length >= 3 && commonNorm.includes(qNorm));

    // If searching a clinical symptom (e.g. 'ячмінь', 'задишка', 'печія'),
    // remedy must contain the primary symptom concept
    if (!isDirectNameMatch && primaryConcept && primaryConcept.patterns.length > 0) {
      const hasPrimary = primaryConcept.patterns.some(p => fullLower.includes(p));
      if (!hasPrimary) continue;
    }

    let bestScore = 0;
    let bestSent = '';
    let bestSec = '';
    let bestMatchedPatterns = [];

    // Scan all sections and sentences
    if (remedy.sec) {
      for (const [secName, secText] of Object.entries(remedy.sec)) {
        const sentences = secText.replace(/\n+/g, ' ').split(/(?<=[.?!])\s+/);

        for (const sent of sentences) {
          const sTrim = sent.trim();
          if (!sTrim) continue;
          const sLower = sTrim.toLowerCase();

          let matchedCount = 0;
          const matchedPatternsInSent = [];

          for (const c of concepts) {
            const matchedP = c.patterns.find(p => sLower.includes(p));
            if (matchedP) {
              matchedCount++;
              matchedPatternsInSent.push(matchedP);
            }
          }

          if (matchedCount > 0) {
            // Quadratic formula for co-occurrence in same sentence!
            // When all 3 or 4 requested concepts match in one sentence:
            // 1 match = 150
            // 2 matches = 200 + 400 = 600
            // 3 matches = 300 + 1350 = 1650
            // 4 matches = 400 + 3200 = 3600
            let score = (matchedCount * 100) + Math.pow(matchedCount, 3) * 50;

            // Extra bonus if all concepts matched in this single sentence:
            if (matchedCount === totalConcepts && totalConcepts >= 2) {
              score += 5000;
            }

            // Section relevance bonus (e.g. eye terms in eye section)
            const sUpper = secName.toUpperCase();
            if ((sUpper.includes('ОЧ') || sUpper.includes('ГЛАЗ')) && (qTrim.includes('оч') || qTrim.includes('повік') || qTrim.includes('ячм') || qTrim.includes('век') || qTrim.includes('ячмен'))) {
              score += 500;
            }

            if (score > bestScore) {
              bestScore = score;
              bestSent = sTrim;
              bestSec = secName;
              bestMatchedPatterns = matchedPatternsInSent;
            }
          }
        }
      }
    }

    // Check clinical list if no specific sentence found
    if (bestScore === 0 && remedy.clin) {
      const cLower = remedy.clin.toLowerCase();
      let clinMatches = 0;
      for (const c of concepts) {
        if (c.patterns.some(p => cLower.includes(p))) clinMatches++;
      }
      if (clinMatches > 0) {
        bestScore = clinMatches * 50;
        bestSec = 'КЛИНИКА';
        bestSent = remedy.clin.slice(0, 150) + '...';
      }
    }

    if (isDirectNameMatch) {
      bestScore += 20000;
      if (!bestSent) bestSent = remedy.common || remedy.clin?.slice(0, 120) || '';
      if (!bestSec) bestSec = 'ПРЕПАРАТ';
    }

    if (bestScore > 0) {
      results.push({
        remedy,
        score: bestScore,
        section: bestSec,
        sentence: bestSent,
        matchedPatterns: bestMatchedPatterns
      });
    }
  }

  // Sort by score descending
  results.sort((a, b) => b.score - a.score);
  return results;
}

// ==========================================
// 5. HIGHLIGHTING SNIPPETS
// ==========================================
function highlightSnippet(sentence, matchedPatterns) {
  if (!sentence) return '';
  let safe = sentence.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  // Sort patterns by length descending so longer words match first
  const sorted = [...new Set(matchedPatterns)].sort((a, b) => b.length - a.length);

  for (const pat of sorted) {
    if (pat.length < 2) continue;
    const regex = new RegExp(`(${pat}[а-яёїіє]*)`, 'gi');
    safe = safe.replace(regex, '<mark class="hl-primary">$1</mark>');
  }

  return safe;
}

// ==========================================
// 6. INITIALIZATION & UI RENDERING
// ==========================================
async function initApp() {
  const loading = document.getElementById('loadingIndicator');
  try {
    const res = await fetch('data/remedies_search.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    remediesData = await res.json();
    loading.style.display = 'none';

    const input = document.getElementById('searchInput');
    const urlParams = new URLSearchParams(window.location.search);
    const qParam = urlParams.get('q');

    if (qParam) {
      input.value = qParam;
      runSearch(qParam);
    } else {
      input.value = 'ячмінь на правій нижній повіці';
      runSearch(input.value);
    }
  } catch (err) {
    loading.innerHTML = `<p style="color: #dc2626; padding: 2rem;">Помилка завантаження бази даних: ${err.message}</p>`;
  }
}

function runSearch(query) {
  const qTrim = query.trim();
  const clearBtn = document.getElementById('btnClear');
  clearBtn.style.display = qTrim ? 'block' : 'none';

  const statusBar = document.getElementById('statusBar');
  const container = document.getElementById('cardsList');

  if (!qTrim) {
    statusBar.innerHTML = 'Введіть будь-який симптом, орган чи модальність для пошуку...';
    container.innerHTML = '';
    return;
  }

  const t0 = performance.now();
  const results = searchRemedies(qTrim);
  const elapsed = (performance.now() - t0).toFixed(1);

  if (results.length === 0) {
    statusBar.innerHTML = `За запитом <strong>«${escapeHtml(qTrim)}»</strong> нічого не знайдено.`;
    container.innerHTML = `
      <div style="text-align: center; padding: 3rem; background: white; border-radius: 12px; border: 1px solid #e2e8f0;">
        <p style="font-size: 1.1rem; color: #64748b;">Спробуйте інші слова або виберіть один із прикладів вище.</p>
      </div>`;
    return;
  }

  statusBar.innerHTML = `Знайдено <span class="results-count">${results.length}</span> препаратів (${elapsed} мс). Перші позиції — найбільш релевантні:`;

  const cardsHtml = results.map((item, index) => {
    const r = item.remedy;
    const rank = index + 1;
    const isTop = (rank === 1 && item.score >= 1500);
    const highlighted = highlightSnippet(item.sentence, item.matchedPatterns);
    const uaSecName = SECTION_NAMES_UA[item.section.toUpperCase()] || item.section;

    return `
      <article class="card ${isTop ? 'is-top-match' : ''}" data-id="${r.id}">
        <div class="card-header">
          <div class="card-title-group">
            <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
              <span class="rank-badge">${isTop ? '⭐ #1 ТОЧНИЙ ЗБІГ' : '#' + rank}</span>
              ${isTop ? '<span class="badge-exact">✓ Найвища відповідність симптому</span>' : ''}
            </div>
            <div>
              <span class="card-latin">${r.latin}</span>
              ${r.cyr ? `<span class="card-cyr">(${r.cyr})</span>` : ''}
            </div>
            ${r.common ? `<div class="card-common">🌿 ${r.common}</div>` : ''}
          </div>
          <div class="card-badge-side">
            <span class="badge-section">Рубрика: ${uaSecName}</span>
          </div>
        </div>

        <div class="snippet-box">
          ${highlighted}
        </div>

        <div class="card-actions">
          <button class="btn-details" onclick="openRemedyModal(${r.id})">
            📖 Повний опис препарату
          </button>
          <span class="remedy-id-text">ID: ${r.id}</span>
        </div>
      </article>
    `;
  }).join('');

  container.innerHTML = cardsHtml;
}

// ==========================================
// 7. MODAL VIEW WITH UKRAINIAN SECTION TITLES
// ==========================================
async function openRemedyModal(remedyId) {
  const modal = document.getElementById('remedyModal');
  const modalTitle = document.getElementById('modalTitle');
  const modalBody = document.getElementById('modalBody');

  modalTitle.innerText = 'Завантаження...';
  modalBody.innerHTML = '<div class="spinner"></div>';
  modal.classList.add('open');

  try {
    const res = await fetch(`data/remedies/${remedyId}.json`);
    if (!res.ok) throw new Error('Помилка завантаження файлу препарату');
    const full = await res.json();

    modalTitle.innerHTML = `${full.latin_name} <span style="font-size: 1rem; color: #64748b;">(${full.cyrillic_name || ''})</span>`;

    let html = '';
    if (full.image_url) {
      html += `<div class="modal-img-wrap"><img src="${full.image_url}" alt="${full.latin_name}" onerror="this.style.display='none'"></div>`;
    }

    if (full.common_name) {
      html += `<p style="margin-bottom: 0.5rem;"><strong>Народна / наукова назва:</strong> ${escapeHtml(full.common_name)}</p>`;
    }
    if (full.synonyms) {
      html += `<p style="margin-bottom: 0.5rem;"><strong>Синоніми:</strong> ${escapeHtml(full.synonyms)}</p>`;
    }
    if (full.intro) {
      html += `<div class="modal-sec-title">Опис і технологія приготування</div>`;
      html += `<div class="modal-sec-text">${escapeHtml(full.intro)}</div>`;
    }

    if (full.sections) {
      for (const [sName, sText] of Object.entries(full.sections)) {
        const uaTitle = SECTION_NAMES_UA[sName.toUpperCase()] || sName;
        html += `<div class="modal-sec-title">${escapeHtml(uaTitle)}</div>`;
        html += `<div class="modal-sec-text">${escapeHtml(sText)}</div>`;
      }
    }

    if (full.source) {
      html += `<div class="modal-source">${escapeHtml(full.source)}</div>`;
    }

    modalBody.innerHTML = html;
  } catch (err) {
    modalBody.innerHTML = `<p style="color: #dc2626;">Не вдалося відкрити опис: ${err.message}</p>`;
  }
}

function closeModal() {
  document.getElementById('remedyModal').classList.remove('open');
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ==========================================
// 8. EVENT LISTENERS
// ==========================================
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
  initApp();

  const input = document.getElementById('searchInput');
  const clearBtn = document.getElementById('btnClear');

  let debounceTimer;
  input.addEventListener('input', (e) => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      runSearch(e.target.value);
    }, 120);
  });

  clearBtn.addEventListener('click', () => {
    input.value = '';
    input.focus();
    runSearch('');
  });

  document.querySelectorAll('.chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const q = chip.getAttribute('data-query');
      if (q) {
        input.value = q;
        input.focus();
        runSearch(q);
      }
    });
  });

  document.getElementById('modalCloseBtn').addEventListener('click', closeModal);
  document.getElementById('remedyModal').addEventListener('click', (e) => {
    if (e.target.id === 'remedyModal') closeModal();
  });

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
    if (e.key === '/' && document.activeElement !== input) {
      e.preventDefault();
      input.focus();
      input.select();
    }
  });
});

}
