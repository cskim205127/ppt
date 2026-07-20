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
  evidence: string;
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
          title: { type: "string", description: "슬라이드 제목 — 주제 나열이 아니라 스크립트에서 실제로 다뤄진 핵심 결론을 담은 문장" },
          bullets: {
            type: "array",
            items: { type: "string" },
            description:
              "type=bullets일 때: 3~5개(내용이 풍부하면 5개), 각 12~20단어. 스크립트에 실제 등장한 구체적 수치·사례·이유·근거를 최대한 담아 실속있게 작성 — 두루뭉술한 일반론 금지.",
          },
          leftLabel: { type: "string", description: "type=comparison일 때 왼쪽 열 이름" },
          leftItems: {
            type: "array",
            items: { type: "string" },
            description: "type=comparison일 때 왼쪽 항목 2~4개, 스크립트 근거에 기반한 구체적 내용",
          },
          rightLabel: { type: "string", description: "type=comparison일 때 오른쪽 열 이름" },
          rightItems: {
            type: "array",
            items: { type: "string" },
            description: "type=comparison일 때 오른쪽 항목 2~4개, 스크립트 근거에 기반한 구체적 내용",
          },
          steps: {
            type: "array",
            items: { type: "string" },
            description: "type=process일 때 단계 3~6개, 스크립트에서 설명한 실제 순서/방법을 반영",
          },
          takeaways: {
            type: "array",
            items: { type: "string" },
            description: "type=summary일 때 핵심 요약 3~5개, 스크립트 전체를 관통하는 구체적 결론",
          },
          evidence: {
            type: "string",
            description:
              "이 슬라이드 내용이 스크립트의 어느 부분/어떤 발언·수치·사례에 근거하는지 1문장으로 명시 (원문 그대로 인용하지 않아도 되지만 반드시 스크립트에 실제로 있는 내용을 가리켜야 함). 스크립트에 해당 근거가 없으면 빈 문자열.",
          },
          notes: { type: "string", description: "발표자 노트 1~3문장, 원문 맥락의 뉘앙스를 담을 것" },
          hasDetail: { type: "boolean", description: "이 슬라이드가 추가 상세 설명이 꼭 필요한 복잡한 내용이면 true" },
          detailTitle: { type: "string", description: "hasDetail=true일 때 상세 슬라이드 제목" },
          detailBullets: {
            type: "array",
            items: { type: "string" },
            description: "hasDetail=true일 때 상세 내용 4~7개, 스크립트의 세부 내용을 구체적으로 풀어서 작성",
          },
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
          "evidence",
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

가장 중요한 원칙 — 내용의 실속:
- 모든 슬라이드는 스크립트에 실제로 등장하는 논점·주장·근거·수치·사례에 기반해야 한다. 스크립트에 없는 내용을 지어내거나, 스크립트 대신 일반적인 통념/뻔한 이야기로 채우지 마라.
- "일관성이 중요하다", "소통이 핵심이다" 같은 두루뭉술한 일반론이 아니라, 스크립트가 실제로 말한 구체적인 이유·방법·숫자·예시를 뽑아서 써라.
- 스크립트 전체를 훑어서 화자가 실제로 강조한 논점들을 우선순위대로 골라 슬라이드를 구성한다 — 스크립트 앞부분만 보고 나머지를 무시하지 않는다.
- 스크립트가 짧거나 실질적 내용(정보/주장)이 거의 없는 경우(예: 노래 가사, 잡담) 억지로 비즈니스 인사이트를 창작하지 말고, 있는 그대로의 내용을 최대한 성실하게 정리한다.
- 각 슬라이드의 evidence 필드에 그 내용이 스크립트의 어느 근거에서 나왔는지 반드시 명시한다 — 이게 채워지지 않으면 그 슬라이드 내용은 지어낸 것이다.

구성 규칙:
- 스크립트를 그대로 요약/번역하지 말고, 문제 제기 → 전개 → 결론의 하나의 스토리로 재구성한다 (단, 논점 자체는 위 원칙대로 스크립트에 충실할 것).
- 슬라이드 제목은 주제명이 아니라 그 슬라이드의 결론/핵심 메시지 문장이어야 한다.
- 원본 영상이 한국어가 아니어도 결과물은 항상 자연스러운 한국어여야 한다 (직역 금지, 의미 기반 재작성).
- 마지막 슬라이드는 반드시 type="summary"로 핵심 시사점 3~5개를 담는다.
- 슬라이드 타입(bullets/comparison/process)을 내용에 맞게 다양하게 섞어서 지루하지 않게 구성한다 — 같은 타입만 연달아 쓰지 않는다. 단, 스크립트 내용상 자연스러운 타입만 쓴다 (비교할 대상이 없는데 comparison을 억지로 만들지 않는다).
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

  // gpt-4o's context window comfortably fits far more than the old 24k-char
  // cap — that cap was needlessly throwing away large chunks of longer
  // videos' actual content, undermining faithfulness to the source.
  const TRANSCRIPT_CHAR_LIMIT = 60000;
  const truncated =
    transcript.length > TRANSCRIPT_CHAR_LIMIT ? transcript.slice(0, TRANSCRIPT_CHAR_LIMIT) + " ...(생략)" : transcript;

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
