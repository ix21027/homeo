/**
 * Materia Medica Multilingual Search Engine & Modality Repertory
 * Language Switcher: Ukrainian & Russian
 * Advanced Modalities Search: Aggravation (<) & Amelioration (>)
 * 100% Client-Side for GitHub Pages
 */

let currentLang = 'ua';
try {
  if (typeof window !== 'undefined' && window.location) {
    const urlParams = new URLSearchParams(window.location.search);
    const urlLang = urlParams.get('lang');
    if (urlLang === 'ru' || urlLang === 'ua') {
      currentLang = urlLang;
    } else {
      const savedLang = localStorage.getItem('homeo_lang');
      if (savedLang === 'ru' || savedLang === 'ua') {
        currentLang = savedLang;
      }
    }
  }
} catch (e) {}

// ===== DARK THEME =====
function applyTheme(isDark) {
  document.body.classList.toggle('dark', isDark);
  const btn = document.getElementById('btnThemeToggle');
  if (btn) btn.textContent = isDark ? '🌙' : '☀️';
}

(function initTheme() {
  try {
    const saved = localStorage.getItem('homeo_theme');
    const mq = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)');
    // Apply: saved override wins, otherwise follow system
    applyTheme(saved === 'dark' || (saved !== 'light' && mq && mq.matches));
    // React to system theme changes in real-time (if no manual override)
    if (mq && mq.addEventListener) {
      mq.addEventListener('change', function (e) {
        const manualOverride = localStorage.getItem('homeo_theme');
        if (!manualOverride) applyTheme(e.matches);
      });
    }
  } catch (e) {}
})();

function toggleTheme() {
  const isDark = document.body.classList.toggle('dark');
  try { localStorage.setItem('homeo_theme', isDark ? 'dark' : 'light'); } catch (e) {}
  const btn = document.getElementById('btnThemeToggle');
  if (btn) btn.textContent = isDark ? '🌙' : '☀️';
}

document.addEventListener('DOMContentLoaded', function () {
  const btn = document.getElementById('btnThemeToggle');
  if (btn) {
    btn.textContent = document.body.classList.contains('dark') ? '🌙' : '☀️';
    btn.addEventListener('click', toggleTheme);
  }
});


const DATA_CACHE = {
  ua: null,
  ru: null
};

let remediesData = [];
let lastSearchResults = [];
let currentModalRemedy = null;
let downloadModalLang = currentLang;

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
    pageDescription: 'База даних гомеопатичних препаратів Materia Medica з повнотекстовим розумним пошуком симптомів та модальностей. Працює на GitHub Pages.',
    headerTitle: 'Materia Medica',
    headerSubtitle: 'Пошуковий гомеопатичний реперторій: 341 препарат, 11 770+ симптомів за капітальною працею <em>Джона Генрі Кларка</em>.',
    dlDb: 'База SQLite (.db)',
    dlJson: 'Дані JSON (.json)',
    dlCsv: 'Таблиця CSV (.csv)',
    dlDbTitle: 'Завантажити базу даних SQLite',
    dlJsonTitle: 'Завантажити повний файл JSON',
    dlCsvTitle: 'Завантажити таблицю CSV для Excel',
    dlDbFile: 'materia_medica_ua.db',
    dlJsonFile: 'materia_medica_ua.json',
    dlCsvFile: 'materia_medica_ua.csv',
    searchPlaceholder: 'Введіть симптом, наприклад: ячмінь на правій нижній повіці, біль у попереку...',
    btnClearTitle: 'Очистити',
    advToggle: 'Розширений пошук та модальності',
    lblWorse: 'Погіршення (гірше від):',
    lblBetter: 'Покращення (краще від):',
    worseChips: [
      { id: 'холод', label: 'Холоду', stem: 'холод' },
      { id: 'тепло', label: 'Тепла', stem: 'тепл' },
      { id: 'сирість', label: 'Сирості', stem: 'сир' },
      { id: 'протяг', label: 'Протягу / вітру', stem: 'протяг' },
      { id: 'сонце', label: 'Сонця / спеки', stem: 'сонц' },
      { id: 'рух', label: 'Руху', stem: 'рух' },
      { id: 'ходьба', label: 'При ходьбі', stem: 'ходьб' },
      { id: 'спокій', label: 'Спокою', stem: 'спок' },
      { id: 'лежачи', label: 'Лежачи', stem: 'лежа' },
      { id: 'сидячи', label: 'Сидячи', stem: 'сидя' },
      { id: 'ніч', label: 'Ночі', stem: 'ніч' },
      { id: 'ранок', label: 'Вранці', stem: 'ран' },
      { id: 'вечір', label: 'Увечері', stem: 'веч' },
      { id: 'дотик', label: 'Дотику', stem: 'дотик' },
      { id: 'їжа', label: 'Після їжі', stem: 'їж' },
      { id: 'кава', label: 'Кави', stem: 'кав' },
      { id: 'алкоголь', label: 'Алкоголю', stem: 'вин' },
      { id: 'купання', label: 'Купання / води', stem: 'купан' },
      { id: 'гроза', label: 'Перед грозою', stem: 'гроз' },
      { id: 'розмова', label: 'Розмови', stem: 'розмов' }
    ],
    betterChips: [
      { id: 'тепло', label: 'Тепла', stem: 'тепл' },
      { id: 'холод', label: 'Холоду', stem: 'холод' },
      { id: 'повітря', label: 'Свіжого повітря', stem: 'повітр' },
      { id: 'спокій', label: 'Спокою', stem: 'спок' },
      { id: 'рух', label: 'Руху', stem: 'рух' },
      { id: 'ходьба', label: 'При ходьбі', stem: 'ходьб' },
      { id: 'лежачи', label: 'Лежачи', stem: 'лежа' },
      { id: 'тиск', label: 'Натискання / тиску', stem: 'тиск' },
      { id: 'розтирання', label: 'Розтирання / масажу', stem: 'розтиран' },
      { id: 'сон', label: 'Після сну', stem: 'сон' },
      { id: 'їжа', label: 'Після їжі', stem: 'їж' },
      { id: 'холодне_пиття', label: 'Холодного пиття', stem: 'холодн' },
      { id: 'піт', label: 'Виділення поту', stem: 'пот' },
      { id: 'відрижка', label: 'Відходження газів', stem: 'відрижк' }
    ],
    inputWorsePlaceholder: 'Власне погіршення (напр. протяг, о 3 ночі, купання)...',
    inputBetterPlaceholder: 'Власне покращення (напр. гарячий чай, лежачи на боці)...',
    lblSection: 'Рубрика / Орган:',
    sections: [
      { val: '', text: 'Усі органи та розділи' },
      { val: 'ОЧІ|ГЛАЗА', text: 'Очі та зір' },
      { val: 'ГОЛОВА', text: 'Голова, мозок, запаморочення' },
      { val: 'ДИХАЛЬНА|ДЫХАТЕЛЬНАЯ|КАШЕЛЬ', text: 'Дихальна система, кашель, груди' },
      { val: 'СЕРЦЕ|СЕРДЦЕ', text: 'Серце та кровообіг' },
      { val: 'ЖЕЛУДОК|ШЛУНОК|ЖКТ|ЖИВОТ', text: 'Шлунок, живіт, травлення' },
      { val: 'СПИНА|ПОЗВОНОЧНИК|ХРЕБЕТ', text: 'Спина, хребет, поперек' },
      { val: "СУСТАВЫ|СУГЛОБИ|МЫШЦЫ|М'ЯЗИ|КОНЕЧНОСТИ|КІНЦІВКИ", text: 'М\'язи, суглоби, кінцівки' },
      { val: 'КОЖА|ШКІРА', text: 'Шкіра, висипання, свербіж' },
      { val: 'МОЧЕВЫДЕЛИТЕЛЬНАЯ|СЕЧОВИВІДНА', text: 'Сечовидільна система та нирки' },
      { val: 'ПСИХИКА|ПСИХІКА', text: 'Психіка, емоції, страхи' },
      { val: 'ЛИХОРАДКА|ЛИХОМАНКА|ПОТ|ПІТ', text: 'Лихоманка, жар, піт' },
      { val: 'КЛИНИКА|КЛІНІКА', text: 'Клінічні діагнози / нозології' }
    ],
    resetFilters: 'Скинути фільтри',
    quickLabel: 'Швидкі запити:',
    quickQueries: [
      { q: 'ячмінь на правій нижній повіці', text: 'Ячмінь на правій нижній повіці', priority: true },
      { q: 'ячмінь на лівій нижній повіці', text: 'Ячмінь на лівій нижній повіці' },
      { q: 'ячмінь на верхній повіці', text: 'Ячмінь на верхній повіці' },
      { q: 'ячмінь', text: 'Всі згадки про ячмінь' },
      { q: 'біль у попереку що віддає в стегно', text: 'Біль у попереку що віддає в стегно' },
      { q: 'сухий гавкаючий кашель', text: 'Сухий гавкаючий кашель' },
      { q: 'запаморочення при вставанні', text: 'Запаморочення при вставанні' },
      { q: 'ревматизм', text: 'Ревматизм' }
    ],
    statusLoading: 'Завантаження бази даних...',
    statusInit: 'Ініціалізація гомеопатичної бази даних...',
    statusEmpty: 'Введіть будь-який симптом, орган чи виберіть модальності для пошуку...',
    statusNotFound: 'За вашим запитом нічого не знайдено. Спробуйте змінити модальності або слова.',
    statusFound: 'Знайдено <span class="results-count">{count}</span> препаратів ({time} мс). Перші позиції — найбільш релевантні:',
    cardRankTop: '#1 ТОЧНИЙ ЗБІГ',
    cardExactMatch: 'Найвища відповідність симптому',
    cardRubric: 'Рубрика:',
    cardBtnDetails: 'Повний опис препарату',
    cardWorseTag: 'Гірше:',
    cardBetterTag: 'Краще:',
    modalLoading: 'Завантаження...',
    modalCommonName: 'Народна / ботанічна назва:',
    modalSynonyms: 'Синоніми:',
    modalIntro: 'Опис і технологія приготування',
    modalSource: 'Джерело:',
    modalClose: 'Закрити',
    modalError: 'Не вдалося відкрити опис:',
    modalSearchPlaceholder: 'Шукати симптоми у цьому описі...',
    modalCatAll: 'Всі рубрики',
    modalCatMind: 'Психіка',
    modalCatHead: 'Голова & Очі',
    modalCatResp: 'Дихання',
    modalCatDigest: 'Травлення',
    modalCatBack: 'Спина & Суглоби',
    modalCatSkin: 'Шкіра',
    modalCatMod: 'Модальності',
    modalCatClin: 'Клініка',
    menuBtn: 'Меню',
    menuBtnTitle: 'Меню та налаштування',
    menuLangTitle: 'Мова сайту',
    menuDlTitle: 'База даних',
    menuDlDb: 'Завантажити базу даних',
    menuDlDbSub: 'SQLite, JSON, CSV (UA / RU)',
    menuInfo: '<strong>Materia Medica</strong> — 341 препарат, 11 771 симптом. Працює автономно на GitHub Pages.',
    searchPlaceholder: 'Введіть симптом або назву препарату (напр. ячмінь, Aconitum, Арніка)...',
    suggHeaderRemedies: 'Препарати за запитом "{q}" ({n}):',
    suggCatalogTitle: 'Каталог усіх препаратів (341):',
    suggReadRemedy: 'Читати опис →',
    suggFooterHint: 'Натисніть на препарат для опису, або Enter для пошуку симптомів',
    btnCatalogTitle: 'Каталог усіх 341 препаратів',
    btnCatalogTextFull: 'Препарати',
    catalogFilterPlaceholder: 'Пошук серед 341 препаратів...',
    txtRemediesCount: 'препаратів',
    menuCatHeader: 'Каталог',
    menuCatalogTitle: 'Каталог препаратів (341)',
    menuCatalogSub: 'Швидкий вибір та опис за назвою',
    downloadMenuBtn: 'Завантажити БД',
    downloadMenuBadge: 'SQLite • JSON • CSV',
    dlModalTitle: 'Завантаження бази даних',
    dlModalSubtitle: 'Оберіть мову вмісту та необхідний формат бази даних для автономної роботи:',
    lblDlDbLang: 'Мова даних у базі:',
    dlLangUaTitle: 'Українська версія',
    dlLangUaDesc: '341 препарат, 100% переклад усіх 11 771 симптомів',
    dlLangRuTitle: 'Русская версия',
    dlLangRuDesc: '341 препарат, оригінальний текст Кларка',
    dlCardTitleSqlite: 'SQLite База даних (.db)',
    dlCardDescSqlite: 'Повна реляційна база з 23 полями та 11 771 рубрикою. Включає повнотекстовий індекс FTS5 (unicode61). Сумісна з Python, DB Browser for SQLite, DBeaver.',
    dlCardTitleJson: 'JSON Датасет (.json)',
    dlCardDescJson: 'Повний структурований масив усіх 341 препаратів з ієрархією рубрик, синонімами, модальностями та симптомами. Зручно для вебу, парсерів та штучного інтелекту.',
    dlCardTitleCsv: 'CSV Таблиця (.csv)',
    dlCardDescCsv: '11 771 рядок рубрик і симптомів у кодуванні UTF-8 (id, latin_name, cyrillic_name, common_name, section, content). Готова до відкриття в Excel або Google Таблицях.',
    txtBtnDlSqlite: 'Завантажити .db',
    txtBtnDlJson: 'Завантажити .json',
    txtBtnDlCsv: 'Завантажити .csv',
    txtDlCliTitle: 'Швидкий пошук у терміналі (CLI):',
    dlFootnote: 'Усі файли відкриті для некомерційного використання. Джерело: архів Materia Medica Джона Генрі Кларка (homeopat-sam.com).',
    copyQuoteBtn: 'Цитата',
    toastQuoteCopied: 'Цитату симптому скопійовано!',
    activeFiltersTitle: 'Активні фільтри:',
    activeFilterReset: 'Скинути все',
    btnSearchSubmit: 'Знайти',
    btnSearchTitle: 'Шукати'
  },
  ru: {
    pageTitle: 'Materia Medica — Поисковый Реперторий (Джон Генри Кларк)',
    pageDescription: 'База данных гомеопатических препаратов Materia Medica с полнотекстовым умным поиском симптомов и модальностей. Работает на GitHub Pages.',
    headerTitle: 'Materia Medica',
    headerSubtitle: 'Поисковый гомеопатический реперторий: 341 препарат, 11 770+ симптомов по фундаментальному труду <em>Джона Генри Кларка</em>.',
    dlDb: 'База SQLite (.db)',
    dlJson: 'Данные JSON (.json)',
    dlCsv: 'Таблица CSV (.csv)',
    dlDbTitle: 'Скачать базу данных SQLite',
    dlJsonTitle: 'Скачать полный файл JSON',
    dlCsvTitle: 'Скачать таблицу CSV для Excel',
    dlDbFile: 'materia_medica_ru.db',
    dlJsonFile: 'materia_medica_ru.json',
    dlCsvFile: 'materia_medica_ru.csv',
    searchPlaceholder: 'Введите симптом, например: ячмень на правом нижнем веке, боль в пояснице...',
    btnClearTitle: 'Очистить',
    advToggle: 'Расширенный поиск и модальности',
    lblWorse: 'Ухудшение (хуже от):',
    lblBetter: 'Улучшение (лучше от):',
    worseChips: [
      { id: 'холод', label: 'Холода', stem: 'холод' },
      { id: 'тепло', label: 'Тепла', stem: 'тепл' },
      { id: 'сирість', label: 'Сырости', stem: 'сырост' },
      { id: 'протяг', label: 'Сквозняка / ветра', stem: 'сквозняк' },
      { id: 'сонце', label: 'Солнца / жары', stem: 'солн' },
      { id: 'рух', label: 'Движения', stem: 'движен' },
      { id: 'ходьба', label: 'При ходьбе', stem: 'ходьб' },
      { id: 'спокій', label: 'Покоя', stem: 'поко' },
      { id: 'лежачи', label: 'Лежа', stem: 'лежа' },
      { id: 'сидячи', label: 'Сидя', stem: 'сидя' },
      { id: 'ніч', label: 'Ночью', stem: 'ноч' },
      { id: 'ранок', label: 'Утром', stem: 'утр' },
      { id: 'вечір', label: 'Вечером', stem: 'вечер' },
      { id: 'дотик', label: 'Прикосновения', stem: 'прикосновен' },
      { id: 'їжа', label: 'После еды', stem: 'ед' },
      { id: 'кава', label: 'Кофе', stem: 'кофе' },
      { id: 'алкоголь', label: 'Алкоголя / вина', stem: 'вин' },
      { id: 'купання', label: 'Купания / воды', stem: 'купан' },
      { id: 'гроза', label: 'Перед грозой', stem: 'гроз' },
      { id: 'розмова', label: 'Разговора', stem: 'разговор' }
    ],
    betterChips: [
      { id: 'тепло', label: 'Тепла', stem: 'тепл' },
      { id: 'холод', label: 'Холода', stem: 'холод' },
      { id: 'повітря', label: 'Свежего воздуха', stem: 'воздух' },
      { id: 'спокій', label: 'Покоя', stem: 'поко' },
      { id: 'рух', label: 'Движения', stem: 'движен' },
      { id: 'ходьба', label: 'При ходьбе', stem: 'ходьб' },
      { id: 'лежачи', label: 'Лежа', stem: 'лежа' },
      { id: 'тиск', label: 'Надавливания / давления', stem: 'давлен' },
      { id: 'розтирання', label: 'Растирания / массажа', stem: 'растиран' },
      { id: 'сон', label: 'После сна', stem: 'сна' },
      { id: 'їжа', label: 'После еды', stem: 'ед' },
      { id: 'холодне_пиття', label: 'Холодного питья', stem: 'холодн' },
      { id: 'піт', label: 'Выделения пота', stem: 'пот' },
      { id: 'відрижка', label: 'Отхождения газов', stem: 'отрыжк' }
    ],
    inputWorsePlaceholder: 'Свое ухудшение (напр. сквозняк, в 3 ночи, купание)...',
    inputBetterPlaceholder: 'Свое улучшение (напр. горячий чай, лежа на боку)...',
    lblSection: 'Рубрика / Орган:',
    sections: [
      { val: '', text: 'Все органы и разделы' },
      { val: 'ОЧІ|ГЛАЗА', text: 'Глаза и зрение' },
      { val: 'ГОЛОВА', text: 'Голова, мозг, головокружение' },
      { val: 'ДИХАЛЬНА|ДЫХАТЕЛЬНАЯ|КАШЕЛЬ', text: 'Дыхательная система, кашель, грудь' },
      { val: 'СЕРЦЕ|СЕРДЦЕ', text: 'Сердце и кровообращение' },
      { val: 'ЖЕЛУДОК|ШЛУНОК|ЖКТ|ЖИВОТ', text: 'Желудок, живот, пищеварение' },
      { val: 'СПИНА|ПОЗВОНОЧНИК|ХРЕБЕТ', text: 'Спина, позвоночник, поясница' },
      { val: "СУСТАВЫ|СУГЛОБИ|МЫШЦЫ|М'ЯЗИ|КОНЕЧНОСТИ|КІНЦІВКИ", text: 'Мышцы, суставы, конечности' },
      { val: 'КОЖА|ШКІРА', text: 'Кожа, высыпания, зуд' },
      { val: 'МОЧЕВЫДЕЛИТЕЛЬНАЯ|СЕЧОВИВІДНА', text: 'Мочевыделительная система и почки' },
      { val: 'ПСИХИКА|ПСИХІКА', text: 'Психика, эмоции, страхи' },
      { val: 'ЛИХОРАДКА|ЛИХОМАНКА|ПОТ|ПІТ', text: 'Лихорадка, жар, пот' },
      { val: 'КЛИНИКА|КЛІНІКА', text: 'Клинические диагнозы / нозологии' }
    ],
    resetFilters: 'Сбросить фильтры',
    quickLabel: 'Быстрые запросы:',
    quickQueries: [
      { q: 'ячмень на правом нижнем веке', text: 'Ячмень на правом нижнем веке', priority: true },
      { q: 'ячмень на левом нижнем веке', text: 'Ячмень на левом нижнем веке' },
      { q: 'ячмень на верхнем веке', text: 'Ячмень на верхнем веке' },
      { q: 'ячмень', text: 'Все упоминания о ячмене' },
      { q: 'боль в пояснице отдающая в бедро', text: 'Боль в пояснице отдающая в бедро' },
      { q: 'сухой лающий кашель', text: 'Сухой лающий кашель' },
      { q: 'головокружение при вставании', text: 'Головокружение при вставании' },
      { q: 'ревматизм', text: 'Ревматизм' }
    ],
    statusLoading: 'Загрузка базы данных...',
    statusInit: 'Инициализация гомеопатической базы данных...',
    statusEmpty: 'Введите любой симптом, орган или выберите модальности для поиска...',
    statusNotFound: 'По вашему запросу ничего не найдено. Попробуйте изменить модальности или слова.',
    statusFound: 'Найдено <span class="results-count">{count}</span> препаратов ({time} мс). Первые позиции — наиболее релевантные:',
    cardRankTop: '#1 ТОЧНОЕ СОВПАДЕНИЕ',
    cardExactMatch: 'Наивысшее соответствие симптому',
    cardRubric: 'Рубрика:',
    cardBtnDetails: 'Полное описание препарата',
    cardWorseTag: 'Хуже:',
    cardBetterTag: 'Лучше:',
    modalLoading: 'Загрузка...',
    modalCommonName: 'Народное / ботаническое название:',
    modalSynonyms: 'Синонимы:',
    modalIntro: 'Описание и технология приготовления',
    modalSource: 'Источник:',
    modalClose: 'Закрыть',
    modalError: 'Не удалось открыть описание:',
    modalSearchPlaceholder: 'Искать симптомы в этом описании...',
    modalCatAll: 'Все рубрики',
    modalCatMind: 'Психика',
    modalCatHead: 'Голова и Глаза',
    modalCatResp: 'Дыхание',
    modalCatDigest: 'Пищеварение',
    modalCatBack: 'Спина и Суставы',
    modalCatSkin: 'Кожа',
    modalCatMod: 'Модальности',
    modalCatClin: 'Клиника',
    menuBtn: 'Меню',
    menuBtnTitle: 'Меню и настройки',
    menuLangTitle: 'Язык сайта',
    menuDlTitle: 'База данных',
    menuDlDb: 'Скачать базу данных',
    menuDlDbSub: 'SQLite, JSON, CSV (UA / RU)',
    menuInfo: '<strong>Materia Medica</strong> — 341 препарат, 11 771 симптом. Работает автономно на GitHub Pages.',
    searchPlaceholder: 'Введите симптом или название препарата (напр. ячмень, Aconitum, Арника)...',
    suggHeaderRemedies: 'Препараты по запросу "{q}" ({n}):',
    suggCatalogTitle: 'Каталог всех препаратов (341):',
    suggReadRemedy: 'Читать описание →',
    suggFooterHint: 'Нажмите на препарат для описания, или Enter для поиска симптомов',
    btnCatalogTitle: 'Каталог всех 341 препаратов',
    btnCatalogTextFull: 'Препараты',
    catalogFilterPlaceholder: 'Поиск среди 341 препаратов...',
    txtRemediesCount: 'препаратов',
    menuCatHeader: 'Каталог',
    menuCatalogTitle: 'Каталог препаратов (341)',
    menuCatalogSub: 'Быстрый выбор и описание по названию',
    downloadMenuBtn: 'Скачать БД',
    downloadMenuBadge: 'SQLite • JSON • CSV',
    dlModalTitle: 'Скачивание базы данных',
    dlModalSubtitle: 'Выберите язык содержимого и необходимый формат базы данных для автономной работы:',
    lblDlDbLang: 'Язык данных в базе:',
    dlLangUaTitle: 'Украинская версия',
    dlLangUaDesc: '341 препарат, 100% перевод всех 11 771 симптомов',
    dlLangRuTitle: 'Русская версия',
    dlLangRuDesc: '341 препарат, оригинальный текст Кларка',
    dlCardTitleSqlite: 'SQLite База данных (.db)',
    dlCardDescSqlite: 'Полная реляционная база с 23 полями и 11 771 рубрикой. Включает полнотекстовый индекс FTS5 (unicode61). Совместима с Python, DB Browser for SQLite, DBeaver.',
    dlCardTitleJson: 'JSON Датасет (.json)',
    dlCardDescJson: 'Полный структурированный массив всех 341 препаратов с иерархией рубрик, синонимами, модальностями и симптомами. Удобно для веба, парсеров и ИИ.',
    dlCardTitleCsv: 'CSV Таблица (.csv)',
    dlCardDescCsv: '11 771 строка рубрик и симптомов в кодировке UTF-8 (id, latin_name, cyrillic_name, common_name, section, content). Готова к открытию в Excel или Google Таблицах.',
    txtBtnDlSqlite: 'Скачать .db',
    txtBtnDlJson: 'Скачать .json',
    txtBtnDlCsv: 'Скачать .csv',
    txtDlCliTitle: 'Быстрый поиск в терминале (CLI):',
    dlFootnote: 'Все файлы открыты для некоммерческого использования. Источник: архив Materia Medica Джона Генри Кларка (homeopat-sam.com).',
    copyQuoteBtn: 'Цитата',
    toastQuoteCopied: 'Цитата скопирована в буфер обмена!',
    activeFiltersTitle: 'Активные фильтры:',
    activeFilterReset: 'Сбросить все',
    btnSearchSubmit: 'Найти',
    btnSearchTitle: 'Искать'
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
  let w = word.toLowerCase().trim().replace(/[’ʼ]/g, "'");
  if (w.length <= 2) return w;

  // Alternations
  w = w.replace(/мінь$/g, 'мен');
  w = w.replace(/біль$/g, 'бол');
  w = w.replace(/кашель$/g, 'кашл');
  w = w.replace(/палець$/g, 'пальц');
  w = w.replace(/живіт$/g, 'живот');
  w = w.replace(/очі$/g, 'оч');
  w = w.replace(/око$/g, 'ок');
  w = w.replace(/вусі$/g, 'вух');
  w = w.replace(/нозі$/g, 'ног');
  w = w.replace(/руці$/g, 'рук');
  w = w.replace(/щоці$/g, 'щок');
  w = w.replace(/повіці$/g, 'повік');
  w = w.replace(/печінці$/g, 'печінк');
  w = w.replace(/нирці$/g, 'нирк');

  w = w.replace(/(увального|увальному|увальний|увальна|увальне|увальні|увальних|увальними|увальник|ування|уванні|увань|уючий|уюча|уюче|уючі|уючих|уючими|уючим|ючий|юча|юче|ючі|ючих|ючими|ючим|ячий|яча|яче|ячі|ячих|ячими|ячим|ачий|ача|аче|ачі|ачих|ачими|ачим|ому|ими|ого|ою|ею|ям|ами|ях|ах|ів|ей|ий|ій|им|ім|ати|яти|увати|ювати|ються|ється|тися|лося|лася|лось|лись|уть|ють|ять|ить|ешь|ете|имо|емо|ємо|ння|ення|ість|ості|істю|івна|ович|а|я|у|ю|е|є|і|и|о|й)$/g, '');
  if (w.endsWith('ц') && w.length > 3) {
    w = w.slice(0, -1) + 'к';
  }
  return w;
}

function stemRussian(word) {
  let w = word.toLowerCase().trim();
  if (w.length <= 2) return w;

  w = w.replace(/кашель$/g, 'кашл');
  w = w.replace(/палец$/g, 'пальц');

  w = w.replace(/(ующего|ующему|ующим|ующих|ующем|ующая|ующее|ующие|ующей|ующею|ующую|ующий|ющего|ющему|ющим|ющих|ющем|ющая|ющее|щие|щей|щею|щую|щий|ящего|ящему|ящим|ящих|ящем|ящая|ящее|ящие|ящей|ящею|ящую|ящий|ащего|ащему|ащим|ащих|ащем|ащая|ащее|ащие|ащей|ащею|ащую|ащий|ившего|ившему|ившим|ивших|ившем|ившая|ившее|ившие|ившей|ившею|ившую|ивший|авшего|авшему|авшим|авших|авшем|авшая|авшее|авшие|авшей|авшею|авшую|авший|явшего|явшему|явшим|явших|явшем|явшая|явшее|явшие|явшей|явшею|явшую|явший|ому|ыми|ими|ого|его|ему|ых|их|ую|юю|ою|ею|ям|ами|ях|ах|ов|ев|ей|ий|ый|ой|ем|им|ам|ать|ять|еть|ить|уть|ишь|ешь|ете|ите|ут|ют|ат|ят|ет|ит|ся|сь|ло|ла|ли|лось|лась|лись|ение|ения|ением|ость|ости|остью|а|я|у|ю|е|и|ы|о)$/g, '');
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
  'век': ['век', 'повік', 'повіц'],
  'оч': ['оч', 'ок', 'глаз'],
  'ок': ['оч', 'ок', 'глаз'],
  'глаз': ['глаз', 'оч', 'ок'],
  'зіниц': ['зрачок', 'зрачк'],
  'сльозотеч': ['слезотечен', 'слез'],
  'світлобоязн': ['светобоязн', 'свет'],
  'халязіон': ['халазион'],
  'прав': ['прав'],
  'лів': ['лів', 'лев'],
  'лев': ['лев', 'лів'],
  'верхн': ['верхн'],
  'нижн': ['нижн'],

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
  'колюч': ['колющ', 'кол', 'коле', 'колюч'],
  'колющ': ['колющ', 'колюч', 'кол', 'коле'],
  'кол': ['кол', 'колюч', 'колющ', 'коле'],
  'пекуч': ['жгуч', 'жжен'],
  'ніюч': ['ноющ', 'ной'],
  'стріл': ['стріл', 'стрел', 'стріля', 'стреля', 'стріляюч', 'стреляющ'],
  'стрел': ['стрел', 'стріл', 'стреля', 'стріля', 'стреляющ', 'стріляюч'],
  'стріля': ['стріля', 'стреля', 'стріл', 'стрел', 'стріляюч', 'стреляющ'],
  'стреля': ['стреля', 'стріля', 'стрел', 'стріл', 'стреляющ', 'стріляюч'],
  'стріляюч': ['стреляющ', 'стрел', 'стріл', 'стріля'],
  'стискаюч': ['сжимающ', 'сжим'],
  'розпираюч': ['распирающ', 'распир'],
  'тягнуч': ['тянущ', 'тян', 'тягн'],
  'тян': ['тян', 'тягн', 'тянущ', 'тягнуч'],
  'тягн': ['тягн', 'тян', 'тягнуч', 'тянущ'],
  'дав': ['дав', 'давит', 'тиск', 'давлен', 'надавл'],
  'онімін': ['онеменен', 'неме'],
  'поколюван': ['покалыван', 'кол'],
  'свербіж': ['зуд', 'чес'],
  'зуд': ['зуд', 'свербіж'],
  'тремтін': ['дрожь', 'дрож'],
  'судом': ['судорог', 'спазм'],
  'слабк': ['слабост', 'слаб', 'упадок'],
  'виснажен': ['истощен'],
  'втом': ['усталост', 'утомлен'],
  'відда': ['відда', 'отда', 'ірраді', 'ирради'],
  'отда': ['отда', 'відда', 'ирради', 'ірраді'],

  // Respiratory & Throat
  'задишк': ['одышк', 'удушь', 'дыхан', 'дихан'],
  'задух': ['удушь', 'одышк', 'дыхан', 'дихан'],
  'одышк': ['одышк', 'удушь', 'задишк', 'дыхан', 'дихан'],
  'кашл': ['кашл', 'кашел'],
  'кашел': ['кашл', 'кашел'],
  'гавк': ['гавк', 'лающ', 'лаю'],
  'лающ': ['лающ', 'гавк', 'лаю'],
  'лаю': ['лаю', 'лающ', 'гавк'],
  'хрип': ['хрип', 'охрип', 'сип', 'осип', 'хрипл', 'хриплы'],
  'сип': ['сип', 'осип', 'хрип', 'охрип'],
  'мокрот': ['мокрот', 'харкотин'],
  'харкотин': ['харкотин', 'мокрот'],
  'горл': ['горл', 'глотк', 'гортан'],
  'мигдалик': ['миндалин'],
  'леген': ['легк'],
  'груд': ['груд'],
  'сух': ['сух'],

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
  'поясниц': ['поясниц', 'поперек', 'крестц'],
  'хребет': ['позвоночник', 'позвоноч', 'хребт'],
  'позвоноч': ['позвоноч', 'хребет', 'хребт'],
  'куприк': ['копчик'],
  'суглоб': ['сустав'],
  'сустав': ['сустав', 'суглоб'],
  "м'яз": ["м'яз", 'мяз', 'мышц', 'м яз'],
  'мяз': ['мяз', "м'яз", 'мышц', 'м яз'],
  'мышц': ['мышц', "м'яз", 'мяз', 'м яз'],
  'кістк': ['кост'],
  'кост': ['кост', 'кістк'],
  'стегн': ['стегн', 'бедр'],
  'бедр': ['бедр', 'стегн'],
  'колін': ['колен'],
  'литок': ['икр'],
  'стоп': ['стоп'],
  "п'ят": ["п'ят", 'пят', 'пятк'],
  'пят': ['пят', "п'ят", 'пятк'],
  'пятк': ['пятк', "п'ят", 'пят'],
  'кінцівк': ['конечност'],
  'рук': ['рук'],
  'пальц': ['пальц'],

  // Kidneys & Urinary
  'нирк': ['нирк', 'почк'],
  'почк': ['почк', 'нирк'],
  'сеч': ['сеч', 'моч'],
  'моч': ['моч', 'сеч'],

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
  'веч': ['вечер', 'веч', 'сумерк', 'сутінк'],
  'вечер': ['веч', 'вечер', 'сумерк', 'сутінк'],
  'сир': ['сырост', 'влаг', 'дожд', 'сир'],
  'сырост': ['сир', 'влаг', 'дожд'],
  'дотик': ['прикосновен', 'дотик'],
  'прикосновен': ['дотик', 'прикосновен'],
  'повітр': ['воздух', 'повітр'],
  'воздух': ['повітр', 'воздух'],
  'тиск': ['давлен', 'надавл', 'тиск', 'дав'],
  'давлен': ['тиск', 'надавл', 'давлен', 'дав'],
  'лежа': ['лежа', 'постел', 'ліжк'],
  'сидя': ['сидя', 'сиден'],
  'протяг': ['сквозняк', 'протяг', 'ветер', 'вітр'],
  'сквозняк': ['протяг', 'сквозняк', 'ветер', 'вітр'],
  'сонц': ['солн', 'сонц', 'жар', 'зной', 'спек'],
  'солн': ['сонц', 'солн', 'жар', 'зной', 'спек'],
  'ходьб': ['ходьб', 'ход', 'шаг'],
  'растиран': ['розтиран', 'растиран', 'массаж', 'масаж'],
  'розтиран': ['растиран', 'розтиран', 'массаж', 'масаж'],
  'кав': ['кофе', 'кав'],
  'кофе': ['кав', 'кофе'],
  'вин': ['алког', 'вин', 'водк', 'пив'],
  'алког': ['вин', 'алког', 'водк', 'пив'],
  'купан': ['купан', 'вод', 'ванн'],
  'гроз': ['гроз', 'бур'],
  'розмов': ['разговор', 'розмов', 'реч', 'мовл'],
  'разговор': ['розмов', 'разговор', 'реч', 'мовл'],
  'газ': ['газ', 'отрыжк', 'відрижк', 'метеоризм', 'здутт'],
  'відрижк': ['газ', 'отрыжк', 'відрижк'],
  'отрыжк': ['газ', 'відрижк', 'отрыжк'],
  'пот': ['пот', 'піт', 'испарин'],
  'піт': ['пот', 'піт', 'испарин'],
  'сон': ['сон', 'сн', 'сна', 'сну', 'сні'],
  'сн': ['сон', 'сн', 'сна', 'сну', 'сні']
};

function expandWordToPatterns(word) {
  const wLower = word.toLowerCase().trim().replace(/[’ʼ]/g, "'");
  if (wLower.length <= 1) return [];

  const stUa = stemUkrainian(wLower);
  const stRu = stemRussian(wLower);
  const st = stUa.length <= stRu.length ? stUa : stRu;

  const stNorm = normalizeCyrillic(st);
  const equivs = new Set([wLower, st, stNorm, stUa, stRu]);

  if (wLower.includes("'")) {
    equivs.add(wLower.replace(/'/g, ''));
    equivs.add(wLower.replace(/'/g, ' '));
  }
  if (st.includes("'")) {
    equivs.add(st.replace(/'/g, ''));
    equivs.add(st.replace(/'/g, ' '));
  }

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
    const keyMatch = st === key || stUa === key || stRu === key ||
                     st.startsWith(key) ||
                     (st.length >= 4 && key.startsWith(st));
    if (keyMatch) {
      list.forEach(item => {
        equivs.add(item);
        equivs.add(normalizeCyrillic(item));
      });
    }
  }

  return Array.from(equivs).filter(p => p.length >= 2);
}

function expandQueryToConcepts(query) {
  const normalizedQuery = (query || '').replace(/[’ʼ]/g, "'");
  const words = normalizedQuery.match(/[A-Za-zА-Яа-яІіЇїЄєҐґ0-9']+/g) || [];
  const concepts = [];
  const stopWords = new Set(['в', 'у', 'на', 'та', 'і', 'й', 'до', 'від', 'при', 'що', 'як', 'під', 'час', 'для', 'по', 'за', 'над', 'из', 'от', 'к', 'с', 'со', 'о', 'об']);

  for (const rawW of words) {
    const w = rawW.replace(/^'+|'+$/g, '');
    if (w.length <= 1) continue;
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
  const sentences = text.replace(/([.;!?])\s+/g, '$1\n').split('\n');
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

        const sentences = secText.replace(/\n+/g, ' ').replace(/([.?!])\s+/g, '$1\n').split('\n');

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
            const matchesSecConcept = concepts.some(c =>
              c.patterns.some(p => p.length >= 3 && sUpper.includes(p.toUpperCase()))
            );
            if (matchesSecConcept || ((sUpper.includes('ОЧ') || sUpper.includes('ГЛАЗ')) && (qTrim.includes('оч') || qTrim.includes('повік') || qTrim.includes('повіц') || qTrim.includes('ячм') || qTrim.includes('век') || qTrim.includes('ячмен')))) {
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

    if (hasQuery && bestScore === 0 && remedy.clin && (!sectionFilterRegex || sectionFilterRegex.test('КЛІНІКА') || sectionFilterRegex.test('КЛИНИКА'))) {
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

  const sorted = [...new Set(matchedPatterns || [])]
    .filter(p => p && p.length >= 2)
    .sort((a, b) => b.length - a.length);

  if (sorted.length === 0) return safe;

  const escaped = sorted.map(p => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  try {
    const regex = new RegExp(`(^|[^а-яёїієґa-z0-9])(${escaped.join('|')}[а-яёїієґa-z0-9'’]*)`, 'gi');
    return safe.replace(regex, (match, pfx, word) => `${pfx}<mark class="hl-primary">${word}</mark>`);
  } catch (e) {
    return safe;
  }
}

// ==========================================
// 7. UI LOCALIZATION & SWITCHING
// ==========================================
function updateUILanguage() {
  const t = I18N[currentLang];
  document.title = t.pageTitle;
  document.documentElement.lang = currentLang === 'ua' ? 'uk' : 'ru';

  const metaDesc = document.querySelector('meta[name="description"]');
  if (metaDesc && t.pageDescription) {
    metaDesc.setAttribute('content', t.pageDescription);
  }

  const titleEl = document.getElementById('headerTitle');
  if (titleEl) titleEl.innerHTML = t.headerTitle;
  const subEl = document.getElementById('headerSubtitle');
  if (subEl) subEl.innerHTML = t.headerSubtitle;


  // Header Dropdown Menu Localization
  const btnHeaderMenu = document.getElementById('btnHeaderMenu');
  if (btnHeaderMenu) {
    const mTitle = t.menuBtnTitle || t.menuBtn || 'Меню';
    btnHeaderMenu.title = mTitle;
    btnHeaderMenu.setAttribute('aria-label', mTitle);
  }
  const txtMenuLangTitle = document.getElementById('txtMenuLangTitle');
  if (txtMenuLangTitle && t.menuLangTitle) txtMenuLangTitle.innerText = t.menuLangTitle;
  const txtMenuDlTitle = document.getElementById('txtMenuDlTitle');
  if (txtMenuDlTitle && t.menuDlTitle) txtMenuDlTitle.innerText = t.menuDlTitle;
  const txtMenuDlDb = document.getElementById('txtMenuDlDb');
  if (txtMenuDlDb && t.menuDlDb) txtMenuDlDb.innerText = t.menuDlDb;

  // Unified search box & catalog button localization
  const searchInputEl = document.getElementById('searchInput');
  if (searchInputEl && t.searchPlaceholder) searchInputEl.placeholder = t.searchPlaceholder;
  const btnCatalog = document.getElementById('btnCatalogDropdown');
  if (btnCatalog && t.btnCatalogTitle) {
    btnCatalog.title = t.btnCatalogTitle;
    btnCatalog.setAttribute('aria-label', t.btnCatalogTitle);
  }
  const btnCatalogText = btnCatalog ? btnCatalog.querySelector('.btn-catalog-text-full') : null;
  if (btnCatalogText && t.btnCatalogTextFull) btnCatalogText.innerText = t.btnCatalogTextFull;

  updateDownloadModalTexts();
  updateDownloadModalFiles(downloadModalLang);

  const searchInput = document.getElementById('searchInput');
  if (searchInput) searchInput.placeholder = t.searchPlaceholder;

  const btnClear = document.getElementById('btnClear');
  if (btnClear && t.btnClearTitle) {
    btnClear.title = t.btnClearTitle;
    btnClear.setAttribute('aria-label', t.btnClearTitle);
  }

  const btnSearchSubmit = document.getElementById('btnSearchSubmit');
  if (btnSearchSubmit && t.btnSearchSubmit) {
    btnSearchSubmit.innerText = t.btnSearchSubmit;
    btnSearchSubmit.title = t.btnSearchTitle || t.btnSearchSubmit;
    btnSearchSubmit.setAttribute('aria-label', t.btnSearchTitle || t.btnSearchSubmit);
  }

  const btnSearchIcon = document.getElementById('btnSearchIcon');
  if (btnSearchIcon && t.btnSearchTitle) {
    btnSearchIcon.title = t.btnSearchTitle;
    btnSearchIcon.setAttribute('aria-label', t.btnSearchTitle);
  }

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
    btnUa.setAttribute('aria-pressed', currentLang === 'ua' ? 'true' : 'false');
    btnRu.setAttribute('aria-pressed', currentLang === 'ru' ? 'true' : 'false');
  }

  const selectSection = document.getElementById('selectSection');
  if (selectSection) {
    const curVal = selectSection.value;
    selectSection.innerHTML = t.sections.map(s => `
      <option value="${s.val}" ${s.val === curVal ? 'selected' : ''}>${s.text}</option>
    `).join('');
  }

  renderModalityChips();
  updateFiltersBadge();

  const modalCloseBtn = document.getElementById('modalCloseBtn');
  if (modalCloseBtn && t.modalClose) {
    modalCloseBtn.setAttribute('aria-label', t.modalClose);
    modalCloseBtn.title = t.modalClose;
  }

  updateActiveFiltersStrip();
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
      updateActiveFiltersStrip();
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

function updateActiveFiltersStrip() {
  const strip = document.getElementById('activeFiltersStrip');
  if (!strip) return;
  const t = I18N[currentLang];

  const hasFilters = filterState.worseChips.size > 0 ||
                     filterState.betterChips.size > 0 ||
                     Boolean(filterState.worseCustom.trim()) ||
                     Boolean(filterState.betterCustom.trim()) ||
                     Boolean(filterState.section);

  if (!hasFilters) {
    strip.style.display = 'none';
    strip.innerHTML = '';
    return;
  }

  strip.style.display = 'flex';
  let html = `<span class="active-filter-label">${t.activeFiltersTitle || 'Активні фільтри:'}</span>`;

  for (const cid of filterState.worseChips) {
    const chipDef = t.worseChips.find(c => c.id === cid);
    const label = chipDef ? chipDef.label : cid;
    html += `<button type="button" class="active-filter-pill is-worse" onclick="toggleWorseChip('${escapeHtml(cid)}')">${escapeHtml(label)} <span class="pill-remove">✕</span></button>`;
  }

  for (const cid of filterState.betterChips) {
    const chipDef = t.betterChips.find(c => c.id === cid);
    const label = chipDef ? chipDef.label : cid;
    html += `<button type="button" class="active-filter-pill is-better" onclick="toggleBetterChip('${escapeHtml(cid)}')">${escapeHtml(label)} <span class="pill-remove">✕</span></button>`;
  }

  if (filterState.worseCustom.trim()) {
    html += `<button type="button" class="active-filter-pill is-worse" onclick="clearCustomWorse()">${escapeHtml(filterState.worseCustom.trim())} <span class="pill-remove">✕</span></button>`;
  }

  if (filterState.betterCustom.trim()) {
    html += `<button type="button" class="active-filter-pill is-better" onclick="clearCustomBetter()">${escapeHtml(filterState.betterCustom.trim())} <span class="pill-remove">✕</span></button>`;
  }

  if (filterState.section) {
    const secDef = t.sections.find(s => s.val === filterState.section);
    const label = secDef ? secDef.text : filterState.section;
    html += `<button type="button" class="active-filter-pill is-sec" onclick="clearSectionFilter()">${escapeHtml(label)} <span class="pill-remove">✕</span></button>`;
  }

  html += `<button type="button" class="active-filter-pill" onclick="resetAllFilters()">${t.activeFilterReset || 'Скинути все'} ✕</button>`;
  strip.innerHTML = html;
}

function toggleWorseChip(cid) {
  if (filterState.worseChips.has(cid)) {
    filterState.worseChips.delete(cid);
  } else {
    filterState.worseChips.add(cid);
  }
  renderModalityChips();
  updateFiltersBadge();
  updateActiveFiltersStrip();
  const input = document.getElementById('searchInput');
  runSearch(input ? input.value : '');
}

function toggleBetterChip(cid) {
  if (filterState.betterChips.has(cid)) {
    filterState.betterChips.delete(cid);
  } else {
    filterState.betterChips.add(cid);
  }
  renderModalityChips();
  updateFiltersBadge();
  updateActiveFiltersStrip();
  const input = document.getElementById('searchInput');
  runSearch(input ? input.value : '');
}

function clearCustomWorse() {
  filterState.worseCustom = '';
  const inW = document.getElementById('inputWorseCustom');
  if (inW) inW.value = '';
  updateFiltersBadge();
  updateActiveFiltersStrip();
  const input = document.getElementById('searchInput');
  runSearch(input ? input.value : '');
}

function clearCustomBetter() {
  filterState.betterCustom = '';
  const inB = document.getElementById('inputBetterCustom');
  if (inB) inB.value = '';
  updateFiltersBadge();
  updateActiveFiltersStrip();
  const input = document.getElementById('searchInput');
  runSearch(input ? input.value : '');
}

function clearSectionFilter() {
  filterState.section = '';
  const selectSec = document.getElementById('selectSection');
  if (selectSec) selectSec.value = '';
  updateFiltersBadge();
  updateActiveFiltersStrip();
  const input = document.getElementById('searchInput');
  runSearch(input ? input.value : '');
}

function resetAllFilters() {
  filterState.worseChips.clear();
  filterState.betterChips.clear();
  filterState.worseCustom = '';
  filterState.betterCustom = '';
  filterState.section = '';

  const inW = document.getElementById('inputWorseCustom');
  if (inW) inW.value = '';
  const inB = document.getElementById('inputBetterCustom');
  if (inB) inB.value = '';
  const selectSec = document.getElementById('selectSection');
  if (selectSec) selectSec.value = '';

  renderModalityChips();
  updateFiltersBadge();
  updateActiveFiltersStrip();
  const input = document.getElementById('searchInput');
  runSearch(input ? input.value : '');
}

// ==========================================
// TOAST & DOWNLOAD MODAL HELPERS
// ==========================================
function showToast(message, duration = 2500) {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerText = message;
  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('toast-out');
    setTimeout(() => toast.remove(), 200);
  }, duration);
}

function toggleTopMenu(forceOpen) {
  const wrapper = document.getElementById('topMenuWrapper');
  const btn = document.getElementById('btnHeaderMenu');
  if (!wrapper) return;
  const shouldOpen = typeof forceOpen === 'boolean' ? forceOpen : !wrapper.classList.contains('open');
  if (shouldOpen) closeHeaderCatalog();
  wrapper.classList.toggle('open', shouldOpen);
  if (btn) btn.setAttribute('aria-expanded', shouldOpen ? 'true' : 'false');
}

function closeTopMenu() {
  toggleTopMenu(false);
}

function renderHeaderCatalog(filterQuery = '') {
  const dropdown = document.getElementById('headerCatalogDropdown');
  if (!dropdown) return;
  const t = I18N[currentLang] || I18N.ua;
  const query = (filterQuery || '').trim();
  const matches = searchRemedyNames(query);

  let html = `
    <div class="header-catalog-search-wrap">
      <input 
        type="text" 
        id="headerCatalogFilterInput" 
        class="header-catalog-filter-input" 
        placeholder="${escapeHtml(t.catalogFilterPlaceholder || 'Пошук серед 341 препаратів...')}" 
        value="${escapeHtml(query)}"
        autocomplete="off"
        autocorrect="off"
        autocapitalize="off"
        spellcheck="false"
      />
    </div>
  `;

  if (matches.length === 0) {
    html += `
      <div style="padding: 1.5rem; text-align: center; color: #64748b; font-size: 0.88rem;">
        <p>${escapeHtml(t.statusNotFound || 'Препарати не знайдені')}</p>
      </div>
    `;
  } else {
    html += `
      <div class="sugg-header">
        <strong>${escapeHtml(t.suggCatalogTitle || 'Каталог усіх препаратів (341):')}</strong>
        <span style="font-size: 0.74rem; color: #64748b;">${matches.length} ${t.txtRemediesCount || 'препаратів'}</span>
      </div>
    `;

    let currentLetter = '';
    for (let i = 0; i < matches.length; i++) {
      const r = matches[i];
      if (!query) {
        const letter = (r.latin || '?')[0].toUpperCase();
        if (letter !== currentLetter) {
          currentLetter = letter;
          html += `<div class="sugg-group-header">— ${escapeHtml(letter)} —</div>`;
        }
      }
      html += `
        <div class="sugg-item" data-id="${r.id}" role="option" aria-selected="false">
          <div class="sugg-main">
            <div class="sugg-title">
              <span class="sugg-latin">${query ? highlightRemedyMatch(r.latin, query) : escapeHtml(r.latin)}</span>
              ${r.cyr ? `<span class="sugg-cyr">(${query ? highlightRemedyMatch(r.cyr, query) : escapeHtml(r.cyr)})</span>` : ''}
            </div>
            ${r.common ? `<div class="sugg-common">${query ? highlightRemedyMatch(r.common, query) : escapeHtml(r.common)}</div>` : ''}
          </div>
          <span class="sugg-action-badge">${escapeHtml(t.suggReadRemedy || 'Читати опис →')}</span>
        </div>
      `;
    }
    html += `<div class="sugg-footer"><span>Усі ${matches.length} препаратів</span></div>`;
  }

  dropdown.innerHTML = html;

  // Filter input event listeners
  const filterInput = document.getElementById('headerCatalogFilterInput');
  if (filterInput) {
    filterInput.addEventListener('input', (e) => {
      const val = e.target.value;
      renderHeaderCatalog(val);
      const updated = document.getElementById('headerCatalogFilterInput');
      if (updated) {
        updated.focus();
        updated.setSelectionRange(val.length, val.length);
      }
    });
    filterInput.addEventListener('click', (e) => e.stopPropagation());
    filterInput.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeHeaderCatalog();
      }
    });
  }

  // Remedy items click
  dropdown.querySelectorAll('.sugg-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = parseInt(item.getAttribute('data-id'), 10);
      if (id) {
        closeHeaderCatalog();
        openRemedyModal(id);
      }
    });
  });
}

function openHeaderCatalog() {
  const wrapper = document.getElementById('headerCatalogWrapper');
  const dropdown = document.getElementById('headerCatalogDropdown');
  const btn = document.getElementById('btnCatalogDropdown');
  if (!wrapper || !dropdown) return;

  closeTopMenu();
  closeSearchSuggestions();

  renderHeaderCatalog('');
  dropdown.style.display = 'block';
  wrapper.classList.add('open');
  if (btn) btn.setAttribute('aria-expanded', 'true');

  setTimeout(() => {
    const filterInput = document.getElementById('headerCatalogFilterInput');
    if (filterInput) filterInput.focus();
  }, 40);
}

function closeHeaderCatalog() {
  const wrapper = document.getElementById('headerCatalogWrapper');
  const dropdown = document.getElementById('headerCatalogDropdown');
  const btn = document.getElementById('btnCatalogDropdown');
  if (dropdown) dropdown.style.display = 'none';
  if (wrapper) wrapper.classList.remove('open');
  if (btn) btn.setAttribute('aria-expanded', 'false');
}

function toggleHeaderCatalog(forceOpen) {
  const wrapper = document.getElementById('headerCatalogWrapper');
  if (!wrapper) return;
  const shouldOpen = typeof forceOpen === 'boolean' ? forceOpen : !wrapper.classList.contains('open');
  if (shouldOpen) {
    openHeaderCatalog();
  } else {
    closeHeaderCatalog();
  }
}

function openDownloadModal() {
  const modal = document.getElementById('downloadModal');
  if (!modal) return;
  downloadModalLang = currentLang;
  updateDownloadModalTexts();
  updateDownloadModalFiles(downloadModalLang);
  modal.classList.add('open');
  if (typeof document !== 'undefined' && document.body) {
    document.body.classList.add('modal-open');
  }
}

function closeDownloadModal() {
  const modal = document.getElementById('downloadModal');
  if (modal) modal.classList.remove('open');
  const remedyModal = document.getElementById('remedyModal');
  if ((!remedyModal || !remedyModal.classList.contains('open')) && typeof document !== 'undefined' && document.body) {
    document.body.classList.remove('modal-open');
  }
}

function updateDownloadModalTexts() {
  const t = I18N[currentLang];
  const title = document.getElementById('dlModalTitle');
  if (title) title.innerText = t.dlModalTitle;
  const sub = document.getElementById('dlModalSubtitle');
  if (sub) sub.innerText = t.dlModalSubtitle;
  const lblLang = document.getElementById('lblDlDbLang');
  if (lblLang) lblLang.innerText = t.lblDlDbLang;

  const uaTitle = document.getElementById('txtDlLangUaTitle');
  if (uaTitle) uaTitle.innerText = t.dlLangUaTitle;
  const uaDesc = document.getElementById('txtDlLangUaDesc');
  if (uaDesc) uaDesc.innerText = t.dlLangUaDesc;

  const ruTitle = document.getElementById('txtDlLangRuTitle');
  if (ruTitle) ruTitle.innerText = t.dlLangRuTitle;
  const ruDesc = document.getElementById('txtDlLangRuDesc');
  if (ruDesc) ruDesc.innerText = t.dlLangRuDesc;

  const cardSqlite = document.getElementById('dlCardTitleSqlite');
  if (cardSqlite) cardSqlite.innerText = t.dlCardTitleSqlite;
  const descSqlite = document.getElementById('dlCardDescSqlite');
  if (descSqlite) descSqlite.innerText = t.dlCardDescSqlite;
  const btnSqlite = document.getElementById('txtBtnDlSqlite');
  if (btnSqlite) btnSqlite.innerText = t.txtBtnDlSqlite;

  const cardJson = document.getElementById('dlCardTitleJson');
  if (cardJson) cardJson.innerText = t.dlCardTitleJson;
  const descJson = document.getElementById('dlCardDescJson');
  if (descJson) descJson.innerText = t.dlCardDescJson;
  const btnJson = document.getElementById('txtBtnDlJson');
  if (btnJson) btnJson.innerText = t.txtBtnDlJson;

  const cardCsv = document.getElementById('dlCardTitleCsv');
  if (cardCsv) cardCsv.innerText = t.dlCardTitleCsv;
  const descCsv = document.getElementById('dlCardDescCsv');
  if (descCsv) descCsv.innerText = t.dlCardDescCsv;
  const btnCsv = document.getElementById('txtBtnDlCsv');
  if (btnCsv) btnCsv.innerText = t.txtBtnDlCsv;

  const dlCloseBtn = document.getElementById('dlModalCloseBtn');
  if (dlCloseBtn && t.modalClose) {
    dlCloseBtn.setAttribute('aria-label', t.modalClose);
    dlCloseBtn.title = t.modalClose;
  }
}

function updateDownloadModalFiles(lang) {
  downloadModalLang = lang;
  if (typeof document === 'undefined') return;

  const btnUa = document.getElementById('btnDlLangUa');
  const btnRu = document.getElementById('btnDlLangRu');
  if (btnUa) btnUa.classList.toggle('active', lang === 'ua');
  if (btnRu) btnRu.classList.toggle('active', lang === 'ru');

  const linkSqlite = document.getElementById('dlLinkSqlite');
  const linkJson = document.getElementById('dlLinkJson');
  const linkCsv = document.getElementById('dlLinkCsv');

  const sizeSqlite = document.getElementById('dlSizeSqlite');
  const sizeJson = document.getElementById('dlSizeJson');
  const sizeCsv = document.getElementById('dlSizeCsv');

  const isUa = (lang === 'ua');
  const suffix = isUa ? 'ua' : 'ru';

  if (linkSqlite) {
    linkSqlite.href = `materia_medica_${suffix}.db`;
    linkSqlite.setAttribute('download', `materia_medica_${suffix}.db`);
  }
  if (linkJson) {
    linkJson.href = `materia_medica_${suffix}.json`;
    linkJson.setAttribute('download', `materia_medica_${suffix}.json`);
  }
  if (linkCsv) {
    linkCsv.href = `materia_medica_${suffix}.csv`;
    linkCsv.setAttribute('download', `materia_medica_${suffix}.csv`);
  }

  if (sizeSqlite) sizeSqlite.innerText = isUa ? '~73 MB' : '~78 MB';
  if (sizeJson) sizeJson.innerText = isUa ? '~22 MB' : '~26 MB';
  if (sizeCsv) sizeCsv.innerText = isUa ? '~10 MB' : '~11 MB';
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
  if (newLang === currentLang && DATA_CACHE[currentLang]) return;
  const oldLang = currentLang;
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
    let q = input ? input.value.trim() : '';

    // Smart query translation on language switch
    if (q) {
      const oldQueries = I18N[oldLang]?.quickQueries || [];
      const newQueries = I18N[currentLang]?.quickQueries || [];
      const matchIdx = oldQueries.findIndex(item => item.q.toLowerCase() === q.toLowerCase());
      if (matchIdx !== -1 && newQueries[matchIdx]) {
        q = newQueries[matchIdx].q;
        if (input) input.value = q;
      }
    }
    runSearch(q);
  } catch (err) {
    console.error('Error switching language:', err);
  } finally {
    if (loading) loading.style.display = 'none';
  }
}

// ==========================================
// REMEDY AUTOCOMPLETE & SUGGESTIONS COMBOBOX
// ==========================================
let selectedRemedyId = null;
let activeSuggestionIndex = -1;
let currentRemedySuggestions = [];
let remedyAutocompleteInitialized = false;
let unifiedSearchInitialized = false;
let searchDebounceTimer = null;

function normalizeRemedyKey(str) {
  if (!str) return '';
  return str.toLowerCase()
    .replace(/і/g, 'и')
    .replace(/є/g, 'е')
    .replace(/ї/g, 'и')
    .replace(/ґ/g, 'г')
    .replace(/й/g, 'и')
    .replace(/ы/g, 'и')
    .replace(/э/g, 'е')
    .replace(/я/g, 'а')
    .replace(/ю/g, 'у')
    .replace(/(.)\1+/gu, '$1')
    .trim();
}

function highlightRemedyMatch(text, query) {
  if (!text) return '';
  const escapedText = escapeHtml(text);
  if (!query || !query.trim()) return escapedText;
  const rawQ = query.trim();
  const qClean = rawQ.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  try {
    const directRegex = new RegExp(`(${qClean})`, 'gi');
    if (directRegex.test(text)) {
      return escapedText.replace(directRegex, '<mark class="remedy-match-hl">$1</mark>');
    }
    const words = rawQ.split(/\s+/).filter(w => w.length >= 3);
    if (words.length > 0) {
      const pattern = words.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
      const wordRegex = new RegExp(`(${pattern})`, 'gi');
      if (wordRegex.test(text)) {
        return escapedText.replace(wordRegex, '<mark class="remedy-match-hl">$1</mark>');
      }
    }
    return escapedText;
  } catch (e) {
    return escapedText;
  }
}

function searchRemedyNames(query) {
  if (!remediesData || remediesData.length === 0) return [];

  const rawQ = (query || '').trim();
  if (!rawQ) {
    // Return all remedies sorted alphabetically by Latin name
    return [...remediesData].sort((a, b) => (a.latin || '').localeCompare(b.latin || ''));
  }

  const rawLower = rawQ.toLowerCase();
  const qNorm = normalizeRemedyKey(rawQ);
  const qWords = qNorm.split(/\s+/).filter(Boolean);
  const qStems = qWords.map(w => w.length >= 4 ? w.replace(/[аеиуояією]$/u, '') : w);

  const results = [];
  for (const r of remediesData) {
    let score = 0;
    const lat = (r.latin || '').toLowerCase();
    const latNorm = normalizeRemedyKey(r.latin || '');
    const cyr = (r.cyr || '').toLowerCase();
    const cyrNorm = normalizeRemedyKey(r.cyr || '');
    const com = (r.common || '').toLowerCase();
    const comNorm = normalizeRemedyKey(r.common || '');

    // Exact raw prefix matches (top priority)
    if (lat.startsWith(rawLower)) {
      score = Math.max(score, 100);
    } else if (cyr.startsWith(rawLower)) {
      score = Math.max(score, 95);
    } else if (lat.includes(rawLower)) {
      score = Math.max(score, 80);
    } else if (cyr.includes(rawLower)) {
      score = Math.max(score, 75);
    } else if (com.startsWith(rawLower)) {
      score = Math.max(score, 60);
    } else if (com.includes(rawLower)) {
      score = Math.max(score, 50);
    }

    // Normalized matches (handles double letters, cyrillic variants, transliteration)
    if (score === 0 && qNorm) {
      if (latNorm.startsWith(qNorm) || cyrNorm.startsWith(qNorm)) {
        score = Math.max(score, 70);
      } else if (latNorm.includes(qNorm) || cyrNorm.includes(qNorm)) {
        score = Math.max(score, 55);
      } else if (comNorm.includes(qNorm)) {
        score = Math.max(score, 45);
      }
    }

    // Stem matches (handles word endings: бджола -> бджолина, тощо)
    if (score === 0 && qStems.length > 0) {
      for (const st of qStems) {
        if (st.length >= 3) {
          if (cyrNorm.includes(st) || latNorm.includes(st)) {
            score = Math.max(score, 40);
            break;
          } else if (comNorm.includes(st)) {
            score = Math.max(score, 30);
            break;
          }
        }
      }
    }

    if (score > 0) {
      results.push({ remedy: r, score });
    }
  }

  // Sort by score descending, then alphabetically by Latin name
  results.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return (a.remedy.latin || '').localeCompare(b.remedy.latin || '');
  });

  return results.map(item => item.remedy);
}

function openSearchSuggestions(matches, query, isCatalog = false) {
  const dropdown = document.getElementById('searchSuggestionsDropdown');
  const card = document.getElementById('searchBoxCard');
  const input = document.getElementById('searchInput');
  if (!dropdown) return;

  currentRemedySuggestions = matches;
  activeSuggestionIndex = -1;
  const t = I18N[currentLang];

  if (matches.length === 0) {
    if (isCatalog) {
      dropdown.innerHTML = `
        <div class="sugg-empty">
          <p>Препарати відсутні</p>
        </div>
      `;
    } else {
      closeSearchSuggestions();
      return;
    }
  } else {
    let html = '';

    if (isCatalog) {
      // Full catalog of 341 remedies A-Z
      html += `
        <div class="sugg-header">
          <strong>${escapeHtml(t.suggCatalogTitle || 'Каталог усіх препаратів (341):')}</strong>
          <span style="font-size: 0.74rem; color: #64748b;">Оберіть для відкриття опису</span>
        </div>
      `;
      let currentLetter = '';
      for (let i = 0; i < matches.length; i++) {
        const r = matches[i];
        const letter = (r.latin || '?')[0].toUpperCase();
        if (letter !== currentLetter) {
          currentLetter = letter;
          html += `<div class="sugg-group-header">— ${escapeHtml(letter)} —</div>`;
        }
        html += `
          <div class="sugg-item" data-id="${r.id}" data-idx="${i}" role="option" aria-selected="false">
            <div class="sugg-main">
              <div class="sugg-title">
                <span class="sugg-latin">${escapeHtml(r.latin)}</span>
                ${r.cyr ? `<span class="sugg-cyr">(${escapeHtml(r.cyr)})</span>` : ''}
              </div>
              ${r.common ? `<div class="sugg-common">${escapeHtml(r.common)}</div>` : ''}
            </div>
            <span class="sugg-action-badge">${escapeHtml(t.suggReadRemedy || 'Читати опис →')}</span>
          </div>
        `;
      }
      html += `<div class="sugg-footer"><span>Усі 341 препаратів</span></div>`;
    } else {
      // Live search suggestions
      const displayMatches = matches.slice(0, 15);
      const headerTpl = t.suggHeaderRemedies || 'Препарати за запитом "{q}" ({n}):';
      const headerText = headerTpl.replace('{q}', escapeHtml(query)).replace('{n}', matches.length);
      html += `
        <div class="sugg-header">
          <strong>${headerText}</strong>
          <span style="font-size: 0.74rem; color: #64748b;">↓/↑ для вибору, Enter для переходу</span>
        </div>
      `;
      for (let i = 0; i < displayMatches.length; i++) {
        const r = displayMatches[i];
        html += `
          <div class="sugg-item" data-id="${r.id}" data-idx="${i}" role="option" aria-selected="false">
            <div class="sugg-main">
              <div class="sugg-title">
                <span class="sugg-latin">${highlightRemedyMatch(r.latin, query)}</span>
                ${r.cyr ? `<span class="sugg-cyr">(${highlightRemedyMatch(r.cyr, query)})</span>` : ''}
              </div>
              ${r.common ? `<div class="sugg-common">${highlightRemedyMatch(r.common, query)}</div>` : ''}
            </div>
            <span class="sugg-action-badge">${escapeHtml(t.suggReadRemedy || 'Читати опис →')}</span>
          </div>
        `;
      }
      html += `
        <div class="sugg-footer">
          <span>${escapeHtml(t.suggFooterHint || 'Натисніть на препарат для опису, або Enter для пошуку симптомів')}</span>
        </div>
      `;
    }

    dropdown.innerHTML = html;
  }

  dropdown.style.display = 'block';
  if (card) card.classList.add('dropdown-open');
  if (input) input.setAttribute('aria-expanded', 'true');
}

function closeSearchSuggestions() {
  const dropdown = document.getElementById('searchSuggestionsDropdown');
  const card = document.getElementById('searchBoxCard');
  const input = document.getElementById('searchInput');
  if (dropdown) dropdown.style.display = 'none';
  if (card) card.classList.remove('dropdown-open');
  if (input) input.setAttribute('aria-expanded', 'false');
  activeSuggestionIndex = -1;
}

function selectSuggestedRemedy(remedy) {
  if (!remedy) return;
  const input = document.getElementById('searchInput');
  if (input) {
    input.value = `${remedy.latin}${remedy.cyr ? ` (${remedy.cyr})` : ''}`;
  }
  const clearBtn = document.getElementById('btnClear');
  if (clearBtn) clearBtn.style.display = 'flex';

  closeSearchSuggestions();
  openRemedyModal(remedy.id);
}

function updateActiveSearchSuggestion(newIdx) {
  const dropdown = document.getElementById('searchSuggestionsDropdown');
  if (!dropdown) return;

  const items = dropdown.querySelectorAll('.sugg-item');
  if (items.length === 0) return;

  items.forEach(el => {
    el.classList.remove('active');
    el.setAttribute('aria-selected', 'false');
  });

  if (newIdx >= 0 && newIdx < items.length) {
    activeSuggestionIndex = newIdx;
    const target = items[newIdx];
    target.classList.add('active');
    target.setAttribute('aria-selected', 'true');
    target.scrollIntoView({ block: 'nearest' });
  } else {
    activeSuggestionIndex = -1;
  }
}

function initUnifiedSearch() {
  if (unifiedSearchInitialized) return;
  unifiedSearchInitialized = true;

  const input = document.getElementById('searchInput');
  const searchForm = document.getElementById('searchForm');
  const btnSearchSubmit = document.getElementById('btnSearchSubmit');
  const btnSearchIcon = document.getElementById('btnSearchIcon');
  const clearBtn = document.getElementById('btnClear');
  const btnCatalog = document.getElementById('btnCatalogDropdown');
  const dropdown = document.getElementById('searchSuggestionsDropdown');

  function triggerSearch() {
    closeSearchSuggestions();
    clearTimeout(searchDebounceTimer);
    if (input) {
      runSearch(input.value);
    }
  }

  // Form submit (handles mobile keyboard 'Search'/'Go' key)
  if (searchForm) {
    searchForm.addEventListener('submit', (e) => {
      e.preventDefault();
      triggerSearch();
      if (input) input.blur();
    });
  }

  // Submit button ('Знайти' / 'Найти')
  if (btnSearchSubmit) {
    btnSearchSubmit.addEventListener('click', (e) => {
      e.preventDefault();
      triggerSearch();
      if (input) input.blur();
    });
  }

  // Search icon button
  if (btnSearchIcon) {
    btnSearchIcon.addEventListener('click', (e) => {
      e.preventDefault();
      triggerSearch();
    });
  }

  if (input) {
    input.addEventListener('input', (e) => {
      const q = e.target.value;
      if (clearBtn) clearBtn.style.display = q.trim() ? 'flex' : 'none';

      // 1. Live remedy suggestions
      if (q.trim().length >= 1) {
        const matches = searchRemedyNames(q);
        if (matches.length > 0) {
          openSearchSuggestions(matches, q, false);
        } else {
          closeSearchSuggestions();
        }
      } else {
        closeSearchSuggestions();
      }

      // 2. Symptom search debounced
      clearTimeout(searchDebounceTimer);
      searchDebounceTimer = setTimeout(() => {
        runSearch(q);
      }, 150);
    });

    input.addEventListener('change', () => {
      triggerSearch();
    });

    input.addEventListener('search', () => {
      triggerSearch();
    });

    input.addEventListener('keydown', (e) => {
      const isDropdownOpen = dropdown && dropdown.style.display === 'block';

      if (e.key === 'ArrowDown') {
        if (!isDropdownOpen) {
          const q = input.value.trim();
          if (q) {
            const matches = searchRemedyNames(q);
            if (matches.length > 0) {
              openSearchSuggestions(matches, q, false);
              updateActiveSearchSuggestion(0);
              e.preventDefault();
            }
          }
        } else {
          e.preventDefault();
          const items = dropdown.querySelectorAll('.sugg-item');
          if (items.length > 0) {
            const next = activeSuggestionIndex + 1 >= items.length ? 0 : activeSuggestionIndex + 1;
            updateActiveSearchSuggestion(next);
          }
        }
      } else if (e.key === 'ArrowUp') {
        if (isDropdownOpen) {
          e.preventDefault();
          const items = dropdown.querySelectorAll('.sugg-item');
          if (items.length > 0) {
            const prev = activeSuggestionIndex - 1 < 0 ? items.length - 1 : activeSuggestionIndex - 1;
            updateActiveSearchSuggestion(prev);
          }
        }
      } else if (e.key === 'Enter') {
        if (isDropdownOpen && activeSuggestionIndex >= 0 && currentRemedySuggestions[activeSuggestionIndex]) {
          e.preventDefault();
          selectSuggestedRemedy(currentRemedySuggestions[activeSuggestionIndex]);
        } else {
          e.preventDefault();
          triggerSearch();
          input.blur();
        }
      } else if (e.key === 'Escape') {
        if (isDropdownOpen) {
          e.preventDefault();
          closeSearchSuggestions();
        }
      }
    });

    // Keyboard shortcut '/'
    document.addEventListener('keydown', (e) => {
      if (e.key === '/' && document.activeElement !== input) {
        const isInputFocused = document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA');
        if (!isInputFocused) {
          e.preventDefault();
          input.focus();
          input.select();
        }
      }
    });
  }

  // Click on suggested remedy
  if (dropdown) {
    dropdown.addEventListener('click', (e) => {
      const item = e.target.closest('.sugg-item');
      if (!item) return;
      const id = parseInt(item.getAttribute('data-id'), 10);
      if (id && remediesData) {
        const remedy = remediesData.find(r => r.id === id);
        if (remedy) {
          selectSuggestedRemedy(remedy);
        }
      }
    });
  }

  // Clear button
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      if (input) {
        input.value = '';
        input.focus();
      }
      clearBtn.style.display = 'none';
      closeSearchSuggestions();
      runSearch('');
    });
  }

  // Catalog dropdown button (in header, to the left of menu)
  if (btnCatalog) {
    btnCatalog.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleHeaderCatalog();
    });
  }

  // Click outside listener
  document.addEventListener('click', (e) => {
    const form = document.getElementById('searchForm');
    const wrapper = document.getElementById('searchInputWrapper');
    const container = form || wrapper;
    if (container && !container.contains(e.target)) {
      closeSearchSuggestions();
    }
    const catWrapper = document.getElementById('headerCatalogWrapper');
    if (catWrapper && !catWrapper.contains(e.target)) {
      closeHeaderCatalog();
    }
  });
}

function populateRemedySelector() {
  initUnifiedSearch();
}

async function initApp() {
  const loading = document.getElementById('loadingIndicator');
  try {
    await loadDataset(currentLang);
    populateRemedySelector();
    updateUILanguage();
    if (loading) loading.style.display = 'none';

    const input = document.getElementById('searchInput');
    const urlParams = new URLSearchParams(window.location.search);
    const qParam = urlParams.get('q');

    if (qParam && input) {
      input.value = qParam;
      runSearch(qParam);
    } else {
      if (input) input.value = '';
      runSearch('');
    }
  } catch (err) {
    if (loading) {
      const errMsg = currentLang === 'ua'
        ? `Помилка завантаження бази даних: ${err.message}`
        : `Ошибка загрузки базы данных: ${err.message}`;
      loading.innerHTML = `<p style="color: #dc2626; padding: 2rem;">${errMsg}</p>`;
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
    if (statusBar) statusBar.innerHTML = t.statusEmpty;
    if (container) container.innerHTML = '';
    return;
  }

  const t0 = performance.now();
  const results = searchRemedies(qTrim);
  const elapsed = (performance.now() - t0).toFixed(1);

  if (results.length === 0) {
    if (statusBar) statusBar.innerHTML = t.statusNotFound;
    if (container) {
      container.innerHTML = `
      <div style="text-align: center; padding: 3rem; background: white; border-radius: 12px; border: 1px solid #e2e8f0;">
        <p style="font-size: 1.1rem; color: #64748b;">${t.statusNotFound}</p>
      </div>`;
    }
    return;
  }

  lastSearchResults = results;
  if (statusBar) {
    statusBar.innerHTML = t.statusFound.replace('{count}', results.length).replace('{time}', elapsed);
  }

  const cardsHtml = results.map((item) => {
    const r = item.remedy;
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
      <article class="card">
        <div class="card-header">
          <div class="card-title-group">
            <div>
              <span class="card-latin" onclick="openRemedyModal(${r.id})" style="cursor: pointer;" title="${t.cardBtnDetails}">${r.latin}</span>
              ${r.cyr ? `<span class="card-cyr">(${r.cyr})</span>` : ''}
            </div>
            ${r.common ? `<div class="card-common">${r.common}</div>` : ''}
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
          <button type="button" class="btn-details" onclick="openRemedyModal(${r.id})">
            ${t.cardBtnDetails}
          </button>
        </div>
      </article>
    `;
  }).join('');

  container.innerHTML = cardsHtml;
}

// ==========================================
// 10. DETAILED MODAL VIEW & UX ENHANCEMENTS
// ==========================================
function copySnippetQuote(index) {
  const item = lastSearchResults[index];
  if (!item) return;
  const r = item.remedy;
  const t = I18N[currentLang];
  const quoteText = `«${item.sentence.trim()}» — ${r.latin}${r.cyr ? ` (${r.cyr})` : ''} [${t.cardRubric} ${item.section}]`;

  if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(quoteText).then(() => {
      showToast(t.toastQuoteCopied || 'Цитату скопійовано в буфер обміну!');
    }).catch(() => {
      showToast(t.toastQuoteCopied || 'Цитату скопійовано в буфер обміну!');
    });
  } else {
    showToast(t.toastQuoteCopied || 'Цитату скопійовано в буфер обміну!');
  }
}

function getSectionIcon(secName) {
  return '';
}

function getSectionCategory(secName) {
  const u = (secName || '').toUpperCase();
  if (/МОДАЛЬН|ПОГІРШ|УХУДШ|ПОКРАЩ|УЛУЧШ/.test(u)) return 'mod';
  if (/КЛІНІ[КЧ]|КЛИНИ[КЧ]|ЕТІОЛОГ|ЭТИОЛОГ|ХАРАКТЕРИСТИК|ТИП|ДОЗИ/.test(u)) return 'clin';
  if (/ПСИХІК|ПСИХИК/.test(u)) return 'mind';
  if (/ДИХА|ДЫХА|КАШЕЛ|ГРУД|СЕРЦ|СЕРД/.test(u)) return 'resp';
  if (/ШЛУНОК|ЖЕЛУДОК|ЖИВОТ|КИШК|ПЕЧІНК|ПЕЧЕНЬ|СТУЛ|ВИПРАВН|АПЕТИТ|ЖАЖДА|СПРАГА/.test(u)) return 'digest';
  if (/СПИН|ПОПЕРЕК|ПОЯСНИЦ|ХРЕБЕТ|ПОЗВОНОЧНИК|СУГЛОБ|СУСТАВ|КІНЦІВК|КОНЕЧНОСТ|М'ЯЗ|МЫШЦ|ШИЯ|ШЕЯ/.test(u)) return 'back';
  if (/ШКІР|КОЖА|ВИСИП|СВЕРБІЖ|ЗУД/.test(u)) return 'skin';
  if (/ОЧІ|ГЛАЗА|ГОЛОВА|МОЗОК|ГОЛОВОКРУЖЕНИЕ|ЗАПАМОРОЧЕННЯ|ВУХА|УШИ|СЛУХ|ЯЗИК|ЯЗЫК|ГОРЛО|ГЛОТК/.test(u) ||
      /(^|[^А-ЯЁЇІЄҐ])(НІС|НОС|РОТ|ЗУБ)([^А-ЯЁЇІЄҐ]|$)/.test(u)) {
    return 'head';
  }
  return 'other';
}

function renderModalSections(remedy, category = 'all', query = '') {
  const container = document.getElementById('modalSectionsContainer');
  if (!container || !remedy || !remedy.sections) return;
  const t = I18N[currentLang];
  const qTrim = (query || '').trim().toLowerCase();

  let html = '';
  let matchCount = 0;

  for (const [sName, sText] of Object.entries(remedy.sections)) {
    const cat = getSectionCategory(sName);
    if (category !== 'all' && cat !== category) continue;

    if (qTrim) {
      const matchInName = sName.toLowerCase().includes(qTrim);
      const matchInText = sText.toLowerCase().includes(qTrim);
      if (!matchInName && !matchInText) continue;
    }

    matchCount++;
    const icon = getSectionIcon(sName);

    let formattedText = escapeHtml(sText);
    if (qTrim) {
      try {
        const reg = new RegExp(`(^|[^а-яёїієґa-z0-9])(${escapedQ}[а-яёїієґa-z0-9'’]*)`, 'gi');
        formattedText = formattedText.replace(reg, (m, pfx, word) => `${pfx}<mark>${word}</mark>`);
      } catch (e) {}
    }

    html += `
      <div class="modal-sec-card" data-sname="${escapeHtml(sName)}">
        <div class="modal-sec-card-header">
          ${icon ? `<span class="modal-sec-card-icon">${icon}</span>` : ''}
          <span class="modal-sec-card-name">${escapeHtml(sName)}</span>
        </div>
        <div class="modal-sec-card-body">${formattedText}</div>
      </div>
    `;
  }

  if (matchCount === 0) {
    html = `
      <div style="text-align: center; padding: 2.5rem 1rem; background: #f8fafc; border-radius: 8px; border: 1px dashed var(--border); color: #64748b;">
        <p style="font-size: 1rem;">${t.statusNotFound}</p>
      </div>
    `;
  }

  container.innerHTML = html;
}

let activeModalCat = 'all';

async function openRemedyModal(remedyId) {
  const modal = document.getElementById('remedyModal');
  const modalTitle = document.getElementById('modalTitle');
  const modalBody = document.getElementById('modalBody');
  const t = I18N[currentLang];

  modalTitle.innerText = t.modalLoading;
  modalBody.innerHTML = '<div class="spinner"></div>';
  modal.classList.add('open');
  if (typeof document !== 'undefined' && document.body) {
    document.body.classList.add('modal-open');
  }

  try {
    const filename = `data/remedies_${currentLang}/${remedyId}.json`;
    let res = await fetch(filename);
    if (!res.ok) {
      res = await fetch(`data/remedies/${remedyId}.json`);
      if (!res.ok) throw new Error(currentLang === 'ua' ? 'Помилка завантаження файлу препарату' : 'Ошибка загрузки файла препарата');
    }
    const full = await res.json();
    currentModalRemedy = full;
    activeModalCat = 'all';

    modalTitle.innerHTML = `${escapeHtml(full.latin_name)} <span style="font-size: 1rem; color: #64748b; font-weight: 500;">(${escapeHtml(full.cyrillic_name || '')})</span>`;

    // Calculate category counts
    const counts = { all: 0, mind: 0, head: 0, resp: 0, digest: 0, back: 0, skin: 0, mod: 0, clin: 0 };
    if (full.sections) {
      for (const sName of Object.keys(full.sections)) {
        counts.all++;
        const cat = getSectionCategory(sName);
        if (counts[cat] !== undefined) counts[cat]++;
      }
    }

    let metaHtml = '';
    if (full.image_url) {
      metaHtml += `<div class="modal-img-wrap"><img src="${full.image_url}" alt="${escapeHtml(full.latin_name)}" onerror="this.parentElement ? this.parentElement.remove() : (this.style.display='none')"></div>`;
    }

    metaHtml += '<div class="modal-meta-box">';
    if (full.common_name) {
      metaHtml += `<div class="modal-meta-row"><strong>${t.modalCommonName}</strong> ${escapeHtml(full.common_name)}</div>`;
    }
    if (full.synonyms) {
      metaHtml += `<div class="modal-meta-row"><strong>${t.modalSynonyms}</strong> ${escapeHtml(full.synonyms)}</div>`;
    }
    if (full.intro) {
      metaHtml += `<div class="modal-meta-row" style="margin-top: 0.5rem; color: #475569; font-style: italic;">${escapeHtml(full.intro)}</div>`;
    }
    metaHtml += '</div>';

    // Toolbar with search and category pills
    const catDefs = [
      { id: 'all', label: t.modalCatAll || 'Всі рубрики', count: counts.all },
      { id: 'mind', label: t.modalCatMind || 'Психіка', count: counts.mind },
      { id: 'head', label: t.modalCatHead || 'Голова & Очі', count: counts.head },
      { id: 'resp', label: t.modalCatResp || 'Дихання', count: counts.resp },
      { id: 'digest', label: t.modalCatDigest || 'Травлення', count: counts.digest },
      { id: 'back', label: t.modalCatBack || 'Спина & Суглоби', count: counts.back },
      { id: 'skin', label: t.modalCatSkin || 'Шкіра', count: counts.skin },
      { id: 'mod', label: t.modalCatMod || 'Модальності', count: counts.mod },
      { id: 'clin', label: t.modalCatClin || 'Клініка', count: counts.clin }
    ].filter(c => c.id === 'all' || c.count > 0);

    const toolbarHtml = `
      <div class="modal-toolbar">
        <div class="modal-search-wrap">
          <span class="modal-search-icon"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg></span>
          <input 
            type="text" 
            id="modalSearchInput" 
            class="modal-search-input" 
            placeholder="${t.modalSearchPlaceholder || 'Шукати симптоми у цьому описі...'}"
            autocomplete="off"
            autocorrect="off"
            autocapitalize="off"
            spellcheck="false"
            enterkeyhint="search"
          />
        </div>
        <div class="modal-cat-bar" id="modalCatBar">
          ${catDefs.map(c => `
            <button type="button" class="modal-cat-btn ${c.id === 'all' ? 'active' : ''}" data-cat="${c.id}">
              ${c.label} <span style="opacity: 0.75; font-size: 0.72rem;">(${c.count})</span>
            </button>
          `).join('')}
        </div>
      </div>
    `;

    let bodyContent = metaHtml + toolbarHtml + '<div id="modalSectionsContainer"></div>';

    if (full.source) {
      bodyContent += `<div class="modal-source">${t.modalSource} ${escapeHtml(full.source)}</div>`;
    }

    modalBody.innerHTML = bodyContent;

    // Render initial sections
    renderModalSections(full, 'all', '');

    // Setup in-modal search input
    const mInput = document.getElementById('modalSearchInput');
    let mTimer;
    if (mInput) {
      mInput.addEventListener('input', (e) => {
        clearTimeout(mTimer);
        mTimer = setTimeout(() => {
          renderModalSections(full, activeModalCat, e.target.value);
        }, 120);
      });
    }

    // Setup category buttons
    const catBtns = modalBody.querySelectorAll('.modal-cat-btn');
    catBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        catBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        activeModalCat = btn.getAttribute('data-cat');
        renderModalSections(full, activeModalCat, mInput ? mInput.value : '');
      });
    });

  } catch (err) {
    modalBody.innerHTML = `<p style="color: #dc2626; padding: 2rem;">${t.modalError || 'Не вдалося відкрити опис:'} ${escapeHtml(err.message)}</p>`;
  }
}

function closeModal() {
  const modal = document.getElementById('remedyModal');
  if (modal) modal.classList.remove('open');
  currentModalRemedy = null;
  const dlModal = document.getElementById('downloadModal');
  if ((!dlModal || !dlModal.classList.contains('open')) && typeof document !== 'undefined' && document.body) {
    document.body.classList.remove('modal-open');
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ==========================================
// 11. EVENT LISTENERS & APP STARTUP
// ==========================================
let appStarted = false;

function startApp() {
  if (appStarted) return;
  appStarted = true;

  initApp();
  initUnifiedSearch();

  const searchInput = document.getElementById('searchInput');

  // Top-right dropdown menu wiring
  const btnHeaderMenu = document.getElementById('btnHeaderMenu');
  if (btnHeaderMenu) {
    btnHeaderMenu.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleTopMenu();
    });
  }

  document.addEventListener('click', (e) => {
    const wrapper = document.getElementById('topMenuWrapper');
    if (wrapper && wrapper.classList.contains('open') && !wrapper.contains(e.target)) {
      closeTopMenu();
    }
    const catWrapper = document.getElementById('headerCatalogWrapper');
    if (catWrapper && catWrapper.classList.contains('open') && !catWrapper.contains(e.target)) {
      closeHeaderCatalog();
    }
  });

  const btnUa = document.getElementById('langBtnUa');
  const btnRu = document.getElementById('langBtnRu');
  if (btnUa) {
    btnUa.addEventListener('click', () => {
      switchLanguage('ua');
      closeTopMenu();
    });
  }
  if (btnRu) {
    btnRu.addEventListener('click', () => {
      switchLanguage('ru');
      closeTopMenu();
    });
  }

  // Download menu modal wiring
  const btnOpenDownloads = document.getElementById('btnOpenDownloads');
  if (btnOpenDownloads) {
    btnOpenDownloads.addEventListener('click', () => {
      closeTopMenu();
      openDownloadModal();
    });
  }

  const dlModalCloseBtn = document.getElementById('dlModalCloseBtn');
  if (dlModalCloseBtn) dlModalCloseBtn.addEventListener('click', closeDownloadModal);

  const downloadModal = document.getElementById('downloadModal');
  if (downloadModal) {
    downloadModal.addEventListener('click', (e) => {
      if (e.target.id === 'downloadModal') closeDownloadModal();
    });
  }

  const btnDlLangUa = document.getElementById('btnDlLangUa');
  const btnDlLangRu = document.getElementById('btnDlLangRu');
  if (btnDlLangUa) btnDlLangUa.addEventListener('click', () => updateDownloadModalFiles('ua'));
  if (btnDlLangRu) btnDlLangRu.addEventListener('click', () => updateDownloadModalFiles('ru'));

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
      updateActiveFiltersStrip();
      clearTimeout(searchDebounceTimer);
      searchDebounceTimer = setTimeout(() => {
        const inp = document.getElementById('searchInput');
        runSearch(inp ? inp.value : '');
      }, 200);
    });
  }

  const inBetter = document.getElementById('inputBetterCustom');
  if (inBetter) {
    inBetter.addEventListener('input', (e) => {
      filterState.betterCustom = e.target.value;
      updateFiltersBadge();
      updateActiveFiltersStrip();
      clearTimeout(searchDebounceTimer);
      searchDebounceTimer = setTimeout(() => {
        const inp = document.getElementById('searchInput');
        runSearch(inp ? inp.value : '');
      }, 200);
    });
  }

  const selectSec = document.getElementById('selectSection');
  if (selectSec) {
    selectSec.addEventListener('change', (e) => {
      filterState.section = e.target.value;
      updateFiltersBadge();
      updateActiveFiltersStrip();
      const inp = document.getElementById('searchInput');
      runSearch(inp ? inp.value : '');
    });
  }

  const btnReset = document.getElementById('btnResetFilters');
  if (btnReset) {
    btnReset.addEventListener('click', resetAllFilters);
  }

  const modalCloseBtn = document.getElementById('modalCloseBtn');
  if (modalCloseBtn) modalCloseBtn.addEventListener('click', closeModal);
  const remedyModal = document.getElementById('remedyModal');
  if (remedyModal) {
    remedyModal.addEventListener('click', (e) => {
      if (e.target.id === 'remedyModal') closeModal();
    });
  }

  if (typeof window !== 'undefined' && window.addEventListener) {
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeHeaderCatalog();
        closeTopMenu();
        closeModal();
        closeDownloadModal();
      }
      const inp = document.getElementById('searchInput');
      if (e.key === '/' && inp && document.activeElement !== inp) {
        const rModal = document.getElementById('remedyModal');
        const dModal = document.getElementById('downloadModal');
        if ((rModal && rModal.classList.contains('open')) || (dModal && dModal.classList.contains('open'))) return;
        e.preventDefault();
        inp.focus();
        inp.select();
      }
    });
  }
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startApp);
  } else {
    startApp();
  }
}

// Global scope exports
if (typeof window !== 'undefined') {
  window.toggleTopMenu = toggleTopMenu;
  window.closeTopMenu = closeTopMenu;
  window.openHeaderCatalog = openHeaderCatalog;
  window.closeHeaderCatalog = closeHeaderCatalog;
  window.toggleHeaderCatalog = toggleHeaderCatalog;
  window.openRemedyModal = openRemedyModal;
  window.closeModal = closeModal;
  window.switchLanguage = switchLanguage;
  window.runSearch = runSearch;
  window.copySnippetQuote = copySnippetQuote;
  window.openDownloadModal = openDownloadModal;
  window.closeDownloadModal = closeDownloadModal;
  window.updateDownloadModalFiles = updateDownloadModalFiles;
  window.toggleWorseChip = toggleWorseChip;
  window.toggleBetterChip = toggleBetterChip;
  window.clearCustomWorse = clearCustomWorse;
  window.clearCustomBetter = clearCustomBetter;
  window.clearSectionFilter = clearSectionFilter;
  window.resetAllFilters = resetAllFilters;
  window.showToast = showToast;
}

