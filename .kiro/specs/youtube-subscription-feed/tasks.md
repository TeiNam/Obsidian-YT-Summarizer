# 구현 계획: YouTube 구독 피드

## 개요

기존 Obsidian YouTube Summarizer 플러그인에 YouTube Data API v3 기반 구독 피드 기능을 추가한다. 타입 정의 → API 클라이언트 → 비즈니스 로직 → UI 순서로 점진적으로 구현하며, 각 단계에서 기존 테스트가 깨지지 않도록 한다.

## 태스크

- [ ] 1. 타입 정의 및 설정 확장
  - [x] 1.1 구독 피드 관련 타입 및 인터페이스 추가
    - `src/models/types.ts`에 `MonitoredChannel`, `SubscriptionChannel`, `SubscriptionListResponse`, `VideoItem`, `PlaylistItemsResponse`, `ChannelVideos`, `VideoSummaryStatus` 타입 추가
    - `PluginSettings` 인터페이스에 `youtubeDataApiKey`, `monitoredChannels`, `subscriptionSaveFolderPath`, `lastCheckedAt` 필드 추가
    - `DEFAULT_SETTINGS` 객체에 신규 필드 기본값 추가
    - _Requirements: 1.2, 3.2, 4.2, 4.3, 5.3_

  - [x]* 1.2 설정 라운드트립 속성 테스트 작성
    - **Property 1: 설정 라운드트립**
    - fast-check으로 랜덤 `PluginSettings` 객체(구독 관련 필드 포함) 생성 후 `Object.assign({}, DEFAULT_SETTINGS, data)` 라운드트립 검증
    - **Validates: Requirements 1.2, 3.2, 4.2, 5.3**

- [ ] 2. i18n 확장
  - [x] 2.1 구독 피드 관련 i18n 키 추가
    - `src/i18n/index.ts`의 `Translations` 인터페이스에 구독 피드 관련 키 추가
    - `en`, `ko` 번역 객체에 모든 신규 키의 번역 값 추가
    - _Requirements: 8.1_

  - [x]* 2.2 번역 키 완전성 속성 테스트 작성
    - **Property 8: 번역 키 완전성**
    - 구독 피드 관련 모든 i18n 키에 대해 en/ko 번역 객체 모두에 비어있지 않은 문자열 값이 존재하는지 검증
    - **Validates: Requirements 8.1**

- [x] 3. 체크포인트 - 타입 및 i18n 검증
  - 모든 테스트가 통과하는지 확인하고, 질문이 있으면 사용자에게 문의한다.

- [ ] 4. YouTubeDataApiClient 구현
  - [x] 4.1 YouTubeDataApiClient 클래스 구현
    - `src/services/YouTubeDataApiClient.ts` 생성
    - `fetchSubscriptions(pageToken?)`: subscriptions.list 엔드포인트 호출, 페이지네이션 지원
    - `fetchAllSubscriptions()`: nextPageToken을 사용하여 모든 구독 채널 자동 조회
    - `fetchRecentVideos(uploadsPlaylistId, maxResults?)`: playlistItems.list 엔드포인트 호출
    - 기존 `YouTubeSummaryApiClient`와 동일한 `RequestFn` 의존성 주입 패턴 사용
    - API 오류 처리 (403 유효하지 않은 키, 429 쿼터 초과, 네트워크 오류)
    - _Requirements: 2.1, 2.3, 2.4, 2.5, 5.1_

  - [x]* 4.2 YouTubeDataApiClient 단위 테스트 작성
    - `src/services/YouTubeDataApiClient.test.ts` 생성
    - API 호출 성공/실패 시나리오, 오류 응답 처리 테스트
    - _Requirements: 2.1, 2.4, 2.5_

  - [x]* 4.3 페이지네이션 완전성 속성 테스트 작성
    - **Property 2: 페이지네이션 완전성**
    - 랜덤 구독 채널 수(1~200)와 모킹된 API 응답으로 `fetchAllSubscriptions`가 정확히 N개 채널을 중복 없이 반환하는지 검증
    - **Validates: Requirements 2.3**

- [ ] 5. SubscriptionManager 구현
  - [x] 5.1 SubscriptionManager 클래스 구현
    - `src/services/SubscriptionManager.ts` 생성
    - `getUploadsPlaylistId(channelId)`: 채널 ID의 두 번째 문자를 `U`로 교체하여 Uploads 플레이리스트 ID 도출
    - `filterNewVideos(videos, lastCheckedAt)`: 마지막 확인 시점 이후 영상만 필터링
    - `fetchNewVideos()`: 모니터링 대상 채널의 신규 영상을 채널별로 그룹화하여 반환
    - `updateLastCheckedAt(channelId, timestamp)`: 마지막 확인 시점 업데이트
    - 개별 채널 조회 실패 시 다른 채널에 영향 없도록 격리
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

  - [x]* 5.2 Uploads 플레이리스트 ID 도출 속성 테스트 작성
    - **Property 9: Uploads 플레이리스트 ID 도출**
    - 랜덤 "UC" 접두사 채널 ID로 `getUploadsPlaylistId`가 "UU"로 시작하고 나머지가 동일한 문자열을 반환하는지 검증
    - **Validates: Requirements 5.1**

  - [x]* 5.3 신규 영상 필터링 속성 테스트 작성
    - **Property 4: 신규 영상 필터링**
    - 랜덤 영상 목록과 마지막 확인 시점으로 `filterNewVideos` 결과의 모든 영상이 마지막 확인 시점 이후이며, 누락 없는지 검증
    - **Validates: Requirements 5.2**

  - [x]* 5.4 채널별 영상 그룹화 속성 테스트 작성
    - **Property 5: 채널별 영상 그룹화**
    - 랜덤 영상 목록으로 그룹화 결과의 각 그룹 내 영상이 동일한 channelId를 가지며, 총 영상 수가 보존되는지 검증
    - **Validates: Requirements 6.1**

  - [x]* 5.5 SubscriptionManager 단위 테스트 작성
    - `src/services/SubscriptionManager.test.ts` 생성
    - 빈 모니터링 채널 목록, 신규 영상 없는 경우, 개별 채널 실패 격리 테스트
    - _Requirements: 5.1, 5.2, 5.4_

- [ ] 6. NoteCreator 확장
  - [x] 6.1 날짜 접두사 파일명 지원 추가
    - `src/services/NoteCreator.ts`에 `resolveFilePathWithDatePrefix(title, uploadDate)` 메서드 추가
    - `createNoteWithDatePrefix(content, uploadDate, saveFolderPath)` 메서드 추가
    - ISO 8601 날짜를 `yyyy-MM-dd` 형식으로 변환하여 파일명 접두사로 사용
    - 기존 `sanitizeFileName` 함수 재사용
    - 기존 메서드는 변경하지 않음
    - _Requirements: 6.4_

  - [x]* 6.2 날짜 접두사 파일명 형식 속성 테스트 작성
    - **Property 7: 날짜 접두사 파일명 형식**
    - 랜덤 영상 제목과 ISO 8601 날짜로 `resolveFilePathWithDatePrefix` 결과가 `yyyy-MM-dd_` 접두사로 시작하고 특수 문자를 포함하지 않는지 검증
    - **Validates: Requirements 6.4**

  - [x]* 6.3 NoteCreator 확장 단위 테스트 작성
    - 기존 `src/services/NoteCreator.test.ts`에 날짜 접두사 관련 테스트 케이스 추가
    - _Requirements: 6.4_

- [x] 7. 체크포인트 - 서비스 레이어 검증
  - 모든 테스트가 통과하는지 확인하고, 질문이 있으면 사용자에게 문의한다.

- [ ] 8. SettingsTab 확장
  - [x] 8.1 구독 피드 설정 섹션 추가
    - `src/settings/SettingsTab.ts`에 YouTube Data API Key 입력 필드(password 타입) 추가
    - "구독 목록 가져오기" 버튼 추가 (API Key 입력 시에만 표시)
    - 구독 채널 목록을 체크박스와 함께 표시하는 UI 구현
    - 채널 체크박스 토글 시 `monitoredChannels` 즉시 저장
    - 구독 영상 요약 전용 저장 폴더 경로 입력 필드 추가
    - API Key 비어있을 때 구독 관련 섹션 비활성화
    - `YouTubeSummarizerPluginInterface`에 구독 관련 메서드 추가
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.2, 3.1, 3.3, 4.1, 4.2_

  - [x]* 8.2 채널 토글 반영 속성 테스트 작성
    - **Property 3: 채널 토글 반영**
    - 랜덤 채널 목록과 토글 대상 채널로 `monitoredChannels` 배열에 해당 채널이 정확히 포함/제거되고 다른 채널은 변경되지 않는지 검증
    - **Validates: Requirements 3.1**

  - [x]* 8.3 SettingsTab 확장 단위 테스트 작성
    - 기존 `src/settings/SettingsTab.test.ts`에 구독 설정 섹션 관련 테스트 추가
    - API Key 비어있을 때 섹션 비활성화, 구독 목록 가져오기 버튼 표시 조건 테스트
    - _Requirements: 1.1, 1.3, 1.4, 2.4, 2.5_

- [ ] 9. FeedView 구현
  - [x] 9.1 FeedView 컴포넌트 구현
    - `src/views/FeedView.ts` 생성
    - 신규 영상 목록을 채널별로 그룹화하여 렌더링
    - 각 영상 항목에 영상 제목, 채널 이름, 업로드 날짜, "요약하기" 버튼 표시
    - 새로고침 버튼을 상단에 표시
    - 요약 진행 중 버튼 비활성화 및 진행 상태 표시
    - 요약 완료 시 상태를 "요약 완료"로 변경
    - 모니터링 대상 채널 없을 때 안내 메시지 표시
    - 빈 피드 상태 메시지 표시
    - 개별 영상 요약 실패 시 해당 영상만 오류 상태로 표시
    - _Requirements: 5.4, 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7_

  - [x]* 9.2 영상 항목 렌더링 정보 포함 속성 테스트 작성
    - **Property 6: 영상 항목 렌더링 정보 포함**
    - 랜덤 `VideoItem` 객체로 렌더링 결과에 영상 제목, 채널 이름, 업로드 날짜 텍스트가 모두 포함되는지 검증
    - **Validates: Requirements 6.2**

  - [x]* 9.3 FeedView 단위 테스트 작성
    - `src/views/FeedView.test.ts` 생성
    - 빈 피드 상태 메시지, 요약 진행 중 버튼 비활성화, 요약 완료 상태 전환, 개별 오류 격리 테스트
    - _Requirements: 5.4, 6.5, 6.6, 6.7_

- [ ] 10. SidebarView 탭 전환 구현
  - [x] 10.1 SidebarView에 탭 전환 UI 추가
    - `src/views/SidebarView.ts`에 "URL 요약" 탭과 "구독 피드" 탭 전환 UI 추가
    - `activeTab` 상태 관리 (`"url"` | `"feed"`)
    - 탭 클릭 시 해당 콘텐츠로 전환
    - 마지막 선택 탭 상태를 메모리에서 유지하여 뷰 재오픈 시 복원
    - 기존 URL 요약 UI를 `renderUrlTab` 메서드로 분리
    - 구독 피드 탭은 `FeedView`에 위임
    - `setDependencies`에 구독 관련 의존성(SubscriptionManager, 설정) 추가
    - _Requirements: 7.1, 7.2, 7.3_

  - [x]* 10.2 SidebarView 탭 전환 단위 테스트 작성
    - 기존 `src/views/SidebarView.test.ts`에 탭 전환 동작, 마지막 탭 상태 복원 테스트 추가
    - _Requirements: 7.1, 7.2, 7.3_

- [x] 11. 체크포인트 - UI 레이어 검증
  - 모든 테스트가 통과하는지 확인하고, 질문이 있으면 사용자에게 문의한다.

- [ ] 12. 플러그인 진입점 통합
  - [x] 12.1 main.ts에 구독 피드 의존성 연결
    - `src/main.ts`에서 `YouTubeDataApiClient`, `SubscriptionManager` 인스턴스 생성
    - `SidebarView`에 구독 관련 의존성 주입 (SubscriptionManager, summarizerServiceFactory)
    - `SettingsTab`에 구독 목록 조회를 위한 API 클라이언트 접근 제공
    - `loadSettings`에서 구독 관련 신규 필드 기본값 병합 처리
    - _Requirements: 1.2, 5.1, 9.1_

  - [x]* 12.2 main.ts 통합 단위 테스트 작성
    - 기존 `src/main.test.ts`에 구독 관련 의존성 주입 및 설정 로드 테스트 추가
    - _Requirements: 1.2, 9.1_

- [ ] 13. 모바일 호환성 및 반응형 스타일
  - [x] 13.1 반응형 CSS 스타일 추가
    - `styles.css`에 구독 피드 관련 스타일 추가
    - 탭 전환 UI 스타일
    - 채널별 영상 목록 레이아웃
    - 모바일 화면 크기 대응 반응형 스타일
    - 요약 상태별(idle, summarizing, completed, error) 시각적 구분
    - _Requirements: 9.2_

- [x] 14. 최종 체크포인트 - 전체 통합 검증
  - 모든 테스트가 통과하는지 확인하고, 질문이 있으면 사용자에게 문의한다.

## 참고 사항

- `*` 표시된 태스크는 선택 사항이며 빠른 MVP를 위해 건너뛸 수 있다
- 각 태스크는 특정 요구사항을 참조하여 추적 가능하다
- 체크포인트에서 점진적으로 검증하여 안정성을 확보한다
- 속성 기반 테스트(PBT)는 보편적 정확성 속성을 검증하고, 단위 테스트는 특정 예제와 에지 케이스를 검증한다
- 기존 코드(SummarizerService, YouTubeSummaryApiClient, YouTubeUrlValidator)는 변경하지 않는다
