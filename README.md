# agent-runner

n8n → HTTP → 이 서비스 → yt-dlp(자막 추출) → OpenAI(구조화 출력으로 슬라이드 개요 생성, 항상 한국어) → pptxgenjs 템플릿 렌더링 → `.pptx`.

Railway 배포: https://ppt-production-cfef.up.railway.app (project `b268b2f8-5a21-4ca4-adbf-e6c5507e54c6`, service `ppt`)

## 아키텍처 변경 이력

**v1 (2026-07-16)**: Claude Agent SDK + `sources-to-deck`/`pptx` 스킬 기반. 서버/인증/잡 라이프사이클까지 Railway에 완전히 배포되어 검증됐으나, Anthropic Console 결제가 끝내 활성화되지 않아 실제 LLM 호출은 검증하지 못함.

**v2 (2026-07-20, 현재)**: OpenAI 기반으로 전면 재설계. 사용자가 이미 OpenAI 크레딧을 보유하고 있어 전환. 에이전트가 즉흥적으로 다이어그램을 설계하던 방식 대신, **OpenAI가 슬라이드 개요(JSON, structured output)를 만들고 코드가 정해진 템플릿 라이브러리로 결정적으로 렌더링**하는 방식으로 바뀜 — 품질은 템플릿 다양성(bullets/comparison/process/summary + 상세링크 슬라이드)에 의존하며, v1처럼 매번 즉흥적인 커스텀 다이어그램이 나오지는 않음. n8n 워크플로우와 Agent Runner의 HTTP API(잡 생성/폴링) 구조는 LLM 프로바이더에 무관하게 그대로 유지됨.

## 파이프라인

1. `lib/transcript.ts` — yt-dlp로 자막 추출 (언어 무관, en/ko 우선 시도 후 전체 폴백)
2. `lib/outline.ts` — OpenAI structured output으로 `{title, subtitle, eyebrow, slides[]}` JSON 생성. 슬라이드 타입: `bullets`/`comparison`/`process`/`summary`. 항상 한국어로 재구성 (직역 아님). 일부 슬라이드는 `hasDetail=true`로 표시되어 별도 상세 슬라이드 생성 대상이 됨.
3. `lib/renderDeck.ts` — pptxgenjs로 표지+아젠다+본문 슬라이드+(있으면)상세 슬라이드를 렌더링. 상세 슬라이드는 원본 슬라이드에서 하이퍼링크로 연결되고, 상세 슬라이드에는 "메인으로 돌아가기" 버튼이 있음 (`slide: N` 하이퍼링크, pptxgenjs 지원).
4. `lib/openaiRunner.ts` — 위 세 단계를 순서대로 실행하는 오케스트레이터. `routes/jobs.ts`가 호출.

## 환경변수

`.env.example` 참고. 필수: `OPENAI_API_KEY`, `RUNNER_SHARED_SECRET`.

## 디렉터리

```
src/
  server.ts             Express 부트스트랩
  routes/jobs.ts         POST /jobs, GET /jobs/:id, GET /jobs/:id/file
  lib/openaiRunner.ts     파이프라인 오케스트레이터 (전체 흐름의 진입점)
  lib/transcript.ts       yt-dlp 자막 추출
  lib/outline.ts          OpenAI 구조화 출력 → 슬라이드 개요
  lib/renderDeck.ts       pptxgenjs 템플릿 렌더러 (표지/아젠다/본문/상세/서머리)
  lib/icons.ts            react-icons + sharp 아이콘 래스터라이즈
  lib/jobStore.ts         인메모리 잡 상태 (v1: 컨테이너 재시작 시 유실됨, 알려진 한계)
  lib/auth.ts             Bearer 공유시크릿 미들웨어
```

## 알려진 v1 갭 (필요해지면 추후 개선)

- 잡 상태가 인메모리라 컨테이너 재시작 시 진행 중이던 잡 정보 유실
- `costUsd`는 항상 미계산 (OpenAI 토큰 단가를 하드코딩하지 않기 위해 의도적으로 생략 — n8n 이메일 템플릿에서 이 필드를 참조한다면 업데이트 필요)
- 렌더링 후 자동 시각 QA 없음 (v1의 LibreOffice 렌더+AI 재검토 루프가 없음) — 대신 템플릿을 여유있는 여백/폰트 크기로 보수적으로 설계해 안전하게 구성
