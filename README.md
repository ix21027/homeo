# База Даних Гомеопатичних Препаратів Materia Medica

Повна структурована база даних гомеопатичних препаратів, вивантажена та опрацьована з архіву **homeopat-sam.com** ([Wayback Machine](https://web.archive.org/web/20180112212146/http://homeopat-sam.com/Materia_Medica/p3)).

В основу описів покладено капітальну працю: **Джон Генри Кларк. «Словарь Практической Materia Medica в 6-ти томах»** (Изд-во «Гомеопатическая медицина». Москва. 2001 г.).

---

## 📊 Загальна статистика

- **Кількість препаратів:** `341` (100% доступних в розділі Materia Medica)
- **Загальна кількість рубрик/секцій:** `11,771`
- **Унікальних назв рубрик:** `71`
- **Розмір SQLite БД:** `~53 MB` (включаючи повнотекстовий індекс FTS5)
- **Розмір JSON:** `~26 MB`
- **Розмір CSV:** `~6.5 MB`

---

## 📁 Структура файлів

| Файл / Папка | Опис |
|---|---|
| [`materia_medica.db`](file:///home/ubuntu/homeo/materia_medica.db) | Основна реляційна база даних SQLite з повнотекстовим пошуком FTS5 |
| [`materia_medica.json`](file:///home/ubuntu/homeo/materia_medica.json) | Повний експорт у форматі JSON (всі поля, секції та повний текст) |
| [`materia_medica.csv`](file:///home/ubuntu/homeo/materia_medica.csv) | Табличний експорт у форматі CSV (UTF-8 з BOM для Excel) |
| [`remedies_md/`](file:///home/ubuntu/homeo/remedies_md) | 341 окремий Markdown-файл для зручного читання кожного препарату |
| [`raw_html/`](file:///home/ubuntu/homeo/raw_html) | 341 оригінальний архівний HTML-файл (локальний офлайн-кеш) |
| [`search.py`](file:///home/ubuntu/homeo/search.py) | CLI-утиліта для швидкого пошуку та перегляду препаратів |
| [`build_database.py`](file:///home/ubuntu/homeo/build_database.py) | Скрипт парсингу та побудови баз даних |
| [`download_all.py`](file:///home/ubuntu/homeo/download_all.py) | Скрипт завантаження сторінок через Wayback Machine |

---

## 🗄️ Схема бази даних SQLite (`materia_medica.db`)

### 1. Таблиця `remedies`
Містить основні відомості про кожен препарат:
- `id` (INTEGER PRIMARY KEY) — оригінальний числовий ідентифікатор статті
- `latin_name` (TEXT) — міжнародна латинська назва (наприклад: *Aconitum napellus*)
- `cyrillic_name` (TEXT) — кирилична назва/транслітерація (*Аконитум*)
- `common_name` (TEXT) — народна або ботанічна назва рослини/речовини (*борец ядовитый*)
- `synonyms` (TEXT) — синонімічні назви препарату
- `full_title` (TEXT) — повний заголовок
- `h1` (TEXT) — заголовок сторінки
- `image_url` (TEXT) — посилання на ілюстрацію препарату
- `intro` (TEXT) — вступна частина (родина, походження, частина рослини, технологія приготування)
- `characteristics` (TEXT) — рубрика «ХАРАКТЕРИСТИКА»
- `mind` (TEXT) — рубрика «ПСИХИКА»
- `type_constitution` (TEXT) — рубрика «ТИП» (конституційний тип)
- `tropism` (TEXT) — рубрика «ТРОПНОСТЬ» (органи-мішені)
- `clinical` (TEXT) — рубрика «КЛИНИКА / НОЗОЛОГИИ» (перелік хвороб та діагнозів)
- `general_symptoms` (TEXT) — рубрика «ОБЩИЕ СИМПТОМЫ»
- `modalities` (TEXT) — рубрика «МОДАЛЬНОСТИ» (погіршення / покращення)
- `etiology` (TEXT) — рубрика «ЭТИОЛОГИЯ»
- `relationships` (TEXT) — рубрика «ВЗАИМОСВЯЗИ» (подібні препарати, антидоти, сумісність)
- `source` (TEXT) — літературне першоджерело
- `sections_json` (TEXT) — JSON-словник з усіма вилученими секціями
- `full_text` (TEXT) — повний очищений текст усього опису
- `archive_url` (TEXT) — посилання на зліпок Wayback Machine
- `original_url` (TEXT) — початкове посилання на homeopat-sam.com

### 2. Таблиця `remedy_sections`
Реляційна таблиця для пошуку по конкретних рубриках:
- `id` (INTEGER PRIMARY KEY)
- `remedy_id` (INTEGER REFERENCES remedies(id))
- `section_name` (TEXT) — назва рубрики (*ГОЛОВА*, *СОН*, *ЛИХОРАДКА*, *ШЕЯ*, *СУСТАВЫ* тощо)
- `section_text` (TEXT) — опис симптомів рубрики

### 3. Віртуальна таблиця `remedies_fts`
Швидкісний рушій SQLite FTS5 (Full-Text Search) для миттєвого пошуку симптомів, клінічних проявів та модальностей по всій базі.

---

## 🔍 Як користуватися утилітою пошуку (`search.py`)

```bash
# 1. Повнотекстовий пошук за симптомом чи діагнозом:
python3 /home/ubuntu/homeo/search.py "мигрень"
python3 /home/ubuntu/homeo/search.py "ревматизм"
python3 /home/ubuntu/homeo/search.py "бессонница"

# 2. Пошук препарату за латинською або українською/російською назвою:
python3 /home/ubuntu/homeo/search.py --name "Aconit"
python3 /home/ubuntu/homeo/search.py --name "Полынь"

# 3. Детальний перегляд препарату за ID:
python3 /home/ubuntu/homeo/search.py --id 18

# 4. Статистика бази даних:
python3 /home/ubuntu/homeo/search.py --stats
```

---

## 💻 Приклади роботи з базою в Python

```python
import sqlite3

conn = sqlite3.connect('/home/ubuntu/homeo/materia_medica.db')
cur = conn.cursor()

# Знайти всі препарати, де в клініці вказано бронхіт:
cur.execute("""
    SELECT id, latin_name, cyrillic_name, common_name
    FROM remedies
    WHERE clinical LIKE '%Бронхит%'
""")
for row in cur.fetchall():
    print(row)

# Повнотекстовий пошук через FTS5:
cur.execute("""
    SELECT r.latin_name, snippet(remedies_fts, 4, '[', ']', '...', 10)
    FROM remedies_fts
    JOIN remedies r ON r.id = remedies_fts.id
    WHERE remedies_fts MATCH 'невралгия'
    LIMIT 5
""")
for row in cur.fetchall():
    print(row)
```
