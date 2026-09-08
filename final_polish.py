#!/usr/bin/env python3
"""
Final Polish for Ukrainian Materia Medica
Fixes the remaining ~15 precise terms and regenerates all synchronized datasets.
"""

import os
import re
import json
import csv
import sqlite3

DATA_REMEDIES_UA_DIR = "/home/ubuntu/homeo/data/remedies_ua"
DATA_REMEDIES_DIR = "/home/ubuntu/homeo/data/remedies"
CACHE_DIR = "/home/ubuntu/homeo/cache_ua"
DATA_DIR = "/home/ubuntu/homeo/data"
MD_DIR = "/home/ubuntu/homeo/remedies_md"

# Remove duplicate / orphan markdown files
orphan_md = os.path.join(MD_DIR, "086_Magnesium_muriaticum______________________.md")
if os.path.exists(orphan_md):
    os.remove(orphan_md)
    print(f"Removed orphan file: {orphan_md}")

# Load and polish all 341 files
all_ua_files = sorted([f for f in os.listdir(DATA_REMEDIES_UA_DIR) if f.endswith(".json")], key=lambda x: int(x.split(".")[0]))
all_remedies = []

EXACT_REPLACEMENTS = [
    (r'\bнесвертывающейся крові\b', 'рідкої крові, що не згортається'),
    (r'\bсором дыхания\b', 'утруднення дихання'),
    (r'\bпсоричных\b', 'псоричних'),
    (r'\bНагноительные процеси\b', 'Нагнійні процеси'),
    (r'\bнагноительные процеси\b', 'нагнійні процеси'),
    (r'\bфликтены\b', 'фліктени'),
    (r'\bфликтен\b', 'фліктен'),
    (r'\bРодимые плями\b', 'Родимі плями'),
    (r'\bродимые плями\b', 'родимі плями'),
    (r'\bElectricitas \(Электрицитас\)\b', 'Electricitas (Електрицитас)'),
    (r'\bсімейства мириковые\b', 'родини восковицевих'),
    (r'\bкомковатым\b', 'грудкуватим'),
    (r'\bСкиррозные\b', 'Скірозні'),
    (r'\bскиррозные\b', 'скірозні'),
    (r'\bригидны\b', 'ригідні'),
    (r'\bконгестивные\b', 'конгестивні'),
    # Lower back fixes
    (r'і\s+поясниця\.', 'і попереку.'),
    (r'в\s+поясниця\.', 'в попереку.'),
    (r'в\s+області(\s+)поясниця\.', r'у ділянці\1попереку.'),
    # Temple fixes (avoiding alcohol whiskey)
    (r'на очі і віскі\.', 'на очі і скроні.'),
    (r'ніби віскі здавлює', 'ніби скроні здавлює'),
    (r'ніби віскі затиснуті', 'ніби скроні затиснуті'),
    (r'Віскі:\s*давить біль в обох скронях', 'Скроні: давить біль в обох скронях'),
    (r'віскі\)\.', 'скроні).'),
    (r'на лоб, віскі, вуха', 'на лоб, скроні, вуха'),
    (r'у вуха і віскі\.', 'у вуха і скроні.'),
    # Eyelid fixes
    (r'рухи очей та вік болючі', 'рухи очей та повік болючі'),
    (r'Набряклість вік,', 'Набряклість повік,'),
]

for fname in all_ua_files:
    fpath = os.path.join(DATA_REMEDIES_UA_DIR, fname)
    with open(fpath, "r", encoding="utf-8") as f:
        rem = json.load(f)

    # Remedy 86 special fix
    if rem["id"] == 86:
        rem["latin_name"] = "Magnesium muriaticum"
        rem["cyrillic_name"] = "Магнезіум муріатікум"

    # Remedy 456 special fix (Cyrillic р in Limulus cycloрs)
    if rem["id"] == 456:
        rem["latin_name"] = "Limulus cyclops"

    # Apply exact replacements across metadata
    for field in ["cyrillic_name", "common_name", "synonyms", "intro"]:
        val = rem.get(field, "")
        if val:
            for pat, rep in EXACT_REPLACEMENTS:
                val = re.sub(pat, rep, val, flags=re.IGNORECASE)
            rem[field] = val

    # Apply exact replacements across sections
    cleaned_sections = {}
    for s_name, s_text in rem.get("sections", {}).items():
        val = s_text
        for pat, rep in EXACT_REPLACEMENTS:
            val = re.sub(pat, rep, val)
        cleaned_sections[s_name] = val
    rem["sections"] = cleaned_sections

    # Synchronize top-level fields
    rem["characteristics"] = cleaned_sections.get("ХАРАКТЕРИСТИКА", "")
    rem["mind"] = cleaned_sections.get("ПСИХІКА ТА ЕМОЦІЇ", "")
    rem["clinical"] = cleaned_sections.get("КЛІНІЧНЕ ЗАСТОСУВАННЯ (НОЗОЛОГІЇ)", "")
    rem["modalities"] = cleaned_sections.get("МОДАЛЬНОСТІ (ПОГІРШЕННЯ / ПОКРАЩЕННЯ)", "")
    rem["relationships"] = cleaned_sections.get("ВЗАЄМОЗВ'ЯЗКИ ТА ПОРІВНЯННЯ", "")
    rem["type_constitution"] = cleaned_sections.get("ТИП І КОНСТИТУЦІЯ", "")
    rem["tropism"] = cleaned_sections.get("ТРОПНІСТЬ", "")
    rem["general_symptoms"] = cleaned_sections.get("ЗАГАЛЬНІ СИМПТОМИ", "")
    rem["etiology"] = cleaned_sections.get("ЕТІОЛОГІЯ (ПРИЧИНИ ХВОРОБИ)", "")

    cyr_part = f" ({rem['cyrillic_name']})" if rem.get("cyrillic_name") else ""
    com_part = f" - {rem['common_name']}" if rem.get("common_name") else ""
    rem["full_title"] = f"{rem['latin_name']}{cyr_part}{com_part}"
    rem["page_title"] = rem["full_title"]

    full_parts = [rem.get("intro", "")] + list(cleaned_sections.values())
    rem["full_text"] = "\n\n".join([p for p in full_parts if p])

    # Save to remedies_ua, remedies, and cache_ua
    with open(fpath, "w", encoding="utf-8") as f:
        json.dump(rem, f, ensure_ascii=False, indent=2)
    with open(os.path.join(DATA_REMEDIES_DIR, fname), "w", encoding="utf-8") as f:
        json.dump(rem, f, ensure_ascii=False, indent=2)
    with open(os.path.join(CACHE_DIR, fname), "w", encoding="utf-8") as f:
        json.dump(rem, f, ensure_ascii=False, indent=2)

    all_remedies.append(rem)

print(f"Updated all {len(all_remedies)} remedy JSON files.")

# Update remedies_search_ua.json and remedies_search.json
print("Updating remedies_search_ua.json and remedies_search.json...")
search_data = []
for r in all_remedies:
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

with open(os.path.join(DATA_DIR, "remedies_search_ua.json"), "w", encoding="utf-8") as f:
    json.dump(search_data, f, ensure_ascii=False)
with open(os.path.join(DATA_DIR, "remedies_search.json"), "w", encoding="utf-8") as f:
    json.dump(search_data, f, ensure_ascii=False)

# Update materia_medica_ua.json & materia_medica.json
print("Writing materia_medica_ua.json & materia_medica.json...")
with open("/home/ubuntu/homeo/materia_medica_ua.json", "w", encoding="utf-8") as f:
    json.dump(all_remedies, f, ensure_ascii=False, indent=2)
with open("/home/ubuntu/homeo/materia_medica.json", "w", encoding="utf-8") as f:
    json.dump(all_remedies, f, ensure_ascii=False, indent=2)

# Update materia_medica_ua.csv & materia_medica.csv
print("Writing materia_medica_ua.csv & materia_medica.csv...")
for cpath in ["/home/ubuntu/homeo/materia_medica_ua.csv", "/home/ubuntu/homeo/materia_medica.csv"]:
    with open(cpath, "w", encoding="utf-8", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(["id", "latin_name", "cyrillic_name", "common_name", "synonyms", "section", "content"])
        for r in all_remedies:
            for s_name, s_text in r.get("sections", {}).items():
                writer.writerow([r["id"], r["latin_name"], r.get("cyrillic_name", ""), r.get("common_name", ""), r.get("synonyms", ""), s_name, s_text])

# Clear and rewrite remedies_md/*.md
print("Re-generating clean Markdown cards in remedies_md/...")
# Remove old md files first to prevent any orphans
for old_f in os.listdir(MD_DIR):
    if old_f.endswith(".md"):
        os.remove(os.path.join(MD_DIR, old_f))

for r in all_remedies:
    clean_latin = re.sub(r'[^a-zA-Z0-9_]', '_', r['latin_name'])
    fname = f"{int(r['id']):03d}_{clean_latin}.md"
    with open(os.path.join(MD_DIR, fname), "w", encoding="utf-8") as f:
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

# Rebuild SQLite databases
print("Rebuilding SQLite databases (materia_medica_ua.db and materia_medica.db)...")
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
    for r in all_remedies:
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

print("\nFinal Polish complete!\n")
