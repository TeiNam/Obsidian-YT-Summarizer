# 구현 계획: Obsidian YouTube Summarizer

## 개요

옵시디언 플러그인으로 유튜브 영상 링크를 입력받아 자막/메타데이터를 추출하고, AWS Bedrock을 통해 AI 요약을 생성하여 마크다운 노트로 저장하는 기능을 구현한다. TypeScript 기반으로 Vitest + fast-check 테스트 프레임워크를 사용한다.

## Tasks

- [x] 1. 프로젝트 구조 및 타입 정의 설정
  - [x] 1.1 프로젝트 디렉토리 구조 생성 및 기본 설정 파일 구성
    - `src/` 하위에 `views/`, `services/`, `utils/`, `models/`, `settings/` 디렉토리 생성
    - `tsconfig.json`, `package.json`, `vitest.config.ts` 등 기본 설정 파일 구성
    - `vitest`, `fast-check`, `obsidian` 타입 의존성 설정
    - _Requirements: 전체_
  - [x] 1.2 타입 및 인터페이스 정의 (`src/models/types.ts`)
    - `PluginSettings`, `ValidationResult`, `VideoMetadata`, `TranscriptResult`, `SummarizeRequest`, `SummarizeResponse`, `NoteContent` 인터페이스 정의
    - `SummaryStage` 열거형 정의
    - `DEFAULT_SETTINGS` 상수 정의 (`system_prompt.md` 내용을 `DEFAULT_SUMMARY_PROMPT`로 내장)
    - `ProgressCallback` 타입 정의
    - _Requirements: 6.2, 6.6, 6.7, 7.2_

- [x] 2. URL 유효성 검증 모듈 구현
  - [x] 2.1 `YouTubeUrlValidator` 구현 (`src/utils/YouTubeUrlValidator.ts`)
    - `validateYouTubeUrl(url: string): ValidationResult` 함수 구현
    - `extractVideoId(url: string): string | null` 함수 구현l
    - `youtube.com/watch?v=`, `youtu.be/`, `youtube.com/shorts/` 형식 지원
    - http/https, www 유무, 추가 쿼리 파라미터 등 변형 처리
    - 빈 문자열 입력 시 "유튜브 링크를 입력해주세요" 오류 메시지 반환
    - 유효하지 않은 URL 시 "유효한 유튜브 링크를 입력해주세요" 오류 메시지 반환
    - _Requirements: 2.1, 2.2, 2.3, 2.4_
  - [x] 2.2 Property 1 속성 기반 테스트 작성
    - **Property 1: 유효한 유튜브 URL은 videoId를 추출한다**
    - 랜덤 videoId와 URL 형식 조합을 생성하여 유효한 URL이 올바르게 파싱되는지 검증
    - **Validates: Requirements 2.1, 2.3**
  - [x] 2.3 Property 2 속성 기반 테스트 작성
    - **Property 2: 유효하지 않은 URL은 거부된다**
    - 랜덤 문자열을 생성하여 유효하지 않은 URL이 거부되는지 검증
    - **Validates: Requirements 2.2**
  - [x] 2.4 URL 검증 단위 테스트 작성
    - 빈 문자열, 공백만 있는 문자열, 유사하지만 유효하지 않은 URL 에지 케이스 테스트
    - 각 URL 형식별 구체적 예제 테스트
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

- [x] 3. 유튜브 데이터 추출 서비스 구현
  - [x] 3.1 `YouTubeDataFetcher` 구현 (`src/services/YouTubeDataFetcher.ts`)
    - `fetchMetadata(videoId: string): Promise<VideoMetadata>` 구현
    - 유튜브 페이지 HTML에서 `<meta>` 태그 또는 `ytInitialPlayerResponse` JSON 파싱으로 제목/설명 추출
    - 메타데이터 가져오기 실패 시 영상 ID 기반 대체 제목 생성 (`YouTube 영상 - {videoId}`)
    - `fetchTranscript(videoId: string): Promise<TranscriptResult>` 구현
    - `timedtext` API 엔드포인트를 활용한 자막 추출
    - 자막 실패 시 `{ transcript: null, hasTranscript: false }` 반환
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_
  - [x] 3.2 Property 3 속성 기반 테스트 작성
    - **Property 3: 대체 제목 생성**
    - 랜덤 영상 ID 문자열로 대체 제목 생성 로직 검증 (비어있지 않고 영상 ID 포함)
    - **Validates: Requirements 3.4**
  - [x] 3.3 유튜브 데이터 추출 단위 테스트 작성
    - 실제 유튜브 HTML 응답 샘플을 사용한 메타데이터 파싱 테스트
    - 자막 추출 성공/실패 시나리오 테스트
    - 네트워크 오류 시 그레이스풀 디그레이데이션 테스트
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

- [x] 4. 체크포인트 - 핵심 유틸리티 검증
  - 모든 테스트가 통과하는지 확인하고, 질문이 있으면 사용자에게 문의한다.

- [x] 5. AWS Bedrock 클라이언트 구현
  - [x] 5.1 `BedrockClient` 구현 (`src/services/BedrockClient.ts`)
    - `constructor(region: string, modelId: string)` 구현
    - `summarize(request: SummarizeRequest): Promise<SummarizeResponse>` 구현
    - 요약 프롬프트 내 메타정보 블록 템플릿 치환 로직 구현 (`{title}`, `{channel}`, `{duration}`, `{transcript_text}` 등)
    - 자막 있는 경우와 대체 요약(메타데이터 기반) 경우의 요청 분기 처리
    - AWS Bedrock API 호출 실패 시 `{ success: false, error: "..." }` 반환
    - 로컬 AWS 자격 증명(~/.aws/credentials 또는 환경 변수) 활용
    - _Requirements: 5.1, 5.2, 5.6, 6.4, 6.5, 6.6, 6.7_
  - [x] 5.2 Property 7 속성 기반 테스트 작성
    - **Property 7: 프롬프트와 콘텐츠 결합**
    - 랜덤 프롬프트/콘텐츠 조합으로 메타정보 블록 플레이스홀더 대체 검증
    - **Validates: Requirements 5.1, 5.2**
  - [x] 5.3 Bedrock 클라이언트 단위 테스트 작성
    - API 호출 성공/실패 시나리오 모킹 테스트
    - 자막 기반 요약과 대체 요약 요청 분기 테스트
    - _Requirements: 5.1, 5.2, 5.6_

- [x] 6. 노트 생성 서비스 구현
  - [x] 6.1 `NoteCreator` 구현 (`src/services/NoteCreator.ts`)
    - `constructor(app: App, savePath: string)` 구현
    - `generateMarkdown(content: NoteContent): string` 구현
    - YAML 프론트매터 생성 (tags, date, url, channel 포함)
    - 옵시디언 네이티브 임베딩 문법 `![](URL)` 사용
    - 대체 요약인 경우 callout 안내 문구 포함
    - `createNote(content: NoteContent): Promise<TFile>` 구현 (Vault API 사용)
    - `resolveFilePath(title: string): Promise<string>` 구현 (중복 파일명 타임스탬프 추가)
    - 저장 폴더 미존재 시 자동 생성
    - _Requirements: 4.1, 4.2, 4.3, 4.5, 5.3, 5.4, 7.1, 7.2, 7.3_
  - [x] 6.2 Property 4 속성 기반 테스트 작성
    - **Property 4: 마크다운 노트 구조 무결성**
    - 랜덤 NoteContent 객체로 h1 헤더, 임베딩, 요약 내용 포함 검증
    - **Validates: Requirements 4.1, 4.2, 4.3, 5.3**
  - [x] 6.3 Property 5 속성 기반 테스트 작성
    - **Property 5: 대체 요약 안내 문구 포함**
    - 랜덤 NoteContent(isFallback true/false)로 안내 문구 조건부 포함 검증
    - **Validates: Requirements 5.4**
  - [x] 6.4 Property 6 속성 기반 테스트 작성
    - **Property 6: 파일명 중복 해결**
    - 랜덤 제목 문자열로 동일 제목 파일 존재 시 고유 파일 경로 반환 및 타임스탬프 포함 검증
    - **Validates: Requirements 4.5**
  - [x] 6.5 노트 생성 단위 테스트 작성
    - 특정 입력에 대한 마크다운 출력 스냅샷 테스트
    - YAML 프론트매터 정확성 테스트
    - 폴더 자동 생성 테스트
    - _Requirements: 4.1, 4.2, 4.3, 4.5, 5.3, 5.4, 7.3_

- [x] 7. 체크포인트 - 서비스 레이어 검증
  - 모든 테스트가 통과하는지 확인하고, 질문이 있으면 사용자에게 문의한다.

- [x] 8. 요약 오케스트레이션 서비스 구현
  - [x] 8.1 `SummarizerService` 구현 (`src/services/SummarizerService.ts`)
    - `constructor(fetcher, bedrockClient, noteCreator)` 의존성 주입
    - `summarize(videoId, videoUrl, prompt, onProgress): Promise<TFile>` 구현
    - 진행 단계별 `onProgress` 콜백 호출 (메타데이터 → 자막 → 요약 → 노트 생성 순서)
    - 자막 실패 시 대체 요약 플로우 분기 처리
    - AWS Bedrock 실패 시 임베딩만 포함된 노트 생성
    - 각 단계별 오류 처리 및 그레이스풀 디그레이데이션
    - _Requirements: 3.5, 3.6, 5.1, 5.2, 5.4, 5.5, 5.6, 8.2_
  - [x] 8.2 Property 9 속성 기반 테스트 작성
    - **Property 9: 진행 콜백 순서 보장**
    - 다양한 시나리오(자막 성공/실패)에서 진행 콜백이 정해진 순서로 호출되는지 검증
    - **Validates: Requirements 8.2**
  - [x] 8.3 오케스트레이션 서비스 단위 테스트 작성
    - 정상 플로우(자막 있음) 테스트
    - 대체 요약 플로우(자막 없음) 테스트
    - Bedrock 실패 시 임베딩만 포함된 노트 생성 테스트
    - _Requirements: 3.5, 3.6, 5.1, 5.2, 5.4, 5.6, 8.2_

- [x] 9. 사이드바 UI 구현
  - [x] 9.1 `SidebarView` 구현 (`src/views/SidebarView.ts`)
    - `ItemView` 상속, `getViewType()`, `getDisplayText()` 구현
    - `onOpen()`에서 유튜브_링크_입력창(플레이스홀더: "유튜브 링크를 입력하세요")과 요약_버튼 렌더링
    - 요약_버튼 클릭 시 URL 검증 → `SummarizerService.summarize()` 호출 플로우 연결
    - `setLoading(loading, message)`: 로딩 상태 전환 및 버튼 비활성화/활성화
    - `showError(message)`, `showSuccess(message)`: 상태 메시지 표시
    - `resetForm()`: 완료 후 입력창 초기화 및 버튼 활성화
    - 자막 실패 시 "자막을 가져올 수 없어 영상 설명 기반으로 요약합니다" 안내 메시지 표시
    - 진행 단계별 상태 메시지 표시 (메타데이터 가져오는 중, 자막 가져오는 중, AWS Bedrock 요약 생성 중 등)
    - _Requirements: 1.2, 1.3, 2.2, 2.4, 3.6, 5.5, 5.6, 8.1, 8.2, 8.3, 8.4_

- [x] 10. 설정 탭 구현
  - [x] 10.1 `SettingsTab` 구현 (`src/settings/SettingsTab.ts`)
    - `PluginSettingTab` 상속, `display()` 구현
    - 요약_프롬프트 편집 텍스트 영역 (기본값: `system_prompt.md` 내용)
    - 노트 저장 폴더 경로 설정 (기본값: "YouTube Summaries")
    - AWS 리전 설정 (기본값: "us-east-1")
    - Bedrock 모델 ID 설정 (기본값: "anthropic.claude-3-sonnet-20240229-v1:0")
    - 설정 변경 시 영구 저장
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 7.1, 7.2_
  - [x] 10.2 Property 8 속성 기반 테스트 작성
    - **Property 8: 설정 저장/로드 라운드트립**
    - 랜덤 PluginSettings 객체로 저장 후 로드 시 동일 값 반환 검증
    - **Validates: Requirements 6.3**

- [x] 11. 플러그인 진입점 및 통합
  - [x] 11.1 `YouTubeSummarizerPlugin` 구현 (`src/main.ts`)
    - `Plugin` 상속, `onload()`, `onunload()` 구현
    - 사이드바 아이콘 등록 (좌측 리본 아이콘)
    - `SidebarView` 뷰 등록
    - `SettingsTab` 설정 탭 추가
    - `loadSettings()`, `saveSettings()` 구현
    - 모든 서비스 인스턴스 생성 및 의존성 연결
    - 노트 생성 후 옵시디언 편집기에서 자동 열기 (`app.workspace.getLeaf().openFile()`)
    - 완료 시 옵시디언 알림 표시 (`new Notice("요약이 완료되었습니다")`)
    - _Requirements: 1.1, 1.2, 4.4, 8.3, 8.4_

- [x] 12. 최종 체크포인트 - 전체 통합 검증
  - 모든 테스트가 통과하는지 확인하고, 질문이 있으면 사용자에게 문의한다.

## 참고 사항

- `*` 표시된 태스크는 선택 사항이며 빠른 MVP를 위해 건너뛸 수 있습니다
- 각 태스크는 추적 가능성을 위해 구체적인 요구사항을 참조합니다
- 체크포인트에서 점진적 검증을 수행합니다
- 속성 기반 테스트(Property-Based Test)는 보편적 정확성 속성을 검증합니다
- 단위 테스트는 특정 예제와 에지 케이스를 검증합니다
