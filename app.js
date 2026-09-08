/**
 * Materia Medica Multilingual Search Engine & Modality Repertory
 * Language Switcher: Ukrainian & Russian
 * Advanced Modalities Search: Aggravation (<) & Amelioration (>)
 * 100% Client-Side for GitHub Pages
 */

let currentLang = 'ua';
try {
  const savedLang = localStorage.getItem('homeo_lang');
  if (savedLang === 'ru' || savedLang === 'ua') {
    currentLang = savedLang;
  }
} catch (e) {}

const DATA_CACHE = {
  ua: null,
  ru: null
};

let remediesData = [];

// ==========================================
// 1. ADVANCED MODALITIES & FILTER STATE
// ==========================================
const filterState = {
  worseChips: new Set(),
  betterChips: new Set(),
  worseCustom: '',
  betterCustom: '',
  section: ''
};

// ==========================================
// 2. I18N LOCALIZATION DICTIONARY
// ==========================================
const I18N = {
  ua: {
    pageTitle: 'Materia Medica — Пошуковий Реперторій (Джон Генрі Кларк)',
    headerTitle: '🌿 Materia Medica',
    headerSubtitle: 'Пошуковий гомеопатичний реперторій: 341 препарат, 11 770+ симптомів за капітальною працею <em>Джона Генрі Кларка</em>.',
    dlDb: 'База SQLite (.db)',
    dlJson: 'Дані JSON (.json)',
    dlCsv: 'Таблиця CSV (.csv)',
    dlDbFile: 'materia_medica_ua.db',
    dlJsonFile: 'materia_medica_ua.json',
    dlCsvFile: 'materia_medica_ua.csv',
    searchPlaceholder: 'Введіть симптом, наприклад: ячмінь на правій нижній повіці, біль у попереку...',
    advToggle: 'Розширений пошук та модальності',
    lblWorse: 'Погіршення (гірше від):',
    lblBetter: 'Покращення (краще від):',
    worseChips: [
      { id: 'холод', label: '❄️ Холоду', stem: 'холод' },
      { id: 'тепло', label: '🔥 Тепла', stem: 'тепл' },
      { id: 'рух', label: '🏃 Руху', stem: 'рух' },
      { id: 'спокій', label: '🛋️ Спокою', stem: 'спок' },
      { id: 'ніч', label: '🌙 Ночі', stem: 'ніч' },
      { id: 'ранок', label: '🌅 Вранці', stem: 'ран' },
      { id: 'сирість', label: '🌧️ Сирості / вологи', stem: 'сир' },
      { id: 'дотик', label: '👆 Дотику', stem: 'дотик' },
      { id: 'їжа', label: '🍽️ Після їжі', stem: 'їж' }
    ],
    betterChips: [
      { id: 'тепло', label: '🔥 Тепла', stem: 'тепл' },
      { id: 'холод', label: '❄️ Холоду', stem: 'холод' },
      { id: 'спокій', label: '🛋️ Спокою', stem: 'спок' },
      { id: 'рух', label: '🚶 Руху', stem: 'рух' },
      { id: 'повітря', label: '🍃 Свіжого повітря', stem: 'повітр' },
      { id: 'тиск', label: '💆 Натискання / тиску', stem: 'тиск' },
      { id: 'сон', label: '💤 Після сну', stem: 'сон' },
      { id: 'їжа', label: '🍲 Після їжі', stem: 'їж' }
    ],
    inputWorsePlaceholder: 'Власне погіршення (напр. протяг, о 3 ночі, купання)...',
    inputBetterPlaceholder: 'Власне покращення (напр. гарячий чай, лежачи на боці)...',
    lblSection: '📍 Рубрика / Орган:',
    sections: [
      { val: '', text: 'Усі органи та розділи' },
      { val: 'ОЧІ|ГЛАЗА', text: '👁️ Очі та зір' },
      { val: 'ГОЛОВА', text: '🧠 Голова, мозок, запаморочення' },
      { val: 'ДИХАЛЬНА|ДЫХАТЕЛЬНАЯ|КАШЕЛЬ', text: '🫁 Дихальна система, кашель, груди' },
      { val: 'СЕРЦЕ|СЕРДЦЕ', text: '❤️ Серце та кровообіг' },
      { val: 'ЖЕЛУДОК|ШЛУНОК|ЖКТ|ЖИВОТ', text: '🥣 Шлунок, живіт, травлення' },
      { val: 'СПИНА|ПОЗВОНОЧНИК|ХРЕБЕТ', text: '🦴 Спина, хребет, поперек' },
      { val: "СУСТАВЫ|СУГЛОБИ|МЫШЦЫ|М'ЯЗИ|КОНЕЧНОСТИ|КІНЦІВКИ", text: '💪 М\'язи, суглоби, кінцівки' },
      { val: 'КОЖА|ШКІРА', text: '🩹 Шкіра, висипання, свербіж' },
      { val: 'МОЧЕВЫДЕЛИТЕЛЬНАЯ|СЕЧОВИВІДНА', text: '💧 Сечовидільна система та нирки' },
      { val: 'ПСИХИКА|ПСИХІКА', text: '🧘 Психіка, емоції, страхи' },
      { val: 'ЛИХОРАДКА|ЛИХОМАНКА|ПОТ|ПІТ', text: '🌡️ Лихоманка, жар, піт' },
      { val: 'КЛИНИКА|КЛІНІКА', text: '📋 Клінічні діагнози / нозології' }
    ],
    resetFilters: 'Скинути фільтри',
    quickLabel: 'Швидкі запити:',
    quickQueries: [
      { q: 'ячмінь на правій нижній повіці', text: '👁️ Ячмінь на правій нижній повіці', priority: true },
      { q: 'ячмінь на лівій нижній повіці', text: '👁️ Ячмінь на лівій нижній повіці' },
      { q: 'ячмінь на верхній повіці', text: '👁️ Ячмінь на верхній повіці' },
      { q: 'ячмінь', text: '💊 Всі згадки про ячмінь' },
      { q: 'біль у попереку що віддає в стегно', text: '⚡ Біль у попереку що віддає в стегно' },
      { q: 'сухий гавкаючий кашель', text: '🫁 Сухий гавкаючий кашель' },
      { q: 'запаморочення при вставанні', text: '🌀 Запаморочення при вставанні' },
      { q: 'ревматизм', text: '🦴 Ревматизм' }
    ],
    statusLoading: 'Завантаження бази даних...',
    statusInit: 'Ініціалізація гомеопатичної бази даних...',
    statusEmpty: 'Введіть будь-який симптом, орган чи виберіть модальності для пошуку...',
    statusNotFound: 'За вашим запитом нічого не знайдено. Спробуйте змінити модальності або слова.',
    statusFound: 'Знайдено <span class="results-count">{count}</span> препаратів ({time} мс). Перші позиції — найбільш релевантні:',
    cardRankTop: '⭐ #1 ТОЧНИЙ ЗБІГ',
    cardExactMatch: '✓ Найвища відповідність симптому',
    cardRubric: 'Рубрика:',
    cardBtnDetails: '📖 Повний опис препарату',
    cardWorseTag: '🔴 Гірше:',
    cardBetterTag: '🟢 Краще:',
    modalLoading: 'Завантаження...',
    modalCommonName: 'Народна / ботанічна назва:',
    modalSynonyms: 'Синоніми:',
    modalIntro: 'Опис і технологія приготування',
    modalSource: 'Джерело:',
    footerText: 'База даних створена на основі архіву <strong>homeopat-sam.com</strong> (Materia Medica, 2018). Повністю автономний клієнтський застосунок для <strong>GitHub Pages</strong>.'
  },
  ru: {
    pageTitle: 'Materia Medica — Поисковый Реперторий (Джон Генри Кларк)',
    headerTitle: '🌿 Materia Medica',
    headerSubtitle: 'Поисковый гомеопатический реперторий: 341 препарат, 11 770+ симптомов по фундаментальному труду <em>Джона Генри Кларка</em>.',
    dlDb: 'База SQLite (.db)',
    dlJson: 'Данные JSON (.json)',
    dlCsv: 'Таблица CSV (.csv)',
    dlDbFile: 'materia_medica_ru.db',
    dlJsonFile: 'materia_medica_ru.json',
    dlCsvFile: 'materia_medica_ru.csv',
    searchPlaceholder: 'Введите симптом, например: ячмень на правом нижнем веке, боль в пояснице...',
    advToggle: 'Расширенный поиск и модальности',
    lblWorse: 'Ухудшение (хуже от):',
    lblBetter: 'Улучшение (лучше от):',
    worseChips: [
      { id: 'холод', label: '❄️ Холода', stem: 'холод' },
      { id: 'тепло', label: '🔥 Тепла', stem: 'тепл' },
      { id: 'рух', label: '🏃 Движения', stem: 'движен' },
      { id: 'спокій', label: '🛋️ Покоя', stem: 'поко' },
      { id: 'ніч', label: '🌙 Ночью', stem: 'ноч' },
      { id: 'ранок', label: '🌅 Утром', stem: 'утр' },
      { id: 'сирість', label: '🌧️ Сырости / влаги', stem: 'сырост' },
      { id: 'дотик', label: '👆 Прикосновения', stem: 'прикосновен' },
      { id: 'їжа', label: '🍽️ После еды', stem: 'ед' }
    ],
    betterChips: [
      { id: 'тепло', label: '🔥 Тепла', stem: 'тепл' },
      { id: 'холод', label: '❄️ Холода', stem: 'холод' },
      { id: 'спокій', label: '🛋️ Покоя', stem: 'поко' },
      { id: 'рух', label: '🚶 Движения', stem: 'движен' },
      { id: 'повітря', label: '🍃 Свежего воздуха', stem: 'воздух' },
      { id: 'тиск', label: '💆 Надавливания / давления', stem: 'давлен' },
      { id: 'сон', label: '💤 После сна', stem: 'сна' },
      { id: 'їжа', label: '🍲 После еды', stem: 'ед' }
    ],
    inputWorsePlaceholder: 'Свое ухудшение (напр. сквозняк, в 3 ночи, купание)...',
    inputBetterPlaceholder: 'Свое улучшение (напр. горячий чай, лежа на боку)...',
    lblSection: '📍 Рубрика / Орган:',
    sections: [
      { val: '', text: 'Все органы и разделы' },
      { val: 'ОЧІ|ГЛАЗА', text: '👁️ Глаза и зрение' },
      { val: 'ГОЛОВА', text: '🧠 Голова, мозг, головокружение' },
      { val: 'ДИХАЛЬНА|ДЫХАТЕЛЬНАЯ|КАШЕЛЬ', text: '🫁 Дыхательная система, кашель, грудь' },
      { val: 'СЕРЦЕ|СЕРДЦЕ', text: '❤️ Сердце и кровообращение' },
      { val: 'ЖЕЛУДОК|ШЛУНОК|ЖКТ|ЖИВОТ', text: '🥣 Желудок, живот, пищеварение' },
      { val: 'СПИНА|ПОЗВОНОЧНИК|ХРЕБЕТ', text: '🦴 Спина, позвоночник, поясница' },
      { val: "СУСТАВЫ|СУГЛОБИ|МЫШЦЫ|М'ЯЗИ|КОНЕЧНОСТИ|КІНЦІВКИ", text: '💪 Мышцы, суставы, конечности' },
      { val: 'КОЖА|ШКІРА', text: '🩹 Кожа, высыпания, зуд' },
      { val: 'МОЧЕВЫДЕЛИТЕЛЬНАЯ|СЕЧОВИВІДНА', text: '💧 Мочевыделительная система и почки' },
      { val: 'ПСИХИКА|ПСИХІКА', text: '🧘 Психика, эмоции, страхи' },
      { val: 'ЛИХОРАДКА|ЛИХОМАНКА|ПОТ|ПІТ', text: '🌡️ Лихорадка, жар, пот' },
      { val: 'КЛИНИКА|КЛІНІКА', text: '📋 Клинические диагнозы / нозологии' }
    ],
    resetFilters: 'Сбросить фильтры',
    quickLabel: 'Быстрые запросы:',
    quickQueries: [
      { q: 'ячмень на правом нижнем веке', text: '👁️ Ячмень на правом нижнем веке', priority: true },
      { q: 'ячмень на левом нижнем веке', text: '👁️ Ячмень на левом нижнем веке' },
      { q: 'ячмень на верхнем веке', text: '👁️ Ячмень на верхнем веке' },
      { q: 'ячмень', text: '💊 Все упоминания о ячмене' },
      { q: 'боль в пояснице отдающая в бедро', text: '⚡ Боль в пояснице отдающая в бедро' },
      { q: 'сухой лающий кашель', text: '🫁 Сухой лающий кашель' },
      { q: 'головокружение при вставании', text: '🌀 Головокружение при вставании' },
      { q: 'ревматизм', text: '🦴 Ревматизм' }
    ],
    statusLoading: 'Загрузка базы данных...',
    statusInit: 'Инициализация гомеопатической базы данных...',
    statusEmpty: 'Введите любой симптом, орган или выберите модальности для поиска...',
    statusNotFound: 'По вашему запросу ничего не найдено. Попробуйте изменить модальности или слова.',
    statusFound: 'Найдено <span class="results-count">{count}</span> препаратов ({time} мс). Первые позиции — наиболее релевантные:',
    cardRankTop: '⭐ #1 ТОЧНОЕ СОВПАДЕНИЕ',
    cardExactMatch: '✓ Наивысшее соответствие симптому',
    cardRubric: 'Рубрика:',
    cardBtnDetails: '📖 Полное описание препарата',
    cardWorseTag: '🔴 Хуже:',
    cardBetterTag: '🟢 Лучше:',
    modalLoading: 'Загрузка...',
    modalCommonName: 'Народное / ботаническое название:',
    modalSynonyms: 'Синонимы:',
    modalIntro: 'Описание и технология приготовления',
    modalSource: 'Источник:',
    footerText: 'База данных создана на основе архива <strong>homeopat-sam.com</strong> (Materia Medica, 2018). Полностью автономное клиентское приложение для <strong>GitHub Pages</strong>.'
  }
};

// ==========================================
// 3. STEMMERS & THESAURUS
// ==========================================
function normalizeCyrillic(str) {
  if (!str) return '';
  return str.toLowerCase()
    .replace(/і/g, 'и')
    .replace(/є/g, 'е')
    .replace(/ї/g, 'и')
    .replace(/ґ/g, 'г')
    .replace(/й/g, 'и');
}

function stemUkrainian(word) {
  let w = word.toLowerCase().trim();
  if (w.length <= 2) return w;

  // Alternations
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

  w = w.replace(/(ому|ими|ого|ою|ею|ям|ами|ях|ах|ів|ей|ий|ій|им|ім|ати|яти|увати|ювати|ються|тися|лося|лася|лось|лись|уть|ють|ять|ить|ешь|ете|имо|емо|ємо|ння|ення|ість|ості|івна|ович|а|я|у|ю|е|є|і|и|о|й)$/g, '');
  if (w.endsWith('ц') && w.length > 3) {
    w = w.slice(0, -1) + 'к';
  }
  return w;
}

function stemRussian(word) {
  let w = word.toLowerCase().trim();
  if (w.length <= 2) return w;
  w = w.replace(/(ому|ыми|ими|ого|его|ому|ему|ых|их|ую|юю|ою|ею|ям|ами|ях|ах|ов|ев|ей|ий|ый|ой|ем|им|ам|ать|ять|еть|ить|уть|ишь|ешь|ете|ите|ут|ют|ат|ят|ся|сь|ло|ла|ли|лось|лась|лись|ение|ения|ением|ость|ости|а|я|у|ю|е|и|ы|о)$/g, '');
  return w;
}

function stemWord(word) {
  const stUa = stemUkrainian(word);
  const stRu = stemRussian(word);
  return stUa.length <= stRu.length ? stUa : stRu;
}

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
  'бол': ['бол', 'біль', 'болезнен'],
  'біль': ['бол', 'біль'],
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
  'поперек': ['поперек', 'поясниц', 'поясничн', 'крестц'],
  'поясниц': ['поясниц', 'поперек'],
  'хребет': ['позвоночник', 'позвоноч'],
  'куприк': ['копчик'],
  'суглоб': ['сустав'],
  'сустав': ['сустав', 'суглоб'],
  'м яз': ['мышц'],
  'мышц': ['мышц', 'м яз'],
  'кістк': ['кост'],
  'кост': ['кост', 'кістк'],
  'стегн': ['стегн', 'бедр'],
  'бедр': ['бедр', 'стегн'],
  'колін': ['колен'],
  'литок': ['икр'],
  'стоп': ['стоп'],
  'п ят': ['пятк'],
  'кінцівк': ['конечност'],
  'рук': ['рук'],
  'пальц': ['пальц'],

  // Modalities terms
  'холод': ['холод'],
  'тепл': ['тепл', 'жар'],
  'рух': ['движен', 'рух'],
  'движен': ['рух', 'движен'],
  'спок': ['поко', 'спок'],
  'поко': ['спок', 'поко'],
  'ніч': ['ноч', 'ніч'],
  'ноч': ['ніч', 'ноч'],
  'ран': ['утр', 'ран'],
  'утр': ['ран', 'утр'],
  'сир': ['сырост', 'влаг', 'дожд', 'сыр'],
  'сырост': ['сир', 'влаг', 'дожд'],
  'дотик': ['прикосновен', 'дотик'],
  'прикосновен': ['дотик', 'прикосновен'],
  'повітр': ['воздух', 'повітр'],
  'воздух': ['повітр', 'воздух'],
  'тиск': ['давлен', 'надавл', 'тиск'],
  'давлен': ['тиск', 'надавл', 'давлен']
};

function expandWordToPatterns(word) {
  const wLower = word.toLowerCase().trim();
  const stUa = stemUkrainian(wLower);
  const stRu = stemRussian(wLower);
  const st = stUa.length <= stRu.length ? stUa : stRu;

  const stNorm = normalizeCyrillic(st);
  const equivs = new Set([wLower, st, stNorm, stUa, stRu]);

  // Ukrainian vowel & consonant palatalization
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

  for (const [key, list] of Object.entries(THESAURUS)) {
    if (st === key || st.startsWith(key) || key.startsWith(st)) {
      list.forEach(item => {
        equivs.add(item);
        equivs.add(normalizeCyrillic(item));
      });
    }
  }

  return Array.from(equivs).filter(p => p.length >= 2);
}

function expandQueryToConcepts(query) {
  const words = query.match(/[A-Za-zА-Яа-яІіЇїЄєҐґ0-9]+/g) || [];
  const concepts = [];
  const stopWords = new Set(['в', 'у', 'на', 'та', 'і', 'й', 'до', 'від', 'при', 'що', 'як', 'під', 'час', 'для', 'по', 'за', 'над', 'из', 'от', 'к', 'с', 'со']);

  for (const w of words) {
    if (stopWords.has(w.toLowerCase())) continue;
    const patterns = expandWordToPatterns(w);
    if (patterns.length > 0) {
      concepts.push({
        originalWord: w,
        patterns
      });
    }
  }

  return concepts;
}

// ==========================================
// 4. MODALITY PARSING & SNIPPET EXTRACTION
// ==========================================
function parseModalities(sec) {
  let worse = '';
  let better = '';
  if (!sec) return { worse: '', better: '' };

  for (const [k, v] of Object.entries(sec)) {
    if (k.toLowerCase().includes('модал')) {
      const text = v.replace(/•/g, '\n• ');
      const lines = text.split('\n');
      let currentSection = null;
      for (const line of lines) {
        const l = line.trim();
        const lLower = l.toLowerCase();
        if (/^(•\s*)?(гірше|хуже|погіршення|ухудшение)/i.test(lLower)) {
          currentSection = 'worse';
          worse += ' ' + l;
        } else if (/^(•\s*)?(краще|лучше|покращення|улучшение)/i.test(lLower)) {
          currentSection = 'better';
          better += ' ' + l;
        } else if (currentSection === 'worse') {
          worse += ' ' + l;
        } else if (currentSection === 'better') {
          better += ' ' + l;
        }
      }
    }
  }
  return { worse: worse.trim(), better: better.trim() };
}

function findModalitySnippet(text, patterns) {
  if (!text) return '';
  const sentences = text.split(/(?<=[.;!?])\s+/);
  for (const s of sentences) {
    const sLow = s.toLowerCase();
    for (const p of patterns) {
      if (sLow.includes(p)) {
        return s.trim().replace(/^•\s*/, '').replace(/^(гірше|хуже|краще|лучше)[:.]\s*/i, '');
      }
    }
  }
  return text.slice(0, 140).replace(/^•\s*/, '').replace(/^(гірше|хуже|краще|лучше)[:.]\s*/i, '');
}

// ==========================================
// 5. SEARCH & RELEVANCE SCORING ENGINE
// ==========================================
function searchRemedies(query) {
  const qTrim = (query || '').trim();
  const concepts = qTrim ? expandQueryToConcepts(qTrim) : [];
  const totalConcepts = concepts.length;

  const worseQueryStems = [];
  const betterQueryStems = [];

  const t = I18N[currentLang];
  filterState.worseChips.forEach(id => {
    const chipDef = t.worseChips.find(c => c.id === id);
    if (chipDef) worseQueryStems.push(chipDef.stem);
  });
  filterState.betterChips.forEach(id => {
    const chipDef = t.betterChips.find(c => c.id === id);
    if (chipDef) betterQueryStems.push(chipDef.stem);
  });

  if (filterState.worseCustom && filterState.worseCustom.trim()) {
    const cWords = filterState.worseCustom.match(/[A-Za-zА-Яа-яІіЇїЄєҐґ0-9]+/g) || [];
    cWords.forEach(w => worseQueryStems.push(w));
  }
  if (filterState.betterCustom && filterState.betterCustom.trim()) {
    const cWords = filterState.betterCustom.match(/[A-Za-zА-Яа-яІіЇїЄєҐґ0-9]+/g) || [];
    cWords.forEach(w => betterQueryStems.push(w));
  }

  const worsePatterns = worseQueryStems.flatMap(w => expandWordToPatterns(w));
  const betterPatterns = betterQueryStems.flatMap(w => expandWordToPatterns(w));
  const sectionFilterRegex = filterState.section ? new RegExp(filterState.section, 'i') : null;

  const hasModalityFilters = worsePatterns.length > 0 || betterPatterns.length > 0;
  const hasQuery = concepts.length > 0;

  if (!hasQuery && !hasModalityFilters && !sectionFilterRegex) {
    return [];
  }

  const results = [];

  for (const remedy of remediesData) {
    const latinLower = (remedy.latin || '').toLowerCase();
    const cyrLower = (remedy.cyr || '').toLowerCase();
    const commonLower = (remedy.common || '').toLowerCase();
    const qLower = qTrim.toLowerCase();

    const isDirectNameMatch = qLower && (
      (latinLower && latinLower.includes(qLower)) ||
      (cyrLower && cyrLower.includes(qLower)) ||
      (commonLower && commonLower.includes(qLower))
    );

    let matchedWorseCount = 0;
    let matchedBetterCount = 0;
    let matchedWorseText = '';
    let matchedBetterText = '';

    const wText = (remedy.mod_worse || '').toLowerCase();
    const bText = (remedy.mod_better || '').toLowerCase();

    if (worsePatterns.length > 0) {
      for (const p of worsePatterns) {
        if (wText.includes(p)) {
          matchedWorseCount++;
          if (!matchedWorseText) {
            matchedWorseText = findModalitySnippet(remedy.mod_worse, [p]);
          }
        }
      }
      if (matchedWorseCount === 0 && remedy.sec) {
        for (const [sName, sContent] of Object.entries(remedy.sec)) {
          const sLow = sContent.toLowerCase();
          for (const p of worsePatterns) {
            if ((sLow.includes('гірше') || sLow.includes('хуже')) && sLow.includes(p)) {
              matchedWorseCount++;
              matchedWorseText = findModalitySnippet(sContent, [p]);
              break;
            }
          }
          if (matchedWorseCount > 0) break;
        }
      }
    }

    if (betterPatterns.length > 0) {
      for (const p of betterPatterns) {
        if (bText.includes(p)) {
          matchedBetterCount++;
          if (!matchedBetterText) {
            matchedBetterText = findModalitySnippet(remedy.mod_better, [p]);
          }
        }
      }
      if (matchedBetterCount === 0 && remedy.sec) {
        for (const [sName, sContent] of Object.entries(remedy.sec)) {
          const sLow = sContent.toLowerCase();
          for (const p of betterPatterns) {
            if ((sLow.includes('краще') || sLow.includes('лучше')) && sLow.includes(p)) {
              matchedBetterCount++;
              matchedBetterText = findModalitySnippet(sContent, [p]);
              break;
            }
          }
          if (matchedBetterCount > 0) break;
        }
      }
    }

    if (!hasQuery && hasModalityFilters) {
      if (worsePatterns.length > 0 && matchedWorseCount === 0) continue;
      if (betterPatterns.length > 0 && matchedBetterCount === 0) continue;
    }

    if (sectionFilterRegex && remedy.sec) {
      const hasSec = Object.keys(remedy.sec).some(k => sectionFilterRegex.test(k));
      if (!hasSec) continue;
    }

    let bestScore = 0;
    let bestSent = '';
    let bestSec = '';
    let bestMatchedPatterns = [];

    if (hasQuery && remedy.sec) {
      for (const [secName, secText] of Object.entries(remedy.sec)) {
        if (sectionFilterRegex && !sectionFilterRegex.test(secName)) {
          continue;
        }

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
            let score = (matchedCount * 100) + Math.pow(matchedCount, 3) * 50;

            if (matchedCount === totalConcepts && totalConcepts >= 2) {
              score += 5000;
            }

            const sUpper = secName.toUpperCase();
            if ((sUpper.includes('ОЧ') || sUpper.includes('ГЛАЗ')) && (qTrim.includes('оч') || qTrim.includes('повік') || qTrim.includes('повіц') || qTrim.includes('ячм') || qTrim.includes('век') || qTrim.includes('ячмен'))) {
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

    if (hasQuery && bestScore === 0 && remedy.clin) {
      const cLower = remedy.clin.toLowerCase();
      let clinMatches = 0;
      for (const c of concepts) {
        if (c.patterns.some(p => cLower.includes(p))) clinMatches++;
      }
      if (clinMatches > 0) {
        bestScore = clinMatches * 50;
        bestSec = 'КЛІНІКА / КЛИНИКА';
        bestSent = remedy.clin.slice(0, 150) + '...';
      }
    }

    if (isDirectNameMatch) {
      bestScore += 20000;
      if (!bestSent) bestSent = remedy.common || remedy.clin?.slice(0, 120) || '';
      if (!bestSec) bestSec = 'ПРЕПАРАТ';
    }

    if (hasQuery && bestScore === 0) {
      continue;
    }

    if (matchedWorseCount > 0) {
      bestScore += matchedWorseCount * 1200;
    }
    if (matchedBetterCount > 0) {
      bestScore += matchedBetterCount * 1200;
    }

    if (!hasQuery && (matchedWorseCount > 0 || matchedBetterCount > 0)) {
      bestScore = (matchedWorseCount + matchedBetterCount) * 1000;
      if (!bestSent) {
        bestSent = remedy.common || (remedy.intro ? remedy.intro.slice(0, 150) : '');
        bestSec = 'МОДАЛЬНОСТІ';
      }
    }

    if (bestScore > 0) {
      results.push({
        remedy,
        score: bestScore,
        section: bestSec,
        sentence: bestSent,
        matchedPatterns: bestMatchedPatterns,
        matchedWorseText,
        matchedBetterText
      });
    }
  }

  results.sort((a, b) => b.score - a.score);
  return results;
}

// ==========================================
// 6. HIGHLIGHTING SNIPPETS
// ==========================================
function highlightSnippet(sentence, matchedPatterns) {
  if (!sentence) return '';
  let safe = sentence.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const sorted = [...new Set(matchedPatterns || [])].sort((a, b) => b.length - a.length);

  for (const pat of sorted) {
    if (pat.length < 2) continue;
    const regex = new RegExp(`(${pat}[а-яёїіє]*)`, 'gi');
    safe = safe.replace(regex, '<mark class="hl-primary">$1</mark>');
  }

  return safe;
}

// ==========================================
// 7. UI LOCALIZATION & SWITCHING
// ==========================================
function updateUILanguage() {
  const t = I18N[currentLang];
  document.title = t.pageTitle;
  document.documentElement.lang = currentLang;

  const titleEl = document.getElementById('headerTitle');
  if (titleEl) titleEl.innerHTML = t.headerTitle;
  const subEl = document.getElementById('headerSubtitle');
  if (subEl) subEl.innerHTML = t.headerSubtitle;

  const dlDb = document.getElementById('dlDb');
  if (dlDb) {
    dlDb.href = t.dlDbFile;
    dlDb.setAttribute('download', t.dlDbFile);
    const txtDb = document.getElementById('txtDlDb');
    if (txtDb) txtDb.innerText = t.dlDb;
  }
  const dlJson = document.getElementById('dlJson');
  if (dlJson) {
    dlJson.href = t.dlJsonFile;
    dlJson.setAttribute('download', t.dlJsonFile);
    const txtJson = document.getElementById('txtDlJson');
    if (txtJson) txtJson.innerText = t.dlJson;
  }
  const dlCsv = document.getElementById('dlCsv');
  if (dlCsv) {
    dlCsv.href = t.dlCsvFile;
    dlCsv.setAttribute('download', t.dlCsvFile);
    const txtCsv = document.getElementById('txtDlCsv');
    if (txtCsv) txtCsv.innerText = t.dlCsv;
  }

  const searchInput = document.getElementById('searchInput');
  if (searchInput) searchInput.placeholder = t.searchPlaceholder;
  const txtAdvToggle = document.getElementById('txtAdvToggle');
  if (txtAdvToggle) txtAdvToggle.innerText = t.advToggle;

  const lblWorse = document.getElementById('lblWorse');
  if (lblWorse) lblWorse.innerText = t.lblWorse;
  const lblBetter = document.getElementById('lblBetter');
  if (lblBetter) lblBetter.innerText = t.lblBetter;

  const inWorse = document.getElementById('inputWorseCustom');
  if (inWorse) inWorse.placeholder = t.inputWorsePlaceholder;
  const inBetter = document.getElementById('inputBetterCustom');
  if (inBetter) inBetter.placeholder = t.inputBetterPlaceholder;

  const lblSec = document.getElementById('lblSection');
  if (lblSec) lblSec.innerText = t.lblSection;
  const txtReset = document.getElementById('txtResetFilters');
  if (txtReset) txtReset.innerText = t.resetFilters;

  const btnUa = document.getElementById('langBtnUa');
  const btnRu = document.getElementById('langBtnRu');
  if (btnUa && btnRu) {
    btnUa.classList.toggle('active', currentLang === 'ua');
    btnRu.classList.toggle('active', currentLang === 'ru');
  }

  const selectSection = document.getElementById('selectSection');
  if (selectSection) {
    const curVal = selectSection.value;
    selectSection.innerHTML = t.sections.map(s => `
      <option value="${s.val}" ${s.val === curVal ? 'selected' : ''}>${s.text}</option>
    `).join('');
  }

  renderModalityChips();

  const qLabel = document.getElementById('txtQuickLabel');
  if (qLabel) qLabel.innerText = t.quickLabel;
  const qList = document.getElementById('quickChipsList');
  if (qList) {
    qList.innerHTML = t.quickQueries.map(item => `
      <button type="button" class="chip ${item.priority ? 'chip-priority' : ''}" data-query="${item.q}">
        ${item.text}
      </button>
    `).join('');
    qList.querySelectorAll('.chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const q = chip.getAttribute('data-query');
        if (q && searchInput) {
          searchInput.value = q;
          searchInput.focus();
          runSearch(q);
        }
      });
    });
  }

  const footerEl = document.querySelector('footer p');
  if (footerEl) footerEl.innerHTML = t.footerText;
}

function renderModalityChips() {
  const t = I18N[currentLang];
  const worseContainer = document.getElementById('worseChipsContainer');
  const betterContainer = document.getElementById('betterChipsContainer');

  if (worseContainer) {
    worseContainer.innerHTML = t.worseChips.map(c => `
      <button type="button" class="mod-chip ${filterState.worseChips.has(c.id) ? 'active-worse' : ''}" data-mod-id="${c.id}" data-type="worse">
        ${c.label}
      </button>
    `).join('');
  }

  if (betterContainer) {
    betterContainer.innerHTML = t.betterChips.map(c => `
      <button type="button" class="mod-chip ${filterState.betterChips.has(c.id) ? 'active-better' : ''}" data-mod-id="${c.id}" data-type="better">
        ${c.label}
      </button>
    `).join('');
  }

  document.querySelectorAll('.mod-chip').forEach(chip => {
    chip.addEventListener('click', (e) => {
      const type = chip.getAttribute('data-type');
      const id = chip.getAttribute('data-mod-id');
      if (type === 'worse') {
        if (filterState.worseChips.has(id)) {
          filterState.worseChips.delete(id);
          chip.classList.remove('active-worse');
        } else {
          filterState.worseChips.add(id);
          chip.classList.add('active-worse');
        }
      } else if (type === 'better') {
        if (filterState.betterChips.has(id)) {
          filterState.betterChips.delete(id);
          chip.classList.remove('active-better');
        } else {
          filterState.betterChips.add(id);
          chip.classList.add('active-better');
        }
      }
      updateFiltersBadge();
      const input = document.getElementById('searchInput');
      runSearch(input ? input.value : '');
    });
  });
}

function updateFiltersBadge() {
  const count = filterState.worseChips.size +
                filterState.betterChips.size +
                (filterState.worseCustom.trim() ? 1 : 0) +
                (filterState.betterCustom.trim() ? 1 : 0) +
                (filterState.section ? 1 : 0);

  const badge = document.getElementById('advFiltersBadge');
  if (badge) {
    badge.innerText = count;
    badge.style.display = count > 0 ? 'inline-flex' : 'none';
  }
}

// ==========================================
// 8. DATA LOADING & INITIALIZATION
// ==========================================
async function loadDataset(lang) {
  if (DATA_CACHE[lang]) {
    remediesData = DATA_CACHE[lang];
    return;
  }

  const filename = `data/remedies_search_${lang}.json`;
  const res = await fetch(filename);
  if (!res.ok) {
    const fallbackRes = await fetch('data/remedies_search.json');
    if (!fallbackRes.ok) throw new Error(`HTTP ${res.status}`);
    remediesData = await fallbackRes.json();
  } else {
    remediesData = await res.json();
  }

  for (const r of remediesData) {
    const m = parseModalities(r.sec);
    r.mod_worse = m.worse;
    r.mod_better = m.better;
  }

  DATA_CACHE[lang] = remediesData;
}

async function switchLanguage(newLang) {
  if (newLang !== 'ua' && newLang !== 'ru') return;
  currentLang = newLang;
  try {
    localStorage.setItem('homeo_lang', currentLang);
  } catch (e) {}

  const loading = document.getElementById('loadingIndicator');
  if (loading) loading.style.display = 'block';

  try {
    await loadDataset(currentLang);
    updateUILanguage();
    const input = document.getElementById('searchInput');
    const q = input ? input.value : '';
    runSearch(q);
  } catch (err) {
    console.error('Error switching language:', err);
  } finally {
    if (loading) loading.style.display = 'none';
  }
}

async function initApp() {
  const loading = document.getElementById('loadingIndicator');
  try {
    await loadDataset(currentLang);
    updateUILanguage();
    if (loading) loading.style.display = 'none';

    const input = document.getElementById('searchInput');
    const urlParams = new URLSearchParams(window.location.search);
    const qParam = urlParams.get('q');

    if (qParam) {
      input.value = qParam;
      runSearch(qParam);
    } else {
      input.value = currentLang === 'ua' ? 'ячмінь на правій нижній повіці' : 'ячмень на правом нижнем веке';
      runSearch(input.value);
    }
  } catch (err) {
    if (loading) {
      loading.innerHTML = `<p style="color: #dc2626; padding: 2rem;">Помилка завантаження бази даних: ${err.message}</p>`;
    }
  }
}

// ==========================================
// 9. SEARCH EXECUTION & CARD RENDERING
// ==========================================
function runSearch(query) {
  const qTrim = (query || '').trim();
  const clearBtn = document.getElementById('btnClear');
  if (clearBtn) clearBtn.style.display = qTrim ? 'block' : 'none';

  const statusBar = document.getElementById('statusBar');
  const container = document.getElementById('cardsList');
  const t = I18N[currentLang];

  const hasModalityFilters = filterState.worseChips.size > 0 ||
                             filterState.betterChips.size > 0 ||
                             filterState.worseCustom.trim() ||
                             filterState.betterCustom.trim() ||
                             filterState.section;

  if (!qTrim && !hasModalityFilters) {
    statusBar.innerHTML = t.statusEmpty;
    container.innerHTML = '';
    return;
  }

  const t0 = performance.now();
  const results = searchRemedies(qTrim);
  const elapsed = (performance.now() - t0).toFixed(1);

  if (results.length === 0) {
    statusBar.innerHTML = t.statusNotFound;
    container.innerHTML = `
      <div style="text-align: center; padding: 3rem; background: white; border-radius: 12px; border: 1px solid #e2e8f0;">
        <p style="font-size: 1.1rem; color: #64748b;">${t.statusNotFound}</p>
      </div>`;
    return;
  }

  statusBar.innerHTML = t.statusFound.replace('{count}', results.length).replace('{time}', elapsed);

  const cardsHtml = results.map((item, index) => {
    const r = item.remedy;
    const rank = index + 1;
    const isTop = (rank === 1 && item.score >= 1500);
    const highlighted = highlightSnippet(item.sentence, item.matchedPatterns);

    let modHtml = '';
    if (item.matchedWorseText || item.matchedBetterText) {
      modHtml = `
        <div class="card-mod-box">
          ${item.matchedWorseText ? `<div class="card-mod-worse"><span class="card-mod-tag">${t.cardWorseTag}</span> ${escapeHtml(item.matchedWorseText)}</div>` : ''}
          ${item.matchedBetterText ? `<div class="card-mod-better"><span class="card-mod-tag">${t.cardBetterTag}</span> ${escapeHtml(item.matchedBetterText)}</div>` : ''}
        </div>
      `;
    }

    return `
      <article class="card ${isTop ? 'is-top-match' : ''}" data-id="${r.id}">
        <div class="card-header">
          <div class="card-title-group">
            <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
              <span class="rank-badge">${isTop ? t.cardRankTop : '#' + rank}</span>
              ${isTop ? `<span class="badge-exact">${t.cardExactMatch}</span>` : ''}
            </div>
            <div>
              <span class="card-latin">${r.latin}</span>
              ${r.cyr ? `<span class="card-cyr">(${r.cyr})</span>` : ''}
            </div>
            ${r.common ? `<div class="card-common">🌿 ${r.common}</div>` : ''}
          </div>
          <div class="card-badge-side">
            <span class="badge-section">${t.cardRubric} ${item.section}</span>
          </div>
        </div>

        <div class="snippet-box">
          ${highlighted}
        </div>

        ${modHtml}

        <div class="card-actions">
          <button class="btn-details" onclick="openRemedyModal(${r.id})">
            ${t.cardBtnDetails}
          </button>
          <span class="remedy-id-text">ID: ${r.id}</span>
        </div>
      </article>
    `;
  }).join('');

  container.innerHTML = cardsHtml;
}

// ==========================================
// 10. DETAILED MODAL VIEW
// ==========================================
async function openRemedyModal(remedyId) {
  const modal = document.getElementById('remedyModal');
  const modalTitle = document.getElementById('modalTitle');
  const modalBody = document.getElementById('modalBody');
  const t = I18N[currentLang];

  modalTitle.innerText = t.modalLoading;
  modalBody.innerHTML = '<div class="spinner"></div>';
  modal.classList.add('open');

  try {
    const filename = `data/remedies_${currentLang}/${remedyId}.json`;
    let res = await fetch(filename);
    if (!res.ok) {
      res = await fetch(`data/remedies/${remedyId}.json`);
      if (!res.ok) throw new Error('Помилка завантаження файлу препарату');
    }
    const full = await res.json();

    modalTitle.innerHTML = `${full.latin_name} <span style="font-size: 1rem; color: #64748b;">(${full.cyrillic_name || ''})</span>`;

    let html = '';
    if (full.image_url) {
      html += `<div class="modal-img-wrap"><img src="${full.image_url}" alt="${full.latin_name}" onerror="this.style.display='none'"></div>`;
    }

    if (full.common_name) {
      html += `<p style="margin-bottom: 0.5rem;"><strong>${t.modalCommonName}</strong> ${escapeHtml(full.common_name)}</p>`;
    }
    if (full.synonyms) {
      html += `<p style="margin-bottom: 0.5rem;"><strong>${t.modalSynonyms}</strong> ${escapeHtml(full.synonyms)}</p>`;
    }
    if (full.intro) {
      html += `<div class="modal-sec-title">${t.modalIntro}</div>`;
      html += `<div class="modal-sec-text">${escapeHtml(full.intro)}</div>`;
    }

    if (full.sections) {
      for (const [sName, sText] of Object.entries(full.sections)) {
        html += `<div class="modal-sec-title">${escapeHtml(sName)}</div>`;
        html += `<div class="modal-sec-text">${escapeHtml(sText)}</div>`;
      }
    }

    if (full.source) {
      html += `<div class="modal-source">${t.modalSource} ${escapeHtml(full.source)}</div>`;
    }

    modalBody.innerHTML = html;
  } catch (err) {
    modalBody.innerHTML = `<p style="color: #dc2626;">Не вдалося відкрити опис: ${err.message}</p>`;
  }
}

function closeModal() {
  const modal = document.getElementById('remedyModal');
  if (modal) modal.classList.remove('open');
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ==========================================
// 11. EVENT LISTENERS
// ==========================================
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    initApp();

    const input = document.getElementById('searchInput');
    const clearBtn = document.getElementById('btnClear');

    let debounceTimer;
    if (input) {
      input.addEventListener('input', (e) => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          runSearch(e.target.value);
        }, 120);
      });
    }

    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        if (input) {
          input.value = '';
          input.focus();
        }
        runSearch('');
      });
    }

    const btnUa = document.getElementById('langBtnUa');
    const btnRu = document.getElementById('langBtnRu');
    if (btnUa) btnUa.addEventListener('click', () => switchLanguage('ua'));
    if (btnRu) btnRu.addEventListener('click', () => switchLanguage('ru'));

    const toggleBtn = document.getElementById('btnToggleAdvanced');
    const advPanel = document.getElementById('advancedPanel');
    if (toggleBtn && advPanel) {
      toggleBtn.addEventListener('click', () => {
        const isHidden = advPanel.style.display === 'none';
        advPanel.style.display = isHidden ? 'block' : 'none';
        toggleBtn.setAttribute('aria-expanded', isHidden ? 'true' : 'false');
      });
    }

    const inWorse = document.getElementById('inputWorseCustom');
    if (inWorse) {
      inWorse.addEventListener('input', (e) => {
        filterState.worseCustom = e.target.value;
        updateFiltersBadge();
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          runSearch(input ? input.value : '');
        }, 200);
      });
    }

    const inBetter = document.getElementById('inputBetterCustom');
    if (inBetter) {
      inBetter.addEventListener('input', (e) => {
        filterState.betterCustom = e.target.value;
        updateFiltersBadge();
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          runSearch(input ? input.value : '');
        }, 200);
      });
    }

    const selectSec = document.getElementById('selectSection');
    if (selectSec) {
      selectSec.addEventListener('change', (e) => {
        filterState.section = e.target.value;
        updateFiltersBadge();
        runSearch(input ? input.value : '');
      });
    }

    const btnReset = document.getElementById('btnResetFilters');
    if (btnReset) {
      btnReset.addEventListener('click', () => {
        filterState.worseChips.clear();
        filterState.betterChips.clear();
        filterState.worseCustom = '';
        filterState.betterCustom = '';
        filterState.section = '';

        if (inWorse) inWorse.value = '';
        if (inBetter) inBetter.value = '';
        if (selectSec) selectSec.value = '';

        renderModalityChips();
        updateFiltersBadge();
        runSearch(input ? input.value : '');
      });
    }

    const modalCloseBtn = document.getElementById('modalCloseBtn');
    if (modalCloseBtn) modalCloseBtn.addEventListener('click', closeModal);
    const remedyModal = document.getElementById('remedyModal');
    if (remedyModal) {
      remedyModal.addEventListener('click', (e) => {
        if (e.target.id === 'remedyModal') closeModal();
      });
    }

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeModal();
      if (e.key === '/' && document.activeElement !== input) {
        e.preventDefault();
        if (input) input.focus();
      }
    });
  });
}
