// ============================================================
// YouTubeUrlValidator 속성 기반 테스트 (Property-Based Test)
// fast-check 라이브러리를 사용한 PBT
// ============================================================

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { validateYouTubeUrl } from "./YouTubeUrlValidator";

/**
 * 유효한 유튜브 영상 ID 생성기 (Arbitrary)
 * 유튜브 영상 ID는 11자리 영숫자, 하이픈, 언더스코어로 구성
 */
const videoIdArbitrary = fc.stringOf(
  fc.constantFrom(
    ...("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_".split(""))
  ),
  { minLength: 11, maxLength: 11 }
);

/**
 * URL 프로토콜 변형 생성기
 * http 또는 https
 */
const protocolArbitrary = fc.constantFrom("https://", "http://");

/**
 * www 접두사 변형 생성기
 * www. 있거나 없거나
 */
const wwwArbitrary = fc.constantFrom("www.", "");

/**
 * 유효한 유튜브 URL 생성기
 * 3가지 URL 형식과 프로토콜/www 변형을 조합
 */
const validYouTubeUrlArbitrary = fc.tuple(
  videoIdArbitrary,
  protocolArbitrary,
  wwwArbitrary,
  fc.constantFrom("watch", "short", "shorts") as fc.Arbitrary<"watch" | "short" | "shorts">
).map(([videoId, protocol, www, format]) => {
  switch (format) {
    case "watch":
      return { url: `${protocol}${www}youtube.com/watch?v=${videoId}`, videoId };
    case "short":
      // youtu.be 단축 URL (www 변형 포함)
      return { url: `${protocol}${www}youtu.be/${videoId}`, videoId };
    case "shorts":
      return { url: `${protocol}${www}youtube.com/shorts/${videoId}`, videoId };
  }
});

describe("Property 1: 유효한 유튜브 URL은 videoId를 추출한다", () => {
  /**
   * Feature: obsidian-youtube-summarizer, Property 1: 유효한 유튜브 URL은 videoId를 추출한다
   * Validates: Requirements 2.1, 2.3
   *
   * 랜덤 videoId와 URL 형식 조합을 생성하여
   * 유효한 URL이 올바르게 파싱되는지 검증
   */
  it("랜덤 videoId와 URL 형식 조합에서 항상 isValid: true이고 올바른 videoId를 추출한다", () => {
    fc.assert(
      fc.property(validYouTubeUrlArbitrary, ({ url, videoId }) => {
        const result = validateYouTubeUrl(url);

        // 유효한 유튜브 URL은 반드시 isValid: true를 반환해야 한다
        expect(result.isValid).toBe(true);

        // 추출된 videoId가 원본과 일치해야 한다
        expect(result.videoId).toBe(videoId);

        // 오류 메시지가 없어야 한다
        expect(result.error).toBeNull();
      }),
      { numRuns: 200 } // 최소 100회 이상 실행
    );
  });
});

/**
 * 유효한 유튜브 URL 패턴에 해당하는지 확인하는 헬퍼 함수
 * 랜덤 문자열이 우연히 유효한 유튜브 URL이 되는 경우를 필터링하기 위해 사용
 */
function looksLikeValidYouTubeUrl(str: string): boolean {
  const trimmed = str.trim();
  if (!trimmed) return false;

  // 유효한 유튜브 호스트 패턴 확인
  const youtubePatterns = [
    /(?:https?:\/\/)?(?:www\.)?youtube\.com\/watch\?.*v=[a-zA-Z0-9_-]{11}/,
    /(?:https?:\/\/)?(?:www\.)?youtu\.be\/[a-zA-Z0-9_-]{11}/,
    /(?:https?:\/\/)?(?:www\.)?youtube\.com\/shorts\/[a-zA-Z0-9_-]{11}/,
    /(?:https?:\/\/)?(?:www\.)?m\.youtube\.com\/watch\?.*v=[a-zA-Z0-9_-]{11}/,
  ];

  return youtubePatterns.some((pattern) => pattern.test(trimmed));
}

describe("Property 2: 유효하지 않은 URL은 거부된다", () => {
  /**
   * Feature: obsidian-youtube-summarizer, Property 2: 유효하지 않은 URL은 거부된다
   * Validates: Requirements 2.2
   *
   * 랜덤 문자열을 생성하여 유효하지 않은 URL이 거부되는지 검증
   * 유효한 유튜브 URL 패턴을 필터링하여 제외
   */
  it("유효한 유튜브 URL 형식이 아닌 랜덤 문자열은 항상 isValid: false이고 videoId가 null이다", () => {
    fc.assert(
      fc.property(
        fc.string().filter((s) => !looksLikeValidYouTubeUrl(s)),
        (invalidUrl) => {
          const result = validateYouTubeUrl(invalidUrl);

          // 유효하지 않은 URL은 반드시 isValid: false를 반환해야 한다
          expect(result.isValid).toBe(false);

          // videoId는 null이어야 한다
          expect(result.videoId).toBeNull();

          // 오류 메시지가 존재해야 한다
          expect(result.error).not.toBeNull();
        }
      ),
      { numRuns: 200 } // 최소 100회 이상 실행
    );
  });

  it("일반 웹사이트 URL은 유효하지 않은 유튜브 URL로 거부된다", () => {
    // 유튜브가 아닌 다양한 도메인의 URL 생성기
    const nonYoutubeDomainArbitrary = fc.constantFrom(
      "google.com",
      "github.com",
      "example.com",
      "vimeo.com",
      "dailymotion.com",
      "twitter.com",
      "facebook.com"
    );

    const nonYoutubeUrlArbitrary = fc
      .tuple(protocolArbitrary, wwwArbitrary, nonYoutubeDomainArbitrary, fc.webPath())
      .map(([protocol, www, domain, path]) => `${protocol}${www}${domain}${path}`);

    fc.assert(
      fc.property(nonYoutubeUrlArbitrary, (url) => {
        const result = validateYouTubeUrl(url);

        expect(result.isValid).toBe(false);
        expect(result.videoId).toBeNull();
      }),
      { numRuns: 200 }
    );
  });

  it("유튜브 도메인이지만 영상 ID가 없거나 잘못된 경로는 거부된다", () => {
    // 유튜브 도메인이지만 유효하지 않은 경로 생성기
    const invalidYoutubePathArbitrary = fc.constantFrom(
      "https://www.youtube.com/",
      "https://www.youtube.com/feed",
      "https://www.youtube.com/channel/UCxxxxxx",
      "https://www.youtube.com/playlist?list=PLxxxxxx",
      "https://www.youtube.com/watch",
      "https://www.youtube.com/watch?v=",
      "https://www.youtube.com/watch?v=short",
      "https://www.youtube.com/watch?v=toolongvideoidstring",
      "https://www.youtube.com/shorts/",
      "https://www.youtube.com/shorts/abc",
      "https://youtu.be/",
      "https://youtu.be/short",
      "https://youtu.be/toolongvideoidstring123",
    );

    fc.assert(
      fc.property(invalidYoutubePathArbitrary, (url) => {
        const result = validateYouTubeUrl(url);

        expect(result.isValid).toBe(false);
        expect(result.videoId).toBeNull();
      }),
      { numRuns: 100 }
    );
  });
});

