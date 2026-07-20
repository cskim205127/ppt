import pptxgen from "pptxgenjs";
import { iconToBase64Png } from "./icons";
import type { DeckOutline, SlideOutline } from "./outline";

const FONT = "Noto Sans KR";

const NAVY = "141B2E";
const NAVY_PANEL = "1E2A44";
const NAVY_PANEL_2 = "26365A";
const ICE = "EDEFF4";
const ICE_DIM = "AEB9CC";
const SLATE = "5B6B87";
const LIGHT_BG = "F7F8FA";
const CARD_BG = "FFFFFF";
const LINE_SOFT = "E2E6ED";
const CORAL = "FF6D5A";
const CORAL_DARK = "E1503D";
const CORAL_TINT = "FFF1EE";
const GOOD_GREEN = "2E9E6D";

const W = 13.333;
const H = 7.5;

// Icons rotated across "bullets" slides for visual variety without needing
// the LLM to choose one — keeps the outline schema simple.
const BULLET_ICONS: (keyof typeof import("react-icons/fa"))[] = [
  "FaLightbulb",
  "FaChartLine",
  "FaCogs",
  "FaInfoCircle",
  "FaCheckCircle",
];

function freshShadow(opts: Partial<{ opacity: number }> = {}) {
  return { type: "outer" as const, color: "0B0F1A", blur: 12, offset: 4, angle: 135, opacity: opts.opacity ?? 0.18 };
}

interface IconSet {
  [key: string]: string;
}

async function preloadIcons(): Promise<IconSet> {
  const specs: [string, keyof typeof import("react-icons/fa"), string][] = [
    ["lightbulb", "FaLightbulb", CORAL],
    ["chart", "FaChartLine", CORAL],
    ["cogs", "FaCogs", CORAL],
    ["info", "FaInfoCircle", CORAL],
    ["check", "FaCheckCircle", GOOD_GREEN],
    ["checkWhite", "FaCheckCircle", ICE],
    ["balance", "FaBalanceScale", CORAL],
    ["listOl", "FaListOl", CORAL],
    ["flag", "FaFlagCheckered", CORAL],
    ["arrowLeftWhite", "FaArrowLeft", ICE],
  ];
  const icons: IconSet = {};
  for (const [key, name, color] of specs) {
    icons[key] = await iconToBase64Png(name, color, 256);
  }
  return icons;
}

export async function renderDeck(outline: DeckOutline, outputPath: string): Promise<void> {
  const pres = new pptxgen();
  pres.layout = "LAYOUT_WIDE";
  pres.author = "agent-runner";
  pres.title = outline.title;

  const icons = await preloadIcons();

  // ---- Precompute slide numbers so hyperlinks can reference future slides ----
  // 1 = cover, 2 = agenda, 3..(2+n) = content slides, then detail slides appended.
  const contentStart = 3;
  const detailSlideNumForContentIndex = new Map<number, number>();
  let nextDetailNum = contentStart + outline.slides.length;
  outline.slides.forEach((s, i) => {
    if (s.hasDetail) {
      detailSlideNumForContentIndex.set(i, nextDetailNum);
      nextDetailNum += 1;
    }
  });

  buildCoverSlide(pres, outline);
  buildAgendaSlide(pres, outline);

  outline.slides.forEach((slide, i) => {
    const slideNum = contentStart + i;
    const detailNum = detailSlideNumForContentIndex.get(i);
    buildContentSlide(pres, slide, slideNum, outline.slides.length, icons, detailNum);
  });

  outline.slides.forEach((slide, i) => {
    const detailNum = detailSlideNumForContentIndex.get(i);
    if (detailNum === undefined) return;
    const backTarget = contentStart + i;
    buildDetailSlide(pres, slide, backTarget, detailNum);
  });

  await pres.writeFile({ fileName: outputPath });
}

// ===========================================================================
// Shared helpers
// ===========================================================================

function addFooter(slide: pptxgen.Slide, dark: boolean, label: string, pageNum: number) {
  slide.addText(label, {
    x: 0.55, y: H - 0.42, w: 6, h: 0.3, fontFace: FONT, fontSize: 9, color: dark ? ICE_DIM : SLATE, margin: 0,
  });
  slide.addText(String(pageNum), {
    x: W - 1.05, y: H - 0.42, w: 0.5, h: 0.3, fontFace: FONT, fontSize: 9, color: dark ? ICE_DIM : SLATE, align: "right", margin: 0,
  });
}

function addEyebrow(slide: pptxgen.Slide, text: string, x: number, y: number, bg: string, fg: string) {
  slide.addShape("roundRect" as pptxgen.ShapeType, {
    x, y, w: 2.6, h: 0.36, rectRadius: 0.18, fill: { color: bg }, line: { type: "none" },
  });
  slide.addText(text, {
    x, y, w: 2.6, h: 0.36, fontFace: FONT, fontSize: 11, bold: true, color: fg, align: "center", valign: "middle", margin: 0, charSpacing: 1,
  });
}

function slideTitle(slide: pptxgen.Slide, text: string, opts: { dark?: boolean; y?: number; fontSize?: number } = {}) {
  const { dark = false, y = 0.88, fontSize = 27 } = opts;
  slide.addText(text, {
    x: 0.55, y, w: 11.6, h: 1.0, fontFace: FONT, fontSize, bold: true, color: dark ? ICE : NAVY, margin: 0, lineSpacingMultiple: 1.05,
  });
}

function bulletBlock(
  slide: pptxgen.Slide,
  items: string[],
  opts: { x: number; y: number; w: number; h: number; dark?: boolean; fontSize?: number }
) {
  const { x, y, w, h, dark = false, fontSize = 14.5 } = opts;
  const runs = items.map((it, i) => ({
    text: it,
    options: { bullet: { code: "25A0" }, breakLine: i !== items.length - 1, paraSpaceAfter: 10 },
  }));
  slide.addText(runs, {
    x, y, w, h, fontFace: FONT, fontSize, color: dark ? ICE : "2B3346", valign: "top", margin: 0, lineSpacingMultiple: 1.2,
  });
}

function panel(slide: pptxgen.Slide, x: number, y: number, w: number, h: number, fill: string) {
  slide.addShape("roundRect" as pptxgen.ShapeType, {
    x, y, w, h, rectRadius: 0.09, fill: { color: fill }, line: { type: "none" }, shadow: freshShadow(),
  });
}

function numberDot(slide: pptxgen.Slide, x: number, y: number, n: number, size = 0.42) {
  slide.addShape("ellipse" as pptxgen.ShapeType, { x, y, w: size, h: size, fill: { color: CORAL }, line: { type: "none" } });
  slide.addText(String(n), {
    x, y, w: size, h: size, align: "center", valign: "middle", fontFace: FONT, fontSize: 14, bold: true, color: "FFFFFF", margin: 0,
  });
}

function addNavButton(
  slide: pptxgen.Slide,
  opts: { x: number; y: number; w?: number; h?: number; text: string; targetSlide: number; style: "forward" | "back" }
) {
  const { x, y, w = 2.3, h = 0.46, text, targetSlide, style } = opts;
  const isForward = style === "forward";
  const bg = isForward ? CORAL : NAVY_PANEL_2;
  const hyperlink = { slide: targetSlide };

  slide.addShape("roundRect" as pptxgen.ShapeType, {
    x, y, w, h, rectRadius: 0.25, fill: { color: bg }, line: { type: "none" }, shadow: freshShadow({ opacity: isForward ? 0.25 : 0 }), hyperlink,
  });
  slide.addText(text, {
    x, y, w, h, align: "center", valign: "middle", margin: 0, fontFace: FONT, fontSize: 13, bold: true, color: "FFFFFF", hyperlink,
  });
}

function addBackButton(slide: pptxgen.Slide, targetSlide: number) {
  addNavButton(slide, { x: 0.55, y: 0.4, w: 2.15, h: 0.46, text: "← 메인으로 돌아가기", targetSlide, style: "back" });
}

function addDetailLink(slide: pptxgen.Slide, targetSlide: number) {
  addNavButton(slide, { x: W - 2.5, y: 0.42, w: 2.0, h: 0.46, text: "자세히 보기 →", targetSlide, style: "forward" });
}

// ===========================================================================
// Cover
// ===========================================================================

function buildCoverSlide(pres: pptxgen, outline: DeckOutline) {
  const s = pres.addSlide();
  s.background = { color: NAVY };

  s.addShape("ellipse" as pptxgen.ShapeType, { x: 9.6, y: -2.3, w: 7, h: 7, fill: { color: NAVY_PANEL, transparency: 25 }, line: { type: "none" } });
  s.addShape("ellipse" as pptxgen.ShapeType, { x: 10.6, y: -1.3, w: 5, h: 5, fill: { color: CORAL, transparency: 88 }, line: { type: "none" } });
  s.addShape("ellipse" as pptxgen.ShapeType, { x: -2.4, y: 4.6, w: 6, h: 6, fill: { color: NAVY_PANEL, transparency: 35 }, line: { type: "none" } });

  addEyebrow(s, outline.eyebrow || "SUMMARY DECK", 0.55, 0.62, "26365A", CORAL);

  s.addText(outline.title, {
    x: 0.5, y: 2.6, w: 12.3, h: 1.6, fontFace: FONT, fontSize: 40, bold: true, color: "FFFFFF", margin: 0, lineSpacingMultiple: 1.08, valign: "middle",
  });
  s.addText(outline.subtitle, {
    x: 0.55, y: 4.25, w: 10.8, h: 0.8, fontFace: FONT, fontSize: 15, color: ICE_DIM, margin: 0, lineSpacingMultiple: 1.2,
  });

  s.addShape("line" as pptxgen.ShapeType, { x: 0.55, y: 6.62, w: 12.2, h: 0, line: { color: "34456E", width: 1 } });
  s.addText("AUTO-GENERATED DECK", {
    x: W - 3.6, y: 6.78, w: 3.05, h: 0.4, fontFace: FONT, fontSize: 11, bold: true, color: CORAL, align: "right", margin: 0, charSpacing: 1,
  });
}

// ===========================================================================
// Agenda
// ===========================================================================

function buildAgendaSlide(pres: pptxgen, outline: DeckOutline) {
  const s = pres.addSlide();
  s.background = { color: LIGHT_BG };
  addEyebrow(s, "OVERVIEW", 0.55, 0.42, "FFE9E5", CORAL_DARK);
  slideTitle(s, "한눈에 보는 오늘의 흐름", { y: 0.88 });

  const items = outline.slides.map((s2) => s2.title);
  const rowH = Math.min(0.85, (5.6 - 0.4) / Math.max(items.length, 1));
  const startY = 2.15;
  items.forEach((title, i) => {
    const y = startY + i * rowH;
    numberDot(s, 0.55, y + rowH / 2 - 0.21, i + 1, 0.42);
    s.addText(title, {
      x: 1.25, y, w: 11.3, h: rowH, valign: "middle", fontFace: FONT, fontSize: 14, color: NAVY, margin: 0,
    });
    if (i < items.length - 1) {
      s.addShape("line" as pptxgen.ShapeType, { x: 0.76, y: y + rowH, w: 0, h: 0.02, line: { color: LINE_SOFT, width: 1 } });
    }
  });

  addFooter(s, false, "Overview", 2);
}

// ===========================================================================
// Content slide dispatch
// ===========================================================================

function buildContentSlide(
  pres: pptxgen,
  slide: SlideOutline,
  slideNum: number,
  total: number,
  icons: IconSet,
  detailTargetSlide: number | undefined
) {
  if (slide.type === "comparison") {
    buildComparisonSlide(pres, slide, slideNum, total, detailTargetSlide);
  } else if (slide.type === "process") {
    buildProcessSlide(pres, slide, slideNum, total, detailTargetSlide);
  } else if (slide.type === "summary") {
    buildSummarySlide(pres, slide, slideNum, total);
  } else {
    buildBulletsSlide(pres, slide, slideNum, total, icons, detailTargetSlide);
  }
}

function stepTag(s: pptxgen.Slide, slideNum: number, total: number, dark: boolean) {
  s.addText(`${slideNum - 2} / ${total}`, {
    x: 0.55, y: 0.42, w: 3, h: 0.3, fontFace: FONT, fontSize: 11, bold: true, color: dark ? CORAL : CORAL_DARK, margin: 0, charSpacing: 1,
  });
}

function buildBulletsSlide(
  pres: pptxgen,
  slide: SlideOutline,
  slideNum: number,
  total: number,
  icons: IconSet,
  detailTargetSlide: number | undefined
) {
  const dark = slideNum % 2 === 0;
  const s = pres.addSlide();
  s.background = { color: dark ? NAVY : LIGHT_BG };
  stepTag(s, slideNum, total, dark);
  slideTitle(s, slide.title, { dark, y: 0.78, fontSize: 26 });

  const iconKey = ["lightbulb", "chart", "cogs", "info", "check"][(slideNum - 3) % 5];
  const cx = 0.55, cy = 2.15, cw = 5.6, chh = 4.3;
  s.addShape("ellipse" as pptxgen.ShapeType, { x: cx, y: cy, w: 1.0, h: 1.0, fill: { color: dark ? NAVY_PANEL_2 : CORAL_TINT }, line: { type: "none" } });
  s.addImage({ data: icons[iconKey], x: cx + 0.24, y: cy + 0.24, w: 0.52, h: 0.52 });

  bulletBlock(s, slide.bullets ?? [], { x: 0.55, y: cy + 1.3, w: cw, h: chh - 1.3, dark, fontSize: 15.5 });

  if (detailTargetSlide !== undefined) {
    addDetailLink(s, detailTargetSlide);
  }

  addFooter(s, dark, slide.title.slice(0, 24), slideNum);
}

function buildComparisonSlide(
  pres: pptxgen,
  slide: SlideOutline,
  slideNum: number,
  total: number,
  detailTargetSlide: number | undefined
) {
  const s = pres.addSlide();
  s.background = { color: LIGHT_BG };
  stepTag(s, slideNum, total, false);
  slideTitle(s, slide.title, { y: 0.78, fontSize: 26 });

  const cy = 2.15, cw = 5.85, ch = 4.0, gap = 0.35;
  const leftItems = slide.leftItems ?? [];
  const rightItems = slide.rightItems ?? [];

  panel(s, 0.55, cy, cw, ch, CARD_BG);
  s.addShape("rect" as pptxgen.ShapeType, { x: 0.55, y: cy, w: 0.09, h: ch, fill: { color: CORAL_DARK }, line: { type: "none" } });
  s.addText(slide.leftLabel || "A", { x: 0.95, y: cy + 0.25, w: cw - 1.2, h: 0.45, fontFace: FONT, fontSize: 17, bold: true, color: NAVY, margin: 0 });
  bulletBlock(s, leftItems, { x: 0.95, y: cy + 0.85, w: cw - 1.3, h: ch - 1.1, fontSize: 14 });

  const sx = 0.55 + cw + gap;
  panel(s, sx, cy, cw, ch, CARD_BG);
  s.addShape("rect" as pptxgen.ShapeType, { x: sx, y: cy, w: 0.09, h: ch, fill: { color: GOOD_GREEN }, line: { type: "none" } });
  s.addText(slide.rightLabel || "B", { x: sx + 0.4, y: cy + 0.25, w: cw - 1.2, h: 0.45, fontFace: FONT, fontSize: 17, bold: true, color: NAVY, margin: 0 });
  bulletBlock(s, rightItems, { x: sx + 0.4, y: cy + 0.85, w: cw - 1.3, h: ch - 1.1, fontSize: 14 });

  if (detailTargetSlide !== undefined) {
    addDetailLink(s, detailTargetSlide);
  }

  addFooter(s, false, slide.title.slice(0, 24), slideNum);
}

function buildProcessSlide(
  pres: pptxgen,
  slide: SlideOutline,
  slideNum: number,
  total: number,
  detailTargetSlide: number | undefined
) {
  const dark = true;
  const s = pres.addSlide();
  s.background = { color: NAVY };
  stepTag(s, slideNum, total, dark);
  slideTitle(s, slide.title, { dark, y: 0.78, fontSize: 26 });

  const steps = slide.steps ?? [];
  const n = Math.max(steps.length, 1);
  const bx = 0.55, by = 2.5, gap = 0.25;
  const bw = (12.2 - gap * (n - 1)) / n;
  const bh = 3.2;

  steps.forEach((stepText, i) => {
    const x = bx + i * (bw + gap);
    s.addShape("roundRect" as pptxgen.ShapeType, {
      x, y: by, w: bw, h: bh, rectRadius: 0.1, fill: { color: NAVY_PANEL }, line: { color: "35456E", width: 1 }, shadow: freshShadow({ opacity: 0.28 }),
    });
    numberDot(s, x + bw / 2 - 0.24, by + 0.3, i + 1, 0.48);
    s.addText(stepText, {
      x: x + 0.2, y: by + 1.05, w: bw - 0.4, h: bh - 1.3, align: "center", valign: "top", fontFace: FONT, fontSize: 12.5, color: ICE, margin: 0, lineSpacingMultiple: 1.25,
    });
    if (i < n - 1) {
      s.addText("→", { x: x + bw, y: by + bh / 2 - 0.3, w: gap, h: 0.6, align: "center", fontFace: FONT, fontSize: 20, bold: true, color: CORAL, margin: 0 });
    }
  });

  if (detailTargetSlide !== undefined) {
    addDetailLink(s, detailTargetSlide);
  }

  addFooter(s, dark, slide.title.slice(0, 24), slideNum);
}

function buildSummarySlide(pres: pptxgen, slide: SlideOutline, slideNum: number, total: number) {
  const s = pres.addSlide();
  s.background = { color: LIGHT_BG };
  addEyebrow(s, "KEY TAKEAWAYS", 0.55, 0.42, "E7F6EF", GOOD_GREEN);
  slideTitle(s, slide.title, { y: 0.88, fontSize: 26 });

  const takeaways = slide.takeaways ?? [];
  panel(s, 0.55, 2.15, 12.2, 4.3, NAVY);
  const rowH = 4.3 / Math.max(takeaways.length, 1);
  takeaways.forEach((t, i) => {
    const y = 2.15 + i * rowH;
    s.addShape("ellipse" as pptxgen.ShapeType, { x: 0.95, y: y + rowH / 2 - 0.21, w: 0.42, h: 0.42, fill: { color: CORAL }, line: { type: "none" } });
    s.addText(String(i + 1), {
      x: 0.95, y: y + rowH / 2 - 0.21, w: 0.42, h: 0.42, align: "center", valign: "middle", fontFace: FONT, fontSize: 14, bold: true, color: "FFFFFF", margin: 0,
    });
    s.addText(t, {
      x: 1.6, y, w: 10.8, h: rowH, valign: "middle", fontFace: FONT, fontSize: 15.5, color: ICE, margin: 0, lineSpacingMultiple: 1.2,
    });
  });

  addFooter(s, false, "Summary", slideNum);
}

// ===========================================================================
// Detail slides (hyperlinked from a main slide, with a Back button)
// ===========================================================================

function buildDetailSlide(pres: pptxgen, slide: SlideOutline, backTargetSlide: number, slideNum: number) {
  const s = pres.addSlide();
  s.background = { color: LIGHT_BG };
  addBackButton(s, backTargetSlide);
  addEyebrow(s, "DETAIL", 0.55, 1.05, "FFE9E5", CORAL_DARK);
  slideTitle(s, slide.detailTitle || slide.title, { y: 1.5, fontSize: 24 });

  bulletBlock(s, slide.detailBullets ?? [], { x: 0.55, y: 2.3, w: 12.2, h: 4.2, fontSize: 14.5 });

  addFooter(s, false, "상세 설명", slideNum);
}
