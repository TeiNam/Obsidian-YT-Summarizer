// ============================================================
// 유튜브 URL 유효성 검증 유틸리티
// 순수 함수 모듈로 구현
// ============================================================

import { ValidationResult } from "../models/types";

/**
 * 유튜브 영상 ID 정규식 패턴
 * 유튜브 영상 ID는 11자리 영숫자, 하이픈, 언더스코어로 구성
 */
const VIDEO_ID_PATTERN = /^[a-zA-Z0-9_-]{11}$/;

/**
 * 지원하는 유튜브 URL 패턴 목록
 * - youtube.com/watch?v=VIDEO_ID
 * - youtu.be/VIDEO_ID
 * - youtube.com/shorts/VIDEO_ID
 * http/https, www 유무, 추가 쿼리 파라미터 등 변형 처리
 */
const YOUTUBE_URL_PATTERNS: RegExp[] = [
  // youtube.com/watch?v=VIDEO_ID (쿼리 파라미터 순서 무관)
  /^(?:https?:\/\/)?(?:www\.)?youtube\.com\/watch\?.*v=([a-zA-Z0-9_-]{11})(?:&.*)?$/,
  // youtu.be/VIDEO_ID
  /^(?:https?:\/\/)?(?:www\.)?youtu\.be\/([a-zA-Z0-9_-]{11})(?:\?.*)?$/,
  // youtube.com/shorts/VIDEO_ID
  /^(?:https?:\/\/)?(?:www\.)?youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})(?:\?.*)?$/,
];

/**
 * 유튜브 URL에서 영상 ID를 추출하는 함수
 * @param url - 유튜브 URL 문자열
 * @returns 추출된 영상 ID 또는 null
 */
export function extractVideoId(url: string): string | null {
  if (!url || !url.trim()) {
    return null;
  }

  const trimmedUrl = url.trim();

  for (const pattern of YOUTUBE_URL_PATTERNS) {
    const match = trimmedUrl.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }

  // watch URL에서 v 파라미터가 중간에 있는 경우 처리
  // 예: youtube.com/watch?feature=share&v=VIDEO_ID
  try {
    const urlObj = new URL(
      trimmedUrl.startsWith("http") ? trimmedUrl : `https://${trimmedUrl}`
    );
    const hostname = urlObj.hostname.replace(/^www\./, "");

    if (hostname === "youtube.com" || hostname === "m.youtube.com") {
      // /watch 경로에서 v 파라미터 추출
      if (urlObj.pathname === "/watch") {
        const videoId = urlObj.searchParams.get("v");
        if (videoId && VIDEO_ID_PATTERN.test(videoId)) {
          return videoId;
        }
      }

      // /shorts/ 경로에서 영상 ID 추출
      const shortsMatch = urlObj.pathname.match(/^\/shorts\/([a-zA-Z0-9_-]{11})$/);
      if (shortsMatch) {
        return shortsMatch[1];
      }
    }

    // youtu.be 단축 URL 처리
    if (hostname === "youtu.be") {
      const pathId = urlObj.pathname.slice(1); // 앞의 '/' 제거
      if (VIDEO_ID_PATTERN.test(pathId)) {
        return pathId;
      }
    }
  } catch {
    // URL 파싱 실패 시 null 반환
    return null;
  }

  return null;
}

/**
 * 유튜브 URL 유효성을 검증하는 함수
 * @param url - 검증할 URL 문자열
 * @returns 검증 결과 (유효 여부, 영상 ID, 오류 메시지)
 */
export function validateYouTubeUrl(url: string): ValidationResult {
  // 빈 문자열 또는 공백만 있는 경우
  if (!url || !url.trim()) {
    return {
      isValid: false,
      videoId: null,
      error: "유튜브 링크를 입력해주세요",
    };
  }

  // 영상 ID 추출 시도
  const videoId = extractVideoId(url);

  if (videoId) {
    return {
      isValid: true,
      videoId,
      error: null,
    };
  }

  // 유효하지 않은 URL
  return {
    isValid: false,
    videoId: null,
    error: "유효한 유튜브 링크를 입력해주세요",
  };
}
