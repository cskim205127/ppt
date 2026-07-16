# Business deck outline rules

Use this to turn extracted source content into a slide outline for a
**general-business** audience, before handing off to the `pptx` skill.

## Deck skeleton

1. **Title slide** — deck title, one-line subtitle, date. If sources have a
   clear owner/author, add it.
2. **Agenda / Overview** — 3–6 items naming the sections that follow. Skip for
   very short decks (< ~6 slides).
3. **Body slides** — one distinct idea per slide (see rules below).
4. **Section dividers** — only if the deck is long (> ~12 slides).
5. **Summary / Key takeaways** — 3–5 crisp points.
6. **Sources** — list each input (PDF filename, YouTube title + channel, doc
   name). Always include this when material came from external sources.

## Per-slide rules

- **One idea per slide.** If a slide needs two ideas, split it.
- **Title = the takeaway, not the topic.** Prefer "Support tickets fell 30% after
  automation" over "Support metrics". (This alone makes decks feel senior.)
- **3–5 bullets**, each roughly ≤ 8–10 words. No paragraphs on the slide.
- **Parallel phrasing** across bullets in a slide.
- **Numbers over adjectives.** Pull concrete figures from the sources when present.
- **Speaker notes** carry the detail/nuance that doesn't fit the slide. Write
  1–3 sentences of notes per body slide, drawn from the source text.
- **No walls of text, no verbatim transcript dumps.** Summarize.

## Merging multiple sources

- Build ONE narrative, not source-by-source sections, unless the user asked to
  keep them separate.
- Group content by theme/argument across sources.
- If two sources disagree on a fact, put both positions on one slide and flag the
  discrepancy rather than silently choosing.
- Deduplicate overlapping points.

## Outline format to pass to the pptx skill

Represent the outline plainly so the `pptx` skill can render it, e.g.:

```
Slide 1 (title): "<Deck Title>" / subtitle: "<one line>"
Slide 2 (agenda): [item, item, item]
Slide 3 (content): title "<takeaway>"
  - bullet
  - bullet
  - bullet
  notes: "<1-3 sentence speaker note>"
...
Slide N (sources): [ "PDF: report.pdf", "YouTube: <title> — <channel>" ]
```

Then request a clean business style following the visual rules below.

## Visual style & editability

**Font:** Noto Sans KR for all text — set both Latin and East-Asian font so
Korean + English render consistently. Titles bold, body regular. Avoid
mixing multiple typefaces.
(This vendored copy intentionally overrides the upstream skill's Malgun
Gothic default: this runs in a Linux container where Malgun Gothic isn't
legally redistributable. Noto Sans KR is open-licensed and must be
installed in the container image via `fonts-noto-cjk` so pptxgenjs's own
line-wrap math and LibreOffice's QA render agree on the same metrics —
do not let LibreOffice silently substitute a different font at QA time.)

**Palette:** neutral, professional (one accent color + grays). Consistent title
+ bullet layout across slides. Generous whitespace.

**Images vs. native shapes — the core rule:**

| Element type | Build as |
|---|---|
| Concept illustration, hero/mood image, purely decorative icon (symbolic) | **Image file** inserted into the slide (`.png`/`.jpg`/`.svg`) |
| Chart, process/flow diagram, relationship map, org chart, timeline, comparison boxes, labeled callouts — anything with meaning the user may need to correct | **Native PowerPoint shapes + text boxes** (editable), NOT a flattened image |

Rationale: images are fixed; native shapes let the user open the deck and edit
text, boxes, and arrows directly. **When in doubt, use native shapes.**

Keep native diagrams simple — a handful of rectangles/arrows/lines with clear
labels. Don't over-design something the user is likely to rework.

## Per-slide visual annotation

When a body slide calls for a visual, tag it in the outline so rendering knows
which path to take, e.g.:

```
Slide 5 (content): title "3단계 자동화 파이프라인"
  - bullet ...
  visual: NATIVE_SHAPES — 3-box left-to-right flow with arrows,
          labels: 수집 → 정제 → 발행
Slide 8 (content): title "브랜드 비전"
  visual: IMAGE — symbolic hero image (insert file)
```
