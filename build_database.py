#!/usr/bin/env python3
"""
Materia Medica Database Builder
Parses raw HTML archives of homeopat-sam.com remedies, builds SQLite database with FTS5,
and exports data to JSON, CSV, and Markdown formats.
"""

import os
import re
import sys
import json
import csv
import sqlite3
import html
from collections import Counter

INDEX_FILE = "/home/ubuntu/homeo/materia_medica_index.html"
RAW_DIR = "/home/ubuntu/homeo/raw_html"
DB_FILE = "/home/ubuntu/homeo/materia_medica.db"
JSON_FILE = "/home/ubuntu/homeo/materia_medica.json"
CSV_FILE = "/home/ubuntu/homeo/materia_medica.csv"
MD_DIR = "/home/ubuntu/homeo/remedies_md"

BASE_ARCHIVE = "http://web.archive.org"
BASE_ORIGINAL = "http://homeopat-sam.com"

def get_index_remedies():
    with open(INDEX_FILE, "r", encoding="utf-8", errors="replace") as f:
        content = f.read()

    titles_pos = content.find('<div id="titles">')
    if titles_pos == -1:
        titles_pos = 0
    titles_block = content[titles_pos:content.find('<div id="footer"')]

    links = re.findall(r'<a\s+[^>]*href=[\'"]([^\'"]+)[\'"][^>]*>(.*?)</a>', titles_block, re.DOTALL)
    
    remedies = {}
    for href, text in links:
        m = re.search(r'/a(\d+)$', href.strip())
        if not m:
            continue
        aid = int(m.group(1))
        if aid in remedies:
            continue
        
        clean_text = re.sub(r'<[^>]+>', '', text).strip()
        clean_text = html.unescape(clean_text)
        clean_text = re.sub(r'\s+', ' ', clean_text)
        
        raw_href = re.sub(r'(/web/\d+)/', r'\1id_/', href.strip())
        full_archive_url = BASE_ARCHIVE + raw_href if raw_href.startswith('/') else raw_href
        
        orig_url_match = re.search(r'/http://([^/]+.*)$', href.strip())
        if orig_url_match:
            orig_url = "http://" + orig_url_match.group(1)
        else:
            orig_url = BASE_ORIGINAL + f"/-/a{aid}"

        remedies[aid] = {
            "id": aid,
            "index_title": clean_text,
            "archive_url": full_archive_url,
            "original_url": orig_url,
            "orig_href": href.strip()
        }
    return remedies

def parse_title(raw_title):
    t = raw_title.strip()
    synonyms = ""
    if "=" in t:
        parts = t.split("=", 1)
        t = parts[0].strip()
        rest = parts[1].strip()
        dash_match = re.search(r'\s+[-–—]\s+', rest)
        if dash_match:
            synonyms = rest[:dash_match.start()].strip()
            common_from_syn = rest[dash_match.end():].strip()
        else:
            synonyms = rest
            common_from_syn = ""
    else:
        common_from_syn = ""

    dash_match = re.search(r'\s+[-–—]\s+', t)
    if dash_match:
        latin_cyr = t[:dash_match.start()].strip()
        common = t[dash_match.end():].strip()
    else:
        latin_cyr = t
        common = ""

    if common_from_syn and not common:
        common = common_from_syn
    elif common_from_syn and common:
        common = common + "; " + common_from_syn

    cyr_match = re.search(r'\(([^)]+)\)', latin_cyr)
    if cyr_match:
        cyrillic = cyr_match.group(1).strip()
        latin = latin_cyr[:cyr_match.start()].strip()
    else:
        cyrillic = ""
        latin = latin_cyr

    return {
        "latin_name": latin.strip(),
        "cyrillic_name": cyrillic.strip(),
        "common_name": common.strip(),
        "synonyms": synonyms.strip()
    }

def clean_html_text(text):
    text = re.sub(r'<br\s*/?>', '\n', text)
    text = re.sub(r'</?(div|p|h[1-6]|tr|td|li|ul|ol)[^>]*>', '\n', text)
    text = re.sub(r'<[^>]+>', '', text)
    text = html.unescape(text)
    lines = [re.sub(r'[ \t\xa0]+', ' ', l).strip() for l in text.splitlines()]
    res = []
    prev_empty = False
    for l in lines:
        if l:
            res.append(l)
            prev_empty = False
        elif not prev_empty:
            res.append('')
            prev_empty = True
    return '\n'.join(res).strip()

def parse_remedy_html(aid, fpath, index_meta):
    with open(fpath, "r", encoding="utf-8", errors="replace") as f:
        raw = f.read()

    title_match = re.search(r'<title>(.*?)</title>', raw, re.I)
    page_title = html.unescape(title_match.group(1).strip()) if title_match else ""

    h1_match = re.search(r'<h1>(.*?)</h1>', raw, re.I)
    h1 = html.unescape(h1_match.group(1).strip()) if h1_match else ""

    text_match = re.search(r'<div id=\"text\">(.*?)(?:<div id=\"ad\">|<table id=\"footer\">)', raw, re.DOTALL)
    if not text_match:
        return None

    content_html = text_match.group(1)

    # Extract image
    img_match = re.search(r'<img[^>]+src=[\'"]([^\'"]+)[\'"]', content_html)
    img_url = ""
    if img_match:
        img_src = img_match.group(1).strip()
        if "http://" in img_src:
            img_url = img_src
        else:
            img_url = BASE_ORIGINAL + ("/" if not img_src.startswith("/") else "") + img_src

    # Identify and delimit section headers
    def replace_header(m):
        h = re.sub(r'<[^>]+>', '', m.group(1)).replace('&nbsp;', ' ').strip()
        h_clean = re.sub(r'[ \t\xa0]+', ' ', h)
        if re.match(r'^[А-ЯA-Z0-9\s.,–—\-«»()]{3,}$', h_clean) and any(c.isupper() for c in h_clean):
            return f'\n[[[SECTION: {h_clean}]]]\n'
        return m.group(0)

    delim = re.sub(r'<(?:span|p|div)[^>]*style=[\'"][^\'"]*color:\s*#(?:0000cd|006400|800080|000080|000000)[^\'"]*[\'"][^>]*><strong>(.*?)</strong></(?:span|p|div)>', replace_header, content_html, flags=re.I)
    delim = re.sub(r'<strong>\s*([А-ЯA-Z0-9\s.,–—\-«»()]{3,})\s*</strong>', replace_header, delim)

    clean_full = clean_html_text(delim)
    parts = re.split(r'\[\[\[SECTION:\s*(.*?)\s*\]\]\]', clean_full)

    intro = parts[0].strip()
    raw_sections = {}
    for i in range(1, len(parts), 2):
        sec_name = parts[i].strip()
        sec_text = parts[i+1].strip() if i+1 < len(parts) else ""
        if sec_text:
            raw_sections[sec_name] = sec_text

    # Extract source citation if present
    source = ""
    cleaned_sections = {}
    for sec_name, sec_text in raw_sections.items():
        if "Источник:" in sec_text or sec_name.startswith("ИСТОЧНИК"):
            src_m = re.search(r'(Источник:.*?)$', sec_text, re.DOTALL)
            if src_m:
                source = src_m.group(1).strip()
                cleaned_text = sec_text[:src_m.start()].strip()
                if cleaned_text:
                    cleaned_sections[sec_name] = cleaned_text
            elif sec_name.startswith("ИСТОЧНИК"):
                source = sec_text
            else:
                cleaned_sections[sec_name] = sec_text
        else:
            cleaned_sections[sec_name] = sec_text

    # If source wasn't found in sections, check clean_full
    if not source:
        src_m = re.search(r'(Источник:.*?)$', clean_full, re.DOTALL)
        if src_m:
            source = src_m.group(1).strip()

    # Title parsing
    best_title = index_meta.get("index_title", "") or page_title or h1
    names = parse_title(best_title)
    if not names["latin_name"] and h1:
        names["latin_name"] = h1

    # Extract primary fields from sections
    def get_sec(possible_keys):
        for k in possible_keys:
            for s_key, s_val in cleaned_sections.items():
                if k.lower() in s_key.lower():
                    return s_val
        return ""

    characteristics = get_sec(["ХАРАКТЕРИСТИКА", "ХАРАКТРИСТИКА"])
    mind = get_sec(["ПСИХИКА"])
    type_const = get_sec(["ТИП"])
    tropism = get_sec(["ТРОПНОСТЬ"])
    clinical = get_sec(["КЛИНИКА", "НОЗОЛОГИИ"])
    general_symp = get_sec(["ОБЩИЕ СИМПТОМЫ", "ОБЩИЕ"])
    modalities = get_sec(["МОДАЛЬНОСТИ"])
    etiology = get_sec(["ЭТИОЛОГИЯ"])
    relationships = get_sec(["ВЗАИМОСВЯЗИ", "ВЗАИМООТНОШЕНИЯ"])

    # Full plain text without tags or section delimiters
    full_plain = clean_html_text(re.sub(r'\[\[\[SECTION:\s*(.*?)\s*\]\]\]', r'\n\1\n', delim))

    return {
        "id": aid,
        "latin_name": names["latin_name"],
        "cyrillic_name": names["cyrillic_name"],
        "common_name": names["common_name"],
        "synonyms": names["synonyms"],
        "full_title": best_title,
        "page_title": page_title,
        "h1": h1,
        "image_url": img_url,
        "intro": intro,
        "characteristics": characteristics,
        "mind": mind,
        "type_constitution": type_const,
        "tropism": tropism,
        "clinical": clinical,
        "general_symptoms": general_symp,
        "modalities": modalities,
        "etiology": etiology,
        "relationships": relationships,
        "source": source,
        "sections": cleaned_sections,
        "full_text": full_plain,
        "archive_url": index_meta.get("archive_url", ""),
        "original_url": index_meta.get("original_url", "")
    }

def create_database(remedies_data):
    if os.path.exists(DB_FILE):
        os.remove(DB_FILE)

    conn = sqlite3.connect(DB_FILE)
    cur = conn.cursor()

    cur.execute("""
    CREATE TABLE remedies (
        id INTEGER PRIMARY KEY,
        latin_name TEXT,
        cyrillic_name TEXT,
        common_name TEXT,
        synonyms TEXT,
        full_title TEXT,
        h1 TEXT,
        image_url TEXT,
        intro TEXT,
        characteristics TEXT,
        mind TEXT,
        type_constitution TEXT,
        tropism TEXT,
        clinical TEXT,
        general_symptoms TEXT,
        modalities TEXT,
        etiology TEXT,
        relationships TEXT,
        source TEXT,
        sections_json TEXT,
        full_text TEXT,
        archive_url TEXT,
        original_url TEXT
    );
    """)

    cur.execute("CREATE INDEX idx_remedies_latin ON remedies(latin_name);")
    cur.execute("CREATE INDEX idx_remedies_cyrillic ON remedies(cyrillic_name);")
    cur.execute("CREATE INDEX idx_remedies_common ON remedies(common_name);")

    cur.execute("""
    CREATE TABLE remedy_sections (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        remedy_id INTEGER,
        section_name TEXT,
        section_text TEXT,
        FOREIGN KEY (remedy_id) REFERENCES remedies(id)
    );
    """)
    cur.execute("CREATE INDEX idx_sec_remedy ON remedy_sections(remedy_id);")
    cur.execute("CREATE INDEX idx_sec_name ON remedy_sections(section_name);")

    # FTS5 Full-Text Search table
    cur.execute("""
    CREATE VIRTUAL TABLE remedies_fts USING fts5(
        id UNINDEXED,
        latin_name,
        cyrillic_name,
        common_name,
        clinical,
        characteristics,
        mind,
        modalities,
        full_text
    );
    """)

    for r in remedies_data:
        sections_json = json.dumps(r["sections"], ensure_ascii=False)
        cur.execute("""
        INSERT INTO remedies (
            id, latin_name, cyrillic_name, common_name, synonyms, full_title,
            h1, image_url, intro, characteristics, mind, type_constitution,
            tropism, clinical, general_symptoms, modalities, etiology,
            relationships, source, sections_json, full_text, archive_url, original_url
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            r["id"], r["latin_name"], r["cyrillic_name"], r["common_name"], r["synonyms"], r["full_title"],
            r["h1"], r["image_url"], r["intro"], r["characteristics"], r["mind"], r["type_constitution"],
            r["tropism"], r["clinical"], r["general_symptoms"], r["modalities"], r["etiology"],
            r["relationships"], r["source"], sections_json, r["full_text"], r["archive_url"], r["original_url"]
        ))

        # Insert sections
        for s_name, s_text in r["sections"].items():
            cur.execute("INSERT INTO remedy_sections (remedy_id, section_name, section_text) VALUES (?, ?, ?)",
                        (r["id"], s_name, s_text))

        # Insert FTS
        cur.execute("""
        INSERT INTO remedies_fts (
            id, latin_name, cyrillic_name, common_name, clinical,
            characteristics, mind, modalities, full_text
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            r["id"], r["latin_name"], r["cyrillic_name"], r["common_name"],
            r["clinical"], r["characteristics"], r["mind"], r["modalities"], r["full_text"]
        ))

    conn.commit()
    conn.close()
    print(f"SQLite database created successfully: {DB_FILE}")

def export_json(remedies_data):
    with open(JSON_FILE, "w", encoding="utf-8") as f:
        json.dump(remedies_data, f, ensure_ascii=False, indent=2)
    print(f"JSON database exported: {JSON_FILE} ({os.path.getsize(JSON_FILE)} bytes)")

def export_csv(remedies_data):
    fields = [
        "id", "latin_name", "cyrillic_name", "common_name", "synonyms", "full_title",
        "image_url", "intro", "characteristics", "mind", "type_constitution",
        "tropism", "clinical", "general_symptoms", "modalities", "etiology",
        "relationships", "source", "archive_url", "original_url"
    ]
    with open(CSV_FILE, "w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fields, extrasaction="ignore")
        writer.writeheader()
        for r in remedies_data:
            writer.writerow(r)
    print(f"CSV database exported: {CSV_FILE} ({os.path.getsize(CSV_FILE)} bytes)")

def export_markdown_files(remedies_data):
    os.makedirs(MD_DIR, exist_ok=True)
    for r in remedies_data:
        clean_latin = re.sub(r'[^a-zA-Z0-9_\-]+', '_', r["latin_name"]).strip('_')
        fname = f"{r['id']:03d}_{clean_latin}.md"
        fpath = os.path.join(MD_DIR, fname)
        
        lines = []
        lines.append(f"# {r['full_title']}\n")
        lines.append(f"- **Latin:** `{r['latin_name']}`")
        if r['cyrillic_name']:
            lines.append(f"- **Cyrillic:** {r['cyrillic_name']}")
        if r['common_name']:
            lines.append(f"- **Common Name:** {r['common_name']}")
        if r['synonyms']:
            lines.append(f"- **Synonyms:** {r['synonyms']}")
        if r['image_url']:
            lines.append(f"- **Image:** {r['image_url']}")
        lines.append(f"- **Source URL:** {r['archive_url']}\n")
        
        if r['intro']:
            lines.append("## Описание и приготовление")
            lines.append(r['intro'] + "\n")
            
        for s_name, s_text in r['sections'].items():
            lines.append(f"## {s_name}")
            lines.append(s_text + "\n")
            
        if r['source']:
            lines.append(f"---\n*{r['source']}*\n")
            
        with open(fpath, "w", encoding="utf-8") as f:
            f.write("\n".join(lines))
            
    print(f"Markdown individual files exported to: {MD_DIR}/ ({len(remedies_data)} files)")

def main():
    index_remedies = get_index_remedies()
    total_index = len(index_remedies)
    print(f"Total remedies defined in index: {total_index}")

    remedies_data = []
    missing_files = []

    for aid, meta in sorted(index_remedies.items()):
        fpath = os.path.join(RAW_DIR, f"{aid}.html")
        if not os.path.exists(fpath) or os.path.getsize(fpath) < 500:
            missing_files.append((aid, meta["index_title"]))
            continue
        parsed = parse_remedy_html(aid, fpath, meta)
        if parsed:
            remedies_data.append(parsed)

    print(f"Successfully parsed: {len(remedies_data)} / {total_index} remedies.")
    if missing_files:
        print(f"Warning: {len(missing_files)} files not downloaded yet: {missing_files[:5]}")

    create_database(remedies_data)
    export_json(remedies_data)
    export_csv(remedies_data)
    export_markdown_files(remedies_data)

    print("\nDatabase build finished!")

if __name__ == "__main__":
    main()
