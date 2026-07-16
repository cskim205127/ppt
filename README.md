# agent-runner

n8n → HTTP → 이 서비스 → Claude Agent SDK(`sources-to-deck` + `pptx` 스킬) → `.pptx`.
설계 배경은 `C:\Users\oa00241\.claude\plans\n8n-mcp-youtube-glimmering-bachman.md` 참고.

## 현재 상태 (2026-07-16)

**빌드됨, 로컬(Windows, Docker 없이) HTTP 레이어까지만 검증됨.**

검증 완료:
- `npm install` / `tsc --noEmit` / `npm run build` 모두 통과
- `POST /jobs` 인증(Bearer) — 401 확인
- `POST /jobs` URL 검증 — 400 확인
- `POST /jobs` 정상 요청 → 202 즉시 아님, 201 + jobId 즉시 응답 → 백그라운드로 `runDeckJob` 트리거됨 확인
- `GET /jobs/:id` 상태 조회 확인
- `GET /healthz` 확인

**검증 못 함 (이 개발 머신의 한계, 코드 결함 아님):**
- 실제 Claude Agent SDK `query()` 호출 — 이 세션이 실행되는 샌드박스 자체가 임의 프로세스 spawn을 막고 있어서(`EPERM: operation not permitted, uv_spawn ...`) SDK가 내부적으로 CLI 프로세스를 띄우는 지점에서 즉시 실패함. Docker 컨테이너(샌드박스 밖)에서는 이 제약이 없을 것으로 예상하지만 **실측 전까지 가정일 뿐**.
- yt-dlp / LibreOffice / Poppler 연동 — 이 머신에 Docker Desktop이 설치되어 있지 않아 Dockerfile을 한 번도 빌드해보지 못함.
- 전체 파이프라인(자막→번역→렌더링→QA) 품질 — 위 두 가지가 막혀 있어 미검증.

## 다음에 필요한 것

1. **Docker Desktop 설치** (이 머신 또는 배포 대상 머신에). WSL2 백엔드도 함께 필요 — `wsl --install` 먼저.
2. `.env` 파일 생성 (`.env.example` 참고) — 특히 `ANTHROPIC_API_KEY` 실제 값 필요.
3. `docker build -t agent-runner .`
4. `docker run --env-file .env -p 8080:8080 agent-runner`
5. plan 문서의 "마일스톤 3" 커맨드로 실제 유튜브 URL 한 번 돌려서 나온 pptx를 직접 열어 품질 확인.

## 디렉터리
```
src/
  server.ts        Express 부트스트랩
  routes/jobs.ts    POST /jobs, GET /jobs/:id, GET /jobs/:id/file
  lib/claudeRunner.ts   query() 래퍼 — 성공 판정은 텍스트 파싱이 아니라
                        job.outputPath 파일 존재 여부
  lib/promptTemplate.ts 잡별 프롬프트 (언어 무관 한국어 강제 포함)
  lib/jobStore.ts    인메모리 잡 상태 (v1: 컨테이너 재시작 시 유실됨, 알려진 한계)
  lib/auth.ts        Bearer 공유시크릿 미들웨어
  config/allowedTools.ts  무인 실행 허용 도구 목록 — .claude/settings.json과 반드시 동기화
.claude/
  settings.json      permissionMode: dontAsk + 허용목록 (2026-07-16 사용자 명시 승인 하에 작성)
  skills/            sources-to-deck / pptx / pdf 벤더링 (폰트: Malgun Gothic → Noto Sans KR로 전환)
```
