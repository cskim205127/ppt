import {
  workflow,
  node,
  trigger,
  sticky,
  newCredential,
  ifElse,
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
            value: placeholder('Agent Runner 배포 URL (예: http://agent-runner:8080). 배포 후 이 값을 실제 URL로 바꿔주세요.'),
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
      agentRunnerBaseUrl: 'http://agent-runner:8080',
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
    position: [1140, 460],
    parameters: {
      respondWith: 'json',
      responseBody: expr('{{ { "error": "youtubeUrl must be a valid YouTube watch/shorts/youtu.be URL" } }}'),
      options: { responseCode: 400 },
    },
  },
});

// ---------------------------------------------------------------------
// Kick off the Agent Runner job, then ack the webhook immediately.
// The workflow execution keeps running after Respond to Webhook — that
// node only closes the HTTP response, it does not end the execution.
// ---------------------------------------------------------------------
const startDeckJob = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Start Deck Job',
    position: [1140, 220],
    parameters: {
      method: 'POST',
      url: expr('{{ $json.agentRunnerBaseUrl }}/jobs'),
      authentication: 'genericCredentialType',
      genericAuthType: 'httpBearerAuth',
      sendBody: true,
      contentType: 'json',
      specifyBody: 'json',
      jsonBody: expr('{{ { "youtubeUrl": $json.youtubeUrl, "deliverTo": $json.deliverTo } }}'),
    },
    credentials: { httpBearerAuth: newCredential('Agent Runner Bearer Token') },
  },
  output: [{ jobId: 'e655c17a-bb90-488e-b555-0b11578f6e09', statusUrl: '/jobs/e655c17a-bb90-488e-b555-0b11578f6e09' }],
});

const ackWebhook = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: {
    name: 'Ack 202',
    position: [1440, 220],
    parameters: {
      respondWith: 'json',
      responseBody: expr('{{ { "jobId": $json.jobId, "statusUrl": $json.statusUrl } }}'),
      options: { responseCode: 202 },
    },
  },
});

// ---------------------------------------------------------------------
// Poll loop. No explicit attempt-counter — bounded instead by the
// workflow's own Execution Timeout setting (raise it after import, see
// sticky note) plus the Agent Runner's own maxTurns/maxBudgetUsd caps.
// ---------------------------------------------------------------------
const pollWait = node({
  type: 'n8n-nodes-base.wait',
  version: 1.1,
  config: {
    name: 'Poll Delay',
    position: [1440, 400],
    parameters: {
      resume: 'timeInterval',
      amount: 30,
      unit: 'seconds',
    },
  },
});

const pollJobStatus = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Poll Job Status',
    position: [1740, 400],
    parameters: {
      method: 'GET',
      url: expr('{{ $("Prepare Request").item.json.agentRunnerBaseUrl }}/jobs/{{ $("Start Deck Job").item.json.jobId }}'),
      authentication: 'genericCredentialType',
      genericAuthType: 'httpBearerAuth',
    },
    credentials: { httpBearerAuth: newCredential('Agent Runner Bearer Token') },
  },
  output: [{ status: 'succeeded', videoTitle: 'Sample Deck Title', error: undefined, costUsd: 0.42, numTurns: 37 }],
});

const jobFinished = ifElse({
  version: 2.2,
  config: {
    name: 'Job Finished?',
    position: [2040, 400],
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' },
        conditions: [
          { leftValue: expr('{{ $json.status }}'), operator: { type: 'string', operation: 'equals' }, rightValue: 'succeeded' },
          { leftValue: expr('{{ $json.status }}'), operator: { type: 'string', operation: 'equals' }, rightValue: 'failed' },
        ],
        combinator: 'or',
      },
    },
  },
});

const jobSucceeded = ifElse({
  version: 2.2,
  config: {
    name: 'Succeeded?',
    position: [2340, 300],
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' },
        conditions: [
          { leftValue: expr('{{ $json.status }}'), operator: { type: 'string', operation: 'equals' }, rightValue: 'succeeded' },
        ],
        combinator: 'and',
      },
    },
  },
});

// ---------------------------------------------------------------------
// Success path: download -> upload to Drive -> email the Drive link.
// Deliberately NOT attaching the file directly to the email — Google
// Drive's upload output doesn't document binary passthrough, and
// preserving binary through a branch+Merge just for an optional
// attachment isn't worth the fragility for v1. A Drive link is a fully
// reasonable delivery mechanism on its own.
// ---------------------------------------------------------------------
const downloadDeck = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Download Deck',
    position: [2640, 200],
    parameters: {
      method: 'GET',
      url: expr('{{ $("Prepare Request").item.json.agentRunnerBaseUrl }}/jobs/{{ $("Start Deck Job").item.json.jobId }}/file'),
      authentication: 'genericCredentialType',
      genericAuthType: 'httpBearerAuth',
      options: {
        response: { response: { responseFormat: 'file' } },
      },
    },
    credentials: { httpBearerAuth: newCredential('Agent Runner Bearer Token') },
  },
  output: [{}],
});

const uploadToDrive = node({
  type: 'n8n-nodes-base.googleDrive',
  version: 3,
  config: {
    name: 'Upload to Drive',
    position: [2940, 200],
    parameters: {
      resource: 'file',
      operation: 'upload',
      inputDataFieldName: 'data',
      name: expr('{{ ($("Poll Job Status").item.json.videoTitle ?? $("Start Deck Job").item.json.jobId) + ".pptx" }}'),
    },
    credentials: { googleDriveOAuth2Api: newCredential('Google Drive OAuth2 API') },
  },
  output: [{ id: '1AbC...', name: 'Sample Deck Title.pptx', webViewLink: 'https://drive.google.com/file/d/1AbC.../view' }],
});

const emailSuccess = node({
  type: 'n8n-nodes-base.gmail',
  version: 2.2,
  config: {
    name: 'Email Success',
    position: [3240, 200],
    parameters: {
      resource: 'message',
      operation: 'send',
      sendTo: expr('{{ $("Prepare Request").item.json.deliverTo }}'),
      subject: expr('{{ "[자동생성] " + ($("Poll Job Status").item.json.videoTitle ?? "발표자료") }}'),
      emailType: 'html',
      message: expr(
        '{{ "요청하신 유튜브 영상으로 발표자료가 완성됐습니다.<br><br>" + ' +
          '"제목: " + ($("Poll Job Status").item.json.videoTitle ?? "-") + "<br>" + ' +
          '"다운로드: <a href=\\"" + $json.webViewLink + "\\">" + $json.webViewLink + "</a><br><br>" + ' +
          '"턴 수: " + $("Poll Job Status").item.json.numTurns + " / 비용: $" + $("Poll Job Status").item.json.costUsd }}'
      ),
    },
    credentials: { gmailOAuth2: newCredential('Gmail OAuth2 API') },
  },
  output: [{ id: 'abc123', threadId: 'thread123' }],
});

// ---------------------------------------------------------------------
// Failure path
// ---------------------------------------------------------------------
const emailFailure = node({
  type: 'n8n-nodes-base.gmail',
  version: 2.2,
  config: {
    name: 'Email Failure',
    position: [2340, 560],
    parameters: {
      resource: 'message',
      operation: 'send',
      sendTo: expr('{{ $("Prepare Request").item.json.deliverTo }}'),
      subject: expr('{{ "[실패] 발표자료 생성 오류" }}'),
      emailType: 'html',
      message: expr(
        '{{ "유튜브 URL: " + $("Prepare Request").item.json.youtubeUrl + "<br>" + ' +
          '"오류: " + ($json.error ?? "알 수 없는 오류") }}'
      ),
    },
    credentials: { gmailOAuth2: newCredential('Gmail OAuth2 API') },
  },
  output: [{ id: 'def456', threadId: 'thread456' }],
});

// ---------------------------------------------------------------------
// Notes for the person reviewing/importing this workflow
// ---------------------------------------------------------------------
const configNote = sticky(
  '## 배포 전 확인\n' +
    '1. "Prepare Request" 노드의 agentRunnerBaseUrl 값을 실제 배포 URL로 교체\n' +
    '2. "Agent Runner Bearer Token" 자격증명 생성 (Header/Bearer Auth, RUNNER_SHARED_SECRET 값)\n' +
    '3. 워크플로우 설정에서 Execution Timeout을 기본값보다 크게 (예: 1800초) 상향 — ' +
    '폴링 루프가 Agent Runner보다 먼저 죽지 않도록',
  [prepareRequest],
  { color: 5 }
);

const loopNote = sticky(
  '## 폴링 루프\n' +
    '별도 시도횟수 카운터 없이, 워크플로우 Execution Timeout에만 의존합니다.\n' +
    'Agent Runner 자체의 maxTurns/maxBudgetUsd가 잡 자체를 한 번 더 제한합니다.',
  [pollWait, pollJobStatus, jobFinished],
  { color: 4 }
);

// ---------------------------------------------------------------------
// Wire it all together
// ---------------------------------------------------------------------
export default workflow('yt-to-korean-deck', 'YouTube to Korean Deck')
  .add(webhookTrigger)
  .to(
    prepareRequest.to(
      isValidYoutubeUrl
        .onFalse(respondInvalidUrl)
        .onTrue(
          startDeckJob.to(
            ackWebhook.to(
              pollWait.to(
                pollJobStatus.to(
                  jobFinished
                    .onFalse(pollWait)
                    .onTrue(
                      jobSucceeded
                        .onTrue(downloadDeck.to(uploadToDrive.to(emailSuccess)))
                        .onFalse(emailFailure)
                    )
                )
              )
            )
          )
        )
    )
  )
  .add(configNote)
  .add(loopNote);
