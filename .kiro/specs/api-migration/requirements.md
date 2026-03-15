# 요구사항 문서

## 소개

Obsidian YouTube Summarizer 플러그인의 백엔드를 자체 구현(YouTubeDataFetcher + AWS Bedrock)에서 외부 YouTube Summary API(`https://api.rastalion.me/yts/api`)로 전면 교체한다. 기존에 플러그인이 직접 수행하던 자막 추출, AI 요약 생성을 외부 API에 위임하고, 플러그인은 API 호출 및 폴링, 결과를 노트로 정리하는 역할에 집중한다. 설정에서 AWS 관련 항목(리전, Access Key, Secret Key, 모델 ID, 요약 프롬프트)을 제거하고 API Key 하나로 교체한다.

## 용어 정의 (Glossary)

- **플러그인(Plugin)**: 옵시디언에 추가 기능을 제공하는 확장 모듈
- **사이드바_패널(Sidebar_Panel)**: 옵시디언 사이드바에 표시되는 플러그인 전용 UI 영역
- **유튜브_링크_입력창(YouTube_URL_Input)**: 사이드바 패널 내에서 유튜브 영상 URL을 입력받는 텍스트 필드
- **요약_버튼(Summarize_Button)**: 유튜브 영상 요약 프로세스를 시작하는 버튼
- **요약_노트(Summary_Note)**: 유튜브 영상 임베딩과 API 요약 결과가 포함된 옵시디언 마크다운 문서
- **플러그인_설정(Plugin_Settings)**: 플러그인의 동작을 사용자가 커스터마이즈할 수 있는 설정 화면
- **YouTube_Summary_API**: `https://api.rastalion.me/yts/api` 에서 제공하는 외부 영상 요약 REST API
- **API_Key**: YouTube_Summary_API 인증에 사용되는 `X-API-Key` 헤더 값
- **작업_ID(Task_ID)**: YouTube_Summary_API가 요약 요청 시 반환하는 UUID 형식의 작업 식별자
- **작업_상태(Task_Status)**: YouTube_Summary_API 작업의 처리 단계 (pending, extracting, translating, summarizing, completed, failed)
- **API_응답_결과(API_Result)**: 작업 완료 시 반환되는 결과 객체 (video_title, summary, key_points, translated_text, original_language, extraction_method 포함)
- **폴링(Polling)**: 작업 상태를 주기적으로 조회하여 완료 여부를 확인하는 방식
- **영상_제목(Video_Title)**: API 응답의 `video_title` 필드에서 가져온 영상 원본 제목
- **핵심_인사이트(Key_Points)**: API 응답의 `key_points` 배열에 포함된 3~5개의 핵심 요약 항목

## 요구사항

### 요구사항 1: API Key 설정 관리

**사용자 스토리:** 사용자로서, YouTube Summary API의 API Key를 플러그인 설정에서 관리하고 싶다.

#### 인수 조건 (Acceptance Criteria)

1. THE 플러그인_설정 SHALL API_Key를 입력할 수 있는 텍스트 필드를 제공한다
2. THE 플러그인_설정 SHALL 기존 AWS 관련 설정 항목(AWS 리전, Access Key ID, Secret Access Key, Bedrock 모델 ID)을 표시하지 않는다
3. THE 플러그인_설정 SHALL 요약 프롬프트 편집 기능을 표시하지 않는다 (API 서버 측에서 프롬프트를 처리하므로)
4. WHEN 사용자가 API_Key를 입력하면, THE 플러그인_설정 SHALL 변경된 API_Key를 영구적으로 저장한다
5. THE 플러그인_설정 SHALL 노트 저장 폴더 경로 설정을 유지한다
6. THE 플러그인_설정 SHALL 언어 선택 설정을 유지한다

### 요구사항 2: 사이드바 패널 UI 간소화

**사용자 스토리:** 사용자로서, 사이드바에서 유튜브 링크만 입력하여 간편하게 요약을 실행하고 싶다.

#### 인수 조건 (Acceptance Criteria)

1. THE 사이드바_패널 SHALL 유튜브_링크_입력창과 요약_버튼을 표시한다
2. THE 사이드바_패널 SHALL 수동 스크립트 입력 텍스트 영역을 표시하지 않는다 (API가 자막 추출을 처리하므로)
3. WHEN 플러그인이 활성화되면, THE 플러그인 SHALL 옵시디언 좌측 사이드바에 전용 아이콘을 등록한다
4. THE 유튜브_링크_입력창 SHALL 플레이스홀더 텍스트로 "유튜브 링크를 입력하세요"를 표시한다

### 요구사항 3: 유튜브 링크 유효성 검증

**사용자 스토리:** 사용자로서, 잘못된 링크를 입력했을 때 명확한 안내를 받고 싶다.

#### 인수 조건 (Acceptance Criteria)

1. WHEN 사용자가 요약_버튼을 클릭하면, THE 플러그인 SHALL 유튜브_링크_입력창의 값이 유효한 유튜브 URL 형식인지 검증한다
2. IF 입력된 URL이 유효한 유튜브 URL 형식이 아니면, THEN THE 플러그인 SHALL "유효한 유튜브 링크를 입력해주세요"라는 오류 메시지를 표시한다
3. THE 플러그인 SHALL youtube.com/watch, youtu.be, youtube.com/shorts 형식의 URL을 유효한 유튜브 URL로 인식한다
4. IF 유튜브_링크_입력창이 비어있는 상태에서 요약_버튼을 클릭하면, THEN THE 플러그인 SHALL "유튜브 링크를 입력해주세요"라는 오류 메시지를 표시한다

### 요구사항 4: API Key 사전 검증

**사용자 스토리:** 사용자로서, API Key가 설정되지 않은 상태에서 요약을 시도하면 안내를 받고 싶다.

#### 인수 조건 (Acceptance Criteria)

1. IF API_Key가 설정되지 않은 상태에서 요약_버튼을 클릭하면, THEN THE 플러그인 SHALL "설정에서 API Key를 입력해주세요"라는 오류 메시지를 표시한다
2. IF API_Key가 빈 문자열이면, THEN THE 플러그인 SHALL API_Key가 설정되지 않은 것으로 판단한다

### 요구사항 5: YouTube Summary API 요약 요청

**사용자 스토리:** 사용자로서, 유튜브 링크를 입력하면 외부 API를 통해 영상 요약을 받고 싶다.

#### 인수 조건 (Acceptance Criteria)

1. WHEN 유효한 유튜브 URL이 제출되면, THE 플러그인 SHALL YouTube_Summary_API의 `POST /summarize` 엔드포인트에 해당 URL과 대상 언어를 전송한다
2. THE 플러그인 SHALL `X-API-Key` 헤더에 저장된 API_Key를 포함하여 요청한다
3. WHEN YouTube_Summary_API가 202 응답을 반환하면, THE 플러그인 SHALL 응답에서 작업_ID를 추출한다
4. IF YouTube_Summary_API가 401 응답을 반환하면, THEN THE 플러그인 SHALL "API Key가 유효하지 않습니다. 설정을 확인해주세요"라는 오류 메시지를 표시한다
5. IF YouTube_Summary_API가 422 응답을 반환하면, THEN THE 플러그인 SHALL "유효하지 않은 유튜브 URL입니다"라는 오류 메시지를 표시한다
6. IF YouTube_Summary_API 요청이 네트워크 오류로 실패하면, THEN THE 플러그인 SHALL "API 서버에 연결할 수 없습니다. 네트워크를 확인해주세요"라는 오류 메시지를 표시한다

### 요구사항 6: 작업 상태 폴링 및 진행 표시

**사용자 스토리:** 사용자로서, 요약 과정이 어디까지 진행되었는지 실시간으로 알고 싶다.

#### 인수 조건 (Acceptance Criteria)

1. WHEN 작업_ID를 수신하면, THE 플러그인 SHALL YouTube_Summary_API의 `GET /tasks/{task_id}` 엔드포인트를 주기적으로 폴링하여 작업_상태를 조회한다
2. THE 플러그인 SHALL 3초 간격으로 폴링을 수행한다
3. WHILE 폴링이 진행 중인 동안, THE 사이드바_패널 SHALL 현재 작업_상태에 대응하는 진행 단계를 표시한다 (pending: "대기 중...", extracting: "자막 추출 중...", translating: "번역 중...", summarizing: "요약 생성 중...")
4. WHEN 작업_상태가 "completed"이면, THE 플러그인 SHALL 폴링을 중단하고 API_응답_결과를 처리한다
5. WHEN 작업_상태가 "failed"이면, THE 플러그인 SHALL 폴링을 중단하고 API 응답의 오류 메시지를 표시한다
6. WHEN 요약_버튼이 클릭되면, THE 플러그인 SHALL 요약_버튼을 비활성화하여 중복 요청을 방지한다
7. WHEN 요약 프로세스가 완료되거나 실패하면, THE 플러그인 SHALL 요약_버튼을 다시 활성화한다
8. IF 폴링이 최대 횟수(60회, 약 3분)를 초과하면, THEN THE 플러그인 SHALL 폴링을 중단하고 "요약 처리 시간이 초과되었습니다. 다시 시도해주세요"라는 오류 메시지를 표시한다

### 요구사항 7: 요약 노트 생성

**사용자 스토리:** 사용자로서, API 요약 결과가 구조화된 마크다운 노트로 자동 생성되길 원한다.

#### 인수 조건 (Acceptance Criteria)

1. WHEN 작업_상태가 "completed"이면, THE 플러그인 SHALL API_응답_결과의 video_title을 노트 제목으로 사용하여 새로운 마크다운 문서를 생성한다
2. THE 요약_노트 SHALL 문서 상단에 옵시디언 네이티브 임베딩 문법(`![](URL)`)을 사용하여 유튜브 영상을 임베딩한다
3. THE 요약_노트 SHALL API_응답_결과의 summary 필드 내용을 요약 섹션에 포함한다
4. THE 요약_노트 SHALL API_응답_결과의 key_points 배열을 핵심 인사이트 섹션에 목록 형태로 포함한다
5. THE 요약_노트 SHALL YAML 프론트매터에 태그(youtube-summary), 생성 일자, 원본 URL을 포함한다
6. IF 동일한 영상_제목의 노트가 이미 존재하면, THEN THE 플러그인 SHALL 파일명에 타임스탬프를 추가하여 중복을 방지한다
7. WHEN 요약_노트가 생성되면, THE 플러그인 SHALL "요약이 완료되었습니다"라는 성공 알림을 옵시디언 알림으로 표시한다
8. WHEN 요약 프로세스가 완료되면, THE 플러그인 SHALL 유튜브_링크_입력창을 초기화한다

### 요구사항 8: 노트 저장 경로 설정

**사용자 스토리:** 사용자로서, 요약 노트가 저장되는 폴더를 지정하고 싶다.

#### 인수 조건 (Acceptance Criteria)

1. THE 플러그인_설정 SHALL 요약_노트의 저장 폴더 경로를 설정할 수 있는 옵션을 제공한다
2. THE 플러그인 SHALL 기본 저장 경로로 "YouTube Summaries" 폴더를 사용한다
3. IF 지정된 저장 폴더가 존재하지 않으면, THEN THE 플러그인 SHALL 해당 폴더를 자동으로 생성한다

### 요구사항 9: 기존 서비스 제거 및 타입 정리

**사용자 스토리:** 개발자로서, 더 이상 사용하지 않는 AWS Bedrock 및 자체 자막 추출 코드를 제거하여 코드베이스를 깔끔하게 유지하고 싶다.

#### 인수 조건 (Acceptance Criteria)

1. THE 플러그인 SHALL BedrockClient 서비스 모듈을 코드베이스에서 제거한다
2. THE 플러그인 SHALL YouTubeDataFetcher 서비스 모듈을 코드베이스에서 제거한다
3. THE 플러그인 SHALL PluginSettings 타입에서 AWS 관련 필드(awsRegion, bedrockModelId, awsAccessKeyId, awsSecretAccessKey)를 제거한다
4. THE 플러그인 SHALL PluginSettings 타입에 apiKey 필드를 추가한다
5. THE 플러그인 SHALL PluginSettings 타입에서 summaryPrompt 필드를 제거한다
6. THE 플러그인 SHALL SummaryStage 열거형을 API 작업_상태 흐름(pending, extracting, translating, summarizing, completed, failed)에 맞게 업데이트한다
7. THE 플러그인 SHALL YouTube_Summary_API의 요청 및 응답 타입(SummarizeApiRequest, TaskStatusResponse, ApiResult, ApiError)을 정의한다

### 요구사항 10: 새 API 클라이언트 서비스

**사용자 스토리:** 개발자로서, YouTube Summary API와의 통신을 담당하는 전용 클라이언트 서비스를 사용하고 싶다.

#### 인수 조건 (Acceptance Criteria)

1. THE 플러그인 SHALL YouTubeSummaryApiClient 서비스 모듈을 생성한다
2. THE YouTubeSummaryApiClient SHALL `POST /summarize` 요청을 수행하는 메서드를 제공한다
3. THE YouTubeSummaryApiClient SHALL `GET /tasks/{task_id}` 요청을 수행하는 메서드를 제공한다
4. THE YouTubeSummaryApiClient SHALL 모든 요청에 `X-API-Key` 헤더를 포함한다
5. THE YouTubeSummaryApiClient SHALL HTTP 상태 코드에 따라 적절한 오류 타입을 반환한다 (401: 인증 오류, 404: 작업 미발견, 422: 유효하지 않은 URL, 500/504: 서버 오류)
6. THE YouTubeSummaryApiClient SHALL 옵시디언의 `requestUrl` API를 사용하여 HTTP 요청을 수행한다

### 요구사항 11: SummarizerService 리팩토링

**사용자 스토리:** 개발자로서, 요약 오케스트레이션 서비스가 새 API 클라이언트를 사용하도록 재구성하고 싶다.

#### 인수 조건 (Acceptance Criteria)

1. THE SummarizerService SHALL YouTubeDataFetcher와 BedrockClient 대신 YouTubeSummaryApiClient를 의존성으로 사용한다
2. THE SummarizerService SHALL API 요약 요청 → 폴링 → 결과 처리 → 노트 생성 순서로 프로세스를 오케스트레이션한다
3. WHILE 폴링이 진행 중인 동안, THE SummarizerService SHALL 작업_상태 변경 시마다 onProgress 콜백을 호출한다
4. IF API 요약 요청이 실패하면, THEN THE SummarizerService SHALL 오류를 상위 호출자에게 전파한다
5. IF 폴링 중 작업_상태가 "failed"이면, THEN THE SummarizerService SHALL API 오류 메시지를 포함한 오류를 발생시킨다

### 요구사항 12: 플러그인 진입점 업데이트

**사용자 스토리:** 개발자로서, main.ts가 새 서비스 구조를 사용하도록 업데이트하고 싶다.

#### 인수 조건 (Acceptance Criteria)

1. THE 플러그인 SHALL 서비스 팩토리에서 YouTubeDataFetcher와 BedrockClient 생성을 제거한다
2. THE 플러그인 SHALL 서비스 팩토리에서 YouTubeSummaryApiClient를 생성하고 설정의 API_Key를 전달한다
3. THE 플러그인 SHALL SummarizerService에 YouTubeSummaryApiClient와 NoteCreator를 주입한다

### 요구사항 13: 다국어(i18n) 업데이트

**사용자 스토리:** 사용자로서, 변경된 UI 요소에 대해 영어와 한국어 번역이 올바르게 표시되길 원한다.

#### 인수 조건 (Acceptance Criteria)

1. THE 플러그인 SHALL AWS 관련 번역 키(awsRegionLabel, awsRegionDesc, accessKeyLabel, accessKeyDesc, secretKeyLabel, secretKeyDesc, modelLabel, modelDesc)를 제거한다
2. THE 플러그인 SHALL 요약 프롬프트 관련 번역 키(summaryPromptLabel, summaryPromptDesc, editPromptButton, promptModalTitle, promptModalSave, promptModalCancel)를 제거한다
3. THE 플러그인 SHALL 수동 스크립트 입력 관련 번역 키(scriptLabel, scriptPlaceholder, scriptHint)를 제거한다
4. THE 플러그인 SHALL API Key 설정 관련 번역 키(apiKeyLabel, apiKeyDesc)를 추가한다
5. THE 플러그인 SHALL API 작업_상태에 대응하는 진행 단계 번역 키(stagePending, stageExtracting, stageTranslating, stageSummarizing)를 추가한다
6. THE 플러그인 SHALL API 오류 메시지 관련 번역 키(errorInvalidApiKey, errorApiConnection, errorApiTimeout)를 추가한다
7. THE 플러그인 SHALL 기존 stageFetchingMetadata, stageFetchingTranscript 번역 키를 제거한다
