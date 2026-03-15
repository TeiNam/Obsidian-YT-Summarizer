# 구현 계획: 채널별 저장 폴더

## 개요

기존 Obsidian YouTube Summarizer 플러그인에 채널별 저장 폴더 설정 기능을 추가한다. 타입 확장 → i18n → 순수 함수 → UI → 통합 순서로 점진적으로 구현하며, 각 단계에서 기존 185개 테스트가 깨지지 않도록 한다.

## 태스크

- [x] 1. 타입 확장 및 순수 함수 구현
  - [x] 1.1 MonitoredChannel 타입에 saveFolderPath 필드 추가
    - `src/models/types.ts`의 `MonitoredChannel` 인터페이스에 `saveFolderPath?: string` 필드 추가
    - 기존 필드는 변경하지 않음
    - _Requirements: 1.1_

  - [x] 1.2 채널별 저장 폴더 결정 순수 함수 구현
    - `src/views/FeedView.ts`에 `resolveChannelSaveFolderPath(monitoredChannels, channelId, defaultFolderPath)` 순수 함수 export
    - 채널의 `saveFolderPath`가 유효한 비공백 문자열이면 해당 경로 반환
    - `undefined`, 빈 문자열, 공백만인 경우 `defaultFolderPath` 반환
    - 채널 ID가 목록에 없으면 `defaultFolderPath` 반환
    - _Requirements: 1.2, 3.1, 3.2_

  - [x] 1.3 채널별 저장 폴더 결정 속성 테스트 작성
    - **Property 1: 채널별 저장 폴더 결정 로직**
    - `src/views/FeedView.property.test.ts`에 추가
    - fast-check으로 랜덤 MonitoredChannel 목록(saveFolderPath 유/무/빈 문자열/공백), 랜덤 channelId, 랜덤 기본 폴더 경로로 `resolveChannelSaveFolderPath` 결과 검증
    - **Validates: Requirements 1.2, 3.1, 3.2, 5.3**

  - [x] 1.4 하위 호환성 속성 테스트 작성
    - **Property 2: 하위 호환성 - 기존 데이터 로드**
    - `src/models/types.property.test.ts`에 추가
    - saveFolderPath 필드가 없는 랜덤 MonitoredChannel 객체로 `resolveChannelSaveFolderPath`에 전달 시 오류 없이 기본 폴더 경로 반환 검증
    - **Validates: Requirements 1.1, 1.3, 5.2**

- [x] 2. i18n 확장
  - [x] 2.1 채널별 저장 폴더 관련 i18n 키 추가
    - `src/i18n/index.ts`의 `Translations` 인터페이스에 `channelSaveFolderLabel`, `channelSaveFolderDesc` 키 추가
    - `en`, `ko` 번역 객체에 모든 신규 키의 번역 값 추가
    - _Requirements: 4.1_

  - [x] 2.2 번역 키 완전성 속성 테스트 작성
    - **Property 4: 번역 키 완전성**
    - `src/i18n/i18n.property.test.ts`에 추가
    - 채널별 저장 폴더 관련 i18n 키에 대해 en/ko 번역 객체 모두에 비어있지 않은 문자열 값이 존재하는지 검증
    - **Validates: Requirements 4.1**

- [x] 3. 체크포인트 - 타입, 순수 함수, i18n 검증
  - 기존 185개 테스트 + 신규 속성 테스트가 모두 통과하는지 `npx vitest run`으로 확인

- [x] 4. SettingsTab 확장
  - [x] 4.1 renderChannelList에 채널별 저장 폴더 입력 필드 추가
    - `src/settings/SettingsTab.ts`의 `renderChannelList()` 메서드에서 모니터링 중인 채널에 저장 폴더 텍스트 입력 필드 추가
    - placeholder로 `subscriptionSaveFolderPath` 표시
    - 입력값 변경 시 해당 채널의 `saveFolderPath`를 업데이트하고 저장
    - 모니터링 해제된 채널에는 입력 필드 미표시
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [x] 4.2 toggleChannel에서 기존 saveFolderPath 보존
    - `src/settings/SettingsTab.ts`의 `toggleChannel()` 메서드에서 채널 재활성화 시 기존 saveFolderPath 보존 로직 추가
    - _Requirements: 2.5_

  - [x] 4.3 SettingsTab 확장 단위 테스트 작성
    - `src/settings/SettingsTab.test.ts`에 채널별 저장 폴더 관련 테스트 추가
    - 모니터링 중인 채널에 입력 필드 표시, placeholder 값, 입력값 저장, 채널 해제 시 입력 필드 숨김 테스트
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [x] 4.4 채널 설정 라운드트립 속성 테스트 작성
    - **Property 3: 채널 설정 라운드트립**
    - `src/settings/SettingsTab.property.test.ts`에 추가
    - 랜덤 saveFolderPath가 설정된 MonitoredChannel 배열의 Object.assign 라운드트립 검증
    - **Validates: Requirements 2.5**

- [x] 5. 체크포인트 - SettingsTab 검증
  - 기존 185개 테스트 + 신규 테스트가 모두 통과하는지 `npx vitest run`으로 확인

- [x] 6. FeedView 확장
  - [x] 6.1 summarizeVideo에서 채널별 저장 폴더 사용
    - `src/views/FeedView.ts`의 `summarizeVideo()` 메서드에서 `resolveChannelSaveFolderPath`를 사용하여 채널별 폴더 결정
    - 결정된 폴더 경로를 `NoteCreator` 생성 및 `createNoteWithDatePrefix` 호출에 전달
    - _Requirements: 3.1, 3.2, 3.3_

  - [x] 6.2 FeedView 확장 단위 테스트 작성
    - `src/views/FeedView.test.ts`에 채널별 저장 폴더 관련 테스트 추가
    - 채널별 폴더 설정 시 해당 폴더 사용, 미설정 시 공통 폴더 fallback 테스트
    - _Requirements: 3.1, 3.2_

- [x] 7. 최종 체크포인트 - 전체 통합 검증
  - 기존 185개 테스트 + 모든 신규 테스트가 통과하는지 `npx vitest run`으로 확인
  - 빌드가 성공하는지 `npm run build`로 확인

## 참고 사항

- `*` 표시된 태스크는 테스트 태스크이며, 해당 구현 태스크와 함께 실행한다
- 각 태스크는 특정 요구사항을 참조하여 추적 가능하다
- 체크포인트에서 점진적으로 검증하여 안정성을 확보한다
- `NoteCreator.ts`와 `main.ts`는 변경하지 않는다
- 기존 코드의 변경을 최소화하여 하위 호환성을 유지한다
