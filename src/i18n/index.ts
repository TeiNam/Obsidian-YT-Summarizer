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
}

/** 영어 번역 */
const en: Translations = {
  settingsHeader: "YouTube Summarizer",
  settingsDescription: "Summarize YouTube videos with AI and save as Obsidian notes. Paste a YouTube link, and the plugin generates a structured markdown note via YouTube Summary API.",

  languageLabel: "Language",
  languageDesc: "Select the display language for the plugin UI",

  apiKeyLabel: "API Key",
  apiKeyDesc: "API Key for YouTube Summary API authentication",

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
};

/** 한국어 번역 */
const ko: Translations = {
  settingsHeader: "YouTube Summarizer",
  settingsDescription: "유튜브 영상을 AI로 요약하여 옵시디언 노트로 저장합니다. 유튜브 링크를 붙여넣으면 YouTube Summary API를 통해 구조화된 마크다운 노트를 만들어줍니다.",

  languageLabel: "언어 (Language)",
  languageDesc: "플러그인 UI 표시 언어를 선택합니다",

  apiKeyLabel: "API Key",
  apiKeyDesc: "YouTube Summary API 인증을 위한 API Key입니다",

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
