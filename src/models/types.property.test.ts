// ============================================================
// PluginSettings 속성 기반 테스트 (Property-Based Test)
// fast-check 라이브러리를 사용한 설정 라운드트립 검증
// ============================================================

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import type { PluginSettings, MonitoredChannel } from "./types";
import { DEFAULT_SETTINGS } from "./types";
import type { Language } from "../i18n";

/**
 * 언어 타입 생성기
 * PluginSettings의 language 필드에 사용
 */
const languageArbitrary: fc.Arbitrary<Language> = fc.constantFrom("en", "ko");

/**
 * MonitoredChannel 객체 생성기
 * 구독 채널 정보를 랜덤으로 생성
 */
const monitoredChannelArbitrary: fc.Arbitrary<MonitoredChannel> = fc.record({
  channelId: fc.string({ minLength: 1, maxLength: 30 }),
  channelTitle: fc.string({ minLength: 1, maxLength: 100 }),
  thumbnailUrl: fc.webUrl(),
});

/**
 * 완전한 PluginSettings 객체 생성기
 * 기존 필드 + 구독 피드 관련 신규 필드 포함
 */
const pluginSettingsArbitrary: fc.Arbitrary<PluginSettings> = fc.record({
  language: languageArbitrary,
  saveFolderPath: fc.string({ minLength: 0, maxLength: 200 }),
  apiKey: fc.string({ minLength: 0, maxLength: 100 }),
  youtubeDataApiKey: fc.string({ minLength: 0, maxLength: 100 }),
  monitoredChannels: fc.array(monitoredChannelArbitrary, { minLength: 0, maxLength: 20 }),
  subscriptionSaveFolderPath: fc.string({ minLength: 0, maxLength: 200 }),
  videosPerChannel: fc.integer({ min: 1, max: 10 }),
});

describe("Feature: youtube-subscription-feed, Property 1: 설정 라운드트립", () => {
  /**
   * Validates: Requirements 1.2, 3.2, 4.2, 5.3
   *
   * 랜덤 PluginSettings 객체를 생성하여
   * Object.assign({}, DEFAULT_SETTINGS, data) 라운드트립이
   * 원본 데이터를 정확히 보존하는지 검증
   */
  it("랜덤 PluginSettings를 DEFAULT_SETTINGS에 병합하면 원본 설정값이 보존된다", () => {
    fc.assert(
      fc.property(pluginSettingsArbitrary, (randomSettings) => {
        // DEFAULT_SETTINGS에 랜덤 설정을 병합 (플러그인 로드 시 동작 시뮬레이션)
        const merged = Object.assign({}, DEFAULT_SETTINGS, randomSettings);

        // 병합 결과가 원본 랜덤 설정과 동일해야 한다
        expect(merged.language).toBe(randomSettings.language);
        expect(merged.saveFolderPath).toBe(randomSettings.saveFolderPath);
        expect(merged.apiKey).toBe(randomSettings.apiKey);

        // 구독 피드 관련 신규 필드도 보존되어야 한다
        expect(merged.youtubeDataApiKey).toBe(randomSettings.youtubeDataApiKey);
        expect(merged.monitoredChannels).toEqual(randomSettings.monitoredChannels);
        expect(merged.subscriptionSaveFolderPath).toBe(randomSettings.subscriptionSaveFolderPath);
        expect(merged.videosPerChannel).toBe(randomSettings.videosPerChannel);

        // 병합 결과가 전체적으로 원본과 깊은 동등성을 가져야 한다
        expect(merged).toEqual(randomSettings);
      }),
      { numRuns: 100 } // 최소 100회 반복
    );
  });

  /**
   * Validates: Requirements 1.2, 3.2, 4.2, 5.3
   *
   * 부분적인 설정 객체를 병합할 때
   * 누락된 필드는 DEFAULT_SETTINGS의 기본값으로 채워지는지 검증
   */
  it("부분 설정을 병합하면 누락된 필드는 기본값으로 채워진다", () => {
    // 부분 설정 생성기: 일부 필드만 포함
    const partialSettingsArbitrary = fc.record(
      {
        language: languageArbitrary,
        saveFolderPath: fc.string({ minLength: 0, maxLength: 200 }),
        apiKey: fc.string({ minLength: 0, maxLength: 100 }),
        youtubeDataApiKey: fc.string({ minLength: 0, maxLength: 100 }),
        monitoredChannels: fc.array(monitoredChannelArbitrary, { minLength: 0, maxLength: 20 }),
        subscriptionSaveFolderPath: fc.string({ minLength: 0, maxLength: 200 }),
        videosPerChannel: fc.integer({ min: 1, max: 10 }),
      },
      { requiredKeys: [] } // 모든 필드가 선택적
    );

    fc.assert(
      fc.property(partialSettingsArbitrary, (partialSettings) => {
        const merged = Object.assign({}, DEFAULT_SETTINGS, partialSettings);

        // 제공된 필드는 해당 값을 사용해야 한다
        for (const key of Object.keys(partialSettings) as (keyof PluginSettings)[]) {
          expect(merged[key]).toEqual(partialSettings[key]);
        }

        // 제공되지 않은 필드는 DEFAULT_SETTINGS 기본값을 유지해야 한다
        for (const key of Object.keys(DEFAULT_SETTINGS) as (keyof PluginSettings)[]) {
          if (!(key in partialSettings)) {
            expect(merged[key]).toEqual(DEFAULT_SETTINGS[key]);
          }
        }
      }),
      { numRuns: 100 } // 최소 100회 반복
    );
  });
});

// ============================================================
// Property 2: 하위 호환성 - 기존 데이터 로드
// saveFolderPath 필드가 없는 기존 MonitoredChannel 데이터가
// resolveChannelSaveFolderPath에서 오류 없이 기본 폴더 경로를 반환하는지 검증
// ============================================================

import { resolveChannelSaveFolderPath } from "../views/FeedView";

/**
 * saveFolderPath 필드가 없는 MonitoredChannel 객체 생성기
 * 기존 데이터(saveFolderPath 필드 추가 전)를 시뮬레이션
 * saveFolderPath 프로퍼티 자체를 포함하지 않는 객체를 생성
 */
const legacyMonitoredChannelArbitrary: fc.Arbitrary<MonitoredChannel> = fc
  .record({
    channelId: fc.stringMatching(/^UC[A-Za-z0-9]{1,20}$/),
    channelTitle: fc.string({ minLength: 1, maxLength: 50 }),
    thumbnailUrl: fc.webUrl(),
  })
  .map((ch) => ch as MonitoredChannel);

describe("Feature: per-channel-save-folder, Property 2: 하위 호환성 - 기존 데이터 로드", () => {
  /**
   * Validates: Requirements 1.1, 1.3, 5.2
   *
   * saveFolderPath 필드가 없는 랜덤 MonitoredChannel 객체를
   * resolveChannelSaveFolderPath에 전달하면
   * 오류 없이 기본 폴더 경로를 반환해야 한다.
   * 즉, saveFolderPath가 undefined인 기존 데이터는 항상 fallback 경로를 사용한다.
   */
  it("saveFolderPath 필드가 없는 기존 MonitoredChannel 데이터는 오류 없이 기본 폴더 경로를 반환한다", () => {
    // 기본 폴더 경로 생성기
    const defaultFolderArb = fc.stringMatching(/^[A-Za-z0-9/_-]{1,30}$/).filter(
      (s) => s.trim().length > 0
    );

    fc.assert(
      fc.property(
        legacyMonitoredChannelArbitrary,
        defaultFolderArb,
        (legacyChannel, defaultFolder) => {
          // 사전 조건: saveFolderPath 프로퍼티가 객체에 존재하지 않아야 한다
          expect("saveFolderPath" in legacyChannel).toBe(false);

          // resolveChannelSaveFolderPath 호출 시 오류가 발생하지 않아야 한다
          const result = resolveChannelSaveFolderPath(
            [legacyChannel],
            legacyChannel.channelId,
            defaultFolder
          );

          // 기본 폴더 경로를 반환해야 한다
          expect(result).toBe(defaultFolder);
        }
      ),
      { numRuns: 100 } // 최소 100회 반복
    );
  });

  /**
   * Validates: Requirements 1.1, 1.3, 5.2
   *
   * 여러 개의 saveFolderPath 필드가 없는 기존 MonitoredChannel 배열을
   * resolveChannelSaveFolderPath에 전달해도
   * 모든 채널에 대해 기본 폴더 경로를 반환해야 한다.
   */
  it("saveFolderPath 필드가 없는 기존 채널 배열에서 모든 채널이 기본 폴더 경로를 사용한다", () => {
    const legacyChannelsArb = fc.array(legacyMonitoredChannelArbitrary, {
      minLength: 1,
      maxLength: 10,
    });
    const defaultFolderArb = fc.stringMatching(/^[A-Za-z0-9/_-]{1,30}$/).filter(
      (s) => s.trim().length > 0
    );

    fc.assert(
      fc.property(legacyChannelsArb, defaultFolderArb, (legacyChannels, defaultFolder) => {
        for (const channel of legacyChannels) {
          // 각 채널에 saveFolderPath 프로퍼티가 없어야 한다
          expect("saveFolderPath" in channel).toBe(false);

          const result = resolveChannelSaveFolderPath(
            legacyChannels,
            channel.channelId,
            defaultFolder
          );

          // 모든 채널이 기본 폴더 경로를 반환해야 한다
          expect(result).toBe(defaultFolder);
        }
      }),
      { numRuns: 100 } // 최소 100회 반복
    );
  });
});
