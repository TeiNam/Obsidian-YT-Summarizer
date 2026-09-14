// ============================================================
// 다국어(i18n) 지원 모듈
// 영어(en)와 한국어(ko)를 지원하며, 설정에서 언어를 변경할 수 있다
// 로컬 자막 요약과 모델 설정의 안내 문구
// ============================================================

/** 지원 언어 타입 */
export type Language = "en" | "ko";

/** 시스템 언어에서 지원 UI 언어를 감지한다 (첫 실행 초기값용) */
export function detectLanguage(): Language {
  return typeof navigator !== "undefined" && navigator.language?.startsWith("ko") ? "ko" : "en";
}

/** 번역 키 인터페이스 */
export interface Translations {
  // 설정 탭 헤더
  settingsDescription: string;

  // 언어 설정
  languageLabel: string;
  languageDesc: string;
  toggleVisibilityAria: string;

  // AI 모델 설정
  summaryLanguageLabel: string;
  summaryLanguageDesc: string;
  providerLabel: string;
  providerDesc: string;
  modelLabel: string;
  modelDesc: string;
  modelListButton: string;
  modelListLoading: string;
  modelListLoaded: (count: number) => string;
  errorModelList: string;
  errorModelListProfile: string;
  bedrockAuthLabel: string;
  bedrockBearerOption: string;
  bedrockProfileOption: string;
  bedrockTokenLabel: string;
  bedrockTokenDesc: string;
  bedrockRegionLabel: string;
  bedrockRegionDesc: string;
  bedrockProfileLabel: string;
  bedrockProfileDesc: string;
  modelApiKeyLabel: string;
  modelApiKeyDesc: string;
  openaiBaseUrlLabel: string;
  openaiBaseUrlDesc: string;
  maxInputCharsLabel: string;
  maxInputCharsDesc: string;
  maxOutputTokensLabel: string;
  maxOutputTokensDesc: string;
  errorMissingModel: string;
  errorMissingProfile: string;
  errorDesktopProfile: string;
  errorProfileRuntime: string;
  errorInvalidRegion: string;
  errorInvalidBaseUrl: string;
  errorInvalidLimits: string;
  errorNoCaptions: string;
  errorCaptionAccess: string;
  errorCaptionFormat: string;
  errorCaptionIncomplete: string;
  errorCaptionsTimeout: string;
  errorModelTimeout: string;
  errorModelTruncated: string;
  errorModelEmpty: string;
  errorModelBlocked: string;
  errorSummaryFormat: string;
  errorInputTooLong: string;
  errorModelRequest: string;
  errorProfileCredentials: string;

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

  // 벌크(여러 URL) 입력
  bulkLabel: string;
  bulkPlaceholder: string;
  bulkHint: string;
  bulkButton: string;
  bulkProgress: (done: number, total: number) => string;
  bulkDone: (ok: number, fail: number) => string;

  // 채널 그룹
  channelGroupLabel: string;
  channelGroupDesc: string;
  feedUngrouped: string;

  // 피드 페이지네이션
  feedShowMore: string;
}

/** 영어 번역 */
const en: Translations = {
  settingsDescription: "Fetch YouTube captions in Obsidian and send them directly to your selected AI model. No summary server or audio transcription is used. Captions may take time to appear; you can also paste a transcript. Recommended model: Claude Sonnet.",

  languageLabel: "Language",
  languageDesc: "Select the display language for the plugin UI",
  toggleVisibilityAria: "Toggle visibility",

  summaryLanguageLabel: "Summary language",
  summaryLanguageDesc: "Language of translations and generated notes, independent of the UI language",
  providerLabel: "AI provider",
  providerDesc: "The selected provider receives the transcript for translation and summarization",
  modelLabel: "Model ID",
  modelDesc: "Enter a text model ID you can access. Claude Sonnet is recommended, e.g. claude-sonnet-4-6 (Bedrock also accepts inference profile IDs/ARNs)",
  modelListButton: "Load models",
  modelListLoading: "Loading...",
  modelListLoaded: (count) => `Loaded ${count} models. Pick one in the model ID field.`,
  errorModelList: "Could not load the model list. Check the API key, region and network.",
  errorModelListProfile: "Model listing is not supported with AWS profile authentication. Enter a model ID manually.",
  bedrockAuthLabel: "Bedrock authentication",
  bedrockBearerOption: "API key (Bearer token)",
  bedrockProfileOption: "AWS profile / SSO (desktop)",
  bedrockTokenLabel: "Bedrock Bearer token",
  bedrockTokenDesc: "Paste the Bedrock API key without the Bearer prefix. Stored in this vault's plugin data.json; masking only hides it on screen.",
  bedrockRegionLabel: "AWS region",
  bedrockRegionDesc: "Region where the selected model or inference profile is available",
  bedrockProfileLabel: "AWS profile",
  bedrockProfileDesc: "Profile from ~/.aws/config. For SSO, first run aws sso login --profile <profile> in a terminal. The plugin uses the SDK's cached credentials.",
  modelApiKeyLabel: "Model API key",
  modelApiKeyDesc: "Stored separately for each provider in this vault's plugin data.json. Only loopback OpenAI-compatible servers allow an empty key.",
  openaiBaseUrlLabel: "OpenAI-compatible base URL",
  openaiBaseUrlDesc: "Include /v1. Examples: https://api.openai.com/v1 or http://localhost:11434/v1 (Ollama). Changing the URL sends this provider's key to the new endpoint.",
  maxInputCharsLabel: "Maximum input characters",
  maxInputCharsDesc: "Maximum transcript / translated text length (1,000–1,000,000). Longer input stops with an error; it is never silently cut.",
  maxOutputTokensLabel: "Maximum output tokens per call",
  maxOutputTokensDesc: "128–128,000, within your model's output limit. Long translations are split. Increase this if a response is truncated.",
  errorMissingModel: "Enter a model ID in settings.",
  errorMissingProfile: "Enter an AWS profile name in settings.",
  errorDesktopProfile: "AWS profile / SSO authentication requires Obsidian Desktop. Use a Bearer token on mobile.",
  errorProfileRuntime: "AWS profile authentication requires an Obsidian runtime with Node.js 20 or later. Update the Obsidian desktop installer or use a Bearer token.",
  errorInvalidRegion: "Enter a valid AWS region in settings.",
  errorInvalidBaseUrl: "Enter a valid HTTPS base URL without credentials, query parameters or a fragment. HTTP is allowed only for localhost.",
  errorInvalidLimits: "Check the input character limit (1,000–1,000,000) and output token limit (128–128,000). Use whole numbers.",
  errorNoCaptions: "No usable captions are available yet. Try again after YouTube generates them, or paste a transcript. Automatic captions are not guaranteed within one day.",
  errorCaptionAccess: "YouTube could not provide this video's captions (access restriction, login or request limit). Try again later or paste a transcript.",
  errorCaptionFormat: "Could not read YouTube's caption response. Try again later or paste a transcript.",
  errorCaptionIncomplete: "The captions are too short for this video and may be incomplete. Try again later or paste the full transcript.",
  errorCaptionsTimeout: "The YouTube request timed out. Try again later or paste a transcript.",
  errorModelTimeout: "The model request timed out. No note was saved.",
  errorModelTruncated: "The model response was truncated. Increase the output token limit within the model's supported range, or use a shorter transcript. No note was saved.",
  errorModelEmpty: "The model returned no text. Check the model and output token limit.",
  errorModelBlocked: "The model could not complete the request (filter, refusal or unsupported response). No note was saved.",
  errorSummaryFormat: "The model's summary is missing the DETAILED section. Try again or select a model that follows the required format.",
  errorInputTooLong: "The transcript or translation exceeds the input character limit. Increase the limit within the model's context window or provide a shorter transcript. No text was silently cut.",
  errorModelRequest: "Model request failed. Check authentication, model ID, endpoint/region and provider quota.",
  errorProfileCredentials: "Could not load AWS profile credentials. Check the profile and run aws sso login --profile <profile> again if it uses SSO.",

  saveFolderLabel: "Save folder",
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
  errorMissingApiKey: "Enter the selected AI provider's API key or choose an AWS profile in settings.",
  noticeSummaryComplete: "Summary complete",

  // 구독 피드 설정
  youtubeDataApiKeyLabel: "YouTube Data API key",
  youtubeDataApiKeyDesc: "Google Cloud Console → Create Project → Enable YouTube Data API v3 → Credentials → Create API Key",
  addChannelLabel: "Add channel",
  addChannelDesc: "Enter a YouTube channel handle (e.g. @sosumonkey) or channel ID (e.g. UCxxxx)",
  addChannelButton: "Add",
  addingChannel: "Adding...",
  removeChannelButton: "Remove",
  subscriptionChannelsLabel: "Monitored channels",
  subscriptionSaveFolderLabel: "Subscription save folder",
  subscriptionSaveFolderDesc: "Folder path where subscription summary notes will be saved",
  subscriptionSectionHeader: "YouTube subscription feed",
  errorChannelNotFound: "Channel not found. Please check the channel handle or ID",

  // 사이드바 탭
  tabUrlSummary: "URL summary",
  tabSubscriptionFeed: "Subscription feed",

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
  channelSaveFolderLabel: "Channel save folder",
  channelSaveFolderDesc: "Select a folder for this channel's summary notes (leave default to use common folder)",
  channelSaveFolderDefault: "Use default folder",

  // 채널당 영상 개수 설정
  videosPerChannelLabel: "Videos per channel",
  videosPerChannelDesc: "Number of latest videos to show per channel (1-10)",

  // 스크립트 직접 입력
  scriptLabel: "Script / transcript",
  scriptPlaceholder: "Paste the video script or transcript here (optional)",
  scriptHint: "If provided, this text will be used for summarization instead of auto-extraction.",

  bulkLabel: "Bulk summarize (multiple links)",
  bulkPlaceholder: "One YouTube link per line",
  bulkHint: "Links run sequentially, one at a time. Invalid lines are skipped.",
  bulkButton: "Summarize all",
  bulkProgress: (done, total) => `Processing ${done}/${total}...`,
  bulkDone: (ok, fail) => `Done: ${ok} succeeded, ${fail} failed`,

  // 채널 그룹
  channelGroupLabel: "Group",
  channelGroupDesc: "Group this channel under a name (e.g. Stocks, Study). Leave empty for no group.",
  feedUngrouped: "Ungrouped",

  // 피드 페이지네이션
  feedShowMore: "Show more",
};

/** 한국어 번역 */
const ko: Translations = {
  settingsDescription: "옵시디언에서 유튜브 자막을 가져와 선택한 AI 모델로 직접 번역·요약합니다. 별도 요약 서버와 음성 인식을 사용하지 않습니다. 자막 생성이 늦어지면 나중에 재시도하거나 스크립트를 직접 입력할 수 있습니다. 권장 모델은 Claude Sonnet 계열입니다.",

  languageLabel: "언어 (Language)",
  languageDesc: "플러그인 UI 표시 언어를 선택합니다",
  toggleVisibilityAria: "표시 전환",

  summaryLanguageLabel: "요약 언어",
  summaryLanguageDesc: "UI 언어와 별도로 번역문과 요약 노트의 언어를 선택합니다",
  providerLabel: "AI 제공자",
  providerDesc: "선택한 제공자에게 자막을 전송하여 번역·요약합니다",
  modelLabel: "모델 ID",
  modelDesc: "접근 가능한 텍스트 모델 ID를 입력하세요. Claude Sonnet 계열을 권장합니다 (예: claude-sonnet-4-6). Bedrock은 추론 프로필 ID/ARN도 지원합니다",
  modelListButton: "모델 불러오기",
  modelListLoading: "불러오는 중...",
  modelListLoaded: (count) => `모델 ${count}개를 불러왔습니다. 모델 ID 입력란에서 선택하세요.`,
  errorModelList: "모델 목록을 불러오지 못했습니다. API 키·리전·네트워크를 확인해주세요.",
  errorModelListProfile: "AWS 프로필 인증에서는 모델 목록 조회를 지원하지 않습니다. 모델 ID를 직접 입력해주세요.",
  bedrockAuthLabel: "Bedrock 인증 방식",
  bedrockBearerOption: "API 키 (Bearer 토큰)",
  bedrockProfileOption: "AWS 프로필 / SSO (데스크톱)",
  bedrockTokenLabel: "Bedrock Bearer 토큰",
  bedrockTokenDesc: "Bearer 접두사 없이 Bedrock API 키를 입력하세요. 볼트의 플러그인 data.json에 저장되며, 마스킹은 화면에서만 숨깁니다",
  bedrockRegionLabel: "AWS 리전",
  bedrockRegionDesc: "선택한 모델이나 추론 프로필을 사용할 수 있는 리전입니다",
  bedrockProfileLabel: "AWS 프로필",
  bedrockProfileDesc: "~/.aws/config의 프로필 이름입니다. SSO는 터미널에서 aws sso login --profile <프로필>로 먼저 로그인하세요. SDK가 캐시된 자격 증명을 사용합니다",
  modelApiKeyLabel: "모델 API 키",
  modelApiKeyDesc: "볼트의 플러그인 data.json에 제공자별로 따로 저장됩니다. 로컬 PC의 OpenAI 호환 서버만 키를 비워 둘 수 있습니다",
  openaiBaseUrlLabel: "OpenAI 호환 기본 URL",
  openaiBaseUrlDesc: "/v1까지 입력하세요. 예: https://api.openai.com/v1, http://localhost:11434/v1 (Ollama). URL을 바꾸면 이 제공자의 키가 새 주소로 전송됩니다",
  maxInputCharsLabel: "최대 입력 글자 수",
  maxInputCharsDesc: "자막과 번역문의 상한입니다 (1,000~1,000,000자). 넘으면 오류로 중단하며 뒷부분을 임의로 자르지 않습니다",
  maxOutputTokensLabel: "호출당 최대 출력 토큰",
  maxOutputTokensDesc: "모델의 출력 한도 이내로 설정하세요 (128~128,000). 긴 번역은 나누어 처리하며 응답이 잘리면 이 값을 늘려 재시도하세요",
  errorMissingModel: "설정에서 모델 ID를 입력해주세요.",
  errorMissingProfile: "설정에서 AWS 프로필 이름을 입력해주세요.",
  errorDesktopProfile: "AWS 프로필·SSO 인증은 옵시디언 데스크톱에서 사용할 수 있습니다. 모바일에서는 Bearer 토큰을 사용해주세요.",
  errorProfileRuntime: "AWS 프로필 인증에는 Node.js 20 이상인 옵시디언 런타임이 필요합니다. 옵시디언 데스크톱 설치 프로그램을 업데이트하거나 Bearer 토큰을 사용해주세요.",
  errorInvalidRegion: "설정에서 올바른 AWS 리전을 입력해주세요.",
  errorInvalidBaseUrl: "인증 정보·쿼리·프래그먼트가 없는 HTTPS 기본 URL을 입력해주세요. HTTP는 로컬 PC 주소만 허용합니다.",
  errorInvalidLimits: "입력 글자 수(1,000~1,000,000)와 출력 토큰(128~128,000)을 범위 내 정수로 설정해주세요.",
  errorNoCaptions: "아직 사용할 수 있는 자막이 없습니다. 유튜브 자막 생성 후 재시도하거나 스크립트를 직접 입력해주세요. 자동 자막이 하루 안에 생성된다는 보장은 없습니다.",
  errorCaptionAccess: "유튜브에서 자막을 가져올 수 없습니다 (접근 제한·로그인·요청 제한). 잠시 후 재시도하거나 스크립트를 직접 입력해주세요.",
  errorCaptionFormat: "유튜브 자막 응답을 읽지 못했습니다. 잠시 후 재시도하거나 스크립트를 직접 입력해주세요.",
  errorCaptionIncomplete: "영상 길이에 비해 자막이 너무 짧아 불완전할 수 있습니다. 나중에 재시도하거나 전체 스크립트를 직접 입력해주세요.",
  errorCaptionsTimeout: "유튜브 요청 시간이 초과되었습니다. 나중에 재시도하거나 스크립트를 직접 입력해주세요.",
  errorModelTimeout: "모델 응답 시간이 초과되었습니다. 노트는 저장하지 않았습니다.",
  errorModelTruncated: "모델 응답이 출력 한도로 잘렸습니다. 모델이 지원하는 범위에서 출력 토큰을 늘리거나 짧은 자막으로 재시도해주세요. 노트는 저장하지 않았습니다.",
  errorModelEmpty: "모델이 텍스트를 반환하지 않았습니다. 모델과 출력 토큰 설정을 확인해주세요.",
  errorModelBlocked: "모델이 요청을 완료하지 못했습니다 (필터·응답 거절·지원하지 않는 응답). 노트는 저장하지 않았습니다.",
  errorSummaryFormat: "모델 요약에 DETAILED 섹션이 없습니다. 다시 시도하거나 출력 형식을 따를 수 있는 모델을 선택해주세요.",
  errorInputTooLong: "자막 또는 번역문이 입력 글자 수 상한을 넘었습니다. 모델의 컨텍스트 한도 내에서 상한을 늘리거나 짧은 자막을 입력해주세요. 뒷부분은 임의로 자르지 않았습니다.",
  errorModelRequest: "모델 호출에 실패했습니다. 인증 정보, 모델 ID, 주소·리전, 제공자 할당량을 확인해주세요.",
  errorProfileCredentials: "AWS 프로필 자격 증명을 불러오지 못했습니다. 프로필을 확인하고 SSO라면 aws sso login --profile <프로필>로 다시 로그인해주세요.",

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
  errorMissingApiKey: "설정에서 선택한 AI 제공자의 API 키를 입력하거나 AWS 프로필 인증을 선택해주세요.",
  noticeSummaryComplete: "요약이 완료되었습니다",

  // 구독 피드 설정
  youtubeDataApiKeyLabel: "YouTube Data API key",
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

  bulkLabel: "여러 개 한번에 요약",
  bulkPlaceholder: "한 줄에 유튜브 링크 하나씩",
  bulkHint: "위에서부터 한 번에 하나씩 순차로 요약합니다. 잘못된 줄은 건너뜁니다.",
  bulkButton: "전체 요약",
  bulkProgress: (done, total) => `처리 중 ${done}/${total}...`,
  bulkDone: (ok, fail) => `완료: 성공 ${ok}건, 실패 ${fail}건`,

  // 채널 그룹
  channelGroupLabel: "그룹",
  channelGroupDesc: "이 채널을 그룹명으로 묶습니다 (예: 주식, 스터디). 비우면 그룹 없음.",
  feedUngrouped: "그룹 없음",

  // 피드 페이지네이션
  feedShowMore: "더 보기",
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
