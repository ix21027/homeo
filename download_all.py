#!/usr/bin/env python3
"""
Robust, keep-alive downloader for Materia Medica from homeopat-sam.com via Wayback Machine.
Downloads all 341 remedy articles and saves them to raw_html/<id>.html.
"""

import os
import re
import sys
import time
import http.client
import urllib.parse

INDEX_FILE = "/home/ubuntu/homeo/materia_medica_index.html"
RAW_DIR = "/home/ubuntu/homeo/raw_html"
USER_AGENT = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

def get_remedy_list():
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
        # Format raw Wayback URL using id_ modifier
        raw_href = re.sub(r'(/web/\d+)/', r'\1id_/', href.strip())
        quoted = urllib.parse.quote(raw_href, safe='/:?&=')
        
        remedies.append({
            "id": aid,
            "title": clean_text,
            "path": quoted,
            "orig_href": href.strip()
        })
    return remedies

class ArchiveClient:
    def __init__(self, host="web.archive.org", timeout=25):
        self.host = host
        self.timeout = timeout
        self.conn = None
        self._connect()

    def _connect(self):
        if self.conn:
            try:
                self.conn.close()
            except Exception:
                pass
        self.conn = http.client.HTTPConnection(self.host, timeout=self.timeout)

    def get(self, path, max_retries=5):
        headers = {
            "User-Agent": USER_AGENT,
            "Connection": "keep-alive"
        }
        for attempt in range(max_retries):
            try:
                self.conn.request("GET", path, headers=headers)
                resp = self.conn.getresponse()
                status = resp.status
                loc = resp.getheader("Location")
                body = resp.read()

                if status == 200:
                    return body
                elif status in (301, 302, 303, 307, 308) and loc:
                    parsed = urllib.parse.urlparse(loc)
                    next_path = parsed.path + ("?" + parsed.query if parsed.query else "")
                    self.conn.request("GET", next_path, headers=headers)
                    resp2 = self.conn.getresponse()
                    if resp2.status == 200:
                        return resp2.read()
                    elif resp2.status in (301, 302, 303, 307, 308):
                        loc2 = resp2.getheader("Location")
                        resp2.read()
                        if loc2:
                            p2 = urllib.parse.urlparse(loc2)
                            self.conn.request("GET", p2.path + ("?" + p2.query if p2.query else ""), headers=headers)
                            resp3 = self.conn.getresponse()
                            return resp3.read() if resp3.status == 200 else None
                    else:
                        resp2.read()
                elif status == 404:
                    # Try without id_
                    if "id_/" in path:
                        clean_path = path.replace("id_/", "/")
                        self.conn.request("GET", clean_path, headers=headers)
                        fb_resp = self.conn.getresponse()
                        if fb_resp.status == 200:
                            return fb_resp.read()
                        elif fb_resp.status in (301, 302, 303) and fb_resp.getheader("Location"):
                            fb_loc = fb_resp.getheader("Location")
                            fb_resp.read()
                            fb_p = urllib.parse.urlparse(fb_loc)
                            self.conn.request("GET", fb_p.path + ("?" + fb_p.query if fb_p.query else ""), headers=headers)
                            fb_resp2 = self.conn.getresponse()
                            return fb_resp2.read() if fb_resp2.status == 200 else None
                        fb_resp.read()
                    return None
            except Exception as e:
                # Reconnect on error
                time.sleep(1.0 * (attempt + 1))
                self._connect()
        return None

    def close(self):
        if self.conn:
            self.conn.close()

def main():
    os.makedirs(RAW_DIR, exist_ok=True)
    remedies = get_remedy_list()
    total = len(remedies)
    print(f"Total remedies: {total}")

    client = ArchiveClient()
    downloaded = 0
    cached = 0
    failed = []

    t_start = time.time()
    for i, r in enumerate(remedies, 1):
        aid = r["id"]
        filepath = os.path.join(RAW_DIR, f"{aid}.html")
        
        if os.path.exists(filepath) and os.path.getsize(filepath) > 1000:
            cached += 1
            if i % 25 == 0 or i == total:
                print(f"[{i}/{total}] Cached: {r['title'][:35]} (Downloaded: {downloaded}, Cached: {cached})", flush=True)
            continue

        t0 = time.time()
        data = client.get(r["path"])
        dt = time.time() - t0

        if data and len(data) > 500:
            with open(filepath, "wb") as f:
                f.write(data)
            downloaded += 1
            print(f"[{i}/{total}] #{aid} ({dt:.2f}s, {len(data)}B): {r['title'][:40]}", flush=True)
        else:
            print(f"[{i}/{total}] FAILED #{aid}: {r['title']}", flush=True)
            failed.append(r)

        time.sleep(0.15)

    client.close()

    elapsed = time.time() - t_start
    print("\n=== Download Complete ===", flush=True)
    print(f"Total: {total}, Downloaded: {downloaded}, Cached: {cached}, Failed: {len(failed)}")
    print(f"Elapsed time: {elapsed:.1f}s", flush=True)

    if failed:
        print(f"Attempting retry on {len(failed)} failed remedies...")
        client = ArchiveClient()
        still_failed = []
        for r in failed:
            aid = r["id"]
            filepath = os.path.join(RAW_DIR, f"{aid}.html")
            data = client.get(r["path"], max_retries=6)
            if data and len(data) > 500:
                with open(filepath, "wb") as f:
                    f.write(data)
                downloaded += 1
                print(f"  Recovered #{aid}: {r['title']}")
            else:
                still_failed.append(r)
            time.sleep(0.5)
        client.close()
        print(f"Final remaining failed: {len(still_failed)}")

if __name__ == "__main__":
    main()
