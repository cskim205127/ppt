# YouTube extraction (yt-dlp) — details & edge cases

Read this when `scripts/yt_transcript.py` fails or behaves unexpectedly.

## Prerequisite

`yt-dlp` must be installed and on PATH:

```bash
pip install yt-dlp        # or: pip install -U yt-dlp to update
```

On Windows this works the same in PowerShell or Git Bash. `yt-dlp` is a Python
console script, so no separate binary is needed.

## What the script does

1. Reads metadata (title, channel, duration, upload date).
2. Downloads subtitles as `.vtt`, preferring **manual** subs, then falling back
   to **auto-generated** captions. Language priority defaults to `en,ko`.
3. Parses the VTT: strips timestamps, cue indices, and inline `<...>` timing
   tags, then collapses the rolling duplicate lines that auto-captions produce.
4. Writes `<title>.txt` (clean transcript) and `<title>.meta.json`.

## Common failures and fixes

- **"yt-dlp not found"** → `pip install yt-dlp`, then re-run.
- **Sign-in / "confirm you're not a bot" / age-restricted** → pass browser
  cookies:
  ```bash
  python scripts/yt_transcript.py "<URL>" --out ./_deck_work/ --cookies-from-browser chrome
  ```
  Swap `chrome` for `firefox`, `edge`, etc. Close the browser first if it locks
  the cookie DB.
- **"No subtitles/captions available"** → the video genuinely has no captions.
  Options: pick a different source, or (heavier) download audio and transcribe
  with Whisper — only if the user agrees to the time/size cost. This script does
  NOT do audio transcription.
- **Wrong language transcript** → override priority, e.g. `--lang ko,en` or
  `--lang ja`.
- **YouTube blocking the host IP** (common on cloud/CI machines) → yt-dlp may
  fail entirely. For server-side use, an API-based transcript service is more
  reliable than yt-dlp. For a normal local Windows machine this is rarely an
  issue.

## Quality note

Auto-generated captions have no punctuation or casing and may misrecognize
names/terms. When building the outline, treat the transcript as a rough source:
re-punctuate mentally, fix obvious term errors from context, and don't quote it
verbatim on slides.
