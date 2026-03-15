# 구현 태스크: 최신 영상 피드 (latest-videos-feed)

## 태스크 목록

- [x] 1. PluginSettings에서 lastCheckedAt 제거 및 videosPerChannel 추가
  - [x] 1.1 `src/models/types.ts`에서 `PluginSettings` 인터페이스의 `lastCheckedAt` 필드를 제거하고 `videosPerChannel: number` 필드를 추가한다
  - [x] 1.2 `DEFAULT_SETTINGS`에서 `lastCheckedAt: {}` 를 제거하고 `videosPerChannel: 3`을 추가한다
- [x] 2. SubscriptionManager에서 lastCheckedAt 관련 코드 제거 및 fetchNewVideos 수정
  - [x] 2.1 `src/services/SubscriptionManager.ts`에서 `filterNewVideos()` 메서드를 삭제한다
  - [x] 2.2 `src/services/SubscriptionManager.ts`에서 `updateLastCheckedAt()` 메서드를 삭제한다
  - [x] 2.3 `fetchNewVideos()`에서 `lastCheckedAt` 기반 필터링 로직을 제거하고, `this.settings.videosPerChannel`을 `fetchRecentVideos()`의 `maxResults` 인자로 전달하도록 수정한다
- [x] 3. FeedView에서 updateLastCheckedAt 호출 제거
  - [x] 3.1 `src/views/FeedView.ts`의 `summarizeVideo()` 메서드에서 `updateLastCheckedAt()` 호출을 제거한다
- [x] 4. i18n에 videosPerChannel 번역 키 추가
  - [x] 4.1 `src/i18n/index.ts`의 `Translations` 인터페이스에 `videosPerChannelLabel`, `videosPerChannelDesc` 키를 추가하고, `en`과 `ko` 번역을 작성한다
- [x] 5. SettingsTab에 채널당 영상 개수 설정 UI 추가
  - [x] 5.1 `src/settings/SettingsTab.ts`의 구독 피드 섹션에 videosPerChannel 슬라이더(범위 1~10)를 추가한다. 값 변경 시 `Math.min(10, Math.max(1, Math.round(value)))`로 클램핑하여 저장한다
- [x] 6. 기존 테스트 수정
  - [x] 6.1 `src/services/SubscriptionManager.test.ts`에서 `filterNewVideos`, `updateLastCheckedAt` 관련 테스트를 제거하고, `fetchNewVideos` 테스트에서 `lastCheckedAt` 의존성을 제거한다. videosPerChannel 기반 동작을 검증하는 테스트를 추가한다
  - [x] 6.2 `src/views/FeedView.test.ts`에서 `updateLastCheckedAt` 모킹을 제거한다
  - [x] 6.3 `src/main.test.ts`에서 `lastCheckedAt` 관련 테스트를 수정한다
  - [x] 6.4 `src/settings/SettingsTab.test.ts`에 videosPerChannel 설정 변경 테스트를 추가한다
- [x] 7. 속성 기반 테스트 작성
  - [x] 7.1 `src/services/SubscriptionManager.property.test.ts`에서 기존 Property 4 (신규 영상 필터링) 테스트를 제거한다
  - [x] 7.2 Property 1 (API 응답 무필터 반환) 속성 테스트를 작성한다: Feature: latest-videos-feed, Property 1: API 응답 무필터 반환
  - [x] 7.3 Property 2 (maxResults에 videosPerChannel 전달) 속성 테스트를 작성한다: Feature: latest-videos-feed, Property 2: maxResults에 videosPerChannel 전달
  - [x] 7.4 Property 3 (videosPerChannel 범위 제한) 속성 테스트를 `src/settings/SettingsTab.property.test.ts`에 작성한다: Feature: latest-videos-feed, Property 3: videosPerChannel 범위 제한
  - [x] 7.5 Property 4 (개별 채널 실패 시 격리) 속성 테스트를 작성한다: Feature: latest-videos-feed, Property 4: 개별 채널 실패 시 격리
