import path from "path";
import { renderDeck } from "../lib/renderDeck";
import type { DeckOutline } from "../lib/outline";

const sample: DeckOutline = {
  title: "테스트 발표자료: 렌더러 스모크 테스트",
  subtitle: "실제 OpenAI 호출 없이 템플릿 렌더링 경로만 검증합니다",
  eyebrow: "SMOKE TEST",
  slides: [
    {
      type: "bullets",
      title: "왜 이 테스트가 필요한가",
      bullets: ["실제 배포 전에 렌더링 코드 자체의 런타임 에러를 잡기 위함", "아이콘 로딩과 폰트 설정을 확인", "레이아웃 좌표 계산이 깨지지 않는지 확인"],
      notes: "스모크 테스트용 노트",
      hasDetail: true,
      detailTitle: "테스트 상세 설명",
      detailBullets: ["상세 슬라이드 링크가 정상 작동하는지 확인", "뒤로가기 버튼도 함께 확인", "추가 항목 3", "추가 항목 4"],
    },
    {
      type: "comparison",
      title: "이전 방식과 새 방식 비교",
      leftLabel: "이전 (Claude Agent SDK)",
      leftItems: ["매번 즉흥적인 다이어그램", "결제 문제로 막힘"],
      rightLabel: "현재 (OpenAI + 템플릿)",
      rightItems: ["결정적 템플릿 렌더링", "이미 크레딧 보유"],
      notes: "비교 슬라이드 노트",
    },
    {
      type: "process",
      title: "파이프라인은 3단계로 동작한다",
      steps: ["yt-dlp로 자막 추출", "OpenAI로 개요 생성", "pptxgenjs로 렌더링"],
      notes: "프로세스 슬라이드 노트",
    },
    {
      type: "bullets",
      title: "두 번째 불릿 슬라이드도 잘 도는지 확인",
      bullets: ["아이콘 로테이션 확인", "다크 배경 슬라이드 확인"],
      notes: "노트",
    },
    {
      type: "summary",
      title: "핵심 요약",
      takeaways: ["렌더러 코드 자체는 문제 없이 돈다", "실제 OpenAI 연동은 별도로 검증 필요", "n8n/Railway 배포는 그대로 재사용 가능"],
      notes: "요약 노트",
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
