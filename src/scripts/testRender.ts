import path from "path";
import { renderDeck } from "../lib/renderDeck";
import type { DeckOutline } from "../lib/outline";

// Deliberately uses LONGER, more substantive bullets (12-20 words, matching
// the post-"실속있게" prompt change) to verify the widened full-width
// bullets-slide layout doesn't overflow.
const sample: DeckOutline = {
  title: "테스트 발표자료: 실속있는 콘텐츠 레이아웃 검증",
  subtitle: "더 길고 구체적인 불릿 텍스트에서도 레이아웃이 안전한지 확인합니다",
  eyebrow: "SMOKE TEST",
  slides: [
    {
      type: "bullets",
      title: "왜 이 테스트가 필요한가: 불릿이 길어지면 레이아웃이 깨질 수 있다",
      bullets: [
        "이전에는 8~12단어로 짧게 제한했지만, 이제는 12~20단어로 구체적 수치와 사례를 담도록 프롬프트를 바꿨다",
        "좁은 왼쪽 절반 컬럼(5.6인치)에 맞추던 레이아웃을 전체 폭(12.2인치)으로 넓혀서 줄바꿈으로 인한 넘침을 방지해야 한다",
        "아이콘도 콘텐츠 폭을 차지하지 않도록 우측 상단의 작은 배지 형태로 옮겼다",
      ],
      notes: "스모크 테스트용 노트",
      evidence: "테스트용 더미 근거 문장",
      hasDetail: true,
      detailTitle: "테스트 상세 설명: 레이아웃 안전성 검증 방법",
      detailBullets: [
        "각 템플릿 타입(bullets/comparison/process/summary)의 텍스트 영역 폭과 높이를 재계산했다",
        "comparison 슬라이드는 2단 구성이라 원래도 좁아서 폰트 크기를 14에서 13.5로 살짝 낮췄다",
        "process 슬라이드는 단계 설명이 원래도 짧게 유지되도록 프롬프트를 유지했다",
        "실제 배포 전 로컬에서 이 스크립트로 눈으로 먼저 확인하는 것이 목적이다",
      ],
    },
    {
      type: "comparison",
      title: "이전 방식과 새 방식의 콘텐츠 밀도 비교",
      leftLabel: "이전 (짧은 불릿)",
      leftItems: ["8~12단어의 두루뭉술한 요약 위주였다", "스크립트의 구체적 근거가 빠지기 쉬웠다"],
      rightLabel: "현재 (실속있는 불릿)",
      rightItems: [
        "12~20단어로 스크립트의 실제 수치·사례·근거를 최대한 담는다",
        "evidence 필드로 스크립트 근거를 명시하도록 강제한다",
      ],
      notes: "비교 슬라이드 노트",
      evidence: "테스트용 더미 근거 문장",
    },
    {
      type: "process",
      title: "파이프라인은 여전히 3단계로 동작한다",
      steps: ["yt-dlp로 자막 추출", "OpenAI로 개요 생성 (이제 더 충실하게)", "pptxgenjs로 렌더링 (넓어진 레이아웃)"],
      notes: "프로세스 슬라이드 노트",
      evidence: "테스트용 더미 근거 문장",
    },
    {
      type: "bullets",
      title: "두 번째 불릿 슬라이드에서도 긴 텍스트가 안전한지 확인",
      bullets: [
        "다크 배경 슬라이드에서도 동일한 전체 폭 레이아웃이 적용되는지 확인한다",
        "아이콘 배지가 제목과 겹치지 않는지, 우측 상단 여백이 충분한지 확인한다",
      ],
      notes: "노트",
      evidence: "테스트용 더미 근거 문장",
    },
    {
      type: "summary",
      title: "핵심 요약: 실속 있는 콘텐츠로도 레이아웃은 안전하다",
      takeaways: [
        "불릿 길이를 늘려도 전체 폭 레이아웃 덕분에 넘침 위험이 크게 줄었다",
        "comparison/process 슬라이드도 여유 있는 높이로 재조정했다",
        "실제 OpenAI 연동 결과로 한 번 더 검증이 필요하다",
      ],
      notes: "요약 노트",
      evidence: "테스트용 더미 근거 문장",
    },
  ],
};

const outPath = path.join(__dirname, "..", "..", "test-output.pptx");
renderDeck(sample, outPath)
  .then(() => console.log("OK:", outPath))
  .catch((err) => {
    console.error("RENDER FAILED:", err);
    process.exit(1);
  });
