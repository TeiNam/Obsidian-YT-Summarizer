// ============================================================
// 다국어(i18n) 지원 모듈
// 영어(en)와 한국어(ko)를 지원하며, 설정에서 언어를 변경할 수 있다
// API 마이그레이션 후: AWS 관련 키 제거, API Key/진행 단계/오류 키 추가
// ============================================================

/** 지원 언어 타입 */
export type Language = "en" | "ko";

/** 번역 키 인터페이스 */
export interface Translations {
  // 설정 탭 헤더
  settingsHeader: string;
  settingsDescription: string;

  // 언어 설정
  languageLabel: string;
  languageDesc: string;

  // API Key 설정
  apiKeyLabel: string;
  apiKeyDesc: string;

  // 저장 폴더
  saveFolderLabel: string;
  saveFolderDesc: string;

  // 사이드바 뷰
  sidebarTitle: string;
  urlPlaceholder: string;
  summarizeButton: string;
  summarizingButton: string;

  // 진행 단계
  stageValidating: string;
  stagePending: string;
  stageExtracting: string;
  stageTranslating: string;
  stageSummarizing: string;
  stageCreatingNote: string;
  stageComplete: string;

  // 오류/알림 메시지
  errorInvalidUrl: string;
  errorNotInitialized: string;
  errorSummarizeFailed: string;
  errorInvalidApiKey: string;
  errorApiConnection: string;
  errorApiTimeout: string;
  errorMissingApiKey: string;
  noticeSummaryComplete: string;

  // 구독 피드 설정
  youtubeDataApiKeyLabel: string;
  youtubeDataApiKeyDesc: string;
  addChannelLabel: string;
  addChannelDesc: string;
  addChannelButton: string;
  addingChannel: string;
  removeChannelButton: string;
  subscriptionChannelsLabel: string;
  subscriptionSaveFolderLabel: string;
  subscriptionSaveFolderDesc: string;
  subscriptionSectionHeader: string;
  errorChannelNotFound: string;

  // 사이드바 탭
  tabUrlSummary: string;
  tabSubscriptionFeed: string;

  // 피드 뷰
  feedRefreshButton: string;
  feedLoading: string;
  feedEmpty: string;
  feedNoChannels: string;
  feedSummarizeButton: string;
  feedSummarizing: string;
  feedSummarized: string;
  feedSummaryError: string;

  // 구독 피드 오류 메시지
  errorInvalidYoutubeDataApiKey: string;
  errorNetworkConnection: string;
  errorFetchSubscriptions: string;

  // 채널별 저장 폴더
  channelSaveFolderLabel: string;
  channelSaveFolderDesc: string;
  channelSaveFolderDefault: string;

  // 채널당 영상 개수 설정
  videosPerChannelLabel: string;
  videosPerChannelDesc: string;

  // 스크립트 직접 입력
  scriptLabel: string;
  scriptPlaceholder: string;
  scriptHint: string;
}

/** 영어 번역 */
const en: Translations = {
  settingsHeader: "YouTube Summarizer",
  settingsDescription: "Summarize YouTube videos with AI and save as Obsidian notes. Paste a YouTube link, and the plugin generates a structured markdown note via YouTube Summary API.",

  languageLabel: "Language",
  languageDesc: "Select the display language for the plugin UI",

  apiKeyLabel: "Summary Server API Key",
  apiKeyDesc: "API Key for YouTube Summary API server authentication",

  saveFolderLabel: "Save Folder",
  saveFolderDesc: "Folder path where summary notes will be saved",

  sidebarTitle: "YouTube Summarizer",
  urlPlaceholder: "Paste a YouTube link here",
  summarizeButton: "Summarize",
  summarizingButton: "Summarizing...",

  stageValidating: "Validating URL...",
  stagePending: "Waiting...",
  stageExtracting: "Extracting subtitles...",
  stageTranslating: "Translating...",
  stageSummarizing: "Generating summary...",
  stageCreatingNote: "Creating note...",
  stageComplete: "Summary complete",

  errorInvalidUrl: "Please enter a valid YouTube link",
  errorNotInitialized: "Plugin is not properly initialized.",
  errorSummarizeFailed: "Failed to generate summary. Please try again",
  errorInvalidApiKey: "API Key is invalid. Please check your settings",
  errorApiConnection: "Cannot connect to API server. Please check your network",
  errorApiTimeout: "Summary processing timed out. Please try again",
  errorMissingApiKey: "Please enter your API Key in settings",
  noticeSummaryComplete: "Summary complete",

  // 구독 피드 설정
  youtubeDataApiKeyLabel: "YouTube Data API Key",
  youtubeDataApiKeyDesc: "Google Cloud Console → Create Project → Enable YouTube Data API v3 → Credentials → Create API Key",
  addChannelLabel: "Add Channel",
  addChannelDesc: "Enter a YouTube channel handle (e.g. @sosumonkey) or channel ID (e.g. UCxxxx)",
  addChannelButton: "Add",
  addingChannel: "Adding...",
  removeChannelButton: "Remove",
  subscriptionChannelsLabel: "Monitored Channels",
  subscriptionSaveFolderLabel: "Subscription Save Folder",
  subscriptionSaveFolderDesc: "Folder path where subscription summary notes will be saved",
  subscriptionSectionHeader: "YouTube Subscription Feed",
  errorChannelNotFound: "Channel not found. Please check the channel handle or ID",

  // 사이드바 탭
  tabUrlSummary: "URL Summary",
  tabSubscriptionFeed: "Subscription Feed",

  // 피드 뷰
  feedRefreshButton: "Refresh",
  feedLoading: "Loading feed...",
  feedEmpty: "No new videos found",
  feedNoChannels: "Please select channels to monitor in settings",
  feedSummarizeButton: "Summarize",
  feedSummarizing: "Summarizing...",
  feedSummarized: "Summary complete",
  feedSummaryError: "Summary failed",

  // 구독 피드 오류 메시지
  errorInvalidYoutubeDataApiKey: "YouTube Data API Key is invalid. Please check your settings",
  errorNetworkConnection: "Network connection error. Please check your network",
  errorFetchSubscriptions: "Failed to fetch subscriptions. Please try again",

  // 채널별 저장 폴더
  channelSaveFolderLabel: "Channel Save Folder",
  channelSaveFolderDesc: "Select a folder for this channel's summary notes (leave default to use common folder)",
  channelSaveFolderDefault: "Use default folder",

  // 채널당 영상 개수 설정
  videosPerChannelLabel: "Videos per channel",
  videosPerChannelDesc: "Number of latest videos to show per channel (1-10)",

  // 스크립트 직접 입력
  scriptLabel: "Script / Transcript",
  scriptPlaceholder: "Paste the video script or transcript here (optional)",
  scriptHint: "If provided, this text will be used for summarization instead of auto-extraction.",
};

/** 한국어 번역 */
const ko: Translations = {
  settingsHeader: "YouTube Summarizer",
  settingsDescription: "유튜브 영상을 AI로 요약하여 옵시디언 노트로 저장합니다. 유튜브 링크를 붙여넣으면 YouTube Summary API를 통해 구조화된 마크다운 노트를 만들어줍니다.",

  languageLabel: "언어 (Language)",
  languageDesc: "플러그인 UI 표시 언어를 선택합니다",

  apiKeyLabel: "요약 서버 API Key",
  apiKeyDesc: "YouTube Summary API 서버 인증을 위한 API Key입니다",

  saveFolderLabel: "노트 저장 폴더",
  saveFolderDesc: "요약 노트가 저장될 폴더 경로입니다",

  sidebarTitle: "YouTube Summarizer",
  urlPlaceholder: "유튜브 링크를 입력하세요",
  summarizeButton: "요약",
  summarizingButton: "요약 중...",

  stageValidating: "URL 검증 중...",
  stagePending: "대기 중...",
  stageExtracting: "자막 추출 중...",
  stageTranslating: "번역 중...",
  stageSummarizing: "요약 생성 중...",
  stageCreatingNote: "노트 생성 중...",
  stageComplete: "요약이 완료되었습니다",

  errorInvalidUrl: "유효한 유튜브 링크를 입력해주세요",
  errorNotInitialized: "플러그인이 올바르게 초기화되지 않았습니다.",
  errorSummarizeFailed: "요약 생성에 실패했습니다. 다시 시도해주세요",
  errorInvalidApiKey: "API Key가 유효하지 않습니다. 설정을 확인해주세요",
  errorApiConnection: "API 서버에 연결할 수 없습니다. 네트워크를 확인해주세요",
  errorApiTimeout: "요약 처리 시간이 초과되었습니다. 다시 시도해주세요",
  errorMissingApiKey: "설정에서 API Key를 입력해주세요",
  noticeSummaryComplete: "요약이 완료되었습니다",

  // 구독 피드 설정
  youtubeDataApiKeyLabel: "YouTube Data API Key",
  youtubeDataApiKeyDesc: "Google Cloud Console → 프로젝트 생성 → YouTube Data API v3 사용 설정 → 사용자 인증 정보 → API 키 만들기",
  addChannelLabel: "채널 추가",
  addChannelDesc: "YouTube 채널 핸들 (예: @sosumonkey) 또는 채널 ID (예: UCxxxx)를 입력하세요",
  addChannelButton: "추가",
  addingChannel: "추가 중...",
  removeChannelButton: "삭제",
  subscriptionChannelsLabel: "모니터링 채널 목록",
  subscriptionSaveFolderLabel: "구독 영상 요약 저장 폴더",
  subscriptionSaveFolderDesc: "구독 영상 요약 노트가 저장될 폴더 경로입니다",
  subscriptionSectionHeader: "YouTube 구독 피드",
  errorChannelNotFound: "채널을 찾을 수 없습니다. 채널 핸들 또는 ID를 확인해주세요",

  // 사이드바 탭
  tabUrlSummary: "URL 요약",
  tabSubscriptionFeed: "구독 피드",

  // 피드 뷰
  feedRefreshButton: "새로고침",
  feedLoading: "피드를 불러오는 중...",
  feedEmpty: "새로운 영상이 없습니다",
  feedNoChannels: "모니터링할 채널을 설정에서 선택해주세요",
  feedSummarizeButton: "요약하기",
  feedSummarizing: "요약 중...",
  feedSummarized: "요약 완료",
  feedSummaryError: "요약 실패",

  // 구독 피드 오류 메시지
  errorInvalidYoutubeDataApiKey: "YouTube Data API Key가 유효하지 않습니다. 설정을 확인해주세요",
  errorNetworkConnection: "네트워크 연결을 확인해주세요",
  errorFetchSubscriptions: "구독 목록을 가져오는데 실패했습니다. 다시 시도해주세요",

  // 채널별 저장 폴더
  channelSaveFolderLabel: "채널별 저장 폴더",
  channelSaveFolderDesc: "이 채널의 요약 노트 저장 폴더를 선택하세요 (기본값이면 공통 폴더 사용)",
  channelSaveFolderDefault: "기본 폴더 사용",

  // 채널당 영상 개수 설정
  videosPerChannelLabel: "채널당 영상 개수",
  videosPerChannelDesc: "채널당 표시할 최신 영상 개수 (1~10)",

  // 스크립트 직접 입력
  scriptLabel: "스크립트 / 자막",
  scriptPlaceholder: "영상의 스크립트 또는 자막을 여기에 붙여넣으세요 (선택사항)",
  scriptHint: "입력하면 자동 추출 대신 이 텍스트를 사용하여 요약합니다.",
};

/** 번역 맵 */
const translations: Record<Language, Translations> = { en, ko };

/**
 * 지정된 언어의 번역 객체를 반환
 * @param lang - 언어 코드
 * @returns 번역 객체
 */
export function t(lang: Language): Translations {
  return translations[lang] ?? translations.en;
}
