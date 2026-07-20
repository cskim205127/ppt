import {
  workflow,
  node,
  trigger,
  sticky,
  newCredential,
  ifElse,
  languageModel,
  outputParser,
  expr,
  placeholder,
} from '@n8n/workflow-sdk';

// ---------------------------------------------------------------------
// Trigger
// ---------------------------------------------------------------------
const webhookTrigger = trigger({
  type: 'n8n-nodes-base.webhook',
  version: 2.1,
  config: {
    name: 'YT to Deck Webhook',
    position: [240, 300],
    parameters: {
      httpMethod: 'POST',
      path: 'yt-to-deck',
      responseMode: 'responseNode',
    },
  },
  output: [{ body: { youtubeUrl: 'https://youtu.be/dQw4w9WgXcQ', deliverTo: 'me@example.com' } }],
});

// ---------------------------------------------------------------------
// Normalize + per-deployment config
// ---------------------------------------------------------------------
const prepareRequest = node({
  type: 'n8n-nodes-base.set',
  version: 3.4,
  config: {
    name: 'Prepare Request',
    position: [540, 300],
    parameters: {
      mode: 'manual',
      includeOtherFields: true,
      assignments: {
        assignments: [
          {
            id: 'youtubeUrl',
            name: 'youtubeUrl',
            value: expr('{{ $json.body?.youtubeUrl ?? $json.youtubeUrl ?? "" }}'),
            type: 'string',
          },
          {
            id: 'deliverTo',
            name: 'deliverTo',
            value: expr('{{ $json.body?.deliverTo ?? $json.deliverTo ?? "" }}'),
            type: 'string',
          },
          {
            id: 'agentRunnerBaseUrl',
            name: 'agentRunnerBaseUrl',
            value: 'https://ppt-production-cfef.up.railway.app',
            type: 'string',
          },
        ],
      },
    },
  },
  output: [
    {
      youtubeUrl: 'https://youtu.be/dQw4w9WgXcQ',
      deliverTo: 'me@example.com',
      agentRunnerBaseUrl: 'https://ppt-production-cfef.up.railway.app',
    },
  ],
});

// ---------------------------------------------------------------------
// URL validation
// ---------------------------------------------------------------------
const isValidYoutubeUrl = ifElse({
  version: 2.2,
  config: {
    name: 'Is Valid YouTube URL',
    position: [840, 300],
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' },
        conditions: [
          {
            leftValue: expr('{{ $json.youtubeUrl }}'),
            operator: { type: 'string', operation: 'regex' },
            rightValue: '^https?:\\/\\/(www\\.)?(youtube\\.com\\/(watch\\?v=|shorts\\/)|youtu\\.be\\/)',
          },
        ],
        combinator: 'and',
      },
    },
  },
});

const respondInvalidUrl = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: {
    name: 'Respond 400 Invalid URL',
    position: [1140, 560],
    parameters: {
      respondWith: 'json',
      responseBody: expr('{{ { "error": "youtubeUrl must be a valid YouTube watch/shorts/youtu.be URL" } }}'),
      options: { responseCode: 400 },
    },
  },
});

// ---------------------------------------------------------------------
// Step 1: transcript (Agent Runner does the yt-dlp part n8n structurally can't)
// ---------------------------------------------------------------------
const getTranscript = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Get Transcript',
    position: [1140, 260],
    onError: 'continueErrorOutput',
    parameters: {
      method: 'POST',
      url: expr('{{ $json.agentRunnerBaseUrl }}/transcript'),
      authentication: 'genericCredentialType',
      genericAuthType: 'httpBearerAuth',
      sendBody: true,
      contentType: 'json',
      specifyBody: 'json',
      jsonBody: expr('{{ { "youtubeUrl": $json.youtubeUrl } }}'),
    },
    credentials: { httpBearerAuth: newCredential('Bearer Auth account') },
  },
  output: [{ title: 'Sample Video Title', channel: 'Sample Channel', transcript: '...transcript text...' }],
});

// ---------------------------------------------------------------------
// Step 2: AI Agent generates the Korean slide outline (structured output).
// This is the node the user edits directly in n8n to tune the prompt —
// no code redeploy needed.
// ---------------------------------------------------------------------
const openAiModel = languageModel({
  type: '@n8n/n8n-nodes-langchain.lmChatOpenAi',
  version: 1.3,
  config: {
    name: 'OpenAI Model',
    position: [1440, 460],
    parameters: {},
    credentials: { openAiApi: newCredential('OpenAI account') },
  },
});

const outlineParser = outputParser({
  type: '@n8n/n8n-nodes-langchain.outputParserStructured',
  version: 1.3,
  config: {
    name: 'Outline Schema',
    position: [1600, 460],
    parameters: {
      schemaType: 'manual',
      inputSchema: '{"type":"object","additionalProperties":false,"properties":{"title":{"type":"string","description":"임팩트 있는 한국어 표지 제목 (한 줄, 발표의 결론/핵심 메시지를 담을 것)"},"subtitle":{"type":"string","description":"표지 부제 - 한 문장"},"eyebrow":{"type":"string","description":"표지 상단 짧은 태그 문구 (영문 대문자 or 짧은 한국어, 5어 이내)"},"slides":{"type":"array","minItems":5,"maxItems":8,"items":{"type":"object","additionalProperties":false,"properties":{"type":{"type":"string","enum":["bullets","comparison","process","summary"],"description":"bullets: 일반 핵심 내용, comparison: 두 대상 비교, process: 단계/순서, summary: 마지막 요약 슬라이드(전체에서 정확히 1개, 반드시 마지막 슬라이드)"},"title":{"type":"string","description":"슬라이드 제목 - 주제 나열이 아니라 스크립트에서 실제로 다뤄진 핵심 결론을 담은 문장"},"bullets":{"type":"array","items":{"type":"string"},"description":"type=bullets일 때: 3~5개(내용이 풍부하면 5개), 각 12~20단어. 스크립트에 실제 등장한 구체적 수치/사례/이유/근거를 최대한 담아 실속있게 작성 - 두루뭉술한 일반론 금지."},"leftLabel":{"type":"string","description":"type=comparison일 때 왼쪽 열 이름"},"leftItems":{"type":"array","items":{"type":"string"},"description":"type=comparison일 때 왼쪽 항목 2~4개, 스크립트 근거 기반"},"rightLabel":{"type":"string","description":"type=comparison일 때 오른쪽 열 이름"},"rightItems":{"type":"array","items":{"type":"string"},"description":"type=comparison일 때 오른쪽 항목 2~4개, 스크립트 근거 기반"},"steps":{"type":"array","items":{"type":"string"},"description":"type=process일 때 단계 3~6개, 스크립트에서 설명한 실제 순서 반영"},"takeaways":{"type":"array","items":{"type":"string"},"description":"type=summary일 때 핵심 요약 3~5개, 스크립트 전체를 관통하는 구체적 결론"},"evidence":{"type":"string","description":"이 슬라이드 내용이 스크립트의 어느 부분/발언/수치/사례에 근거하는지 1문장으로 명시. 근거가 없으면 빈 문자열."},"notes":{"type":"string","description":"발표자 노트 1~3문장"},"hasDetail":{"type":"boolean","description":"추가 상세 설명이 꼭 필요한 복잡한 내용이면 true"},"detailTitle":{"type":"string","description":"hasDetail=true일 때 상세 슬라이드 제목"},"detailBullets":{"type":"array","items":{"type":"string"},"description":"hasDetail=true일 때 상세 내용 4~7개"}},"required":["type","title","bullets","leftLabel","leftItems","rightLabel","rightItems","steps","takeaways","evidence","notes","hasDetail","detailTitle","detailBullets"]}}},"required":["title","subtitle","eyebrow","slides"]}',
    },
  },
});

const generateOutline = node({
  type: '@n8n/n8n-nodes-langchain.agent',
  version: 3.1,
  config: {
    name: 'Generate Outline',
    position: [1440, 260],
    onError: 'continueErrorOutput',
    parameters: {
      promptType: 'define',
      text: expr('영상 제목: {{ $json.title }} / 채널: {{ $json.channel }} / 스크립트: {{ $json.transcript }}'),
      hasOutputParser: true,
      options: {
        systemMessage:
          '너는 영상 스크립트를 한국어 비즈니스 발표자료 개요로 재구성하는 전문 에디터다. 가장 중요한 원칙은 내용의 실속이다. 모든 슬라이드는 스크립트에 실제로 등장하는 논점, 주장, 근거, 수치, 사례에 기반해야 한다. 스크립트에 없는 내용을 지어내거나 일반적인 통념으로 채우지 마라. "일관성이 중요하다" 같은 두루뭉술한 일반론이 아니라, 스크립트가 실제로 말한 구체적인 이유, 방법, 숫자, 예시를 뽑아서 써라. 스크립트 전체를 훑어서 화자가 실제로 강조한 논점들을 우선순위대로 골라 슬라이드를 구성한다. 앞부분만 보고 나머지를 무시하지 않는다. 스크립트에 실질적 내용이 거의 없으면(노래 가사, 잡담 등) 억지로 비즈니스 인사이트를 창작하지 말고 있는 그대로 성실하게 정리한다. 각 슬라이드의 evidence 필드에 스크립트의 어느 근거에서 나왔는지 반드시 명시한다. 구성 규칙: 문제 제기, 전개, 결론의 하나의 스토리로 재구성한다(논점 자체는 스크립트에 충실할 것). 슬라이드 제목은 주제명이 아니라 핵심 결론 문장이어야 한다. 원본 영상이 한국어가 아니어도 결과물은 항상 자연스러운 한국어여야 한다(직역 금지). 마지막 슬라이드는 반드시 type=summary 정확히 1개. 슬라이드 타입을 내용에 맞게 다양하게 섞는다. 비교할 대상이 없으면 comparison을 억지로 만들지 않는다. 사용하지 않는 필드는 빈 배열이나 빈 문자열로 채운다(null 금지).',
      },
    },
    subnodes: { model: openAiModel, outputParser: outlineParser },
  },
  output: [{ output: { title: '샘플 제목', subtitle: '샘플 부제', eyebrow: 'SAMPLE', slides: [] } }],
});

// ---------------------------------------------------------------------
// Step 3: render (Agent Runner does the pptxgenjs part n8n structurally can't)
// ---------------------------------------------------------------------
const renderDeck = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Render',
    position: [1740, 260],
    onError: 'continueErrorOutput',
    parameters: {
      method: 'POST',
      url: expr('{{ $("Prepare Request").item.json.agentRunnerBaseUrl }}/render'),
      authentication: 'genericCredentialType',
      genericAuthType: 'httpBearerAuth',
      sendBody: true,
      contentType: 'json',
      specifyBody: 'json',
      jsonBody: expr('{{ $json }}'),
      options: {
        response: { response: { responseFormat: 'file' } },
      },
    },
    credentials: { httpBearerAuth: newCredential('Bearer Auth account') },
  },
  output: [{}],
});

const uploadToDrive = node({
  type: 'n8n-nodes-base.googleDrive',
  version: 3,
  config: {
    name: 'Upload to Drive',
    position: [2040, 200],
    parameters: {
      resource: 'file',
      operation: 'upload',
      inputDataFieldName: 'data',
      name: expr('{{ ($("Get Transcript").item.json.title ?? "deck") + ".pptx" }}'),
    },
    credentials: { googleDriveOAuth2Api: newCredential('Google Drive account') },
  },
  output: [{ id: '1AbC...', name: 'Sample Deck Title.pptx', webViewLink: 'https://drive.google.com/file/d/1AbC.../view' }],
});

const emailSuccess = node({
  type: 'n8n-nodes-base.gmail',
  version: 2.2,
  config: {
    name: 'Email Success',
    position: [2340, 200],
    parameters: {
      resource: 'message',
      operation: 'send',
      sendTo: expr('{{ $("Prepare Request").item.json.deliverTo }}'),
      subject: expr('{{ "[자동생성] " + ($("Get Transcript").item.json.title ?? "발표자료") }}'),
      emailType: 'html',
      message: expr(
        '{{ "요청하신 유튜브 영상으로 발표자료가 완성됐습니다.<br><br>" + ' +
          '"제목: " + ($("Get Transcript").item.json.title ?? "-") + "<br>" + ' +
          '"다운로드: <a href=\\"" + $json.webViewLink + "\\">" + $json.webViewLink + "</a>" }}'
      ),
    },
    credentials: { gmailOAuth2: newCredential('Gmail account') },
  },
  output: [{ id: 'abc123', threadId: 'thread123' }],
});

const respondSuccess = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: {
    name: 'Respond 200',
    position: [2640, 200],
    parameters: {
      respondWith: 'json',
      responseBody: expr('{{ { "status": "succeeded", "title": $("Get Transcript").item.json.title, "driveLink": $("Upload to Drive").item.json.webViewLink } }}'),
      options: { responseCode: 200 },
    },
  },
});

// ---------------------------------------------------------------------
// Shared failure path
// ---------------------------------------------------------------------
const emailFailure = node({
  type: 'n8n-nodes-base.gmail',
  version: 2.2,
  config: {
    name: 'Email Failure',
    position: [1740, 620],
    parameters: {
      resource: 'message',
      operation: 'send',
      sendTo: expr('{{ $("Prepare Request").item.json.deliverTo }}'),
      subject: '[실패] 발표자료 생성 오류',
      emailType: 'html',
      message: expr(
        '{{ "유튜브 URL: " + $("Prepare Request").item.json.youtubeUrl + "<br>" + ' +
          '"오류: " + ($json.error?.message ?? $json.message ?? "알 수 없는 오류") }}'
      ),
    },
    credentials: { gmailOAuth2: newCredential('Gmail account') },
  },
  output: [{ id: 'def456', threadId: 'thread456' }],
});

const respondFailure = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: {
    name: 'Respond 500',
    position: [2040, 620],
    parameters: {
      respondWith: 'json',
      responseBody: expr('{{ { "status": "failed", "error": ($json.error?.message ?? $json.message ?? "알 수 없는 오류") } }}'),
      options: { responseCode: 500 },
    },
  },
});

// ---------------------------------------------------------------------
// Notes
// ---------------------------------------------------------------------
const promptNote = sticky(
  '## 프롬프트를 여기서 조정하세요. "Generate Outline" 노드(AI Agent)의 systemMessage와 "Outline Schema" 노드의 스키마를 직접 수정하면 코드 재배포 없이 바로 다음 실행부터 반영됩니다.',
  [generateOutline, openAiModel, outlineParser],
  { color: 6 }
);

const configNote = sticky(
  '## 배포 정보. agentRunnerBaseUrl은 이미 실제 Railway 주소로 설정되어 있습니다. v2: 폴링 루프 제거, 동기 처리로 단순화(LLM+렌더링이 충분히 빠름). 이 인스턴스 Execution Timeout 최대 180초 확인됨.',
  [prepareRequest],
  { color: 5 }
);

// ---------------------------------------------------------------------
// Wire it all together
// ---------------------------------------------------------------------
export default workflow('yt-to-korean-deck-v2', 'YouTube to Korean Deck v2 (n8n AI Agent)')
  .add(webhookTrigger)
  .to(
    prepareRequest.to(
      isValidYoutubeUrl
        .onFalse(respondInvalidUrl)
        .onTrue(
          getTranscript
            .onError(emailFailure.to(respondFailure))
            .to(
              generateOutline
                .onError(emailFailure.to(respondFailure))
                .to(
                  renderDeck
                    .onError(emailFailure.to(respondFailure))
                    .to(uploadToDrive.to(emailSuccess.to(respondSuccess)))
                )
            )
        )
    )
  )
  .add(promptNote)
  .add(configNote);
