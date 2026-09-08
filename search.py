#!/usr/bin/env python3
"""
CLI search and lookup tool for Materia Medica SQLite Database.

Usage:
  python3 search.py "симптомы или диагноз"       # Full-text search across remedies
  python3 search.py --name "Aconitum"            # Exact / partial name search
  python3 search.py --id 18                      # Show detailed remedy by ID
  python3 search.py --stats                      # Show database statistics
  python3 search.py --export                     # Show available exports
"""

import sys
import sqlite3
import json
import textwrap

DB_PATH = "/home/ubuntu/homeo/materia_medica.db"

def show_stats(conn):
    cur = conn.cursor()
    cur.execute("SELECT COUNT(*) FROM remedies")
    count = cur.fetchone()[0]
    
    cur.execute("SELECT COUNT(*) FROM remedy_sections")
    sec_count = cur.fetchone()[0]
    
    cur.execute("SELECT COUNT(DISTINCT section_name) FROM remedy_sections")
    distinct_sec = cur.fetchone()[0]

    cur.execute("SELECT section_name, COUNT(*) as cnt FROM remedy_sections GROUP BY section_name ORDER BY cnt DESC LIMIT 10")
    top_sections = cur.fetchall()

    print("\n=== База Даних Materia Medica: Статистика ===")
    print(f"Всього препаратів у базі: {count}")
    print(f"Всього секцій (рубрик): {sec_count}")
    print(f"Унікальних назв рубрик: {distinct_sec}")
    print("\nНайчастіші рубрики:")
    for name, cnt in top_sections:
        print(f"  - {name}: {cnt} препаратів")
    print("=" * 45 + "\n")

def show_remedy(conn, aid):
    cur = conn.cursor()
    cur.execute("""
    SELECT id, latin_name, cyrillic_name, common_name, synonyms, full_title,
           intro, characteristics, mind, clinical, modalities, relationships, source,
           image_url, archive_url, sections_json
    FROM remedies WHERE id = ?
    """, (aid,))
    row = cur.fetchone()
    if not row:
        print(f"Препарат з ID {aid} не знайдено.")
        return

    (rid, latin, cyr, common, syn, title, intro, char, mind, clin, mod, rel, src, img, url, sec_json) = row

    print("\n" + "=" * 65)
    print(f"[{rid}] {latin} ({cyr})")
    if common:
        print(f"Народна / наукова назва: {common}")
    if syn:
        print(f"Синоніми: {syn}")
    if img:
        print(f"Зображення: {img}")
    print(f"Джерело URL: {url}")
    print("=" * 65)

    if intro:
        print("\n--- ОПИС ТА ПРИГОТУВАННЯ ---")
        print(textwrap.fill(intro, width=80))

    if char:
        print("\n--- ХАРАКТЕРИСТИКА ---")
        print(textwrap.fill(char, width=80))

    if mind:
        print("\n--- ПСИХІКА ---")
        print(textwrap.fill(mind, width=80))

    if clin:
        print("\n--- КЛІНІКА / НОЗОЛОГІЇ ---")
        print(textwrap.fill(clin, width=80))

    if mod:
        print("\n--- МОДАЛЬНОСТІ ---")
        print(textwrap.fill(mod, width=80))

    if rel:
        print("\n--- ВЗАЄМОЗВ'ЯЗКИ ---")
        print(textwrap.fill(rel, width=80))

    if src:
        print(f"\nЛітературне джерело: {src}")

    sections = json.loads(sec_json)
    print(f"\nДоступні додаткові рубрики ({len(sections)}):")
    print(", ".join(sections.keys()))
    print("=" * 65 + "\n")

def search_name(conn, term):
    cur = conn.cursor()
    q = f"%{term}%"
    cur.execute("""
    SELECT id, latin_name, cyrillic_name, common_name, full_title
    FROM remedies
    WHERE latin_name LIKE ? OR cyrillic_name LIKE ? OR common_name LIKE ?
    ORDER BY latin_name
    """, (q, q, q))
    rows = cur.fetchall()
    print(f"\nЗнайдено {len(rows)} препаратів за назвою '{term}':")
    for rid, latin, cyr, common, title in rows:
        print(f"  [ID {rid:3d}] {latin:<25} ({cyr}) - {common}")
    print()

def search_fts(conn, query):
    cur = conn.cursor()
    try:
        cur.execute("""
        SELECT r.id, r.latin_name, r.cyrillic_name, r.common_name,
               snippet(remedies_fts, -1, '«', '»', '...', 16) as snippet_match
        FROM remedies_fts
        JOIN remedies r ON r.id = remedies_fts.id
        WHERE remedies_fts MATCH ?
        LIMIT 25
        """, (query,))
        rows = cur.fetchall()
    except Exception:
        # Fallback to simple query or LIKE
        q = f"%{query}%"
        cur.execute("""
        SELECT id, latin_name, cyrillic_name, common_name, clinical, full_text
        FROM remedies
        WHERE full_text LIKE ? OR clinical LIKE ?
        LIMIT 25
        """, (q, q))
        rows = [(r[0], r[1], r[2], r[3], (r[4] or r[5])[:120] + '...') for r in cur.fetchall()]

    print(f"\nРезультати повнотекстового пошуку за запитом: '{query}' (показано до 25):")
    if not rows:
        print("  Нічого не знайдено.")
        return

    for rid, latin, cyr, common, snip in rows:
        print(f"\n[ID {rid:3d}] {latin} ({cyr}) - {common}")
        if snip:
            clean_snip = ' '.join(snip.split())
            print(f"  Фрагмент: {clean_snip}")
    print()

def main():
    if len(sys.argv) < 2:
        print(__doc__)
        return

    import os
    if not os.path.exists(DB_PATH):
        print(f"База даних ще не створена ({DB_PATH}). Запустіть build_database.py після завантаження.")
        return

    conn = sqlite3.connect(DB_PATH)
    arg = sys.argv[1]

    if arg == "--stats":
        show_stats(conn)
    elif arg == "--name" and len(sys.argv) > 2:
        search_name(conn, sys.argv[2])
    elif arg == "--id" and len(sys.argv) > 2:
        show_remedy(conn, int(sys.argv[2]))
    else:
        search_fts(conn, arg)

    conn.close()

if __name__ == "__main__":
    main()
