#!/usr/bin/env python3
"""
Extract a YouTube video's transcript using yt-dlp and clean it into plain text.

Usage:
    python yt_transcript.py "<VIDEO_URL>" [--out DIR] [--lang en,ko] [--cookies-from-browser chrome]

Strategy:
    1. Fetch metadata (title, channel, duration).
    2. Try manual (human) subtitles first, then auto-generated captions.
    3. Parse the resulting .vtt into de-duplicated plain paragraphs.
    4. Write "<title>.txt" and "<title>.meta.json" into --out.

Requires: yt-dlp on PATH  ->  pip install yt-dlp
Works cross-platform (Windows PowerShell / Git Bash, macOS, Linux) because it
only shells out to the `yt-dlp` command and does its own VTT parsing.
"""

import argparse
import json
import os
import re
import shutil
import subprocess
import sys
import glob


def die(msg, code=1):
    print(f"[yt_transcript] {msg}", file=sys.stderr)
    sys.exit(code)


def check_ytdlp():
    if shutil.which("yt-dlp") is None:
        die("yt-dlp not found on PATH. Install it with:  pip install yt-dlp")


def run(cmd):
    return subprocess.run(cmd, capture_output=True, text=True)


def safe_name(name):
    name = re.sub(r'[\\/:*?"<>|]', "_", name).strip()
    return name[:120] or "youtube_transcript"


def get_meta(url, cookies):
    base = ["yt-dlp", "--skip-download", "--print",
            "%(title)s\t%(channel)s\t%(duration)s\t%(upload_date)s"]
    if cookies:
        base += ["--cookies-from-browser", cookies]
    base += [url]
    r = run(base)
    if r.returncode != 0:
        die("Could not read video metadata. yt-dlp said:\n" + r.stderr.strip())
    parts = (r.stdout.strip().split("\t") + ["", "", "", ""])[:4]
    title, channel, duration, upload = parts
    return {
        "title": title or "youtube_transcript",
        "channel": channel,
        "duration_sec": duration,
        "upload_date": upload,
        "url": url,
    }


def download_subs(url, out_dir, langs, cookies):
    """Try manual subs first, then auto-subs, using the requested language
    priority list. If nothing in that list exists, fall back to *any*
    available caption track ("all") rather than failing outright — the
    pipeline translates/synthesizes downstream regardless of source
    language, so grabbing whatever track exists is strictly better than
    reporting no captions when captions do exist in some other language.
    Returns path to a .vtt or None.
    """
    tmpl = os.path.join(out_dir, "_sub.%(ext)s")

    def attempt(lang_spec, write_flag):
        cmd = ["yt-dlp", "--skip-download", "--sub-format", "vtt",
               "--sub-langs", lang_spec, "-o", tmpl, write_flag]
        if cookies:
            cmd += ["--cookies-from-browser", cookies]
        cmd.append(url)
        run(cmd)
        vtts = glob.glob(os.path.join(out_dir, "_sub*.vtt"))
        return vtts[0] if vtts else None

    for lang_spec in (langs, "all"):
        vtt = attempt(lang_spec, "--write-subs")  # 1) manual subtitles
        if vtt:
            return vtt
        vtt = attempt(lang_spec, "--write-auto-subs")  # 2) auto-generated captions
        if vtt:
            return vtt
    return None


def parse_vtt(path):
    """Convert a WebVTT file to de-duplicated plain text."""
    with open(path, encoding="utf-8", errors="ignore") as f:
        raw = f.read()

    lines = []
    for line in raw.splitlines():
        s = line.strip()
        if not s:
            continue
        if s.startswith(("WEBVTT", "Kind:", "Language:", "NOTE")):
            continue
        if "-->" in s:  # timestamp cue line
            continue
        if s.isdigit():  # cue index
            continue
        # strip inline timing tags like <00:00:01.234> and <c> ... </c>
        s = re.sub(r"<[^>]+>", "", s)
        s = s.strip()
        if s:
            lines.append(s)

    # collapse consecutive duplicates (auto-caption rolling repeats)
    deduped = []
    for s in lines:
        if not deduped or deduped[-1] != s:
            deduped.append(s)

    # join into readable paragraphs (~ sentence-ish chunks)
    text = " ".join(deduped)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("url")
    ap.add_argument("--out", default=".")
    ap.add_argument("--lang", default="en,ko",
                    help="comma-separated subtitle language priority; "
                         "falls back to any available language track if none of these exist")
    ap.add_argument("--cookies-from-browser", dest="cookies", default=None,
                    help="e.g. chrome/firefox/edge — helps with sign-in limits")
    args = ap.parse_args()

    check_ytdlp()
    os.makedirs(args.out, exist_ok=True)

    meta = get_meta(args.url, args.cookies)
    title = safe_name(meta["title"])

    vtt = download_subs(args.url, args.out, args.lang, args.cookies)
    if not vtt:
        die("No subtitles/captions available for this video "
            "(neither manual nor auto-generated). Cannot extract a transcript.")

    transcript = parse_vtt(vtt)
    try:
        os.remove(vtt)
    except OSError:
        pass

    txt_path = os.path.join(args.out, f"{title}.txt")
    meta_path = os.path.join(args.out, f"{title}.meta.json")
    with open(txt_path, "w", encoding="utf-8") as f:
        f.write(transcript)
    with open(meta_path, "w", encoding="utf-8") as f:
        json.dump(meta, f, ensure_ascii=False, indent=2)

    wc = len(transcript.split())
    print(f"[yt_transcript] OK: {txt_path} ({wc} words)")
    print(f"[yt_transcript] meta: {meta_path}")


if __name__ == "__main__":
    main()
