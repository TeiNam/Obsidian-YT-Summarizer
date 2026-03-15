// ============================================================
// i18n 번역 키 완전성 속성 기반 테스트 (Property-Based Test)
// fast-check 라이브러리를 사용하여 en/ko 번역 객체의
// 구독 피드 관련 키 완전성을 검증
// ============================================================

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { t } from "./index";
import type { Translations } from "./index";

/**
 * 구독 피드 관련 i18n 키 목록
 * 설계 문서에 정의된 모든 구독 피드 관련 번역 키
 */
const subscriptionFeedKeys: (keyof Translations)[] = [
  // 구독 피드 설정
  "youtubeDataApiKeyLabel",
  "youtubeDataApiKeyDesc",
  "addChannelLabel",
  "addChannelDesc",
  "addChannelButton",
  "addingChannel",
  "removeChannelButton",
  "subscriptionChannelsLabel",
  "subscriptionSaveFolderLabel",
  "subscriptionSaveFolderDesc",
  "subscriptionSectionHeader",
  "errorChannelNotFound",

  // 사이드바 탭
  "tabUrlSummary",
  "tabSubscriptionFeed",

  // 피드 뷰
  "feedRefreshButton",
  "feedLoading",
  "feedEmpty",
  "feedNoChannels",
  "feedSummarizeButton",
  "feedSummarizing",
  "feedSummarized",
  "feedSummaryError",

  // 구독 피드 오류 메시지
  "errorInvalidYoutubeDataApiKey",
  "errorNetworkConnection",
  "errorFetchSubscriptions",
];

/**
 * 구독 피드 관련 i18n 키를 랜덤으로 선택하는 생성기
 * fc.constantFrom을 사용하여 키 목록에서 무작위 선택
 */
const subscriptionFeedKeyArbitrary: fc.Arbitrary<keyof Translations> =
  fc.constantFrom(...subscriptionFeedKeys);

describe("Feature: youtube-subscription-feed, Property 8: 번역 키 완전성", () => {
  /**
   * Validates: Requirements 8.1
   *
   * 구독 피드 관련 모든 i18n 키에 대해
   * en/ko 번역 객체 모두에 비어있지 않은 문자열 값이 존재하는지 검증
   */
  it("구독 피드 관련 랜덤 i18n 키가 en/ko 번역 객체 모두에 비어있지 않은 문자열로 존재한다", () => {
    const enTranslations = t("en");
    const koTranslations = t("ko");

    fc.assert(
      fc.property(subscriptionFeedKeyArbitrary, (key) => {
        // 영어 번역 객체에 해당 키가 존재해야 한다
        expect(enTranslations).toHaveProperty(key);

        // 한국어 번역 객체에 해당 키가 존재해야 한다
        expect(koTranslations).toHaveProperty(key);

        // 영어 번역 값이 비어있지 않은 문자열이어야 한다
        const enValue = enTranslations[key];
        expect(typeof enValue).toBe("string");
        expect((enValue as string).trim().length).toBeGreaterThan(0);

        // 한국어 번역 값이 비어있지 않은 문자열이어야 한다
        const koValue = koTranslations[key];
        expect(typeof koValue).toBe("string");
        expect((koValue as string).trim().length).toBeGreaterThan(0);
      }),
      { numRuns: 100 } // 최소 100회 반복
    );
  });
});

// ============================================================
// 채널별 저장 폴더 관련 번역 키 완전성 속성 기반 테스트
// ============================================================

/**
 * 채널별 저장 폴더 관련 i18n 키 목록
 * 설계 문서에 정의된 채널별 저장 폴더 번역 키
 */
const channelSaveFolderKeys: (keyof Translations)[] = [
  "channelSaveFolderLabel",
  "channelSaveFolderDesc",
];

/**
 * 채널별 저장 폴더 관련 i18n 키를 랜덤으로 선택하는 생성기
 * fc.constantFrom을 사용하여 키 목록에서 무작위 선택
 */
const channelSaveFolderKeyArbitrary: fc.Arbitrary<keyof Translations> =
  fc.constantFrom(...channelSaveFolderKeys);

/**
 * 언어 코드를 랜덤으로 선택하는 생성기
 */
const languageArbitrary = fc.constantFrom("en" as const, "ko" as const);

describe("Feature: per-channel-save-folder, Property 4: 번역 키 완전성", () => {
  /**
   * Validates: Requirements 4.1
   *
   * 채널별 저장 폴더 관련 모든 i18n 키에 대해
   * en/ko 번역 객체 모두에 비어있지 않은 문자열 값이 존재하는지 검증
   */
  it("채널별 저장 폴더 관련 랜덤 i18n 키가 랜덤 언어(en/ko) 번역 객체에 비어있지 않은 문자열로 존재한다", () => {
    fc.assert(
      fc.property(channelSaveFolderKeyArbitrary, languageArbitrary, (key, lang) => {
        const translations = t(lang);

        // 해당 언어의 번역 객체에 키가 존재해야 한다
        expect(translations).toHaveProperty(key);

        // 번역 값이 비어있지 않은 문자열이어야 한다
        const value = translations[key];
        expect(typeof value).toBe("string");
        expect((value as string).trim().length).toBeGreaterThan(0);
      }),
      { numRuns: 100 } // 최소 100회 반복
    );
  });
});
