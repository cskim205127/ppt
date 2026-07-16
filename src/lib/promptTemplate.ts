import type { JobRecord } from "./jobStore";

/**
 * Builds the single prompt handed to the Claude Agent SDK for one job.
 *
 * The one non-negotiable contract with the caller (see claudeRunner.ts):
 * the agent MUST write its final file to exactly `job.outputPath`. The
 * server treats file-existence at that path as the pass/fail signal —
 * never the agent's free-text final message — because there is no
 * guaranteed structured way to extract a file path from SDK result text.
 */
export function buildDeckPrompt(job: JobRecord): string {
  return `다음 유튜브 영상을 기반으로 한국어 발표자료(.pptx)를 만들어줘.

영상 URL: ${job.youtubeUrl}

작업 순서:
1. sources-to-deck 스킬의 유튜브 추출 단계를 사용해 자막을 추출한다.
   scripts/yt_transcript.py 를 --out ${job.jobDir} 로 실행할 것.
   영상의 원래 언어가 무엇이든 상관없이 우선 추출한다(스크립트가 en/ko 자막이
   없으면 자동으로 다른 언어 자막으로 폴백한다).
2. **중요 — sources-to-deck 스킬 문서에 적힌 "소스 언어를 따른다"는 기본
   규칙을 이번 작업에서는 명시적으로 무시한다.** 소스 영상이 한국어가
   아니더라도 최종 결과물의 제목/불릿/다이어그램 라벨/발표자 노트는 전부
   자연스러운 한국어여야 한다. 원문을 그대로 직역한 뒤 요약하지 말고,
   요약·슬라이드 구성 단계에서 한국어로 바로 작성해서 번역체가 되지 않게 할 것.
3. business_deck_outline.md의 규칙대로 아웃라인을 구성하고, document-skills:pptx
   스킬의 품질 기준(주제에 맞는 다이어그램, 다양한 레이아웃, 표지 이미지,
   native shapes 사용 규칙)을 그대로 적용해 렌더링한다.
4. document-skills:pptx 스킬에 정의된 필수 QA를 반드시 수행한다 — markitdown
   기반 텍스트 QA와 LibreOffice(soffice.py + pdftoppm) 기반 시각 QA를 모두
   생략하지 말 것. 이 QA에서 발견한 문제는 반드시 수정 후 재검증한다.
5. 완성된 파일을 **정확히 이 경로**에 저장한다: ${job.outputPath}
   이 경로가 아닌 다른 경로에 저장하면 작업이 실패로 처리된다. 필요하면
   중간 작업 파일은 ${job.jobDir} 하위 다른 폴더에 자유롭게 만들어도 되지만,
   최종 산출물만은 반드시 저 경로 그대로여야 한다.
6. 사람이 승인하거나 질문에 답할 수 없는 무인 환경이다. 확인 질문을 하지
   말고, 합리적인 기본값으로 판단해서 끝까지 진행한다.
7. 완료되면 마지막 줄에 다음 형식으로 한 줄만 출력한다(로그 참고용, 성공
   판정 기준은 아님): DECK_COMPLETE: ${job.outputPath}

작업 디렉터리(${job.jobDir})가 없으면 먼저 만든다.`;
}
