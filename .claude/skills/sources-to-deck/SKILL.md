---
name: sources-to-deck
description: >
  Turn source material — PDF documents, plain text/notes, and YouTube video
  URLs (or any mix of them) — into a polished general-business PowerPoint (.pptx).
  Extracts content from each source, synthesizes a clean slide outline, then
  renders the deck. Make sure to use this skill WHENEVER the user wants to build
  slides / a presentation / a "발표자료" / a deck from existing material such as a
  PDF, a document, meeting notes, an article, or a YouTube video — even if they
  don't say the word "skill" and even if they only give one source. Also trigger
  when the user pastes a YouTube link and asks to "make slides" or "summarize into
  a deck".
---

# Sources → Deck

Pipeline that converts mixed source material into a business PowerPoint. This
skill is a thin orchestrator: the heavy lifting is delegated to two other skills
you should already have installed —

- **`pdf`** skill (Anthropic official) — PDF text/table extraction
- **`pptx`** skill (Anthropic official) — PowerPoint rendering

Install them once in Claude Code with:
`/plugin marketplace add anthropics/skills` then
`/plugin install document-skills@anthropic-agent-skills`

If the `pdf` or `pptx` skill is not available, say so and stop rather than
hand-rolling brittle parsing/rendering.

## Workflow

Follow these four stages in order. Do the work in a scratch folder
(e.g. `./_deck_work/`) and put the final `.pptx` where the user asked (or the
current directory).

### 1. Collect & classify sources

Look at everything the user provided and sort each item into one of three buckets:

- **PDF** — a path ending in `.pdf`, or an uploaded PDF.
- **YouTube** — a URL matching `youtube.com/watch?v=`, `youtu.be/`, or
  `youtube.com/shorts/`.
- **Text** — pasted text, `.txt`/`.md` files, or notes in the conversation.

If the user's intent is clear but a source is missing (e.g. they said "this PDF"
but attached nothing), ask for it before proceeding.

### 2. Extract content from each source

- **PDF** → use the `pdf` skill's extraction workflow to pull text (and tables
  where relevant). Keep section/heading structure — it maps well to slides.
- **YouTube** → run the bundled script:
  ```bash
  python scripts/yt_transcript.py "<VIDEO_URL>" --out ./_deck_work/
  ```
  It uses `yt-dlp` (manual subs → auto-subs fallback), cleans the VTT into plain
  paragraphs, and writes `<title>.txt` plus a small JSON with title/channel/
  duration. If it reports yt-dlp is missing or no captions exist, relay that to
  the user. Details and edge cases: `references/youtube_extraction.md`.
- **Text** → use as-is; note its apparent topic/structure.

Keep a short provenance note per source (title / filename) — you'll cite sources
on a closing slide.

### 3. Synthesize the slide outline

Merge all extracted content into ONE coherent outline before rendering. Do not
just concatenate sources. Follow `references/business_deck_outline.md` for the
structure and slide-writing rules (title slide, agenda, one idea per slide,
3–5 bullets, ~8 words/bullet, speaker notes, sources slide).

Draft the outline as plain text/JSON and show it to the user for a quick sanity
check when the material is large or ambiguous. For small/clear jobs, proceed
directly.

### 4. Render to .pptx

Hand the finalized outline to the `pptx` skill to generate the presentation,
applying the style rules below. Populate speaker notes from the outline. Save as
`.pptx` and present the file.

**Font:** all text uses **Noto Sans KR** — set both the Latin and
East-Asian font to `Noto Sans KR` so Korean and Latin render consistently.
(Overridden from the upstream skill's Malgun Gothic default for this
Linux-container deployment — see `references/business_deck_outline.md`.)

**Editability rule — images vs. native shapes:**

- **Symbolic / decorative visuals** (concept illustration, hero image, mood
  image, an icon that just represents a theme) → OK to insert as an **image file**
  (`.png`/`.jpg`/`.svg`). These don't need to be edited later.
- **Anything the user might need to correct** — data charts, process/flow
  diagrams, relationship maps, org/hierarchy visuals, comparison boxes, timelines,
  labeled callouts → build with **native PowerPoint shapes and text boxes** (via
  the `pptx` skill), NOT as a flattened image. The user must be able to open the
  deck and directly edit the text, boxes, and arrows.
- When unsure which bucket something falls in, default to **native shapes**
  (editable) — err toward editability.
- Keep native diagrams **simple**: a few rectangles/arrows/lines with clear
  labels. Don't over-design what the user may rework.

General-business look otherwise: neutral palette, consistent title + bullet
layout, generous whitespace, a title slide, and section dividers if the deck runs
longer than ~12 slides.

## Defaults

- Deck length: aim for roughly 1 content slide per major idea; a typical
  single-source deck is 8–15 slides. Don't pad.
- Language: match the dominant language of the source material unless the user
  says otherwise.
- If sources conflict, surface the disagreement on a slide rather than silently
  picking one.
