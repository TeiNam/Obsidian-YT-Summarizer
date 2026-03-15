# 요구사항 문서

## 소개

YouTube Data API를 활용하여 사용자의 구독 채널 목록을 가져오고, 선택한 채널의 신규 영상을 모니터링하여 자동/수동으로 요약 노트를 생성하는 기능이다. 기존 YouTube Summarizer 플러그인의 사이드바 뷰와 설정 탭을 확장하여, 구독 피드 관리 및 영상별 요약 버튼을 제공한다.

## 용어 정의

- **Plugin**: Obsidian YouTube Summarizer 플러그인 전체 시스템
- **Settings_Tab**: 플러그인 설정 UI를 제공하는 옵시디언 설정 탭 컴포넌트
- **YouTube_Data_API_Client**: YouTube Data API v3와 HTTP 통신을 담당하는 클라이언트 모듈
- **Subscription_Manager**: 구독 채널 목록 조회, 모니터링 대상 선택, 신규 영상 감지를 관리하는 서비스
- **Feed_View**: 사이드바에서 신규 영상 목록과 요약 버튼을 표시하는 뷰 컴포넌트
- **YouTube_Data_API_Key**: YouTube Data API v3 인증을 위한 사용자 개인 API 키
- **Monitored_Channel**: 사용자가 체크박스로 선택하여 신규 영상 모니터링 대상으로 지정한 구독 채널
- **Summary_Folder**: 요약 노트가 저장되는 옵시디언 볼트 내 폴더 경로

## 요구사항

### 요구사항 1: YouTube Data API Key 설정

**사용자 스토리:** 사용자로서, 설정 탭에서 YouTube Data API Key를 입력하고 저장할 수 있어야 한다. 이를 통해 플러그인이 YouTube Data API에 접근할 수 있다.

#### 인수 조건

1. THE Settings_Tab SHALL YouTube Data API Key 입력 필드를 password 타입으로 표시한다
2. WHEN 사용자가 YouTube Data API Key를 입력하면, THE Settings_Tab SHALL 해당 값을 플러그인 설정에 저장한다
3. WHEN 사용자가 YouTube Data API Key를 입력하면, THE Settings_Tab SHALL "구독 목록 가져오기" 버튼을 표시한다
4. IF YouTube Data API Key가 비어 있으면, THEN THE Settings_Tab SHALL 구독 관련 설정 섹션을 비활성화 상태로 표시한다

### 요구사항 2: 구독 채널 목록 조회

**사용자 스토리:** 사용자로서, YouTube Data API를 통해 내 구독 채널 목록을 가져올 수 있어야 한다. 이를 통해 모니터링할 채널을 선택할 수 있다.

#### 인수 조건

1. WHEN 사용자가 "구독 목록 가져오기" 버튼을 클릭하면, THE YouTube_Data_API_Client SHALL YouTube Data API v3의 subscriptions.list 엔드포인트를 호출하여 구독 채널 목록을 조회한다
2. WHEN 구독 채널 목록 조회가 성공하면, THE Settings_Tab SHALL 각 채널의 이름과 썸네일을 체크박스와 함께 목록으로 표시한다
3. WHEN 구독 채널 수가 50개를 초과하면, THE YouTube_Data_API_Client SHALL pageToken을 사용하여 모든 구독 채널을 페이지네이션으로 조회한다
4. IF YouTube Data API Key가 유효하지 않으면, THEN THE Settings_Tab SHALL "API Key가 유효하지 않습니다" 오류 메시지를 표시한다
5. IF 네트워크 오류가 발생하면, THEN THE Settings_Tab SHALL "네트워크 연결을 확인해주세요" 오류 메시지를 표시한다

### 요구사항 3: 모니터링 채널 선택 및 저장

**사용자 스토리:** 사용자로서, 구독 채널 목록에서 체크박스로 모니터링할 채널을 선택하고 저장할 수 있어야 한다. 이를 통해 관심 있는 채널의 신규 영상만 추적할 수 있다.

#### 인수 조건

1. WHEN 사용자가 채널 체크박스를 토글하면, THE Settings_Tab SHALL 해당 채널의 모니터링 상태를 플러그인 설정에 즉시 저장한다
2. THE Plugin SHALL 모니터링 대상 채널 목록을 채널 ID, 채널 이름과 함께 설정 데이터에 영속적으로 저장한다
3. WHEN 설정 탭을 다시 열면, THE Settings_Tab SHALL 이전에 저장된 모니터링 채널의 체크박스를 선택된 상태로 복원한다

### 요구사항 4: 요약 저장 폴더 설정

**사용자 스토리:** 사용자로서, 구독 영상 요약 노트가 저장될 폴더를 별도로 지정할 수 있어야 한다. 이를 통해 기존 요약 노트와 구독 피드 요약을 분리 관리할 수 있다.

#### 인수 조건

1. THE Settings_Tab SHALL 구독 영상 요약 전용 저장 폴더 경로 입력 필드를 표시한다
2. WHEN 사용자가 폴더 경로를 입력하면, THE Settings_Tab SHALL 해당 경로를 플러그인 설정에 저장한다
3. THE Plugin SHALL 구독 영상 요약 저장 폴더의 기본값을 "YouTube Subscriptions"로 설정한다

### 요구사항 5: 신규 영상 감지

**사용자 스토리:** 사용자로서, 모니터링 대상 채널에 새로운 영상이 올라오면 이를 감지하여 목록에서 확인할 수 있어야 한다.

#### 인수 조건

1. WHEN 사용자가 Feed_View를 열거나 새로고침 버튼을 클릭하면, THE Subscription_Manager SHALL 모니터링 대상 채널의 최근 영상을 YouTube Data API v3의 search.list 또는 playlistItems.list 엔드포인트를 통해 조회한다
2. THE Subscription_Manager SHALL 각 채널별로 마지막 확인 시점 이후에 업로드된 영상만 신규 영상으로 판별한다
3. THE Plugin SHALL 각 채널별 마지막 확인 시점을 설정 데이터에 저장한다
4. IF 모니터링 대상 채널이 없으면, THEN THE Feed_View SHALL "모니터링할 채널을 설정에서 선택해주세요" 안내 메시지를 표시한다

### 요구사항 6: 신규 영상 목록 사이드바 표시

**사용자 스토리:** 사용자로서, 사이드바에서 신규 영상 목록을 확인하고 각 영상을 개별적으로 요약할 수 있어야 한다.

#### 인수 조건

1. THE Feed_View SHALL 신규 영상 목록을 채널별로 그룹화하여 사이드바에 표시한다
2. THE Feed_View SHALL 각 영상 항목에 영상 제목, 채널 이름, 업로드 날짜를 표시한다
3. THE Feed_View SHALL 각 영상 항목의 오른쪽에 "요약하기" 버튼을 표시한다
4. WHEN 사용자가 "요약하기" 버튼을 클릭하면, THE Plugin SHALL 해당 영상의 URL을 기존 SummarizerService에 전달하여 요약을 실행하고, 결과를 구독 영상 요약 폴더에 `yyyy-MM-dd_영상제목.md` 형식(업로드 날짜 접두사)의 파일명으로 노트를 저장한다
5. WHILE 요약이 진행 중이면, THE Feed_View SHALL 해당 영상의 "요약하기" 버튼을 비활성화하고 진행 상태를 표시한다
6. WHEN 요약이 완료되면, THE Feed_View SHALL 해당 영상의 상태를 "요약 완료"로 변경하여 표시한다
7. THE Feed_View SHALL 새로고침 버튼을 상단에 표시하여 수동으로 신규 영상을 다시 조회할 수 있도록 한다

### 요구사항 7: 사이드바 탭 전환

**사용자 스토리:** 사용자로서, 기존 URL 입력 요약 기능과 구독 피드 기능을 사이드바 내에서 전환할 수 있어야 한다.

#### 인수 조건

1. THE SidebarView SHALL 기존 URL 요약 탭과 구독 피드 탭을 전환할 수 있는 탭 UI를 상단에 표시한다
2. WHEN 사용자가 탭을 클릭하면, THE SidebarView SHALL 해당 탭의 콘텐츠로 전환하여 표시한다
3. THE SidebarView SHALL 마지막으로 선택한 탭 상태를 유지하여 뷰를 다시 열 때 복원한다

### 요구사항 8: 다국어 지원

**사용자 스토리:** 사용자로서, 구독 피드 관련 UI 텍스트도 설정된 언어(영어/한국어)로 표시되어야 한다.

#### 인수 조건

1. THE Plugin SHALL 구독 피드 관련 모든 UI 텍스트에 대해 영어(en)와 한국어(ko) 번역을 제공한다
2. WHEN 사용자가 언어 설정을 변경하면, THE Plugin SHALL 구독 피드 관련 UI 텍스트를 선택된 언어로 즉시 갱신한다

### 요구사항 9: 모바일 호환성

**사용자 스토리:** 사용자로서, 모바일 환경에서도 구독 피드 기능을 사용할 수 있어야 한다.

#### 인수 조건

1. THE Plugin SHALL 데스크톱 전용 API(예: Node.js fs, child_process)를 사용하지 않고 옵시디언 모바일 호환 API만 사용한다
2. THE Feed_View SHALL 모바일 화면 크기에서도 영상 목록과 요약 버튼이 정상적으로 표시되고 조작 가능하도록 반응형 레이아웃을 적용한다
