import OpenAI from "openai";

export type SlideType = "bullets" | "comparison" | "process" | "summary";

export interface SlideOutline {
  type: SlideType;
  title: string;
  bullets?: string[];
  leftLabel?: string;
  leftItems?: string[];
  rightLabel?: string;
  rightItems?: string[];
  steps?: string[];
  takeaways?: string[];
  notes: string;
  hasDetail?: boolean;
  detailTitle?: string;
  detailBullets?: string[];
}

export interface DeckOutline {
  title: string;
  subtitle: string;
  eyebrow: string;
  slides: SlideOutline[];
}

const OPENAI_MODEL = process.env.OPENAI_MODEL ?? "gpt-4o-2024-08-06";

const DECK_OUTLINE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    title: { type: "string", description: "임팩트 있는 한국어 표지 제목 (한 줄, 발표의 결론/핵심 메시지를 담을 것)" },
    subtitle: { type: "string", description: "표지 부제 — 한 문장" },
    eyebrow: { type: "string", description: "표지 상단 짧은 태그 문구 (영문 대문자 or 짧은 한국어, 5어 이내)" },
    slides: {
      type: "array",
      minItems: 5,
      maxItems: 8,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          type: {
            type: "string",
            enum: ["bullets", "comparison", "process", "summary"],
            description:
              "bullets: 일반 핵심 내용, comparison: 두 대상 비교, process: 단계/순서, summary: 마지막 요약 슬라이드(전체에서 정확히 1개, 반드시 마지막 슬라이드)",
          },
          title: { type: "string", description: "슬라이드 제목 — 주제 나열이 아니라 핵심 결론을 담은 문장" },
          bullets: {
            type: "array",
            items: { type: "string" },
            description: "type=bullets일 때: 3~5개, 각 8~12단어 이내 한국어 불릿",
          },
          leftLabel: { type: "string", description: "type=comparison일 때 왼쪽 열 이름" },
          leftItems: { type: "array", items: { type: "string" }, description: "type=comparison일 때 왼쪽 항목 2~4개" },
          rightLabel: { type: "string", description: "type=comparison일 때 오른쪽 열 이름" },
          rightItems: { type: "array", items: { type: "string" }, description: "type=comparison일 때 오른쪽 항목 2~4개" },
          steps: { type: "array", items: { type: "string" }, description: "type=process일 때 단계 3~6개, 각 짧게" },
          takeaways: { type: "array", items: { type: "string" }, description: "type=summary일 때 핵심 요약 3~5개" },
          notes: { type: "string", description: "발표자 노트 1~3문장, 원문 맥락의 뉘앙스를 담을 것" },
          hasDetail: { type: "boolean", description: "이 슬라이드가 추가 상세 설명이 꼭 필요한 복잡한 내용이면 true" },
          detailTitle: { type: "string", description: "hasDetail=true일 때 상세 슬라이드 제목" },
          detailBullets: { type: "array", items: { type: "string" }, description: "hasDetail=true일 때 상세 내용 4~7개" },
        },
        required: [
          "type",
          "title",
          "bullets",
          "leftLabel",
          "leftItems",
          "rightLabel",
          "rightItems",
          "steps",
          "takeaways",
          "notes",
          "hasDetail",
          "detailTitle",
          "detailBullets",
        ],
      },
    },
  },
  required: ["title", "subtitle", "eyebrow", "slides"],
} as const;

const SYSTEM_PROMPT = `너는 영상 스크립트를 한국어 비즈니스 발표자료 개요로 재구성하는 전문 에디터다.

규칙:
- 스크립트를 그대로 요약/번역하지 말고, 문제 제기 → 전개 → 결론의 하나의 스토리로 재구성한다.
- 슬라이드 제목은 주제명이 아니라 그 슬라이드의 결론/핵심 메시지 문장이어야 한다.
- 원본 영상이 한국어가 아니어도 결과물은 항상 자연스러운 한국어여야 한다 (직역 금지, 의미 기반 재작성).
- 마지막 슬라이드는 반드시 type="summary"로 핵심 시사점 3~5개를 담는다.
- 슬라이드 타입(bullets/comparison/process)을 내용에 맞게 다양하게 섞어서 지루하지 않게 구성한다 — 같은 타입만 연달아 쓰지 않는다.
- 내용이 특히 복잡하거나 배경 설명이 필요한 슬라이드 1~2개에는 hasDetail=true로 표시하고 detailTitle/detailBullets를 채운다 (나머지는 hasDetail=false).
- 사용하지 않는 필드는 빈 배열 []이나 빈 문자열 ""로 채운다 (null 금지).`;

/**
 * Synthesizes a Korean slide outline from a (possibly non-Korean) transcript
 * via OpenAI structured outputs. Translation happens implicitly as part of
 * this rewrite step — never a literal pre-translation pass — matching the
 * same design rationale used in the earlier Claude-based version.
 */
export async function generateOutline(videoTitle: string, transcript: string): Promise<DeckOutline> {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const truncated = transcript.length > 24000 ? transcript.slice(0, 24000) + " ...(생략)" : transcript;

  const response = await client.chat.completions.create({
    model: OPENAI_MODEL,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: `영상 제목: ${videoTitle}\n\n스크립트:\n${truncated}`,
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "deck_outline",
        strict: true,
        schema: DECK_OUTLINE_SCHEMA,
      },
    },
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error("OpenAI returned no content for outline generation");
  }

  return normalizeOutline(JSON.parse(content) as DeckOutline);
}

/**
 * The JSON schema enforces per-slide shape but not deck-level invariants
 * like "exactly one summary slide, and it's last" — observed in practice:
 * the model sometimes emits two summary-type slides back to back. Demote
 * every summary-type slide except the true last one to a plain bullets
 * slide (reusing its takeaways as bullets) rather than trusting the prompt
 * instruction alone.
 */
function normalizeOutline(outline: DeckOutline): DeckOutline {
  const lastIndex = outline.slides.length - 1;
  const slides = outline.slides.map((slide, i) => {
    if (slide.type === "summary" && i !== lastIndex) {
      return { ...slide, type: "bullets" as const, bullets: slide.takeaways ?? slide.bullets };
    }
    return slide;
  });
  return { ...outline, slides };
}
