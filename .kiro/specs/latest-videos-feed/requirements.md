# 요구사항 문서

## 소개

구독 피드의 영상 표시 방식을 변경하는 기능이다. 기존에는 `lastCheckedAt` 시점 이후에 업로드된 영상만 필터링하여 보여주었으나, 이 방식을 제거하고 각 구독 채널의 가장 최신 영상 3개씩을 항상 보여주는 방식으로 전환한다. 이를 통해 사용자는 피드를 열 때마다 각 채널의 최근 콘텐츠를 일관되게 확인할 수 있다.

## 용어 정의

- **Feed_View**: 사이드바에서 구독 채널의 영상 목록을 표시하는 뷰 컴포넌트
- **Subscription_Manager**: 모니터링 대상 채널의 영상 조회 및 관리를 담당하는 서비스
- **YouTube_Data_Api_Client**: YouTube Data API v3와 HTTP 통신을 수행하는 클라이언트
- **Plugin_Settings**: 플러그인의 전역 설정을 저장하는 인터페이스
- **Monitored_Channel**: 사용자가 모니터링 대상으로 등록한 YouTube 채널
- **Videos_Per_Channel**: 채널당 표시할 최신 영상 개수 (기본값: 3)
- **Channel_Videos**: 채널별로 그룹화된 영상 목록 데이터 구조

## 요구사항

### 요구사항 1: 채널별 최신 영상 조회

**사용자 스토리:** 사용자로서, 구독 채널의 가장 최신 영상 3개를 항상 볼 수 있기를 원한다. 그래야 피드를 열 때마다 각 채널의 최근 콘텐츠를 일관되게 확인할 수 있다.

#### 인수 조건

1. WHEN 사용자가 피드를 로드하면, THE Subscription_Manager SHALL 각 Monitored_Channel의 최신 영상을 Videos_Per_Channel 개수만큼 조회하여 반환한다
2. THE Subscription_Manager SHALL lastCheckedAt 기반 필터링 없이 조회된 영상을 그대로 반환한다
3. WHEN YouTube_Data_Api_Client가 영상을 조회할 때, THE YouTube_Data_Api_Client SHALL maxResults 파라미터를 Videos_Per_Channel 값으로 설정하여 API를 호출한다
4. THE Subscription_Manager SHALL 조회된 영상을 채널별로 그룹화하여 Channel_Videos 배열로 반환한다

### 요구사항 2: lastCheckedAt 기반 필터링 제거

**사용자 스토리:** 사용자로서, 피드를 열 때마다 항상 최신 영상을 볼 수 있기를 원한다. 이전에 확인한 시점과 무관하게 최신 콘텐츠가 표시되어야 한다.

#### 인수 조건

1. THE Subscription_Manager SHALL fetchNewVideos 메서드에서 filterNewVideos 호출을 제거한다
2. THE Subscription_Manager SHALL lastCheckedAt 값을 영상 필터링 목적으로 참조하지 않는다
3. WHEN 피드를 로드할 때, THE Subscription_Manager SHALL 모든 Monitored_Channel에 대해 동일한 개수(Videos_Per_Channel)의 최신 영상을 반환한다

### 요구사항 3: 채널당 영상 개수 설정

**사용자 스토리:** 사용자로서, 채널당 표시되는 최신 영상 개수를 설정에서 조정할 수 있기를 원한다. 그래야 원하는 만큼의 영상을 피드에서 확인할 수 있다.

#### 인수 조건

1. THE Plugin_Settings SHALL videosPerChannel 필드를 포함하며, 기본값은 3이다
2. WHEN 사용자가 설정 탭에서 채널당 영상 개수를 변경하면, THE Plugin_Settings SHALL 해당 값을 저장한다
3. THE Subscription_Manager SHALL 영상 조회 시 Plugin_Settings의 videosPerChannel 값을 maxResults로 사용한다
4. THE Plugin_Settings SHALL videosPerChannel 값을 1 이상 10 이하의 정수로 제한한다

### 요구사항 4: lastCheckedAt 관련 코드 정리

**사용자 스토리:** 개발자로서, 더 이상 사용되지 않는 lastCheckedAt 관련 코드를 정리하고 싶다. 그래야 코드베이스가 깔끔하게 유지된다.

#### 인수 조건

1. THE Subscription_Manager SHALL filterNewVideos 메서드를 제거한다
2. THE Subscription_Manager SHALL updateLastCheckedAt 메서드를 제거한다
3. THE Feed_View SHALL 요약 완료 후 updateLastCheckedAt 호출을 제거한다
4. THE Plugin_Settings SHALL lastCheckedAt 필드를 제거한다
5. WHEN 기존 설정 데이터에 lastCheckedAt 필드가 존재하면, THE Plugin_Settings SHALL 해당 필드를 무시하고 정상 동작한다

### 요구사항 5: 피드 뷰 렌더링 유지

**사용자 스토리:** 사용자로서, 변경된 피드에서도 기존과 동일한 방식으로 채널별 영상 목록을 확인하고 요약 기능을 사용할 수 있기를 원한다.

#### 인수 조건

1. THE Feed_View SHALL 채널별로 그룹화된 최신 영상 목록을 기존과 동일한 UI 구조로 렌더링한다
2. WHEN 영상 목록이 비어 있으면, THE Feed_View SHALL 빈 피드 안내 메시지를 표시한다
3. THE Feed_View SHALL 각 영상 항목에 대해 요약하기 버튼과 요약 상태 표시를 유지한다
4. WHEN 개별 채널 조회가 실패하면, THE Subscription_Manager SHALL 해당 채널을 건너뛰고 나머지 채널의 영상을 계속 반환한다
