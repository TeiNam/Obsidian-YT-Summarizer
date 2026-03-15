# 요구사항 문서

## 소개

현재 모든 구독 채널의 요약 노트가 하나의 공통 폴더(`subscriptionSaveFolderPath`)에 저장된다. 이 기능은 채널별로 개별 저장 폴더를 설정할 수 있도록 확장하여, 사용자가 채널마다 다른 폴더에 요약 노트를 정리할 수 있게 한다. 기존 공통 저장 폴더는 채널별 폴더가 설정되지 않은 경우의 기본값(fallback)으로 유지한다.

## 용어 정의

- **Plugin**: Obsidian YouTube Summarizer 플러그인 전체 시스템
- **Settings_Tab**: 플러그인 설정 UI를 제공하는 옵시디언 설정 탭 컴포넌트
- **Monitored_Channel**: 사용자가 모니터링 대상으로 선택한 구독 채널
- **Channel_Save_Folder**: 특정 채널의 요약 노트가 저장되는 개별 폴더 경로
- **Default_Save_Folder**: 채널별 폴더가 설정되지 않은 경우 사용되는 공통 저장 폴더 경로 (`subscriptionSaveFolderPath`)
- **Feed_View**: 사이드바에서 신규 영상 목록과 요약 버튼을 표시하는 뷰 컴포넌트
- **Note_Creator**: 마크다운 노트를 생성하고 옵시디언 Vault에 저장하는 서비스

## 요구사항

### 요구사항 1: 채널별 저장 폴더 데이터 모델 확장

**사용자 스토리:** 개발자로서, MonitoredChannel 타입에 채널별 저장 폴더 경로를 저장할 수 있어야 한다. 이를 통해 채널마다 다른 폴더에 요약 노트를 저장할 수 있다.

#### 인수 조건

1. THE Plugin SHALL MonitoredChannel 타입에 선택적(optional) 저장 폴더 경로 필드(`saveFolderPath`)를 포함한다
2. WHEN MonitoredChannel의 saveFolderPath가 설정되지 않았거나 빈 문자열이면, THE Plugin SHALL Default_Save_Folder를 해당 채널의 저장 폴더로 사용한다
3. THE Plugin SHALL 기존에 저장된 MonitoredChannel 데이터(saveFolderPath 필드가 없는 데이터)를 정상적으로 로드한다

### 요구사항 2: 채널별 저장 폴더 설정 UI

**사용자 스토리:** 사용자로서, 설정 탭에서 모니터링 대상으로 체크한 각 채널에 대해 개별 저장 폴더 경로를 입력할 수 있어야 한다. 이를 통해 채널별로 요약 노트를 분류하여 관리할 수 있다.

#### 인수 조건

1. WHEN 채널이 모니터링 대상으로 체크되면, THE Settings_Tab SHALL 해당 채널 항목 아래에 저장 폴더 경로 입력 필드를 표시한다
2. WHEN 채널이 모니터링 대상에서 해제되면, THE Settings_Tab SHALL 해당 채널의 저장 폴더 경로 입력 필드를 숨긴다
3. WHEN 사용자가 채널별 저장 폴더 경로를 입력하면, THE Settings_Tab SHALL 해당 경로를 MonitoredChannel의 saveFolderPath에 저장한다
4. THE Settings_Tab SHALL 채널별 저장 폴더 입력 필드의 placeholder로 Default_Save_Folder 경로를 표시한다
5. WHEN 설정 탭을 다시 열면, THE Settings_Tab SHALL 이전에 저장된 채널별 저장 폴더 경로를 입력 필드에 복원한다

### 요구사항 3: 채널별 저장 폴더 경로 결정 로직

**사용자 스토리:** 사용자로서, 요약 노트가 채널별로 설정한 폴더에 저장되어야 한다. 개별 폴더를 설정하지 않은 채널은 기존 공통 폴더에 저장되어야 한다.

#### 인수 조건

1. WHEN 영상 요약 노트를 생성할 때, THE Plugin SHALL 해당 영상의 채널에 설정된 Channel_Save_Folder를 저장 경로로 사용한다
2. WHEN 해당 채널의 Channel_Save_Folder가 설정되지 않았거나 빈 문자열이면, THE Plugin SHALL Default_Save_Folder를 저장 경로로 사용한다
3. THE Plugin SHALL 채널별 저장 폴더가 존재하지 않으면 자동으로 생성한다

### 요구사항 4: 다국어 지원

**사용자 스토리:** 사용자로서, 채널별 저장 폴더 관련 UI 텍스트도 설정된 언어(영어/한국어)로 표시되어야 한다.

#### 인수 조건

1. THE Plugin SHALL 채널별 저장 폴더 입력 필드의 레이블과 설명에 대해 영어(en)와 한국어(ko) 번역을 제공한다
2. WHEN 사용자가 언어 설정을 변경하면, THE Plugin SHALL 채널별 저장 폴더 관련 UI 텍스트를 선택된 언어로 즉시 갱신한다

### 요구사항 5: 하위 호환성

**사용자 스토리:** 기존 사용자로서, 플러그인 업데이트 후에도 기존 설정과 동작이 유지되어야 한다. 이를 통해 업데이트로 인한 데이터 손실이나 동작 변경이 발생하지 않는다.

#### 인수 조건

1. THE Plugin SHALL 기존 subscriptionSaveFolderPath 설정을 변경 없이 유지한다
2. THE Plugin SHALL saveFolderPath 필드가 없는 기존 MonitoredChannel 데이터를 로드할 때 오류 없이 처리한다
3. WHEN 모든 채널에 개별 저장 폴더가 설정되지 않은 경우, THE Plugin SHALL 기존과 동일하게 Default_Save_Folder에 모든 요약 노트를 저장한다
4. THE Plugin SHALL 기존 185개 테스트를 모두 통과한다
