#!/usr/bin/env python3
"""
Scraper for Materia Medica from homeopat-sam.com via Wayback Machine.
Downloads all 341 remedy articles using a polite thread pool with retries and disk caching.
"""

import os
import re
import sys
import time
import concurrent.futures
import urllib.request
import urllib.parse

INDEX_FILE = "/home/ubuntu/homeo/materia_medica_index.html"
RAW_DIR = "/home/ubuntu/homeo/raw_html"
BASE_ARCHIVE = "http://web.archive.org"
USER_AGENT = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

def get_remedy_list():
    if not os.path.exists(INDEX_FILE):
        raise FileNotFoundError(f"{INDEX_FILE} not found!")

    with open(INDEX_FILE, "r", encoding="utf-8", errors="replace") as f:
        content = f.read()

    titles_pos = content.find('<div id="titles">')
    if titles_pos == -1:
        titles_pos = 0
    titles_block = content[titles_pos:content.find('<div id="footer"')]

    links = re.findall(r'<a\s+[^>]*href=[\'"]([^\'"]+)[\'"][^>]*>(.*?)</a>', titles_block, re.DOTALL)
    
    remedies = []
    seen = set()
    for href, text in links:
        m = re.search(r'/a(\d+)$', href.strip())
        if not m:
            continue
        aid = int(m.group(1))
        if aid in seen:
            continue
        seen.add(aid)
        
        clean_text = re.sub(r'<[^>]+>', '', text).strip()
        # Create raw Wayback URL using id_ modifier
        raw_href = re.sub(r'(/web/\d+)/', r'\1id_/', href.strip())
        quoted = urllib.parse.quote(raw_href, safe='/:?&=')
        full_url = urllib.parse.urljoin(BASE_ARCHIVE, quoted)
        
        remedies.append({
            "id": aid,
            "title": clean_text,
            "url": full_url,
            "orig_href": href.strip()
        })
    return remedies

def fetch_url(url, max_retries=6, initial_backoff=2.0):
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    for attempt in range(max_retries):
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                if resp.status == 200:
                    return resp.read()
        except urllib.error.HTTPError as e:
            if e.code == 404:
                # Try fallback without id_
                fb_url = url.replace("id_/", "/")
                try:
                    fb_req = urllib.request.Request(fb_url, headers={"User-Agent": USER_AGENT})
                    with urllib.request.urlopen(fb_req, timeout=30) as fb_resp:
                        if fb_resp.status == 200:
                            return fb_resp.read()
                except Exception:
                    pass
                return None
            print(f"  [Attempt {attempt+1}/{max_retries}] HTTP error on {url}: {e}", flush=True)
        except Exception as e:
            print(f"  [Attempt {attempt+1}/{max_retries}] Net error on {url}: {e}", flush=True)
        
        time.sleep(initial_backoff * (1.5 ** attempt))
    return None

def download_remedy(r):
    aid = r["id"]
    filepath = os.path.join(RAW_DIR, f"{aid}.html")
    if os.path.exists(filepath) and os.path.getsize(filepath) > 1000:
        return aid, "cached", len(open(filepath, 'rb').read())
    
    data = fetch_url(r["url"])
    if data and len(data) > 500:
        with open(filepath, "wb") as f:
            f.write(data)
        return aid, "downloaded", len(data)
    return aid, "failed", 0

def download_all(max_workers=3):
    os.makedirs(RAW_DIR, exist_ok=True)
    remedies = get_remedy_list()
    total = len(remedies)
    print(f"Starting download of {total} remedies with {max_workers} workers...", flush=True)

    completed = 0
    cached = 0
    downloaded = 0
    failed = []

    t_start = time.time()
    with concurrent.futures.ThreadPoolExecutor(max_workers=max_workers) as executor:
        future_to_r = {executor.submit(download_remedy, r): r for r in remedies}
        for future in concurrent.futures.as_completed(future_to_r):
            r = future_to_r[future]
            try:
                aid, status, size = future.result()
                completed += 1
                if status == "cached":
                    cached += 1
                elif status == "downloaded":
                    downloaded += 1
                else:
                    failed.append(r)
                
                if completed % 20 == 0 or completed == total:
                    elapsed = time.time() - t_start
                    print(f"[{completed}/{total}] Progress: {downloaded} new, {cached} cached, {len(failed)} failed ({elapsed:.1f}s)", flush=True)
            except Exception as exc:
                print(f"Remedy {r['id']} generated an exception: {exc}", flush=True)
                failed.append(r)

    print("\n--- Download complete ---", flush=True)
    print(f"Total remedies: {total}")
    print(f"Downloaded: {downloaded}")
    print(f"From cache: {cached}")
    print(f"Failed: {len(failed)}")

    # Retry failed remedies sequentially if any
    if failed:
        print(f"\nRetrying {len(failed)} failed items sequentially...", flush=True)
        still_failed = []
        for r in failed:
            print(f"Retrying #{r['id']}: {r['title']}...", flush=True)
            aid, status, size = download_remedy(r)
            if status == "downloaded":
                downloaded += 1
            else:
                still_failed.append(r)
            time.sleep(1.0)
        print(f"After sequential retry, failed remaining: {len(still_failed)}")

if __name__ == "__main__":
    workers = int(sys.argv[1]) if len(sys.argv) > 1 else 3
    download_all(max_workers=workers)
