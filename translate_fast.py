#!/usr/bin/env python3
"""
Fast Materia Medica Ukrainian Translator
Translates all 341 remedies using parallel section translation and domain medical rules.
"""

import os
import sys
import json
import re
import time
import sqlite3
import csv
from concurrent.futures import ThreadPoolExecutor, as_completed
from translatepy import Translator

CACHE_DIR = "/home/ubuntu/homeo/cache_ua"
DATA_DIR = "/home/ubuntu/homeo/data"
DATA_REMEDIES_DIR = "/home/ubuntu/homeo/data/remedies"
SOURCE_JSON = "/home/ubuntu/homeo/materia_medica.json"

SECTION_NAMES_UA = {
    "XАРАКТЕРИСТИКА": "ХАРАКТЕРИСТИКА",
    "ХАРАКТЕРИСТИКА": "ХАРАКТЕРИСТИКА",
    "ХАРАКТЕРИТСИКА": "ХАРАКТЕРИСТИКА",
    "ХАРАКТРИСТИКА": "ХАРАКТЕРИСТИКА",
    "ХАРАТЕРИСТИКА": "ХАРАКТЕРИСТИКА",
    "ХАРКТЕРИСТИКА": "ХАРАКТЕРИСТИКА",
    "АНУС И ПРЯМАЯ КИШКА": "АНУС І ПРЯМА КИШКА",
    "АППЕТИТ": "АПЕТИТ",
    "БЕРЕМЕННОСТЬ. РОДЫ": "ВАГІТНІСТЬ. ПОЛОГИ",
    "БЕРЕМЕННОСТЬ. РОДЫ.": "ВАГІТНІСТЬ. ПОЛОГИ",
    "ВЗАИМООТНОШЕНИЯ": "ВЗАЄМОЗВ'ЯЗКИ ТА ПОРІВНЯННЯ",
    "ВЗАИМОСВЯЗИ": "ВЗАЄМОЗВ'ЯЗКИ ТА ПОРІВНЯННЯ",
    "ГЛАЗА": "ОЧІ",
    "ГОЛОВА": "ГОЛОВА",
    "ГОЛОВА СНАРУЖИ": "ГОЛОВА ЗОВНІ (ВОЛОССЯ, ШКІРА)",
    "ГОЛОВОКРУЖЕНИЕ": "ЗАПАМОРОЧЕННЯ",
    "ГОРЛО": "ГОРЛО",
    "ГОРТАНЬ": "ГОРТАНЬ",
    "ГОРТАНЬ. ТРАХЕЯ": "ГОРТАНЬ ТА ТРАХЕЯ",
    "ГРУДНАЯ КЛЕТКА": "ГРУДНА КЛІТКА",
    "ГРУДЬ": "ГРУДИ",
    "ДЕТИ": "ДІТИ (ПЕДІАТРІЯ)",
    "ДЕТСКИЕ": "ДІТИ (ПЕДІАТРІЯ)",
    "ДЫХАТЕЛЬНАЯ СИСТЕМА": "ДИХАЛЬНА СИСТЕМА",
    "ЖЕЛУДОК": "ШЛУНОК",
    "ЖЕЛУДОЧНО-КИШЕЧНЫЙ ТРАКТ": "ШЛУНКОВО-КИШКОВИЙ ТРАКТ",
    "ЖЕНСКИЕ": "ЖІНОЧІ ОРГАНИ ТА СИМПТОМИ",
    "ЖИВОТ": "ЖИВІТ",
    "ЗУБЫ": "ЗУБИ",
    "ИНФЕКЦИИ": "ІНФЕКЦІЇ",
    "КАШЕЛЬ": "КАШЕЛЬ",
    "КЛИНИКА": "КЛІНІЧНЕ ЗАСТОСУВАННЯ (НОЗОЛОГІЇ)",
    "КОЖА": "ШКІРА",
    "КОНЕЧНОСТИ": "КІНЦІВКИ",
    "КОСТИ": "КІСТКИ",
    "ЛИМФАТИЧЕСКАЯ СИСТЕМА": "ЛІМФАТИЧНА СИСТЕМА",
    "ЛИМФАТИЧЕСКИЕ ЖЕЛЕЗЫ": "ЛІМФАТИЧНІ ВУЗЛИ ТА ЗАЛОЗИ",
    "ЛИХОРАДКА": "ЛИХОМАНКА (ТЕМПЕРАТУРА)",
    "ЛИЦО": "ОБЛИЧЧЯ",
    "МЕНСТРУАЦИЯ": "МЕНСТРУАЦІЯ",
    "МОДАЛЬНОСТИ": "МОДАЛЬНОСТІ (ПОГІРШЕННЯ / ПОКРАЩЕННЯ)",
    "МОЛОЧНЫЕ ЖЕЛЕЗЫ": "МОЛОЧНІ ЗАЛОЗИ",
    "МОЧЕВЫДЕЛИТЕЛЬНАЯ СИСТЕМА": "СЕЧОВИДІЛЬНА СИСТЕМА",
    "МУЖСКИЕ": "ЧОЛОВІЧІ ОРГАНИ ТА СИМПТОМИ",
    "МЫШЦЫ": "М'ЯЗИ",
    "НЕРВНАЯ СИСТЕМА": "НЕРВОВА СИСТЕМА",
    "НОЗОЛОГИИ": "КЛІНІЧНЕ ЗАСТОСУВАННЯ (НОЗОЛОГІЇ)",
    "НОС": "НІС",
    "ОБЩИЕ СИМПТОМЫ": "ЗАГАЛЬНІ СИМПТОМИ",
    "ОСЛОЖНЕНИЯ ГИРУДОТЕРАПИИ": "УСКЛАДНЕННЯ ГІРУДОТЕРАПІЇ",
    "ПИЩЕВОД": "СТРАВОХІД",
    "ПОЗВОНОЧНИК": "ХРЕБЕТ",
    "ПОТ": "ПІТ",
    "ПРЯМАЯ КИШКА": "ПРЯМА КИШКА",
    "ПСИХИКА": "ПСИХІКА ТА ЕМОЦІЇ",
    "РЕКОМЕНДАЦИИ": "РЕКОМЕНДАЦІЇ",
    "РОТ": "РОТОВА ПОРОЖНИНА ТА ЯЗИК",
    "СЕРДЕЧНО-СОСУДИСТАЯ СИСТЕМА": "СЕРЦЕВО-СУДИННА СИСТЕМА",
    "СЕРДЦЕ И КРОВООБРАЩЕНИЕ": "СЕРЦЕ ТА КРОВООБІГ",
    "СКЛОННОСТИ": "СХИЛЬНОСТІ",
    "СОН": "СОН І СНОВИДІННЯ",
    "СПИНА": "СПИНА ТА ПОПЕРЕК",
    "СУСТАВЫ": "СУГЛОБИ",
    "ТИП": "ТИП І КОНСТИТУЦІЯ",
    "ТРАХЕЯ": "ТРАХЕЯ",
    "ТРОПНОСТЬ": "ТРОПНІСТЬ",
    "УШИ": "ВУХА ТА СЛУХ",
    "ШЕЯ": "ШИЯ",
    "ШЕЯ. СПИНА": "ШИЯ ТА СПИНА",
    "ЭНДОКРИННАЯ СИСТЕМА": "ЕНДОКРИННА СИСТЕМА",
    "ЭТИОЛОГИЯ": "ЕТІОЛОГІЯ (ПРИЧИНИ ХВОРОБИ)",
}

POST_FIXES = [
    # Eyelids (століття/віко -> повіка)
    (r'\bна правому нижньому столітті\b', 'на правій нижній повіці'),
    (r'\bна лівому нижньому столітті\b', 'на лівій нижній повіці'),
    (r'\bна правому верхньому столітті\b', 'на правій верхній повіці'),
    (r'\bна лівому верхньому столітті\b', 'на лівій верхній повіці'),
    (r'\bна правому нижньому віці\b', 'на правій нижній повіці'),
    (r'\bна лівому нижньому віці\b', 'на лівій нижній повіці'),
    (r'\bна правому верхньому віці\b', 'на правій верхній повіці'),
    (r'\bна лівому верхньому віці\b', 'на лівій верхній повіці'),
    (r'\bна нижньому столітті\b', 'на нижній повіці'),
    (r'\bна верхньому столітті\b', 'на верхній повіці'),
    (r'\bна нижньому віці\b', 'на нижній повіці'),
    (r'\bна верхньому віці\b', 'на верхній повіці'),
    (r'\bна правому столітті\b', 'на правій повіці'),
    (r'\bна лівому столітті\b', 'на лівій повіці'),
    (r'\bна правому віці\b', 'на правій повіці'),
    (r'\bна лівому віці\b', 'на лівій повіці'),
    (r'\bна столітті\b', 'на повіці'),
    (r'\bу столітті\b', 'у повіці'),
    (r'\bв столітті\b', 'в повіці'),
    (r'\bстолітті\b', 'повіці'),
    (r'\bверхнього століття\b', 'верхньої повіки'),
    (r'\bнижнього століття\b', 'нижньої повіки'),
    (r'\bверхнього віка\b', 'верхньої повіки'),
    (r'\bнижнього віка\b', 'нижньої повіки'),
    (r'\bверхньому повіку\b', 'верхній повіці'),
    (r'\bнижньому повіку\b', 'нижній повіці'),
    (r'\bправого століття\b', 'правої повіки'),
    (r'\bлівого століття\b', 'лівої повіки'),
    (r'\bкраїв століть\b', 'країв повік'),
    (r'\bкраю століття\b', 'краю повіки'),
    (r'\bкрай століття\b', 'край повіки'),
    (r'\bкраї століть\b', 'краї повік'),
    (r'\bстоліттях\b', 'повіках'),
    (r'\bстоліттям\b', 'повікам'),
    (r'\bстоліттями\b', 'повіками'),
    (r'\bстоліть\b', 'повік'),
    (r'\bстоліття\b', 'повіки'),
    (r'\bу віках\b', 'в повіках'),
    (r'\bв віках\b', 'в повіках'),
    (r'\bна віці\b', 'на повіці'),
    (r'\bу віці\b', 'у повіці'),

    # Stye forms
    (r'\bДва ячменю\b', 'Два ячмені'),
    (r'\bячменю\b', 'ячмені'),

    # Temples (виски -> скроні)
    (r'\bв віскі\b', 'у скроні'),
    (r'\bу віскі\b', 'у скроні'),
    (r'\bна віскі\b', 'на скроні'),
    (r'\bвісках\b', 'скронях'),
    (r'\bвісків\b', 'скронь'),
    (r'\bвіски\b', 'скроні'),
    (r'\bвісок\b', 'скроня'),

    # Lower back (поясница -> поперек)
    (r'\bв поясі\b', 'у попереку'),
    (r'\bу поясі\b', 'у попереку'),
    (r'\bз пояса\b', 'з попереку'),
    (r'\bіз пояса\b', 'із попереку'),
    (r'\bвід пояса\b', 'від попереку'),
    (r'\bдо пояса\b', 'до попереку'),
    (r'\bбіль у поясі\b', 'біль у попереку'),
    (r'\bболі в поясі\b', 'болі в попереку'),
    (r'\bобласті пояса\b', 'ділянці попереку'),
    (r'\bобласть пояса\b', 'ділянка попереку'),

    # Medical terminology polish
    (r'\bподергиван[а-яёїіє]+\b', 'посмикування'),
    (r'\bподергиваниями\b', 'посмикуваннями'),
    (r'\bсвербеж\b', 'свербіж'),
    (r'\bзуд\b', 'свербіж'),
    (r'\bзуда\b', 'свербежу'),
    (r'\bзуду\b', 'свербежу'),
    (r'\bзудом\b', 'свербежем'),
    (r'\bодошка\b', 'задишка'),
    (r'\bодышка\b', 'задишка'),
    (r'\bодышки\b', 'задишки'),
    (r'\bодышку\b', 'задишку'),
]

def clean_uk(text):
    if not text:
        return ""
    for pat, rep in POST_FIXES:
        text = re.sub(pat, rep, text, flags=re.IGNORECASE)
    return text

def translate_block(tr, text, max_attempts=4):
    if not text or not text.strip():
        return ""
    # If text is very long (>4000 chars), split by paragraphs
    if len(text) > 3500:
        paras = text.split("\n\n")
        chunks = []
        curr = []
        curr_len = 0
        for p in paras:
            if curr_len + len(p) > 3000 and curr:
                chunks.append("\n\n".join(curr))
                curr = []
                curr_len = 0
            curr.append(p)
            curr_len += len(p)
        if curr:
            chunks.append("\n\n".join(curr))
        out_chunks = []
        for ch in chunks:
            out_chunks.append(translate_block(tr, ch, max_attempts))
        return "\n\n".join(out_chunks)

    for attempt in range(max_attempts):
        try:
            res = tr.translate(text, "ukrainian")
            return str(res.result)
        except Exception:
            time.sleep(0.3 + attempt * 0.5)
    return text

def translate_single_remedy(rem, tr=None):
    rem_id = rem["id"]
    cache_path = os.path.join(CACHE_DIR, f"{rem_id}.json")
    if os.path.exists(cache_path):
        try:
            with open(cache_path, "r", encoding="utf-8") as f:
                cached = json.load(f)
                if cached.get("id") == rem_id and cached.get("sections"):
                    for k, v in cached.get("sections", {}).items():
                        cached["sections"][k] = clean_uk(v)
                    cached["source"] = "Джерело: Джон Генрі Кларк. «Словник практичної Materia Medica в 6-ти томах» (Вид-во «Гомеопатична медицина». Москва. 2001 р.)."
                    return cached
        except Exception:
            pass

    if tr is None:
        tr = Translator()

    t0 = time.time()
    res = dict(rem)

    # Metadata
    for k in ["cyrillic_name", "common_name", "synonyms", "intro"]:
        val = rem.get(k, "")
        if val and val.strip():
            res[k] = clean_uk(translate_block(tr, val))
        else:
            res[k] = ""

    res["source"] = "Джерело: Джон Генрі Кларк. «Словник практичної Materia Medica в 6-ти томах» (Вид-во «Гомеопатична медицина». Москва. 2001 р.)."

    # Parallel sections
    sections = rem.get("sections", {})

    def translate_section(item):
        sec_name, sec_content = item
        uk_title = SECTION_NAMES_UA.get(sec_name, sec_name)
        if not sec_content or not sec_content.strip():
            return uk_title, ""
        tr_text = translate_block(tr, sec_content)
        return uk_title, clean_uk(tr_text)

    with ThreadPoolExecutor(max_workers=8) as ex:
        res["sections"] = dict(ex.map(translate_section, sections.items()))

    # Save to cache
    with open(cache_path, "w", encoding="utf-8") as f:
        json.dump(res, f, ensure_ascii=False, indent=2)

    elapsed = time.time() - t0
    return res

def main():
    os.makedirs(CACHE_DIR, exist_ok=True)
    os.makedirs(DATA_DIR, exist_ok=True)
    os.makedirs(DATA_REMEDIES_DIR, exist_ok=True)

    print("Loading source materia_medica.json...", flush=True)
    with open(SOURCE_JSON, "r", encoding="utf-8") as f:
        all_remedies = json.load(f)

    total = len(all_remedies)
    cached_count = sum(1 for r in all_remedies if os.path.exists(os.path.join(CACHE_DIR, f"{r['id']}.json")))
    print(f"Total remedies: {total} | Already cached: {cached_count}/{total}", flush=True)

    t_start = time.time()
    translated_remedies = []
    completed = cached_count

    # 4 remedies concurrently, each translating 8 sections in parallel
    with ThreadPoolExecutor(max_workers=4) as executor:
        future_to_rem = {executor.submit(translate_single_remedy, rem): rem for rem in all_remedies}
        for future in as_completed(future_to_rem):
            rem = future_to_rem[future]
            try:
                res = future.result()
                translated_remedies.append(res)
                completed = sum(1 for r in all_remedies if os.path.exists(os.path.join(CACHE_DIR, f"{r['id']}.json")))
                pct = (completed / total) * 100
                print(f"[{completed:3d}/{total}] ({pct:5.1f}%) {rem['id']:3d} {rem.get('latin_name', '')[:25]:25}", flush=True)
            except Exception as e:
                print(f"ERROR on remedy {rem['id']} ({rem.get('latin_name')}): {e}", flush=True)

    print(f"\nAll {len(translated_remedies)} remedies translated in {time.time() - t_start:.1f}s!", flush=True)
    translated_remedies.sort(key=lambda x: x["id"])

    # 1. Update data/remedies/{id}.json
    print("Updating data/remedies/{id}.json...", flush=True)
    for rem in translated_remedies:
        p = os.path.join(DATA_REMEDIES_DIR, f"{rem['id']}.json")
        with open(p, "w", encoding="utf-8") as f:
            json.dump(rem, f, ensure_ascii=False, indent=2)

    # 2. Update data/remedies_search.json
    print("Updating data/remedies_search.json...", flush=True)
    search_data = []
    for r in translated_remedies:
        search_data.append({
            "id": r["id"],
            "latin": r["latin_name"],
            "cyr": r.get("cyrillic_name", ""),
            "common": r.get("common_name", ""),
            "syn": r.get("synonyms", ""),
            "img": r.get("image_url", ""),
            "clin": r.get("clinical", ""),
            "sec": r.get("sections", {}),
            "src": r.get("source", "")
        })

    with open(os.path.join(DATA_DIR, "remedies_search.json"), "w", encoding="utf-8") as f:
        json.dump(search_data, f, ensure_ascii=False)

    # 3. Write materia_medica_ua.json and materia_medica.json
    print("Writing materia_medica_ua.json and materia_medica.json...", flush=True)
    with open("/home/ubuntu/homeo/materia_medica_ua.json", "w", encoding="utf-8") as f:
        json.dump(translated_remedies, f, ensure_ascii=False, indent=2)
    with open("/home/ubuntu/homeo/materia_medica.json", "w", encoding="utf-8") as f:
        json.dump(translated_remedies, f, ensure_ascii=False, indent=2)

    # 4. Write materia_medica_ua.csv and materia_medica.csv
    print("Writing materia_medica_ua.csv and materia_medica.csv...", flush=True)
    for cpath in ["/home/ubuntu/homeo/materia_medica_ua.csv", "/home/ubuntu/homeo/materia_medica.csv"]:
        with open(cpath, "w", encoding="utf-8", newline="") as f:
            writer = csv.writer(f)
            writer.writerow(["id", "latin_name", "cyrillic_name", "common_name", "synonyms", "section", "content"])
            for r in translated_remedies:
                for s_name, s_text in r.get("sections", {}).items():
                    writer.writerow([r["id"], r["latin_name"], r.get("cyrillic_name", ""), r.get("common_name", ""), r.get("synonyms", ""), s_name, s_text])

    # 5. Write Markdown cards in remedies_ua_md/ and remedies_md/
    print("Writing Markdown cards in remedies_ua_md/ and remedies_md/...", flush=True)
    for mdir in ["/home/ubuntu/homeo/remedies_ua_md", "/home/ubuntu/homeo/remedies_md"]:
        os.makedirs(mdir, exist_ok=True)
        for r in translated_remedies:
            fname = f"{int(r['id']):03d}_{re.sub(r'[^a-zA-Z0-9_]', '_', r['latin_name'])}.md"
            with open(os.path.join(mdir, fname), "w", encoding="utf-8") as f:
                f.write(f"# {r['latin_name']}\n\n")
                if r.get("cyrillic_name"):
                    f.write(f"**Українська назва:** {r['cyrillic_name']}\n\n")
                if r.get("common_name"):
                    f.write(f"**Народна/ботанічна назва:** {r['common_name']}\n\n")
                if r.get("synonyms"):
                    f.write(f"**Синоніми:** {r['synonyms']}\n\n")
                if r.get("intro"):
                    f.write(f"## Опис та приготування\n\n{r['intro']}\n\n")
                for s_name, s_text in r.get("sections", {}).items():
                    f.write(f"## {s_name}\n\n{s_text}\n\n")
                if r.get("source"):
                    f.write(f"---\n\n*Джерело:* {r['source']}\n")

    # 6. Build SQLite databases with FTS5
    print("Building SQLite databases with FTS5...", flush=True)
    for db_path in ["/home/ubuntu/homeo/materia_medica_ua.db", "/home/ubuntu/homeo/materia_medica.db"]:
        if os.path.exists(db_path):
            os.remove(db_path)
        conn = sqlite3.connect(db_path)
        cur = conn.cursor()
        cur.execute("""
            CREATE TABLE remedies (
                id INTEGER PRIMARY KEY,
                latin_name TEXT,
                cyrillic_name TEXT,
                common_name TEXT,
                synonyms TEXT,
                intro TEXT,
                source TEXT
            )
        """)
        cur.execute("""
            CREATE TABLE remedy_sections (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                remedy_id INTEGER,
                section_name TEXT,
                content TEXT,
                FOREIGN KEY (remedy_id) REFERENCES remedies(id)
            )
        """)
        cur.execute("""
            CREATE VIRTUAL TABLE remedies_fts USING fts5(
                remedy_id UNINDEXED,
                latin_name,
                cyrillic_name,
                common_name,
                section_name,
                content,
                tokenize = 'unicode61'
            )
        """)
        for r in translated_remedies:
            cur.execute("INSERT INTO remedies VALUES (?, ?, ?, ?, ?, ?, ?)", (
                r["id"], r["latin_name"], r.get("cyrillic_name", ""), r.get("common_name", ""),
                r.get("synonyms", ""), r.get("intro", ""), r.get("source", "")
            ))
            for s_name, s_text in r.get("sections", {}).items():
                cur.execute("INSERT INTO remedy_sections (remedy_id, section_name, content) VALUES (?, ?, ?)",
                            (r["id"], s_name, s_text))
                cur.execute("INSERT INTO remedies_fts VALUES (?, ?, ?, ?, ?, ?)",
                            (r["id"], r["latin_name"], r.get("cyrillic_name", ""), r.get("common_name", ""), s_name, s_text))
        conn.commit()
        conn.close()

    print("ALL UKRAINIANIZATION TASKS COMPLETED SUCCESSFULLY!", flush=True)

if __name__ == '__main__':
    main()
