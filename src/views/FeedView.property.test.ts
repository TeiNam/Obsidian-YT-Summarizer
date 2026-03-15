// @vitest-environment jsdom
// ============================================================
// FeedView 속성 기반 테스트 (Property-Based Test)
// fast-check 라이브러리를 사용한 피드 뷰 렌더링 검증
// - Property 6: 영상 항목 렌더링 정보 포함
// ============================================================

import { describe, it, expect, vi } from "vitest";
import * as fc from "fast-check";
import { FeedView } from "./FeedView";
import type { FeedViewDependencies } from "./FeedView";
import type { VideoItem, PluginSettings } from "../models/types";
import { DEFAULT_SETTINGS } from "../models/types";
import { App } from "obsidian";

/**
 * 모킹된 FeedViewDependencies 생성 헬퍼
 * FeedView 인스턴스 생성에 필요한 최소한의 의존성 모킹
 */
function createMockDeps(overrides?: Partial<FeedViewDependencies>): FeedViewDependencies {
  return {
    subscriptionManager: {
      fetchNewVideos: vi.fn().mockResolvedValue([]),
      getUploadsPlaylistId: vi.fn(),
      filterNewVideos: vi.fn(),
      updateLastCheckedAt: vi.fn(),
    } as any,
    summarizerServiceFactory: vi.fn(),
    getSettings: () => ({ ...DEFAULT_SETTINGS } as PluginSettings),
    app: new App(),
    ...overrides,
  };
}

/**
 * 랜덤 VideoItem 생성기
 * 렌더링 검증에 필요한 유효한 VideoItem 객체를 생성
 * - title, channelTitle: 비어있지 않은 문자열 (공백/특수문자 제외)
 * - publishedAt: 유효한 ISO 8601 날짜 문자열
 */
function videoItemArbitrary(): fc.Arbitrary<VideoItem> {
  return fc.record({
    videoId: fc.string({ minLength: 1, maxLength: 20 }),
    // 렌더링 시 textContent에서 확인 가능하도록 알파벳/숫자 기반 문자열 사용
    title: fc.stringMatching(/^[A-Za-z0-9 ]{1,50}$/).filter((s) => s.trim().length > 0),
    channelId: fc.string({ minLength: 1, maxLength: 30 }),
    channelTitle: fc.stringMatching(/^[A-Za-z0-9 ]{1,50}$/).filter((s) => s.trim().length > 0),
    // 유효한 ISO 8601 날짜 문자열 생성
    publishedAt: fc.date({
      min: new Date("2020-01-01T00:00:00Z"),
      max: new Date("2030-12-31T23:59:59Z"),
    }).map((d) => d.toISOString()),
    thumbnailUrl: fc.constant("https://example.com/thumb.jpg"),
  });
}

// ============================================================
// Property 6: 영상 항목 렌더링 정보 포함
// ============================================================

describe("Feature: youtube-subscription-feed, Property 6: 영상 항목 렌더링 정보 포함", () => {
  /**
   * Validates: Requirements 6.2
   *
   * 랜덤 VideoItem 객체로 renderVideoItem을 호출하여
   * 렌더링 결과에 영상 제목, 채널 이름, 업로드 날짜(yyyy-MM-dd)가
   * 모두 포함되는지 검증
   */
  it("렌더링 결과에 영상 제목, 채널 이름, 업로드 날짜 텍스트가 모두 포함된다", () => {
    const containerEl = document.createElement("div");
    const deps = createMockDeps();
    const feedView = new FeedView(containerEl, deps);

    fc.assert(
      fc.property(videoItemArbitrary(), (video) => {
        // renderVideoItem 호출하여 DOM 요소 생성
        const itemEl = feedView.renderVideoItem(video);
        const textContent = itemEl.textContent ?? "";

        // 속성 1: 영상 제목이 렌더링 결과에 포함되어야 한다
        expect(textContent).toContain(video.title);

        // 속성 2: 채널 이름이 렌더링 결과에 포함되어야 한다
        expect(textContent).toContain(video.channelTitle);

        // 속성 3: 업로드 날짜(yyyy-MM-dd 형식)가 렌더링 결과에 포함되어야 한다
        const dateStr = video.publishedAt.slice(0, 10);
        expect(textContent).toContain(dateStr);
      }),
      { numRuns: 100 } // 최소 100회 반복
    );
  });
});


// ============================================================
// Property 1: 채널별 저장 폴더 결정 로직
// resolveChannelSaveFolderPath 순수 함수의 속성 기반 테스트
// ============================================================

import { resolveChannelSaveFolderPath } from "./FeedView";
import type { MonitoredChannel } from "../models/types";

/**
 * 랜덤 MonitoredChannel 생성기
 * saveFolderPath가 유효한 경로, undefined, 빈 문자열, 공백만으로 구성된 문자열 중 하나를 가짐
 */
function monitoredChannelArbitrary(): fc.Arbitrary<MonitoredChannel> {
  // saveFolderPath의 다양한 케이스를 생성
  const saveFolderPathArb = fc.oneof(
    // 유효한 비공백 경로
    fc.stringMatching(/^[A-Za-z0-9/_-]{1,30}$/).filter((s) => s.trim().length > 0),
    // undefined
    fc.constant(undefined),
    // 빈 문자열
    fc.constant(""),
    // 공백만으로 구성된 문자열
    fc.stringOf(fc.constant(" "), { minLength: 1, maxLength: 10 })
  );

  return fc.record({
    channelId: fc.stringMatching(/^UC[A-Za-z0-9]{1,20}$/),
    channelTitle: fc.string({ minLength: 1, maxLength: 30 }),
    thumbnailUrl: fc.constant("https://example.com/thumb.jpg"),
    saveFolderPath: saveFolderPathArb,
  }) as fc.Arbitrary<MonitoredChannel>;
}

describe("Feature: per-channel-save-folder, Property 1: 채널별 저장 폴더 결정 로직", () => {
  /**
   * Validates: Requirements 1.2, 3.1, 3.2, 5.3
   *
   * 채널의 saveFolderPath가 유효한 비공백 문자열이면
   * resolveChannelSaveFolderPath는 해당 경로(trim된 값)를 반환해야 한다
   */
  it("채널에 유효한 saveFolderPath가 설정되어 있으면 해당 경로를 반환한다", () => {
    // 유효한 비공백 saveFolderPath를 가진 채널 생성기
    const validPathArb = fc.stringMatching(/^[A-Za-z0-9/_-]{1,30}$/).filter(
      (s) => s.trim().length > 0
    );

    const channelArb = fc.record({
      channelId: fc.stringMatching(/^UC[A-Za-z0-9]{1,20}$/),
      channelTitle: fc.string({ minLength: 1, maxLength: 30 }),
      thumbnailUrl: fc.constant("https://example.com/thumb.jpg"),
      saveFolderPath: validPathArb,
    }) as fc.Arbitrary<MonitoredChannel>;

    // 기본 폴더 경로 생성기
    const defaultFolderArb = fc.stringMatching(/^[A-Za-z0-9/_-]{1,30}$/).filter(
      (s) => s.trim().length > 0
    );

    fc.assert(
      fc.property(channelArb, defaultFolderArb, (channel, defaultFolder) => {
        const result = resolveChannelSaveFolderPath(
          [channel],
          channel.channelId,
          defaultFolder
        );
        // 채널의 saveFolderPath(trim된 값)를 반환해야 한다
        expect(result).toBe(channel.saveFolderPath!.trim());
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Validates: Requirements 1.2, 3.2, 5.3
   *
   * 채널의 saveFolderPath가 undefined, 빈 문자열, 또는 공백만으로 구성된 문자열이면
   * resolveChannelSaveFolderPath는 기본 폴더 경로를 반환해야 한다
   */
  it("채널의 saveFolderPath가 미설정/빈 문자열/공백이면 기본 폴더 경로를 반환한다", () => {
    // saveFolderPath가 무효한 값(undefined, 빈 문자열, 공백만)인 채널 생성기
    const invalidPathArb = fc.oneof(
      fc.constant(undefined),
      fc.constant(""),
      fc.stringOf(fc.constant(" "), { minLength: 1, maxLength: 10 })
    );

    const channelArb = fc.record({
      channelId: fc.stringMatching(/^UC[A-Za-z0-9]{1,20}$/),
      channelTitle: fc.string({ minLength: 1, maxLength: 30 }),
      thumbnailUrl: fc.constant("https://example.com/thumb.jpg"),
      saveFolderPath: invalidPathArb,
    }) as fc.Arbitrary<MonitoredChannel>;

    const defaultFolderArb = fc.stringMatching(/^[A-Za-z0-9/_-]{1,30}$/).filter(
      (s) => s.trim().length > 0
    );

    fc.assert(
      fc.property(channelArb, defaultFolderArb, (channel, defaultFolder) => {
        const result = resolveChannelSaveFolderPath(
          [channel],
          channel.channelId,
          defaultFolder
        );
        // 기본 폴더 경로를 반환해야 한다
        expect(result).toBe(defaultFolder);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Validates: Requirements 3.2, 5.3
   *
   * 채널 ID가 목록에 없으면 기본 폴더 경로를 반환해야 한다
   */
  it("채널 ID가 목록에 없으면 기본 폴더 경로를 반환한다", () => {
    const channelsArb = fc.array(monitoredChannelArbitrary(), { minLength: 0, maxLength: 10 });
    const defaultFolderArb = fc.stringMatching(/^[A-Za-z0-9/_-]{1,30}$/).filter(
      (s) => s.trim().length > 0
    );

    fc.assert(
      fc.property(channelsArb, defaultFolderArb, (channels, defaultFolder) => {
        // 목록에 존재하지 않는 채널 ID 사용
        const nonExistentId = "UC_NON_EXISTENT_CHANNEL_ID_999";
        const result = resolveChannelSaveFolderPath(
          channels,
          nonExistentId,
          defaultFolder
        );
        // 기본 폴더 경로를 반환해야 한다
        expect(result).toBe(defaultFolder);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Validates: Requirements 1.2, 3.1, 3.2, 5.3
   *
   * 여러 채널이 있는 목록에서 특정 채널의 저장 폴더를 올바르게 결정한다
   * - 유효한 saveFolderPath가 있는 채널 → 해당 경로 반환
   * - 무효한 saveFolderPath가 있는 채널 → 기본 폴더 반환
   */
  it("여러 채널 목록에서 각 채널의 저장 폴더를 올바르게 결정한다", () => {
    // 중복 channelId를 제거한 채널 목록 생성기
    // resolveChannelSaveFolderPath는 find()를 사용하므로 중복 ID가 있으면 첫 번째 매칭을 반환
    const uniqueChannelsArb = fc.array(monitoredChannelArbitrary(), { minLength: 1, maxLength: 10 })
      .map((channels) => {
        const seen = new Set<string>();
        return channels.filter((ch) => {
          if (seen.has(ch.channelId)) return false;
          seen.add(ch.channelId);
          return true;
        });
      })
      .filter((channels) => channels.length > 0);
    const defaultFolderArb = fc.stringMatching(/^[A-Za-z0-9/_-]{1,30}$/).filter(
      (s) => s.trim().length > 0
    );

    fc.assert(
      fc.property(uniqueChannelsArb, defaultFolderArb, (channels, defaultFolder) => {
        for (const channel of channels) {
          const result = resolveChannelSaveFolderPath(
            channels,
            channel.channelId,
            defaultFolder
          );

          const trimmedPath = channel.saveFolderPath?.trim();
          if (trimmedPath && trimmedPath.length > 0) {
            // 유효한 경로가 있으면 해당 경로 반환
            expect(result).toBe(trimmedPath);
          } else {
            // 무효한 경로이면 기본 폴더 반환
            expect(result).toBe(defaultFolder);
          }
        }
      }),
      { numRuns: 100 }
    );
  });
});
