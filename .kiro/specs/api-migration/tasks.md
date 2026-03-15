# 구현 계획: API 마이그레이션

## 개요

AWS Bedrock + 자체 자막 추출 방식을 외부 YouTube Summary API로 전면 교체한다. 기존 서비스(BedrockClient, YouTubeDataFetcher) 및 관련 테스트를 제거하고, 새로운 API 클라이언트를 생성하여 SummarizerService, NoteCreator, SidebarView, SettingsTab, main.ts, types.ts, i18n을 리팩토링한다.

## Tasks

- [x] 1. 타입 정의 및 데이터 모델 업데이트 (`src/models/types.ts`)
  - [x] 1.1 PluginSettings에서 AWS 관련 필드 제거 및 apiKey 추가
    - `awsRegion`, `bedrockModelId`, `awsAccessKeyId`, `awsSecretAccessKey`, `summaryPrompt` 필드 제거
    - `apiKey: string` 필드 추가
    - `DEFAULT_SETTINGS` 객체에서 제거된 필드 삭제, `apiKey: ""` 추가
    - `DEFAULT_SUMMARY_PROMPT` 상수 제거
    - _Requirements: 9.3, 9.4, 9.5_
  - [x] 1.2 SummaryStage 열거형을 API 작업 상태에 맞게 업데이트
    - `FETCHING_METADATA`, `FETCHING_TRANSCRIPT` 제거
    - `PENDING`, `EXTRACTING`, `TRANSLATING` 추가
    - _Requirements: 9.6_
  - [x] 1.3 API 요청/응답 타입 정의
    - `SummarizeApiRequest`, `SummarizeApiResponse`, `TaskStatusResponse`, `ApiResult`, `ApiErrorDetail` 인터페이스 추가
    - _Requirements: 9.7_
  - [x] 1.4 NoteContent 인터페이스 변경
    - `videoId`, `isFallbackSummary` 필드 제거
    - `keyPoints: string[]` 필드 추가
    - _Requirements: 7.4_
  - [x] 1.5 기존 SummarizeRequest, SummarizeResponse, VideoMetadata, TranscriptResult 인터페이스 제거
    - API가 자막 추출/요약을 처리하므로 더 이상 불필요
    - _Requirements: 9.3_

- [x] 2. 기존 서비스 및 테스트 파일 제거
  - [x] 2.1 BedrockClient 관련 파일 삭제
    - `src/services/BedrockClient.ts` 삭제
    - `src/services/BedrockClient.test.ts` 삭제
    - `src/services/BedrockClient.property.test.ts` 삭제
    - _Requirements: 9.1_
  - [x] 2.2 YouTubeDataFetcher 관련 파일 삭제
    - `src/services/YouTubeDataFetcher.ts` 삭제
    - `src/services/YouTubeDataFetcher.test.ts` 삭제
    - `src/services/YouTubeDataFetcher.property.test.ts` 삭제
    - _Requirements: 9.2_

- [x] 3. 체크포인트 - 타입 정리 및 파일 제거 확인
  - 모든 테스트가 통과하는지 확인하고, 사용자에게 질문이 있으면 문의한다.

- [x] 4. YouTubeSummaryApiClient 신규 생성 (`src/services/YouTubeSummaryApiClient.ts`)
  - [x] 4.1 ApiError 클래스 및 YouTubeSummaryApiClient 클래스 구현
    - `ApiError` 클래스: `code`, `statusCode` 필드 포함
    - 생성자: `apiKey`, 선택적 `requestFn` (테스트용 의존성 주입) 파라미터
    - 옵시디언 `requestUrl` API를 기본 HTTP 클라이언트로 사용
    - 모든 요청에 `X-API-Key` 헤더 포함
    - Base URL: `https://api.rastalion.me/yts/api`
    - _Requirements: 10.1, 10.4, 10.6_
  - [x] 4.2 `submitSummarize` 메서드 구현
    - `POST /summarize` 엔드포인트 호출
    - 요청 본문: `{ url, target_language }`
    - 202 응답에서 `task_id` 추출
    - HTTP 상태 코드별 오류 처리 (401: 인증 오류, 422: 유효하지 않은 URL)
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 10.2, 10.5_
  - [x] 4.3 `getTaskStatus` 메서드 구현
    - `GET /tasks/{task_id}` 엔드포인트 호출
    - `TaskStatusResponse` 반환
    - HTTP 상태 코드별 오류 처리 (404: 작업 미발견, 500/504: 서버 오류)
    - _Requirements: 6.1, 10.3, 10.5_
  - [x] 4.4 YouTubeSummaryApiClient 단위 테스트 작성 (`src/services/YouTubeSummaryApiClient.test.ts`)
    - `requestFn` 모킹을 통한 submitSummarize 성공/실패 테스트
    - getTaskStatus 각 상태별 응답 테스트
    - HTTP 상태 코드별 ApiError 생성 테스트 (401, 404, 422, 500, 504)
    - X-API-Key 헤더 포함 여부 테스트
    - _Requirements: 10.2, 10.3, 10.5_

- [x] 5. SummarizerService 리팩토링 (`src/services/SummarizerService.ts`)
  - [x] 5.1 의존성 교체 및 summarize 메서드 재구현
    - 생성자: `YouTubeDataFetcher`, `BedrockClient` → `YouTubeSummaryApiClient`, `NoteCreator`
    - `summarize(videoUrl, targetLanguage, onProgress)` 시그니처로 변경
    - 내부 플로우: submitSummarize → 3초 간격 폴링 → 상태 변경 시 onProgress 콜백 → completed 시 노트 생성
    - 최대 폴링 60회(약 3분) 초과 시 타임아웃 오류
    - failed 상태 시 API 오류 메시지 포함 Error throw
    - _Requirements: 5.6, 6.1, 6.2, 6.3, 6.4, 6.5, 6.8, 11.1, 11.2, 11.3, 11.4, 11.5_
  - [x] 5.2 SummarizerService 단위 테스트 작성 (`src/services/SummarizerService.test.ts`)
    - API 클라이언트 모킹을 통한 전체 플로우 테스트
    - 폴링 중 상태 변경 시 onProgress 콜백 호출 검증
    - completed 시 NoteCreator.createNote 호출 검증
    - failed 시 오류 전파 검증
    - 폴링 타임아웃(60회 초과) 검증
    - _Requirements: 6.4, 6.5, 6.8, 11.4, 11.5_

- [x] 6. NoteCreator 수정 (`src/services/NoteCreator.ts`)
  - [x] 6.1 generateMarkdown 메서드 업데이트
    - 새 NoteContent 인터페이스에 맞게 수정 (videoId 제거, videoUrl 직접 사용)
    - `isFallbackSummary` callout 로직 제거
    - "핵심 인사이트" 섹션 추가: `keyPoints` 배열을 목록으로 렌더링
    - YAML 프론트매터에 원본 URL 포함
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_
  - [x] 6.2 NoteCreator 단위 테스트 업데이트 (`src/services/NoteCreator.test.ts`)
    - 새 NoteContent 구조로 generateMarkdown 출력 검증
    - keyPoints 섹션 포함 여부 테스트
    - videoUrl 직접 임베딩 테스트
    - _Requirements: 7.2, 7.3, 7.4_

- [x] 7. 체크포인트 - 핵심 서비스 레이어 검증
  - 모든 테스트가 통과하는지 확인하고, 사용자에게 질문이 있으면 문의한다.

- [x] 8. i18n 업데이트 (`src/i18n/index.ts`)
  - [x] 8.1 Translations 인터페이스 및 번역 데이터 업데이트
    - AWS 관련 키 제거: `awsRegionLabel`, `awsRegionDesc`, `accessKeyLabel`, `accessKeyDesc`, `secretKeyLabel`, `secretKeyDesc`, `modelLabel`, `modelDesc`
    - 프롬프트 관련 키 제거: `summaryPromptLabel`, `summaryPromptDesc`, `editPromptButton`, `promptModalTitle`, `promptModalSave`, `promptModalCancel`
    - 스크립트 관련 키 제거: `scriptLabel`, `scriptPlaceholder`, `scriptHint`
    - 기존 진행 단계 키 제거: `stageFetchingMetadata`, `stageFetchingTranscript`
    - API Key 설정 키 추가: `apiKeyLabel`, `apiKeyDesc`
    - 진행 단계 키 추가: `stagePending`, `stageExtracting`, `stageTranslating`
    - 오류 메시지 키 추가: `errorInvalidApiKey`, `errorApiConnection`, `errorApiTimeout`, `errorMissingApiKey`
    - en/ko 번역 데이터 모두 업데이트
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 13.7_

- [x] 9. SettingsTab 리팩토링 (`src/settings/SettingsTab.ts`)
  - [x] 9.1 설정 UI 재구성
    - `BedrockClient` import 및 `PromptEditorModal` 클래스 제거
    - AWS 관련 설정 UI 전체 제거 (리전 드롭다운, Access Key, Secret Key, 모델 선택)
    - 프롬프트 편집 버튼 제거
    - API Key 입력 텍스트 필드 추가
    - 언어 선택, 저장 폴더 설정 유지
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_
  - [x] 9.2 SettingsTab 단위 테스트 업데이트 (`src/settings/SettingsTab.test.ts`)
    - API Key 입력 필드 렌더링 검증
    - AWS 관련 설정 항목이 표시되지 않는지 검증
    - 프롬프트 편집 버튼이 표시되지 않는지 검증
    - _Requirements: 1.1, 1.2, 1.3_

- [x] 10. SidebarView 리팩토링 (`src/views/SidebarView.ts`)
  - [x] 10.1 UI 및 핸들러 업데이트
    - 스크립트 직접 입력 textarea 및 관련 UI 요소 제거
    - `resolveStageText`에서 새 SummaryStage 매핑 적용 (PENDING, EXTRACTING, TRANSLATING)
    - `handleSummarize()`에서 API Key 미설정 사전 검증 추가
    - `summarize()` 호출 시그니처 변경: `(videoUrl, targetLanguage, onProgress)` — prompt, manualTranscript 파라미터 제거
    - 요약 버튼 비활성화/활성화 로직 유지
    - _Requirements: 2.1, 2.2, 4.1, 4.2, 6.3, 6.6, 6.7, 7.7, 7.8_
  - [x] 10.2 SidebarView 단위 테스트 업데이트 (`src/views/SidebarView.test.ts`)
    - 스크립트 textarea가 렌더링되지 않는지 검증
    - API Key 미설정 시 오류 메시지 표시 검증
    - 새 진행 단계 텍스트 매핑 검증
    - _Requirements: 2.2, 4.1, 6.3_

- [x] 11. main.ts 업데이트 (`src/main.ts`)
  - [x] 11.1 서비스 팩토리 및 import 교체
    - `YouTubeDataFetcher`, `BedrockClient` import 제거
    - `YouTubeSummaryApiClient` import 추가
    - 서비스 팩토리에서 `YouTubeSummaryApiClient(this.settings.apiKey)` 생성
    - `SummarizerService(apiClient, noteCreator)` 주입
    - _Requirements: 12.1, 12.2, 12.3_
  - [x] 11.2 main.ts 단위 테스트 업데이트 (`src/main.test.ts`)
    - 새 서비스 팩토리 구조 검증
    - YouTubeSummaryApiClient 생성 및 주입 검증
    - _Requirements: 12.2, 12.3_

- [x] 12. obsidian 모킹 업데이트 (`src/__mocks__/obsidian.ts`)
  - `requestUrl` 모킹 함수가 API 응답 형태를 지원하도록 확인
  - 필요 시 반환 타입 확장 (json 필드 등)
  - _Requirements: 10.6_

- [x] 13. 최종 체크포인트 - 전체 테스트 통과 확인
  - 모든 테스트가 통과하는지 확인하고, 사용자에게 질문이 있으면 문의한다.

## Notes

- `*` 표시된 태스크는 선택 사항이며 빠른 MVP를 위해 건너뛸 수 있습니다
- 각 태스크는 특정 요구사항을 참조하여 추적 가능합니다
- 체크포인트에서 점진적 검증을 수행합니다
- `YouTubeUrlValidator`는 변경 없이 유지됩니다 (기존 테스트 그대로 사용)
