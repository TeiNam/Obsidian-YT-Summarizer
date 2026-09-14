// ============================================================
// Obsidian YouTube Summarizer - 타입 및 인터페이스 정의
// 자막 수집과 AI 모델 직접 호출에 사용하는 설정
// ============================================================

import { Language } from "../i18n";

export type AiProvider = "bedrock" | "openai" | "anthropic" | "gemini";

/**
 * 요약(타겟) 언어 목록 — 주요 20개 언어
 * code는 자막 선호 언어 매칭, english는 프롬프트 지시, label은 설정 UI 표기에 사용
 */
export const SUMMARY_LANGUAGES = [
  { code: "ko", label: "한국어", english: "Korean" },
  { code: "en", label: "English", english: "English" },
  { code: "ja", label: "日本語", english: "Japanese" },
  { code: "zh-CN", label: "简体中文", english: "Simplified Chinese" },
  { code: "zh-TW", label: "繁體中文", english: "Traditional Chinese" },
  { code: "es", label: "Español", english: "Spanish" },
  { code: "fr", label: "Français", english: "French" },
  { code: "de", label: "Deutsch", english: "German" },
  { code: "it", label: "Italiano", english: "Italian" },
  { code: "pt", label: "Português", english: "Portuguese" },
  { code: "ru", label: "Русский", english: "Russian" },
  { code: "ar", label: "العربية", english: "Arabic" },
  { code: "hi", label: "हिन्दी", english: "Hindi" },
  { code: "id", label: "Bahasa Indonesia", english: "Indonesian" },
  { code: "vi", label: "Tiếng Việt", english: "Vietnamese" },
  { code: "th", label: "ไทย", english: "Thai" },
  { code: "tr", label: "Türkçe", english: "Turkish" },
  { code: "pl", label: "Polski", english: "Polish" },
  { code: "nl", label: "Nederlands", english: "Dutch" },
  { code: "sv", label: "Svenska", english: "Swedish" },
] as const;

/** 요약 결과 언어 코드 */
export type SummaryLanguage = (typeof SUMMARY_LANGUAGES)[number]["code"];

/**
 * 플러그인 설정 인터페이스
 * 제공자별 인증값을 따로 보관하여 제공자 전환 시 다른 서비스로 키가 전송되지 않게 한다.
 */
export interface PluginSettings {
  /** UI 표시 언어 */
  language: Language;
  /** 노트 저장 폴더 경로 */
  saveFolderPath: string;
  /** 이전 버전으로 돌아갈 때를 위한 서버 키. 로컬 요약에는 사용하지 않는다. */
  apiKey: string;
  /** 요약 결과 언어 (UI 언어와 별도) */
  summaryLanguage: SummaryLanguage;
  aiProvider: AiProvider;
  bedrockAuthMode: "bearer" | "profile";
  bedrockRegion: string;
  bedrockModelId: string;
  bedrockBearerToken: string;
  bedrockProfile: string;
  openaiBaseUrl: string;
  openaiModel: string;
  openaiApiKey: string;
  anthropicModel: string;
  anthropicApiKey: string;
  geminiModel: string;
  geminiApiKey: string;
  /** 자막/번역문 입력 상한. 넘으면 뒷부분을 자르지 않고 중단한다. */
  maxInputChars: number;
  /** 호출당 출력 토큰 상한. 사용하는 모델의 출력 한도 이내로 설정한다. */
  maxOutputTokens: number;
  /** YouTube Data API v3 인증 키 */
  youtubeDataApiKey: string;

  /** 모니터링 대상 채널 목록 */
  monitoredChannels: MonitoredChannel[];
  /** 구독 영상 요약 저장 폴더 경로 */
  subscriptionSaveFolderPath: string;
  /** 채널당 가져올 최신 영상 개수 (기본값: 6, 범위: 1~10) */
  videosPerChannel: number;
  /** 이미 요약 완료한 영상 ID 목록 (피드에서 "요약함" 표시 영구화) */
  summarizedVideoIds: string[];
}

/**
 * URL 유효성 검증 결과 인터페이스
 */
export interface ValidationResult {
  /** URL이 유효한지 여부 */
  isValid: boolean;
  /** 추출된 영상 ID (유효하지 않으면 null) */
  videoId: string | null;
  /** 오류 메시지 (유효하면 null) */
  error: string | null;
}

/**
 * 노트 생성용 콘텐츠 인터페이스
 * API 응답 결과를 노트로 변환하기 위한 데이터 구조
 */
export interface NoteContent {
  /** 노트의 섹션 제목 언어 (ko면 한국어, 그 외에는 영어 제목) */
  language?: SummaryLanguage;
  /** 영상 제목 */
  videoTitle: string;
  /** 원본 유튜브 URL */
  videoUrl: string;
  /** AI 생성 요약 내용 (마크다운) */
  summary: string;
  /** 핵심 인사이트 배열 */
  keyPoints: string[];
}

/**
 * 요약 프로세스 진행 단계 열거형
 * i18n 키로 사용되며, 실제 표시 텍스트는 t(lang) 함수로 변환
 */
export enum SummaryStage {
  VALIDATING = "stageValidating",
  PENDING = "stagePending",
  EXTRACTING = "stageExtracting",
  TRANSLATING = "stageTranslating",
  SUMMARIZING = "stageSummarizing",
  CREATING_NOTE = "stageCreatingNote",
  COMPLETE = "stageComplete",
}

/**
 * 진행 상태 콜백 타입
 * 요약 프로세스의 각 단계를 UI에 전달하는 데 사용
 */
export type ProgressCallback = (stage: string) => void;

// ============================================================
// 자막 수집 결과
// ============================================================

export interface VideoTranscript {
  title: string;
  uploadDate?: string;
  text: string;
  language?: string;
}

/**
 * 플러그인 기본 설정값
 */
export const DEFAULT_SETTINGS: PluginSettings = {
  language: "en",
  saveFolderPath: "YouTube Summaries",
  apiKey: "",
  summaryLanguage: "ko",
  aiProvider: "bedrock",
  bedrockAuthMode: "bearer",
  bedrockRegion: "us-east-1",
  bedrockModelId: "us.anthropic.claude-sonnet-4-6",
  bedrockBearerToken: "",
  bedrockProfile: "default",
  openaiBaseUrl: "https://api.openai.com/v1",
  openaiModel: "gpt-4.1-mini",
  openaiApiKey: "",
  anthropicModel: "claude-sonnet-4-6",
  anthropicApiKey: "",
  geminiModel: "gemini-2.5-flash",
  geminiApiKey: "",
  maxInputChars: 200000,
  maxOutputTokens: 65536,
  youtubeDataApiKey: "",
  monitoredChannels: [],
  subscriptionSaveFolderPath: "YouTube Subscriptions",
  videosPerChannel: 6,
  summarizedVideoIds: [],
};

// ============================================================
// 구독 피드 관련 타입 및 인터페이스
// ============================================================

/**
 * 모니터링 대상 채널 정보
 * 사용자가 체크박스로 선택한 구독 채널
 */
export interface MonitoredChannel {
  /** YouTube 채널 ID (예: "UCxxxx") */
  channelId: string;
  /** 채널 이름 */
  channelTitle: string;
  /** 채널 썸네일 URL */
  thumbnailUrl: string;
  /** 채널별 저장 폴더 경로 (미설정 시 공통 폴더 사용) */
  saveFolderPath?: string;
  /** 그룹명 (미설정 시 그룹 없음으로 분류, 예: "주식", "스터디") */
  group?: string;
}

/**
 * YouTube Data API channels.list 응답에서 추출한 채널 정보
 */
export interface SubscriptionChannel {
  channelId: string;
  title: string;
  thumbnailUrl: string;
  description: string;
}

/**
 * 채널의 최근 영상 정보
 */
export interface VideoItem {
  videoId: string;
  title: string;
  channelId: string;
  channelTitle: string;
  /** ISO 8601 형식의 업로드 날짜 */
  publishedAt: string;
  thumbnailUrl: string;
}

/**
 * playlistItems.list 응답
 * 페이지네이션 지원
 */
export interface PlaylistItemsResponse {
  items: VideoItem[];
  nextPageToken: string | null;
}

/**
 * 채널별 신규 영상 그룹
 */
export interface ChannelVideos {
  channelId: string;
  channelTitle: string;
  videos: VideoItem[];
}

/**
 * 피드 뷰에서 영상별 요약 상태를 추적하기 위한 타입
 */
export type VideoSummaryStatus = "idle" | "summarizing" | "completed" | "error";
