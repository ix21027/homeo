/**
 * Materia Medica Search & Repertory Engine for GitHub Pages
 * Zero dependencies, runs 100% client-side.
 */

let remediesData = [];
let activeRemedy = null;

// Ukrainian & Russian stem mapping for clinical terminology
const STEM_MAP = {
  // Stye
  'ячмінь': 'ячмен', 'ячмені': 'ячмен', 'ячменем': 'ячмен', 'ячменю': 'ячмен',
  'ячмень': 'ячмен', 'ячмени': 'ячмен', 'ячменем': 'ячмен', 'ячменю': 'ячмен',
  'ячменях': 'ячмен', 'ячменям': 'ячмен',
  // Eyelid
  'повіка': 'век', 'повіки': 'век', 'повіку': 'век', 'повіці': 'век', 'повіками': 'век', 'повіках': 'век', 'повіко': 'век',
  'веко': 'век', 'веки': 'век', 'веке': 'век', 'века': 'век', 'веком': 'век', 'веках': 'век', 'веками': 'век',
  // Sides
  'праве': 'прав', 'правий': 'прав', 'правого': 'прав', 'правому': 'прав', 'правом': 'прав', 'правій': 'прав',
  'правой': 'прав', 'правая': 'прав', 'правое': 'прав', 'правых': 'прав', 'правым': 'прав',
  'ліве': 'лев', 'лівий': 'лев', 'лівого': 'лев', 'лівому': 'лев', 'лівій': 'лев',
  'левое': 'лев', 'левый': 'лев', 'левого': 'лев', 'левому': 'лев', 'левом': 'лев', 'левой': 'лев', 'левая': 'лев', 'левых': 'лев',
  // Vertical
  'нижнє': 'нижн', 'нижня': 'нижн', 'нижній': 'нижн', 'нижньому': 'нижн', 'нижній': 'нижн', 'нижніх': 'нижн', 'нижніми': 'нижн',
  'нижнее': 'нижн', 'нижний': 'нижн', 'нижнем': 'нижн', 'нижняя': 'нижн', 'нижней': 'нижн', 'нижних': 'нижн', 'нижними': 'нижн',
  'верхнє': 'верхн', 'верхня': 'верхн', 'верхній': 'верхн', 'верхньому': 'верхн', 'верхніх': 'верхн',
  'верхнее': 'верхн', 'верхний': 'верхн', 'верхнем': 'верхн', 'верхняя': 'верхн', 'верхней': 'верхн', 'верхних': 'верхн',
  // Eye
  'око': 'глаз', 'очі': 'глаз', 'очах': 'глаз', 'очима': 'глаз', 'очей': 'глаз',
  'глаз': 'глаз', 'глаза': 'глаз', 'глазах': 'глаз', 'глазом': 'глаз', 'глазами': 'глаз', 'глазное': 'глаз',
  // Common symptoms
  'мігрень': 'мигрен', 'мигрень': 'мигрен', 'мигрени': 'мигрен',
  'головна': 'головн', 'головний': 'головн', 'головная': 'головн',
  'біль': 'бол', 'болі': 'бол', 'болить': 'бол', 'боль': 'бол', 'боли': 'бол', 'болезненность': 'бол',
  'бронхіт': 'бронхит', 'бронхит': 'бронхит',
  'кашель': 'кашл', 'кашлю': 'кашл',
  'ревматизм': 'ревматизм'
};

function getStem(word) {
  const w = word.toLowerCase().trim();
  if (STEM_MAP[w]) return STEM_MAP[w];
  return w.length > 5 ? w.slice(0, 5) : w;
}

function tokenize(text) {
  const words = text.match(/[A-Za-zА-Яа-яІіЇїЄєҐґ0-9]+/g) || [];
  return words.map(w => ({
    raw: w,
    stem: getStem(w)
  }));
}

// Load data
async function initApp() {
  const loading = document.getElementById('loadingIndicator');
  const resultsContainer = document.getElementById('cardsList');
  
  try {
    const res = await fetch('data/remedies_search.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    remediesData = await res.json();
    loading.style.display = 'none';
    
    // Check URL query param or set default query
    const urlParams = new URLSearchParams(window.location.search);
    const qParam = urlParams.get('q');
    const input = document.getElementById('searchInput');
    
    if (qParam) {
      input.value = qParam;
      executeSearch(qParam);
    } else {
      // Default initial query highlighting the user's specific request
      input.value = 'ячмень на правом нижнем веке';
      executeSearch(input.value);
    }
  } catch (err) {
    loading.innerHTML = `<p style="color: #dc2626;">Помилка завантаження бази: ${err.message}. Переконайтеся, що файли знаходяться у теці data/.</p>`;
  }
}

// Core Relevance Scoring Engine
function scoreRemedy(remedy, queryTokens) {
  const qStems = new Set(queryTokens.map(t => t.stem));
  
  const hasQStye = qStems.has('ячмен');
  const hasQRight = qStems.has('прав');
  const hasQLeft = qStems.has('лев');
  const hasQLower = qStems.has('нижн');
  const hasQUpper = qStems.has('верхн');
  const hasQEye = qStems.has('глаз') || qStems.has('век');

  // If query is specifically about stye, require stye in remedy text
  if (hasQStye) {
    let hasStyeAnywhere = false;
    if (remedy.clin && remedy.clin.toLowerCase().includes('ячмен')) hasStyeAnywhere = true;
    if (!hasStyeAnywhere && remedy.sec) {
      for (const sText of Object.values(remedy.sec)) {
        if (sText.toLowerCase().includes('ячмен')) {
          hasStyeAnywhere = true;
          break;
        }
      }
    }
    if (!hasStyeAnywhere) return null;
  }

  let bestSentScore = 0;
  let bestSentence = null;
  let bestSection = null;
  let allMatches = [];

  // Scan all sections
  if (remedy.sec) {
    for (const [secName, secText] of Object.entries(remedy.sec)) {
      const isEyes = (secName.toUpperCase() === 'ГЛАЗА' || secName.toUpperCase().includes('ГЛАЗ'));
      const sentences = secText.replace(/\n+/g, ' ').split(/(?<=[.?!])\s+/);

      for (const sent of sentences) {
        const sentTrim = sent.trim();
        if (!sentTrim) continue;
        const sentLower = sentTrim.toLowerCase();

        // If query is about stye, sentence must mention stye
        if (hasQStye && !sentLower.includes('ячмен')) continue;

        let score = 100;
        let matchedFeatures = 1;

        const hasSRight = sentLower.includes('прав');
        const hasSLeft = sentLower.includes('лев');
        const hasSLower = sentLower.includes('нижн');
        const hasSUpper = sentLower.includes('верхн');
        const hasSEye = sentLower.includes('век') || sentLower.includes('глаз');

        // Right side match / penalty
        if (hasQRight && hasSRight) {
          score += 600;
          matchedFeatures++;
        } else if (hasQRight && hasSLeft) {
          score -= 250;
        }

        // Left side match / penalty
        if (hasQLeft && hasSLeft) {
          score += 600;
          matchedFeatures++;
        } else if (hasQLeft && hasSRight) {
          score -= 250;
        }

        // Lower lid match / penalty
        if (hasQLower && hasSLower) {
          score += 500;
          matchedFeatures++;
        } else if (hasQLower && hasSUpper) {
          score -= 150;
        }

        // Upper lid match
        if (hasQUpper && hasSUpper) {
          score += 500;
          matchedFeatures++;
        } else if (hasQUpper && hasSLower) {
          score -= 150;
        }

        // Eyelid mention bonus
        if (hasSEye) {
          score += 150;
        }

        // Co-occurrence multiplier: All 3 features in same sentence gets top tier score!
        if (matchedFeatures >= 3) {
          score += 3000;
        } else if (matchedFeatures === 2) {
          score += 600;
        }

        if (isEyes) {
          score += 300;
        }

        if (score > 0) {
          allMatches.push({ score, secName, sentence: sentTrim });
          if (score > bestSentScore) {
            bestSentScore = score;
            bestSentence = sentTrim;
            bestSection = secName;
          }
        }
      }
    }
  }

  // Check clinical list as fallback or boost
  if (remedy.clin && remedy.clin.toLowerCase().includes('ячмен')) {
    if (bestSentScore === 0) {
      bestSentScore = 50;
      bestSection = 'КЛИНИКА';
      bestSentence = 'Ячмень (в перечне клинических нозологий)';
    } else {
      bestSentScore += 50;
    }
  }

  // If general query (not stye), calculate general token match
  if (!hasQStye) {
    let generalMatches = 0;
    const fullTextLower = `${remedy.latin} ${remedy.cyr} ${remedy.common} ${remedy.clin}`.toLowerCase();
    for (const qs of qStems) {
      if (fullTextLower.includes(qs)) generalMatches++;
    }
    if (generalMatches === 0) return null;
    bestSentScore = generalMatches * 100;
    bestSection = 'ОБЩЕЕ';
    bestSentence = remedy.clin ? remedy.clin.slice(0, 160) + '...' : remedy.common;
  }

  if (bestSentScore <= 0) return null;

  return {
    remedy,
    score: bestSentScore,
    bestSentence: bestSentence || '',
    bestSection: bestSection || 'ОПИС',
    allMatches
  };
}

// Highlight keywords in sentence
function highlightSnippet(sentence, queryTokens) {
  if (!sentence) return '';
  
  // Clean sentence
  let safe = sentence.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  
  // Highlight patterns:
  // Primary (stye): yellow
  // Modifiers (right, left, lower, upper, eyelid): green
  safe = safe.replace(/(ячмен[а-яёїіє]*)/gi, '<mark class="hl-primary">$1</mark>');
  safe = safe.replace(/(прав[а-яёїіє]*|лев[а-яёїіє]*|нижн[а-яёїіє]*|верхн[а-яёїіє]*|век[а-яёїіє]*|пов[іi]к[а-яёїіє]*)/gi, '<mark class="hl-modifier">$1</mark>');

  return safe;
}

// Execute search and render
function executeSearch(query) {
  const qTrim = query.trim();
  const clearBtn = document.getElementById('btnClear');
  clearBtn.style.display = qTrim ? 'block' : 'none';

  if (!qTrim) {
    document.getElementById('statusBar').innerHTML = `Введіть запит для пошуку`;
    document.getElementById('cardsList').innerHTML = '';
    return;
  }

  const queryTokens = tokenize(qTrim);
  const t0 = performance.now();

  const results = [];
  for (const remedy of remediesData) {
    const scored = scoreRemedy(remedy, queryTokens);
    if (scored) {
      results.push(scored);
    }
  }

  // Sort by score descending
  results.sort((a, b) => b.score - a.score);
  const elapsed = (performance.now() - t0).toFixed(1);

  renderResults(results, queryTokens, qTrim, elapsed);
}

// Render result cards
function renderResults(results, queryTokens, queryStr, elapsed) {
  const status = document.getElementById('statusBar');
  const container = document.getElementById('cardsList');

  if (results.length === 0) {
    status.innerHTML = `За запитом <strong>«${escapeHtml(queryStr)}»</strong> нічого не знайдено`;
    container.innerHTML = `
      <div style="text-align: center; padding: 3rem; background: white; border-radius: 12px; border: 1px solid #e2e8f0;">
        <p style="font-size: 1.1rem; color: #64748b;">Спробуйте змінити запит або обрати один зі швидких фільтрів вище.</p>
      </div>`;
    return;
  }

  status.innerHTML = `Знайдено <span class="results-count">${results.length}</span> препаратів (${elapsed} мс). Перші позиції — найбільш релевантні:`;

  const cardsHtml = results.map((item, index) => {
    const r = item.remedy;
    const rank = index + 1;
    const isTop = (rank === 1 && item.score >= 2000);
    const highlighted = highlightSnippet(item.bestSentence, queryTokens);

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
            <span class="badge-section">Рубрика: ${item.bestSection}</span>
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

// Open detailed modal
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
      html += `<p style="margin-bottom: 0.75rem;"><strong>Народна/ботанічна назва:</strong> ${full.common_name}</p>`;
    }
    if (full.synonyms) {
      html += `<p style="margin-bottom: 0.75rem;"><strong>Синоніми:</strong> ${full.synonyms}</p>`;
    }
    if (full.intro) {
      html += `<div class="modal-sec-title">Опис і технологія приготування</div>`;
      html += `<div class="modal-sec-text">${escapeHtml(full.intro)}</div>`;
    }

    // Render each section
    if (full.sections) {
      for (const [sName, sText] of Object.entries(full.sections)) {
        html += `<div class="modal-sec-title">${escapeHtml(sName)}</div>`;
        html += `<div class="modal-sec-text">${escapeHtml(sText)}</div>`;
      }
    }

    if (full.source) {
      html += `<div class="modal-source">${escapeHtml(full.source)}</div>`;
    }

    modalBody.innerHTML = html;
  } catch (err) {
    modalBody.innerHTML = `<p style="color: #dc2626;">Не вдалося завантажити повний опис: ${err.message}</p>`;
  }
}

function closeModal() {
  document.getElementById('remedyModal').classList.remove('open');
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
  initApp();

  const searchInput = document.getElementById('searchInput');
  const clearBtn = document.getElementById('btnClear');

  let debounceTimer;
  searchInput.addEventListener('input', (e) => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      executeSearch(e.target.value);
    }, 150);
  });

  clearBtn.addEventListener('click', () => {
    searchInput.value = '';
    searchInput.focus();
    executeSearch('');
  });

  // Quick query chips
  document.querySelectorAll('.chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const q = chip.getAttribute('data-query');
      if (q) {
        searchInput.value = q;
        searchInput.focus();
        executeSearch(q);
      }
    });
  });

  // Modal events
  document.getElementById('modalCloseBtn').addEventListener('click', closeModal);
  document.getElementById('remedyModal').addEventListener('click', (e) => {
    if (e.target.id === 'remedyModal') closeModal();
  });

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
    if (e.key === '/' && document.activeElement !== searchInput) {
      e.preventDefault();
      searchInput.focus();
      searchInput.select();
    }
  });
});
