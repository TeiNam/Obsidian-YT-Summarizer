// ============================================================
// Obsidian YouTube Summarizer - 타입 및 인터페이스 정의
// API 마이그레이션 후 구조: AWS 관련 제거, YouTube Summary API 타입 추가
// ============================================================

import { Language } from "../i18n";

/**
 * 플러그인 설정 인터페이스
 * API 마이그레이션 후 API Key 하나로 단순화
 * 구독 피드 관련 필드 추가
 */
export interface PluginSettings {
  /** UI 표시 언어 */
  language: Language;
  /** 노트 저장 폴더 경로 */
  saveFolderPath: string;
  /** YouTube Summary API 인증 키 */
  apiKey: string;
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
  /** 영상 제목 (API 응답의 video_title) */
  videoTitle: string;
  /** 원본 유튜브 URL */
  videoUrl: string;
  /** AI 생성 요약 내용 (마크다운) */
  summary: string;
  /** 핵심 인사이트 배열 (API 응답의 key_points) */
  keyPoints: string[];
}

/**
 * 요약 프로세스 진행 단계 열거형
 * API 작업 상태 흐름에 맞게 재정의
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
// YouTube Summary API 요청/응답 타입
// ============================================================

/** POST /summarize 요청 본문 */
export interface SummarizeApiRequest {
  url: string;
  target_language: string;
  /** 수동 입력 스크립트/자막 (제공 시 자동 추출 대신 사용) */
  transcript?: string;
}

/** POST /summarize 응답 (202) */
export interface SummarizeApiResponse {
  task_id: string;
  status: string;
}

/** GET /tasks/{task_id} 응답 */
export interface TaskStatusResponse {
  task_id: string;
  status: "pending" | "extracting" | "translating" | "summarizing" | "completed" | "failed";
  result: ApiResult | null;
  error: ApiErrorDetail | null;
}

/** 완료 시 결과 객체 */
export interface ApiResult {
  video_title: string;
  original_language: string;
  extraction_method: "subtitle" | "transcribe";
  translated_text: string;
  summary: string;
  key_points: string[];
}

/** 오류 상세 */
export interface ApiErrorDetail {
  code: string;
  message: string;
}

/**
 * 플러그인 기본 설정값
 */
export const DEFAULT_SETTINGS: PluginSettings = {
  language: "en",
  saveFolderPath: "YouTube Summaries",
  apiKey: "",
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
