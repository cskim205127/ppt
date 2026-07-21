import { workflow, node, trigger, sticky, newCredential, ifElse, switchCase, languageModel, outputParser, expr } from '@n8n/workflow-sdk';

const AGENT_RUNNER_BASE_URL = 'https://ppt-production-cfef.up.railway.app';

const formTrigger = trigger({
  type: 'n8n-nodes-base.formTrigger',
  version: 2.6,
  config: {
    name: 'Deck Request Form',
    position: [240, 400],
    parameters: {
      formTitle: '유튜브 · PDF · 텍스트 → 한국어 발표자료 자동 생성',
      formDescription: '아래에서 입력 방식을 선택한 뒤 해당하는 항목만 채워주세요. 생성이 완료되면 입력하신 이메일로 다운로드 링크가 발송됩니다.',
      formFields: {
        values: [
          { fieldName: 'sourceType', fieldLabel: '입력 방식 선택', fieldType: 'dropdown', requiredField: true, fieldOptions: { values: [{ option: '유튜브 링크' }, { option: 'PDF 파일' }, { option: '텍스트 직접 입력' }] } },
          { fieldName: 'youtubeUrl', fieldLabel: '유튜브 URL (유튜브 링크 선택 시에만 입력)', fieldType: 'text', placeholder: 'https://www.youtube.com/watch?v=...', requiredField: false },
          { fieldName: 'pdfFile', fieldLabel: 'PDF 파일 (PDF 파일 선택 시에만 업로드)', fieldType: 'file', acceptFileTypes: '.pdf', multipleFiles: false, requiredField: false },
          { fieldName: 'pastedText', fieldLabel: '텍스트 (텍스트 직접 입력 선택 시에만 작성)', fieldType: 'textarea', placeholder: '발표자료로 만들 내용을 여기에 붙여넣으세요', requiredField: false },
          { fieldName: 'deliverTo', fieldLabel: '결과를 받을 이메일 주소', fieldType: 'email', requiredField: true }
        ]
      },
      responseMode: 'lastNode',
      options: { appendAttribution: false, buttonLabel: '제출' }
    }
  }
});

const prepareRequest = node({
  type: 'n8n-nodes-base.set',
  version: 3.4,
  config: {
    name: 'Prepare Request',
    position: [540, 400],
    parameters: {
      mode: 'manual',
      includeOtherFields: true,
      assignments: {
        assignments: [
          { id: 'sourceType', name: 'sourceType', value: expr('{{ $json.sourceType }}'), type: 'string' },
          { id: 'youtubeUrl', name: 'youtubeUrl', value: expr('{{ $json.youtubeUrl }}'), type: 'string' },
          { id: 'pastedText', name: 'pastedText', value: expr('{{ $json.pastedText }}'), type: 'string' },
          { id: 'deliverTo', name: 'deliverTo', value: expr('{{ $json.deliverTo }}'), type: 'string' },
          { id: 'agentRunnerBaseUrl', name: 'agentRunnerBaseUrl', value: AGENT_RUNNER_BASE_URL, type: 'string' },
          { id: 'submittedAt', name: 'submittedAt', value: expr('{{ $now.toISO() }}'), type: 'string' }
        ]
      }
    }
  },
  output: [{ sourceType: '유튜브 링크', youtubeUrl: 'https://www.youtube.com/watch?v=abc', pastedText: '', deliverTo: 'user@example.com', agentRunnerBaseUrl: AGENT_RUNNER_BASE_URL, submittedAt: '2026-07-20T00:00:00.000Z' }]
});

const logSubmission = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: 'Log Submission',
    position: [780, 640],
    parameters: {
      resource: 'row',
      operation: 'insert',
      dataTableId: { __rl: true, mode: 'id', value: 'TWdIcc6mgrKFEecF' },
      columns: {
        mappingMode: 'defineBelow',
        value: {
          submittedAt: expr('{{ $json.submittedAt }}'),
          sourceType: expr('{{ $json.sourceType }}'),
          sourceValue: expr('{{ $json.sourceType === "유튜브 링크" ? $json.youtubeUrl : ($json.sourceType === "텍스트 직접 입력" ? $json.pastedText.slice(0, 200) : "PDF 업로드") }}'),
          deliverTo: expr('{{ $json.deliverTo }}')
        },
        schema: [
          { id: 'submittedAt', displayName: 'submittedAt', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'sourceType', displayName: 'sourceType', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'sourceValue', displayName: 'sourceValue', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'deliverTo', displayName: 'deliverTo', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true }
        ]
      }
    }
  }
});

const routeSource = switchCase({
  version: 3.4,
  config: {
    name: 'Route by Source Type',
    position: [780, 400],
    parameters: {
      mode: 'rules',
      rules: {
        values: [
          { outputKey: 'youtube', conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' }, conditions: [{ leftValue: expr('{{ $json.sourceType }}'), operator: { type: 'string', operation: 'equals' }, rightValue: '유튜브 링크' }], combinator: 'and' } },
          { outputKey: 'pdf', conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' }, conditions: [{ leftValue: expr('{{ $json.sourceType }}'), operator: { type: 'string', operation: 'equals' }, rightValue: 'PDF 파일' }], combinator: 'and' } },
          { outputKey: 'text', conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' }, conditions: [{ leftValue: expr('{{ $json.sourceType }}'), operator: { type: 'string', operation: 'equals' }, rightValue: '텍스트 직접 입력' }], combinator: 'and' } }
        ]
      },
      options: { fallbackOutput: 'extra', renameFallbackOutput: 'Unknown' }
    }
  }
});

const validateYoutubeUrl = ifElse({
  version: 2.2,
  config: {
    name: 'Is Valid YouTube URL',
    position: [1080, 160],
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' },
        conditions: [{ leftValue: expr('{{ $json.youtubeUrl }}'), operator: { type: 'string', operation: 'regex' }, rightValue: '^https?:\\/\\/(www\\.)?(youtube\\.com\\/(watch\\?v=|shorts\\/)|youtu\\.be\\/)' }],
        combinator: 'and'
      }
    }
  }
});

const getTranscript = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Get Transcript',
    position: [1320, 120],
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
      options: {}
    },
    credentials: { httpBearerAuth: newCredential('Bearer Auth account') }
  },
  output: [{ title: '영상 제목', channel: '채널명', transcript: '스크립트 전문' }]
});

const invalidUrlCompletion = node({
  type: 'n8n-nodes-base.form',
  version: 2.5,
  config: {
    name: 'Invalid URL Completion',
    position: [1320, 260],
    parameters: {
      operation: 'completion',
      respondWith: 'text',
      completionTitle: '입력 오류',
      completionMessage: '유튜브 URL 형식이 올바르지 않습니다. 다시 제출해 주세요 (예: https://www.youtube.com/watch?v=... 또는 https://youtu.be/...).'
    }
  }
});

const extractPdfText = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Extract PDF Text',
    position: [1080, 400],
    onError: 'continueErrorOutput',
    parameters: {
      method: 'POST',
      url: expr('{{ $json.agentRunnerBaseUrl }}/pdf-extract'),
      authentication: 'genericCredentialType',
      genericAuthType: 'httpBearerAuth',
      sendBody: true,
      contentType: 'binaryData',
      inputDataFieldName: 'pdfFile',
      options: {}
    },
    credentials: { httpBearerAuth: newCredential('Bearer Auth account') }
  },
  output: [{ title: 'PDF 제목', text: 'PDF 본문 텍스트' }]
});

const normalizePdfResult = node({
  type: 'n8n-nodes-base.set',
  version: 3.4,
  config: {
    name: 'Normalize PDF Result',
    position: [1320, 400],
    parameters: {
      mode: 'manual',
      includeOtherFields: false,
      assignments: {
        assignments: [
          { id: 'title', name: 'title', value: expr('{{ $json.title }}'), type: 'string' },
          { id: 'channel', name: 'channel', value: '', type: 'string' },
          { id: 'transcript', name: 'transcript', value: expr('{{ $json.text }}'), type: 'string' }
        ]
      }
    }
  },
  output: [{ title: 'PDF 제목', channel: '', transcript: 'PDF 본문 텍스트' }]
});

const validateText = ifElse({
  version: 2.2,
  config: {
    name: 'Is Text Non-Empty',
    position: [1080, 640],
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' },
        conditions: [{ leftValue: expr('{{ $json.pastedText }}'), operator: { type: 'string', operation: 'notEmpty' } }],
        combinator: 'and'
      }
    }
  }
});

const normalizeTextResult = node({
  type: 'n8n-nodes-base.set',
  version: 3.4,
  config: {
    name: 'Normalize Text Result',
    position: [1320, 580],
    parameters: {
      mode: 'manual',
      includeOtherFields: false,
      assignments: {
        assignments: [
          { id: 'title', name: 'title', value: expr('{{ $json.pastedText.slice(0, 40) }}...'), type: 'string' },
          { id: 'channel', name: 'channel', value: '', type: 'string' },
          { id: 'transcript', name: 'transcript', value: expr('{{ $json.pastedText }}'), type: 'string' }
        ]
      }
    }
  },
  output: [{ title: '텍스트 앞부분...', channel: '', transcript: '붙여넣은 전체 텍스트' }]
});

const emptyTextCompletion = node({
  type: 'n8n-nodes-base.form',
  version: 2.5,
  config: {
    name: 'Empty Text Completion',
    position: [1320, 720],
    parameters: {
      operation: 'completion',
      respondWith: 'text',
      completionTitle: '입력 오류',
      completionMessage: '텍스트 내용이 비어 있습니다. 발표자료로 만들 내용을 입력한 뒤 다시 제출해 주세요.'
    }
  }
});

const unknownSourceCompletion = node({
  type: 'n8n-nodes-base.form',
  version: 2.5,
  config: {
    name: 'Unknown Source Completion',
    position: [1080, 900],
    parameters: {
      operation: 'completion',
      respondWith: 'text',
      completionTitle: '입력 오류',
      completionMessage: '입력 방식을 다시 선택한 뒤 제출해 주세요.'
    }
  }
});

const readyForOutline = node({
  type: 'n8n-nodes-base.set',
  version: 3.4,
  config: {
    name: 'Ready for Outline',
    position: [1440, 400],
    parameters: {
      mode: 'manual',
      includeOtherFields: true,
      assignments: { assignments: [] }
    }
  },
  output: [{ title: '제목', channel: '', transcript: '본문' }]
});

const openAiModel = languageModel({
  type: '@n8n/n8n-nodes-langchain.lmChatOpenAi',
  version: 1.3,
  config: {
    name: 'OpenAI Model',
    position: [1560, 500],
    parameters: { model: { __rl: true, mode: 'list', value: 'gpt-5-mini' }, options: {} },
    credentials: { openAiApi: newCredential('OpenAI account') }
  }
});

const outlineSchema = outputParser({
  type: '@n8n/n8n-nodes-langchain.outputParserStructured',
  version: 1.3,
  config: {
    name: 'Outline Schema',
    position: [1720, 500],
    parameters: {
      schemaType: 'manual',
      inputSchema: '{"type":"object","additionalProperties":false,"properties":{"title":{"type":"string","description":"임팩트 있는 한국어 표지 제목 (한 줄, 발표의 결론/핵심 메시지를 담을 것)"},"subtitle":{"type":"string","description":"표지 부제 - 한 문장"},"eyebrow":{"type":"string","description":"표지 상단 짧은 태그 문구 (영문 대문자 or 짧은 한국어, 5어 이내)"},"slides":{"type":"array","minItems":5,"maxItems":8,"items":{"type":"object","additionalProperties":false,"properties":{"type":{"type":"string","enum":["bullets","comparison","process","summary"],"description":"bullets: 일반 핵심 내용, comparison: 두 대상 비교, process: 단계/순서, summary: 마지막 요약 슬라이드(전체에서 정확히 1개, 반드시 마지막 슬라이드)"},"title":{"type":"string","description":"슬라이드 제목 - 주제 나열이 아니라 스크립트에서 실제로 다뤄진 핵심 결론을 담은 문장"},"bullets":{"type":"array","items":{"type":"string"},"description":"type=bullets일 때: 3~5개(내용이 풍부하면 5개), 각 12~20단어. 스크립트에 실제 등장한 구체적 수치/사례/이유/근거를 최대한 담아 실속있게 작성 - 두루뭉술한 일반론 금지."},"leftLabel":{"type":"string","description":"type=comparison일 때 왼쪽 열 이름"},"leftItems":{"type":"array","items":{"type":"string"},"description":"type=comparison일 때 왼쪽 항목 2~4개, 스크립트 근거 기반"},"rightLabel":{"type":"string","description":"type=comparison일 때 오른쪽 열 이름"},"rightItems":{"type":"array","items":{"type":"string"},"description":"type=comparison일 때 오른쪽 항목 2~4개, 스크립트 근거 기반"},"steps":{"type":"array","items":{"type":"string"},"description":"type=process일 때 단계 3~6개, 스크립트에서 설명한 실제 순서 반영"},"takeaways":{"type":"array","items":{"type":"string"},"description":"type=summary일 때 핵심 요약 3~5개, 스크립트 전체를 관통하는 구체적 결론"},"evidence":{"type":"string","description":"이 슬라이드 내용이 스크립트의 어느 부분/발언/수치/사례에 근거하는지 1문장으로 명시. 근거가 없으면 빈 문자열."},"notes":{"type":"string","description":"발표자 노트 1~3문장"},"hasDetail":{"type":"boolean","description":"추가 상세 설명이 꼭 필요한 복잡한 내용이면 true"},"detailTitle":{"type":"string","description":"hasDetail=true일 때 상세 슬라이드 제목"},"detailBullets":{"type":"array","items":{"type":"string"},"description":"hasDetail=true일 때 상세 내용 4~7개"}},"required":["type","title","bullets","leftLabel","leftItems","rightLabel","rightItems","steps","takeaways","evidence","notes","hasDetail","detailTitle","detailBullets"]}}},"required":["title","subtitle","eyebrow","slides"]}'
    }
  }
});

const generateOutline = node({
  type: '@n8n/n8n-nodes-langchain.agent',
  version: 3.1,
  config: {
    name: 'Generate Outline',
    position: [1560, 400],
    onError: 'continueErrorOutput',
    subnodes: { model: openAiModel, outputParser: outlineSchema },
    parameters: {
      promptType: 'define',
      text: expr('=영상/문서 제목: {{ $json.title }} / 채널(해당 없으면 빈값): {{ $json.channel }} / 본문: {{ $json.transcript }}'),
      hasOutputParser: true,
      options: {
        systemMessage: '너는 소스 자료(유튜브 스크립트, PDF 문서, 또는 직접 입력한 텍스트)를 한국어 비즈니스 발표자료 개요로 재구성하는 전문 에디터다. 가장 중요한 원칙은 내용의 실속이다. 모든 슬라이드는 소스에 실제로 등장하는 논점, 주장, 근거, 수치, 사례에 기반해야 한다. 소스에 없는 내용을 지어내거나 일반적인 통념으로 채우지 마라. "일관성이 중요하다" 같은 두루뭉술한 일반론이 아니라, 소스가 실제로 말한 구체적인 이유, 방법, 숫자, 예시를 뽑아서 써라. 소스 전체를 훑어서 실제로 강조된 논점들을 우선순위대로 골라 슬라이드를 구성한다. 앞부분만 보고 나머지를 무시하지 않는다. 소스에 실질적 내용이 거의 없으면(노래 가사, 잡담 등) 억지로 비즈니스 인사이트를 창작하지 말고 있는 그대로 성실하게 정리한다. 각 슬라이드의 evidence 필드에 소스의 어느 근거에서 나왔는지 반드시 명시한다. 구성 규칙: 문제 제기, 전개, 결론의 하나의 스토리로 재구성한다(논점 자체는 소스에 충실할 것). 슬라이드 제목은 주제명이 아니라 핵심 결론 문장이어야 한다. 원본이 한국어가 아니어도 결과물은 항상 자연스러운 한국어여야 한다(직역 금지). 마지막 슬라이드는 반드시 type=summary 정확히 1개. 슬라이드 타입을 내용에 맞게 다양하게 섞는다. 비교할 대상이 없으면 comparison을 억지로 만들지 않는다. 사용하지 않는 필드는 빈 배열이나 빈 문자열로 채운다(null 금지).'
      }
    }
  },
  output: [{ output: { title: '표지 제목', subtitle: '부제', eyebrow: 'EYEBROW', slides: [] } }]
});

const renderDeck = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Render',
    position: [1960, 400],
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
      options: { response: { response: { responseFormat: 'file' } } }
    },
    credentials: { httpBearerAuth: newCredential('Bearer Auth account') }
  },
  output: [{}]
});

const uploadToDrive = node({
  type: 'n8n-nodes-base.googleDrive',
  version: 3,
  config: {
    name: 'Upload to Drive',
    position: [2200, 340],
    parameters: {
      resource: 'file',
      operation: 'upload',
      inputDataFieldName: 'data',
      name: expr('{{ ($("Generate Outline").item.json.output?.title ?? "deck") + ".pptx" }}'),
      driveId: { __rl: true, mode: 'list', value: 'My Drive' },
      folderId: { __rl: true, mode: 'list', value: 'root', cachedResultName: '/ (Root folder)' },
      options: {}
    },
    credentials: { googleDriveOAuth2Api: newCredential('Google Drive account') }
  },
  output: [{ webViewLink: 'https://drive.google.com/file/d/example/view' }]
});

const emailSuccess = node({
  type: 'n8n-nodes-base.gmail',
  version: 2.2,
  config: {
    name: 'Email Success',
    position: [2440, 340],
    parameters: {
      resource: 'message',
      operation: 'send',
      sendTo: expr('{{ $("Prepare Request").item.json.deliverTo }}'),
      subject: expr('{{ "[자동생성] " + ($("Generate Outline").item.json.output?.title ?? "발표자료") }}'),
      emailType: 'html',
      message: expr('{{ "요청하신 내용으로 발표자료가 완성됐습니다.<br><br>" + "제목: " + ($("Generate Outline").item.json.output?.title ?? "-") + "<br>" + "다운로드: <a href=\\"" + $json.webViewLink + "\\">" + $json.webViewLink + "</a>" }}'),
      options: {}
    },
    credentials: { gmailOAuth2: newCredential('Gmail account') }
  },
  output: [{ id: 'msg-id' }]
});

const successCompletion = node({
  type: 'n8n-nodes-base.form',
  version: 2.5,
  config: {
    name: 'Success Completion',
    position: [2440, 200],
    parameters: {
      operation: 'completion',
      respondWith: 'text',
      completionTitle: '발표자료 생성 완료',
      completionMessage: expr('{{ "발표자료 생성이 완료되었습니다. 입력하신 이메일로 다운로드 링크를 보내드렸습니다.\\n\\n다운로드 링크: " + $("Upload to Drive").item.json.webViewLink }}')
    }
  }
});

const emailFailure = node({
  type: 'n8n-nodes-base.gmail',
  version: 2.2,
  config: {
    name: 'Email Failure',
    position: [1960, 720],
    parameters: {
      resource: 'message',
      operation: 'send',
      sendTo: expr('{{ $("Prepare Request").item.json.deliverTo }}'),
      subject: '[실패] 발표자료 생성 오류',
      emailType: 'html',
      message: expr('{{ "입력 방식: " + $("Prepare Request").item.json.sourceType + "<br>" + "오류: " + ($json.error?.message ?? $json.message ?? "알 수 없는 오류") }}'),
      options: {}
    },
    credentials: { gmailOAuth2: newCredential('Gmail account') }
  },
  output: [{ id: 'msg-id' }]
});

const failureCompletion = node({
  type: 'n8n-nodes-base.form',
  version: 2.5,
  config: {
    name: 'Failure Completion',
    position: [2200, 720],
    parameters: {
      operation: 'completion',
      respondWith: 'text',
      completionTitle: '발표자료 생성 실패',
      completionMessage: '처리 중 오류가 발생했습니다. 입력하신 이메일로 오류 내용을 보내드렸습니다. 잠시 후 다시 시도해 주세요.'
    }
  }
});

emailFailure.to(failureCompletion);
prepareRequest.to(logSubmission);

const infoSticky = sticky(
  '## 배포 정보. agentRunnerBaseUrl은 이미 실제 Railway 주소로 설정되어 있습니다. v3: 트리거를 Webhook에서 Form Trigger로 교체, 유튜브 링크/PDF 파일/텍스트 직접 입력 3가지 소스를 모두 지원합니다. Form 제출 시 원본 데이터는 Log Submission 노드가 Data Table(yt_to_deck_submissions)에 기록합니다.',
  [formTrigger, prepareRequest, logSubmission],
  { color: 5 }
);

const promptSticky = sticky(
  '## 프롬프트를 여기서 조정하세요. "Generate Outline" 노드(AI Agent)의 systemMessage와 "Outline Schema" 노드의 스키마를 직접 수정하면 코드 재배포 없이 바로 다음 실행부터 반영됩니다. 3가지 입력 소스(유튜브/PDF/텍스트) 모두 이 한 곳에서 처리됩니다.',
  [generateOutline, openAiModel, outlineSchema],
  { color: 6 }
);

readyForOutline.to(generateOutline
  .onError(emailFailure)
  .to(renderDeck
    .onError(emailFailure)
    .to(uploadToDrive
      .to(emailSuccess
        .to(successCompletion)))));

export default workflow('yt-pdf-text-to-deck-v3', 'YouTube/PDF/Text to Korean Deck v3 (Form Input)')
  .add(formTrigger)
  .to(prepareRequest)
  .to(routeSource
    .onCase(0, validateYoutubeUrl
      .onTrue(getTranscript
        .onError(emailFailure)
        .to(readyForOutline))
      .onFalse(invalidUrlCompletion))
    .onCase(1, extractPdfText
      .onError(emailFailure)
      .to(normalizePdfResult
        .to(readyForOutline)))
    .onCase(2, validateText
      .onTrue(normalizeTextResult
        .to(readyForOutline))
      .onFalse(emptyTextCompletion))
    .onCase(3, unknownSourceCompletion))
  .add(infoSticky)
  .add(promptSticky);
