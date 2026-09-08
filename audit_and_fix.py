#!/usr/bin/env python3
"""
Materia Medica Ukrainian Translation Auditor & Fixer
Agent 2: Translation Quality, Medical Terminology & Texts Auditor
"""

import os
import sys
import re
import json
import csv
import sqlite3
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
import translatepy

CACHE_DIR = "/home/ubuntu/homeo/cache_ua"
DATA_REMEDIES_UA_DIR = "/home/ubuntu/homeo/data/remedies_ua"
DATA_REMEDIES_DIR = "/home/ubuntu/homeo/data/remedies"
DATA_REMEDIES_RU_DIR = "/home/ubuntu/homeo/data/remedies_ru"
DATA_DIR = "/home/ubuntu/homeo/data"
MD_DIR = "/home/ubuntu/homeo/remedies_md"

UNTRANSLATED_MAP = {
    27: ["ХАРАКТЕРИСТИКА"],
    34: ["ХАРАКТЕРИСТИКА"],
    38: ["ХАРАКТЕРИСТИКА", "ГОЛОВА", "КІНЦІВКИ"],
    39: ["ХАРАКТЕРИСТИКА"],
    40: ["ХАРАКТЕРИСТИКА"],
    43: ["ХАРАКТЕРИСТИКА", "ГОЛОВА", "КІНЦІВКИ"],
    44: ["КІНЦІВКИ"],
    48: ["ХАРАКТЕРИСТИКА", "ГОЛОВА", "АНУС І ПРЯМА КИШКА", "КІНЦІВКИ"],
    50: ["КІНЦІВКИ"],
    61: ["ХАРАКТЕРИСТИКА", "КІНЦІВКИ"],
    66: ["КІНЦІВКИ"],
    84: ["ПСИХІКА ТА ЕМОЦІЇ", "ГОРЛО"],
    85: ["ПСИХІКА ТА ЕМОЦІЇ", "ЛИХОМАНКА (ТЕМПЕРАТУРА)", "ГОЛОВА", "ШЛУНОК", "КІНЦІВКИ"],
    88: ["ХАРАКТЕРИСТИКА", "КІНЦІВКИ"],
    90: ["ХАРАКТЕРИСТИКА", "КІНЦІВКИ"],
    91: ["ХАРАКТЕРИСТИКА"],
    96: ["ЗУБИ"],
    112: ["ГОЛОВА"],
    122: ["КІНЦІВКИ"],
    123: ["ХАРАКТЕРИСТИКА", "ГОЛОВА", "КІНЦІВКИ"],
    148: ["ХАРАКТЕРИСТИКА"]
}

# Extensive regex patterns for correcting medical false friends and MT mistakes
POST_FIXES = [
    # 1. Eyelids (веко -> повіка, повіці, повіках)
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
    (r'\bкраями століть\b', 'краями повік'),
    (r'\bспазм століть\b', 'спазм повік'),
    (r'\bнабряк століть\b', 'набряк повік'),
    (r'\bзапалення століть\b', 'запалення повік'),
    (r'\bсклеювання століть\b', 'склеювання повік'),
    (r'\bпухлина століття\b', 'пухлина повіки'),
    (r'\bкістозну пухлину століття\b', 'кістозну пухлину повіки'),
    (r'\bв оці, віці\b', 'в оці, повіці'),
    (r'\bв оці,\s*віці\b', 'в оці, повіці'),
    (r'\bнавколо очей і на віках\b', 'навколо очей і на повіках'),
    (r'\bна віках\b', 'на повіках'),
    (r'\bу віках\b', 'у повіках'),
    (r'\bв віках\b', 'в повіках'),
    (r'\bотечное повіку\b', 'набрякла повіка'),
    (r'\bотечная повіка\b', 'набрякла повіка'),
    (r'\bотечні повіки\b', 'набряклі повіки'),
    (r'\bнижню повіку також набрякає\b', 'нижня повіка також набрякає'),
    (r'\bліву повіку звисає\b', 'ліва повіка звисає'),
    (r'\bправу повіку звисає\b', 'права повіка звисає'),
    (r'\bповіку і вся шкіра навколо ока набрякла\b', 'повіка і вся шкіра навколо ока набрякла'),
    (r'\bДва ячменю\b', 'Два ячмені'),
    (r'\bдва ячменю\b', 'два ячмені'),
    (r'\bкрасные края век\b', 'червоні краї повік'),
    (r'\bкрасные веки\b', 'червоні повіки'),
    (r'\bкрая век\b', 'краї повік'),
    (r'\bтяжесть век\b', 'важкість повік'),
    (r'\bвеки\b', 'повіки'),
    (r'\bвеках\b', 'повіках'),
    (r'\bвекам\b', 'повікам'),
    (r'\bвеками\b', 'повіками'),
    (r'\bвеком\b', 'повікою'),
    (r'\bвека\b', 'повіки'),

    # 2. Lower back / lumbar (поясница -> поперек)
    (r'\bв пояснице\b', 'у попереку'),
    (r'\bу пояснице\b', 'у попереку'),
    (r'\bв поясниці\b', 'у попереку'),
    (r'\bу поясниці\b', 'у попереку'),
    (r'\bпоясница\b', 'поперек'),
    (r'\bпоясницы\b', 'попереку'),
    (r'\bпоясницу\b', 'поперек'),
    (r'\bпоясницей\b', 'попереком'),
    (r'\bв поясі\b', 'у попереку'),
    (r'\bу поясі\b', 'у попереку'),
    (r'\bбіль у поясі\b', 'біль у попереку'),
    (r'\bболі в поясі\b', 'болі в попереку'),
    (r'\bломота в поясі\b', 'ломота в попереку'),
    (r'\bпростріл у поясі\b', 'простріл у попереку'),
    (r'\bтяжкість у поясі\b', 'тяжкість у попереку'),
    (r'\bобласті пояса\b', 'ділянці попереку'),
    (r'\bобласть пояса\b', 'ділянка попереку'),
    (r'\bв області поясниця\b', 'у ділянці попереку'),
    (r'\bв області попереку\b', 'у ділянці попереку'),
    (r'\bі поясниця\b', 'і попереку'),
    (r'\bта поясниця\b', 'та попереку'),
    (r'\bпоясничн[а-яіїє]+\b', 'поперековий'),
    (r'\bпоясничних\b', 'поперекових'),
    (r'\bпоясничні\b', 'поперекові'),

    # 3. Temples (виски -> скроні, не віскі)
    (r'\bв висках\b', 'у скронях'),
    (r'\bу висках\b', 'у скронях'),
    (r'\bв виске\b', 'у скроні'),
    (r'\bу виске\b', 'у скроні'),
    (r'\bв висок\b', 'у скроню'),
    (r'\bу висок\b', 'у скроню'),
    (r'\bв віскі\b', 'у скроні'),
    (r'\bу віскі\b', 'у скроні'),
    (r'\bна віскі\b', 'на скроні'),
    (r'\bвісках\b', 'скронях'),
    (r'\bвісків\b', 'скронь'),
    (r'\bстискає віскі\b', 'стискає скроні'),
    (r'\bздавлює віскі\b', 'здавлює скроні'),
    (r'\bзатиснуті віскі\b', 'затиснуті скроні'),
    (r'\bпронизує віскі\b', 'пронизує скроні'),
    (r'\bлоб і віскі\b', 'лоб і скроні'),
    (r'\bщоки, очі та віскі\b', 'щоки, очі та скроні'),
    (r'\bочі та віскі\b', 'очі та скроні'),
    (r'\bщо з\'єднує віскі\b', 'що з\'єднує скроні'),
    (r'\bВіскі:\b', 'Скроні:'),
    (r'\bвіскі та очі\b', 'скроні та очі'),
    (r'\bвіскі та шкіра черепа\b', 'скроні та шкіра черепа'),
    (r'\bвисочн[а-яіїє]+\b', 'скроневий'),
    (r'\bвисочних\b', 'скроневих'),
    (r'\bвисочної\b', 'скроневої'),
    (r'\bвисочні\b', 'скроневі'),

    # 4. Itch (зуд -> свербіж, чесотка -> короста)
    (r'\bсильнейший зуд\b', 'найсильніший свербіж'),
    (r'\bсильний зуд\b', 'сильний свербіж'),
    (r'\bзуд\b', 'свербіж'),
    (r'\bзуда\b', 'свербежу'),
    (r'\bзуду\b', 'свербежу'),
    (r'\bзудом\b', 'свербежем'),
    (r'\bзуде\b', 'свербежі'),
    (r'\bзудящ[а-яіїє]+\b', 'сверблячий'),
    (r'\bзудящие\b', 'сверблячі'),
    (r'\bзудящая\b', 'свербляча'),
    (r'\bзудящей\b', 'сверблячої'),
    (r'\bзудящих\b', 'сверблячих'),
    (r'\bзудящее\b', 'свербляче'),
    (r'\bщо зудить\b', 'що свербить'),
    (r'\bсвербеж\b', 'свербіж'),
    (r'\bчесотка\b', 'короста'),
    (r'\bчесотке\b', 'корості'),
    (r'\bчесотки\b', 'корости'),
    (r'\bчесотку\b', 'коросту'),
    (r'\bчесоткой\b', 'коростою'),

    # 5. Burning (жжение -> печіння, не жженіє)
    (r'\bжжение\b', 'печіння'),
    (r'\bжженіє\b', 'печіння'),
    (r'\bжжения\b', 'печіння'),
    (r'\bжженія\b', 'печіння'),
    (r'\bжжению\b', 'печінню'),
    (r'\bжженію\b', 'печінню'),
    (r'\bжжением\b', 'печінням'),
    (r'\bжженієм\b', 'печінням'),
    (r'\bжгучий\b', 'пекучий'),
    (r'\bжгучая\b', 'пекуча'),
    (r'\bжгучее\b', 'пекуче'),
    (r'\bжгучие\b', 'пекучі'),
    (r'\bжгучей\b', 'пекучої'),
    (r'\bжгучих\b', 'пекучих'),
    (r'\bжжет\b', 'пече'),

    # 6. Chilly (зябкий -> мерзлякуватий / чутливий до холоду)
    (r'\bЦе зябкі ліки\b', 'Це мерзлякуваті ліки'),
    (r'\bце зябкі ліки\b', 'це мерзлякуваті ліки'),
    (r'\bзябкі ліки\b', 'мерзлякуваті ліки'),
    (r'\bзябкий пацієнт\b', 'мерзлякуватий пацієнт'),
    (r'\bзябких пацієнтів\b', 'мерзлякуватих пацієнтів'),
    (r'\bзябким пацієнтам\b', 'мерзлякуватим пацієнтам'),
    (r'\bзябкий\b', 'мерзлякуватий'),
    (r'\bзябкая\b', 'мерзлякувата'),
    (r'\bзябкое\b', 'мерзлякувате'),
    (r'\bзябкие\b', 'мерзлякуваті'),
    (r'\bзябких\b', 'мерзлякуватих'),
    (r'\bзябким\b', 'мерзлякуватим'),
    (r'\bЗябкість\b', 'Мерзлякуватість'),
    (r'\bзябкість\b', 'мерзлякуватість'),
    (r'\bзябкості\b', 'мерзлякуватості'),
    (r'\bзябкостю\b', 'мерзлякуватістю'),
    (r'\bзябкость\b', 'мерзлякуватість'),
    (r'\bзяблость\b', 'мерзлякуватість'),

    # 7. Modalities (ухудшение / хуже -> погіршення / гірше; улучшение / лучше -> покращення / краще)
    (r'•\s*Хуже\.', '• Гірше.'),
    (r'\bХуже:\b', 'Гірше:'),
    (r'\bхуже от\b', 'гірше від'),
    (r'\bхуже при\b', 'гірше при'),
    (r'\bхуже в\b', 'гірше в'),
    (r'\bхуже у\b', 'гірше у'),
    (r'\bхуже ночью\b', 'гірше вночі'),
    (r'\bхуже утром\b', 'гірше вранці'),
    (r'\bхуже вечером\b', 'гірше увечері'),
    (r'\bхуже днем\b', 'гірше вдень'),
    (r'\bхуже после\b', 'гірше після'),
    (r'\bхуже до\b', 'гірше до'),
    (r'\bхуже во время\b', 'гірше під час'),
    (r'\bбуде хуже\b', 'буде гірше'),
    (r'\bстає хуже\b', 'стає гірше'),
    (r'\bстановится хуже\b', 'стає гірше'),
    (r'\bухудшение\b', 'погіршення'),
    (r'\bухудшения\b', 'погіршення'),
    (r'\bухудшению\b', 'погіршенню'),
    (r'\bухудшением\b', 'погіршенням'),
    (r'\bбіль, гірший від\b', 'біль, гірше від'),
    (r'\bбіль,\s*гірший при\b', 'біль, гірше при'),
    (r'\bбіль,\s*гірший вечорами\b', 'біль, гірше вечорами'),
    (r'\bкашель,\s*гірший\b', 'кашель, гірше'),
    (r'\bгірший при дотику\b', 'гірше при дотику'),
    (r'\bгірший увечері\b', 'гірше увечері'),
    (r'\bгірший на вдиху\b', 'гірше на вдиху'),
    (r'•\s*Лучше\.', '• Краще.'),
    (r'\bЛучше:\b', 'Краще:'),
    (r'\bлучше от\b', 'краще від'),
    (r'\bлучше при\b', 'краще при'),
    (r'\bлучше в\b', 'краще в'),
    (r'\bлучше у\b', 'краще у'),
    (r'\bлучше после\b', 'краще після'),
    (r'\bлучше на свежем воздухе\b', 'краще на свіжому повітрі'),
    (r'\bлучше на свіжому повітрі\b', 'краще на свіжому повітрі'),
    (r'\bбуде лучше\b', 'буде краще'),
    (r'\bстає лучше\b', 'стає краще'),
    (r'\bстановится лучше\b', 'стає краще'),
    (r'\bулучшение\b', 'покращення'),
    (r'\bулучшения\b', 'покращення'),
    (r'\bулучшению\b', 'покращенню'),
    (r'\bулучшением\b', 'покращенням'),
    (r'\bElaps кращий при\b', 'Elaps краще допомагає при'),

    # 8. Machine translation blunders & false friends
    (r'\bдеформацію особи\b', 'деформацію обличчя'),
    (r'\bдеформація особи\b', 'деформація обличчя'),
    (r'\bвираз особи\b', 'вираз обличчя'),
    (r'\bколір особи\b', 'колір обличчя'),
    (r'\bшкіра особи\b', 'шкіра обличчя'),
    (r'\bполовина особи\b', 'половина обличчя'),
    (r'\bгаряча особа\b', 'гаряче обличчя'),
    (r'\bчервона особа\b', 'червоне обличчя'),
    (r'\bбліда особа\b', 'бліде обличчя'),
    (r'\bнабрякла особа\b', 'набрякле обличчя'),
    (r'\bтверда освіта\b', 'тверде утворення'),
    (r'\bпухлинна освіта\b', 'пухлинне утворення'),
    (r'\bкістозна освіта\b', 'кістозне утворення'),
    (r'\bкісткова освіта\b', 'кісткове утворення'),
    (r'\bпісля легені руху\b', 'після легкого руху'),
    (r'\bвід легені руху\b', 'від легкого руху'),
    (r'\bпри легені руху\b', 'при легкому русі'),
    (r'\bлегене кровотеча\b', 'легенева кровотеча'),
    (r'\bкам\'янистої густини\b', 'кам\'янистої щільності'),
    (r'\bіз загрозою нагноения\b', 'із загрозою нагноєння'),
    (r'\bнагноения\b', 'нагноєння'),
    (r'\bжабина морда\b', 'жаб\'яча морда'),
    (r'\bжабья морда\b', 'жаб\'яча морда'),
    (r'\bокістя була болюча\b', 'окістя було болючим'),
    (r'\bподергиван[а-яёіїє]+\b', 'посмикування'),
    (r'\bподергиваниями\b', 'посмикуваннями'),
    (r'\bодышка\b', 'задишка'),
    (r'\bодышки\b', 'задишки'),
    (r'\bодышку\b', 'задишку'),
    (r'\bодошка\b', 'задишка'),
    (r'\bслюнотечение\b', 'слинотеча'),
    (r'\bслюнотечения\b', 'слинотечі'),
    (r'\bмокрота\b', 'мокротиння'),
    (r'\bмокроты\b', 'мокротиння'),
    (r'\bизжога\b', 'печія'),
    (r'\bизжоги\b', 'печії'),
    (r'\bотрыжка\b', 'відрижка'),
    (r'\bотрыжки\b', 'відрижки'),
    (r'\bвздутие\b', 'здуття'),
    (r'\bвздутия\b', 'здуття'),
    (r'\bсердцебиение\b', 'серцебиття'),
    (r'\bсердцебиения\b', 'серцебиття'),
    (r'\bголовокружение\b', 'запаморочення'),
    (r'\bголовокружения\b', 'запаморочення'),
    (r'\bдесны\b', 'ясна'),
    (r'\bдесен\b', 'ясен'),
    (r'\bдеснах\b', 'яснах'),
    (r'\bдеснами\b', 'яснами'),
]

def clean_medical_uk(text):
    if not text:
        return ""
    for pat, rep in POST_FIXES:
        text = re.sub(pat, rep, text, flags=re.IGNORECASE)
    return text

def translate_safe(tr, text, max_retries=5):
    if not text or not text.strip():
        return ""

    # If small enough, translate directly
    if len(text) <= 700:
        for attempt in range(max_retries):
            try:
                res = tr.translate(text, "ukrainian")
                res_str = str(res.result)
                ru_chars = len(re.findall(r"[ыэъёЫЭЪЁ]", res_str))
                orig_ru_chars = len(re.findall(r"[ыэъёЫЭЪЁ]", text))
                if orig_ru_chars == 0 or ru_chars <= orig_ru_chars * 0.15:
                    return res_str
                time.sleep(0.5 + attempt * 0.5)
            except Exception:
                time.sleep(0.8 + attempt * 0.8)

    # Split by paragraphs
    paras = text.split("\n\n")
    if len(paras) > 1:
        chunks = []
        curr = []
        curr_len = 0
        for p in paras:
            if curr_len + len(p) > 500 and curr:
                chunks.append("\n\n".join(curr))
                curr = []
                curr_len = 0
            curr.append(p)
            curr_len += len(p)
        if curr:
            chunks.append("\n\n".join(curr))

        translated_chunks = []
        for ch in chunks:
            translated_chunks.append(translate_safe(tr, ch, max_retries))
        return "\n\n".join(translated_chunks)

    # Split long paragraph by sentences
    sentences = re.split(r"(?<=[.!?])\s+", text)
    if len(sentences) > 1:
        chunks = []
        curr = []
        curr_len = 0
        for s in sentences:
            if curr_len + len(s) > 400 and curr:
                chunks.append(" ".join(curr))
                curr = []
                curr_len = 0
            curr.append(s)
            curr_len += len(s)
        if curr:
            chunks.append(" ".join(curr))

        translated_chunks = []
        for ch in chunks:
            translated_chunks.append(translate_safe(tr, ch, max_retries))
        return " ".join(translated_chunks)

    # Fallback attempt
    try:
        res = tr.translate(text, "ukrainian")
        return str(res.result)
    except Exception:
        return text

def translate_remaining_sections():
    print("=" * 60)
    print("STEP 1: Translating 38 remaining Russian sections in 21 remedies...")
    print("=" * 60)
    tr = translatepy.Translator()

    total_translated = 0
    for rem_id, sec_list in UNTRANSLATED_MAP.items():
        ua_path = os.path.join(DATA_REMEDIES_UA_DIR, f"{rem_id}.json")
        cache_path = os.path.join(CACHE_DIR, f"{rem_id}.json")
        ru_path = os.path.join(DATA_REMEDIES_RU_DIR, f"{rem_id}.json")

        with open(ua_path, "r", encoding="utf-8") as f:
            ua_rem = json.load(f)
        with open(ru_path, "r", encoding="utf-8") as f:
            ru_rem = json.load(f)

        latin = ua_rem.get("latin_name", "")
        updated = False

        for sec_name in sec_list:
            orig_text = ua_rem.get("sections", {}).get(sec_name, "")
            ru_count = len(re.findall(r"[ыэъёЫЭЪЁ]", orig_text))
            if ru_count > 2:
                print(f"  [{rem_id:3d}] {latin:22} -> translating '{sec_name}' ({len(orig_text)} chars, {ru_count} RU chars)...", flush=True)
                t0 = time.time()
                tr_text = translate_safe(tr, orig_text)
                tr_text = clean_medical_uk(tr_text)
                new_ru = len(re.findall(r"[ыэъёЫЭЪЁ]", tr_text))
                elapsed = time.time() - t0
                print(f"      Done in {elapsed:.1f}s. RU chars before: {ru_count} -> after: {new_ru}", flush=True)

                ua_rem["sections"][sec_name] = tr_text
                updated = True
                total_translated += 1

        if updated:
            with open(ua_path, "w", encoding="utf-8") as f:
                json.dump(ua_rem, f, ensure_ascii=False, indent=2)
            with open(cache_path, "w", encoding="utf-8") as f:
                json.dump(ua_rem, f, ensure_ascii=False, indent=2)

    print(f"\nStep 1 finished! Total sections translated: {total_translated}\n")

def clean_and_sync_all():
    print("=" * 60)
    print("STEP 2: Cleaning medical terminology across ALL 341 remedies & syncing datasets...")
    print("=" * 60)

    all_ua_files = sorted([f for f in os.listdir(DATA_REMEDIES_UA_DIR) if f.endswith(".json")], key=lambda x: int(x.split(".")[0]))
    print(f"Total remedy files to process: {len(all_ua_files)}")

    all_remedies_ua = []

    for fname in all_ua_files:
        fpath = os.path.join(DATA_REMEDIES_UA_DIR, fname)
        with open(fpath, "r", encoding="utf-8") as f:
            rem = json.load(f)

        # 1. Clean metadata
        rem["cyrillic_name"] = clean_medical_uk(rem.get("cyrillic_name", ""))
        rem["common_name"] = clean_medical_uk(rem.get("common_name", ""))
        rem["synonyms"] = clean_medical_uk(rem.get("synonyms", ""))
        rem["intro"] = clean_medical_uk(rem.get("intro", ""))
        rem["source"] = "Джерело: Джон Генрі Кларк. «Словник практичної Materia Medica в 6-ти томах» (Вид-во «Гомеопатична медицина». Москва. 2001 р.)."

        # 2. Clean all sections
        cleaned_sections = {}
        for s_name, s_text in rem.get("sections", {}).items():
            cleaned_sections[s_name] = clean_medical_uk(s_text)
        rem["sections"] = cleaned_sections

        # 3. Synchronize top-level fields with their Ukrainian section equivalents
        rem["characteristics"] = cleaned_sections.get("ХАРАКТЕРИСТИКА", "")
        rem["mind"] = cleaned_sections.get("ПСИХІКА ТА ЕМОЦІЇ", "")
        rem["clinical"] = cleaned_sections.get("КЛІНІЧНЕ ЗАСТОСУВАННЯ (НОЗОЛОГІЇ)", "")
        rem["modalities"] = cleaned_sections.get("МОДАЛЬНОСТІ (ПОГІРШЕННЯ / ПОКРАЩЕННЯ)", "")
        rem["relationships"] = cleaned_sections.get("ВЗАЄМОЗВ'ЯЗКИ ТА ПОРІВНЯННЯ", "")
        rem["type_constitution"] = cleaned_sections.get("ТИП І КОНСТИТУЦІЯ", "")
        rem["tropism"] = cleaned_sections.get("ТРОПНІСТЬ", "")
        rem["general_symptoms"] = cleaned_sections.get("ЗАГАЛЬНІ СИМПТОМИ", "")
        rem["etiology"] = cleaned_sections.get("ЕТІОЛОГІЯ (ПРИЧИНИ ХВОРОБИ)", "")

        # 4. Clean full_title and page_title
        cyr_part = f" ({rem['cyrillic_name']})" if rem.get("cyrillic_name") else ""
        com_part = f" - {rem['common_name']}" if rem.get("common_name") else ""
        rem["full_title"] = f"{rem['latin_name']}{cyr_part}{com_part}"
        rem["page_title"] = rem["full_title"]

        # 5. Clean full_text (concatenation of intro + all sections)
        full_parts = [rem.get("intro", "")] + list(cleaned_sections.values())
        rem["full_text"] = "\n\n".join([p for p in full_parts if p])

        # Write back to data/remedies_ua/{id}.json
        with open(fpath, "w", encoding="utf-8") as f:
            json.dump(rem, f, ensure_ascii=False, indent=2)

        # Write to data/remedies/{id}.json
        with open(os.path.join(DATA_REMEDIES_DIR, fname), "w", encoding="utf-8") as f:
            json.dump(rem, f, ensure_ascii=False, indent=2)

        # Write to cache_ua/{id}.json
        with open(os.path.join(CACHE_DIR, fname), "w", encoding="utf-8") as f:
            json.dump(rem, f, ensure_ascii=False, indent=2)

        all_remedies_ua.append(rem)

    print(f"Updated all 341 files in data/remedies_ua/, data/remedies/, and cache_ua/.")

    # Write data/remedies_search_ua.json and data/remedies_search.json
    print("Updating remedies_search_ua.json and remedies_search.json...")
    search_data = []
    for r in all_remedies_ua:
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

    # Write materia_medica_ua.json & materia_medica.json
    print("Writing materia_medica_ua.json & materia_medica.json...")
    with open("/home/ubuntu/homeo/materia_medica_ua.json", "w", encoding="utf-8") as f:
        json.dump(all_remedies_ua, f, ensure_ascii=False, indent=2)
    with open("/home/ubuntu/homeo/materia_medica.json", "w", encoding="utf-8") as f:
        json.dump(all_remedies_ua, f, ensure_ascii=False, indent=2)

    # Write materia_medica_ua.csv & materia_medica.csv
    print("Writing materia_medica_ua.csv & materia_medica.csv...")
    for cpath in ["/home/ubuntu/homeo/materia_medica_ua.csv", "/home/ubuntu/homeo/materia_medica.csv"]:
        with open(cpath, "w", encoding="utf-8", newline="") as f:
            writer = csv.writer(f)
            writer.writerow(["id", "latin_name", "cyrillic_name", "common_name", "synonyms", "section", "content"])
            for r in all_remedies_ua:
                for s_name, s_text in r.get("sections", {}).items():
                    writer.writerow([r["id"], r["latin_name"], r.get("cyrillic_name", ""), r.get("common_name", ""), r.get("synonyms", ""), s_name, s_text])

    # Re-generate remedies_md/*.md
    print("Re-generating Markdown cards in remedies_md/...")
    os.makedirs(MD_DIR, exist_ok=True)
    for r in all_remedies_ua:
        fname = f"{int(r['id']):03d}_{re.sub(r'[^a-zA-Z0-9_]', '_', r['latin_name'])}.md"
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
        for r in all_remedies_ua:
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

    print("\nALL CLEANING AND SYNCHRONIZATION TASKS COMPLETED SUCCESSFULLY!\n")

if __name__ == "__main__":
    translate_remaining_sections()
    clean_and_sync_all()
