// ============================================================
// SubscriptionManager 속성 기반 테스트 (Property-Based Test)
// fast-check 라이브러리를 사용한 구독 관리 로직 검증
// - Property 9: Uploads 플레이리스트 ID 도출
// - Property 5: 채널별 영상 그룹화
// - Property 1: API 응답 무필터 반환 (latest-videos-feed)
// ============================================================

import { describe, it, expect, vi } from "vitest";
import * as fc from "fast-check";
import { SubscriptionManager } from "./SubscriptionManager";
import type { YouTubeDataApiClient } from "./YouTubeDataApiClient";
import type { VideoItem, PluginSettings, ChannelVideos, MonitoredChannel, PlaylistItemsResponse } from "../models/types";
import { DEFAULT_SETTINGS } from "../models/types";

/**
 * 모킹된 YouTubeDataApiClient 생성 헬퍼
 * SubscriptionManager 인스턴스 생성에 필요한 최소한의 모킹
 */
function createMockApiClient(): YouTubeDataApiClient {
  return {
    fetchChannelInfo: vi.fn(),
    fetchRecentVideos: vi.fn(),
  } as unknown as YouTubeDataApiClient;
}

/**
 * 테스트용 PluginSettings 생성 헬퍼
 */
function createTestSettings(overrides?: Partial<PluginSettings>): PluginSettings {
  return { ...DEFAULT_SETTINGS, ...overrides };
}

/**
 * 랜덤 VideoItem 생성기
 * channelId를 외부에서 지정할 수 있도록 파라미터화
 */
function videoItemArbitrary(channelIdArb?: fc.Arbitrary<string>): fc.Arbitrary<VideoItem> {
  return fc.record({
    videoId: fc.string({ minLength: 1, maxLength: 20 }),
    title: fc.string({ minLength: 1, maxLength: 100 }),
    channelId: channelIdArb ?? fc.string({ minLength: 1, maxLength: 30 }),
    channelTitle: fc.string({ minLength: 1, maxLength: 100 }),
    // 유효한 ISO 8601 날짜 문자열 생성
    publishedAt: fc.date({
      min: new Date("2020-01-01T00:00:00Z"),
      max: new Date("2030-12-31T23:59:59Z"),
    }).map((d) => d.toISOString()),
    thumbnailUrl: fc.constant("https://example.com/thumb.jpg"),
  });
}

// ============================================================
// Property 9: Uploads 플레이리스트 ID 도출
// ============================================================

describe("Feature: youtube-subscription-feed, Property 9: Uploads 플레이리스트 ID 도출", () => {
  /**
   * Validates: Requirements 5.1
   *
   * 랜덤 "UC" 접두사 채널 ID로 getUploadsPlaylistId가
   * "UU"로 시작하고 나머지가 동일한 문자열을 반환하는지 검증
   */
  it("UC 접두사 채널 ID를 변환하면 UU 접두사로 시작하고 나머지 부분이 동일하다", () => {
    const mockClient = createMockApiClient();
    const settings = createTestSettings();
    const manager = new SubscriptionManager(mockClient, settings);

    // "UC" 접두사 + 랜덤 문자열로 채널 ID 생성
    const channelIdArbitrary = fc
      .string({ minLength: 1, maxLength: 50 })
      .map((suffix) => `UC${suffix}`);

    fc.assert(
      fc.property(channelIdArbitrary, (channelId) => {
        const result = manager.getUploadsPlaylistId(channelId);

        // 결과가 "UU"로 시작해야 한다
        expect(result.startsWith("UU")).toBe(true);

        // "UC" 이후의 나머지 부분이 동일해야 한다
        const originalSuffix = channelId.slice(2);
        const resultSuffix = result.slice(2);
        expect(resultSuffix).toBe(originalSuffix);

        // 결과 길이가 원본과 동일해야 한다
        expect(result.length).toBe(channelId.length);
      }),
      { numRuns: 100 } // 최소 100회 반복
    );
  });
});

// ============================================================
// Property 5: 채널별 영상 그룹화
// ============================================================

/**
 * 영상 목록을 channelId별로 그룹화하는 순수 헬퍼 함수
 * SubscriptionManager.fetchNewVideos의 그룹화 로직을 추출하여 테스트
 */
function groupVideosByChannel(videos: VideoItem[]): ChannelVideos[] {
  const channelMap = new Map<string, { channelTitle: string; videos: VideoItem[] }>();

  for (const video of videos) {
    const existing = channelMap.get(video.channelId);
    if (existing) {
      existing.videos.push(video);
    } else {
      channelMap.set(video.channelId, {
        channelTitle: video.channelTitle,
        videos: [video],
      });
    }
  }

  return Array.from(channelMap.entries()).map(([channelId, data]) => ({
    channelId,
    channelTitle: data.channelTitle,
    videos: data.videos,
  }));
}

describe("Feature: youtube-subscription-feed, Property 5: 채널별 영상 그룹화", () => {
  /**
   * Validates: Requirements 6.1
   *
   * 랜덤 영상 목록으로 그룹화 결과의 각 그룹 내 영상이
   * 동일한 channelId를 가지며, 총 영상 수가 보존되는지 검증
   */
  it("그룹화 결과의 각 그룹 내 영상은 동일한 channelId를 가지며 총 영상 수가 보존된다", () => {
    // 다양한 channelId를 가진 영상 목록 생성기
    const channelIdArbitrary = fc.constantFrom(
      "UC_ch_001", "UC_ch_002", "UC_ch_003", "UC_ch_004", "UC_ch_005"
    );

    fc.assert(
      fc.property(
        fc.array(videoItemArbitrary(channelIdArbitrary), { minLength: 0, maxLength: 50 }),
        (videos) => {
          const groups = groupVideosByChannel(videos);

          // 속성 1: 각 그룹 내 모든 영상은 동일한 channelId를 가져야 한다
          for (const group of groups) {
            for (const video of group.videos) {
              expect(video.channelId).toBe(group.channelId);
            }
          }

          // 속성 2: 그룹화 전후의 총 영상 수가 동일해야 한다
          const totalGroupedVideos = groups.reduce(
            (sum, group) => sum + group.videos.length,
            0
          );
          expect(totalGroupedVideos).toBe(videos.length);

          // 속성 3: 그룹의 channelId는 중복이 없어야 한다
          const groupChannelIds = groups.map((g) => g.channelId);
          const uniqueGroupIds = new Set(groupChannelIds);
          expect(uniqueGroupIds.size).toBe(groups.length);
        }
      ),
      { numRuns: 100 } // 최소 100회 반복
    );
  });
});


// ============================================================
// Property 1: API 응답 무필터 반환 (latest-videos-feed)
// ============================================================

/**
 * 랜덤 MonitoredChannel 생성기
 * 고유한 채널 ID를 가진 모니터링 채널 생성
 */
function monitoredChannelArbitrary(channelId: string): fc.Arbitrary<MonitoredChannel> {
  return fc.record({
    channelId: fc.constant(channelId),
    channelTitle: fc.string({ minLength: 1, maxLength: 50 }),
    thumbnailUrl: fc.constant("https://example.com/thumb.jpg"),
  });
}

describe("Feature: latest-videos-feed, Property 1: API 응답 무필터 반환", () => {
  /**
   * Validates: Requirements 1.1, 1.2, 2.2, 2.3
   *
   * 랜덤 모니터링 채널 목록과 videosPerChannel 값에 대해,
   * fetchNewVideos()가 반환하는 각 채널의 영상 목록은
   * API 클라이언트가 반환한 영상 목록과 정확히 동일해야 한다
   * (필터링이나 누락 없이).
   */
  it("fetchNewVideos()는 API 클라이언트가 반환한 영상을 필터링 없이 그대로 반환한다", async () => {
    await fc.assert(
      fc.asyncProperty(
        // 1~5개의 고유 채널 ID 생성
        fc.array(
          fc.string({ minLength: 3, maxLength: 20 }).map((s) => `UC${s}`),
          { minLength: 1, maxLength: 5 }
        ).chain((channelIds) => {
          // 중복 제거
          const uniqueIds = [...new Set(channelIds)];
          // 각 채널에 대해 모니터링 채널과 해당 영상 목록을 함께 생성
          return fc.tuple(
            // 모니터링 채널 목록
            fc.tuple(
              ...uniqueIds.map((id) => monitoredChannelArbitrary(id))
            ),
            // 각 채널에 대한 영상 목록 (0~5개)
            fc.tuple(
              ...uniqueIds.map((id) =>
                fc.array(videoItemArbitrary(fc.constant(id)), {
                  minLength: 0,
                  maxLength: 5,
                })
              )
            ),
            // videosPerChannel 값 (1~10)
            fc.integer({ min: 1, max: 10 })
          );
        }),
        async ([channels, videoLists, videosPerChannel]) => {
          const mockClient = createMockApiClient();
          const monitoredChannels = channels as unknown as MonitoredChannel[];

          // 각 채널에 대해 API 클라이언트가 반환할 영상 목록 설정
          const expectedByChannel = new Map<string, VideoItem[]>();
          const fetchRecentVideosMock = mockClient.fetchRecentVideos as ReturnType<typeof vi.fn>;

          for (let i = 0; i < monitoredChannels.length; i++) {
            const channel = monitoredChannels[i];
            const videos = videoLists[i] as VideoItem[];
            expectedByChannel.set(channel.channelId, videos);
          }

          // fetchRecentVideos 모킹: playlistId에서 채널 ID를 역추출하여 해당 영상 반환
          fetchRecentVideosMock.mockImplementation(
            async (playlistId: string, _maxResults: number): Promise<PlaylistItemsResponse> => {
              // playlistId "UUxxx" → channelId "UCxxx"
              const channelId = "UC" + playlistId.slice(2);
              const videos = expectedByChannel.get(channelId) ?? [];
              return { items: videos, nextPageToken: null };
            }
          );

          const settings = createTestSettings({
            monitoredChannels,
            videosPerChannel,
          });
          const manager = new SubscriptionManager(mockClient, settings);

          // fetchNewVideos 호출
          const results = await manager.fetchNewVideos();

          // 검증: 각 결과 채널의 영상 목록이 API 응답과 정확히 동일한지 확인
          for (const result of results) {
            const expected = expectedByChannel.get(result.channelId) ?? [];
            // 영상 목록이 정확히 동일해야 한다 (필터링이나 누락 없이)
            expect(result.videos).toEqual(expected);
          }

          // 검증: 영상이 있는 채널은 모두 결과에 포함되어야 한다
          for (const [channelId, videos] of expectedByChannel) {
            if (videos.length > 0) {
              const found = results.find((r) => r.channelId === channelId);
              expect(found).toBeDefined();
            }
          }

          // 검증: 영상이 없는 채널은 결과에 포함되지 않아야 한다
          for (const result of results) {
            const expected = expectedByChannel.get(result.channelId) ?? [];
            expect(expected.length).toBeGreaterThan(0);
          }
        }
      ),
      { numRuns: 100 } // 최소 100회 반복
    );
  });
});


// ============================================================
// Property 2: maxResults에 videosPerChannel 전달 (latest-videos-feed)
// ============================================================

describe("Feature: latest-videos-feed, Property 2: maxResults에 videosPerChannel 전달", () => {
  /**
   * Validates: Requirements 1.3, 3.3
   *
   * 1~10 범위의 랜덤 videosPerChannel 값에 대해,
   * fetchNewVideos() 실행 시 각 채널의 fetchRecentVideos() 호출에
   * 전달되는 maxResults 인자는 settings.videosPerChannel 값과
   * 정확히 일치해야 한다.
   */
  it("fetchNewVideos() 호출 시 각 채널의 fetchRecentVideos에 전달되는 maxResults는 videosPerChannel과 정확히 일치한다", async () => {
    await fc.assert(
      fc.asyncProperty(
        // 1~10 범위의 랜덤 videosPerChannel 값
        fc.integer({ min: 1, max: 10 }),
        // 1~5개의 고유 채널 ID 생성
        fc.array(
          fc.string({ minLength: 3, maxLength: 20 }).map((s) => `UC${s}`),
          { minLength: 1, maxLength: 5 }
        ).map((ids) => [...new Set(ids)]).filter((ids) => ids.length >= 1),
        async (videosPerChannel, uniqueChannelIds) => {
          const mockClient = createMockApiClient();
          const fetchRecentVideosMock = mockClient.fetchRecentVideos as ReturnType<typeof vi.fn>;

          // 각 채널에 대해 빈 응답 반환 (영상 내용은 이 테스트에서 중요하지 않음)
          fetchRecentVideosMock.mockResolvedValue({
            items: [],
            nextPageToken: null,
          } as PlaylistItemsResponse);

          // 모니터링 채널 목록 생성
          const monitoredChannels: MonitoredChannel[] = uniqueChannelIds.map((id) => ({
            channelId: id,
            channelTitle: `Channel ${id}`,
            thumbnailUrl: "https://example.com/thumb.jpg",
          }));

          const settings = createTestSettings({
            monitoredChannels,
            videosPerChannel,
          });
          const manager = new SubscriptionManager(mockClient, settings);

          // fetchNewVideos 호출
          await manager.fetchNewVideos();

          // 검증: fetchRecentVideos가 각 채널에 대해 호출되었는지 확인
          expect(fetchRecentVideosMock).toHaveBeenCalledTimes(uniqueChannelIds.length);

          // 검증: 각 호출의 두 번째 인자(maxResults)가 videosPerChannel과 정확히 일치하는지 확인
          for (let i = 0; i < fetchRecentVideosMock.mock.calls.length; i++) {
            const callArgs = fetchRecentVideosMock.mock.calls[i];
            const passedMaxResults = callArgs[1];
            expect(passedMaxResults).toBe(videosPerChannel);
          }
        }
      ),
      { numRuns: 100 } // 최소 100회 반복
    );
  });
});


// ============================================================
// Property 4: 개별 채널 실패 시 격리 (latest-videos-feed)
// ============================================================

describe("Feature: latest-videos-feed, Property 4: 개별 채널 실패 시 격리", () => {
  /**
   * Validates: Requirements 5.4
   *
   * 랜덤 모니터링 채널 목록에서 일부 채널의 API 호출이 실패하더라도,
   * 성공한 채널의 영상은 모두 결과에 포함되어야 하며,
   * 실패한 채널은 결과에서 제외되어야 한다.
   */
  it("일부 채널의 API 호출이 실패해도 성공한 채널의 영상은 모두 결과에 포함되고, 실패한 채널은 제외된다", async () => {
    await fc.assert(
      fc.asyncProperty(
        // 2~5개의 고유 채널 ID 생성
        fc.array(
          fc.string({ minLength: 3, maxLength: 20 }).map((s) => `UC${s}`),
          { minLength: 2, maxLength: 5 }
        )
          .map((ids) => [...new Set(ids)])
          .filter((ids) => ids.length >= 2)
          .chain((uniqueIds) => {
            return fc.tuple(
              // 모니터링 채널 목록
              fc.tuple(
                ...uniqueIds.map((id) => monitoredChannelArbitrary(id))
              ),
              // 각 채널에 대한 영상 목록 (1~3개, 성공 시 반환할 영상)
              fc.tuple(
                ...uniqueIds.map((id) =>
                  fc.array(videoItemArbitrary(fc.constant(id)), {
                    minLength: 1,
                    maxLength: 3,
                  })
                )
              ),
              // 각 채널의 성공/실패 여부 (true=성공, false=실패)
              fc.tuple(
                ...uniqueIds.map(() => fc.boolean())
              ),
              // videosPerChannel 값 (1~10)
              fc.integer({ min: 1, max: 10 })
            );
          }),
        async ([channels, videoLists, successFlags, videosPerChannel]) => {
          const mockClient = createMockApiClient();
          const monitoredChannels = channels as unknown as MonitoredChannel[];
          const fetchRecentVideosMock = mockClient.fetchRecentVideos as ReturnType<typeof vi.fn>;

          // 채널별 예상 결과 맵 구성
          const expectedSuccessChannels = new Map<string, VideoItem[]>();
          const failedChannelIds = new Set<string>();

          for (let i = 0; i < monitoredChannels.length; i++) {
            const channel = monitoredChannels[i];
            const isSuccess = (successFlags as unknown as boolean[])[i];
            if (isSuccess) {
              expectedSuccessChannels.set(
                channel.channelId,
                (videoLists as unknown as VideoItem[][])[i]
              );
            } else {
              failedChannelIds.add(channel.channelId);
            }
          }

          // fetchRecentVideos 모킹: 성공 채널은 영상 반환, 실패 채널은 에러 throw
          fetchRecentVideosMock.mockImplementation(
            async (playlistId: string, _maxResults: number): Promise<PlaylistItemsResponse> => {
              // playlistId "UUxxx" → channelId "UCxxx"
              const channelId = "UC" + playlistId.slice(2);
              if (failedChannelIds.has(channelId)) {
                throw new Error(`API 호출 실패: ${channelId}`);
              }
              const videos = expectedSuccessChannels.get(channelId) ?? [];
              return { items: videos, nextPageToken: null };
            }
          );

          const settings = createTestSettings({
            monitoredChannels,
            videosPerChannel,
          });
          const manager = new SubscriptionManager(mockClient, settings);

          // fetchNewVideos 호출
          const results = await manager.fetchNewVideos();

          // 검증 1: 성공한 채널의 영상은 모두 결과에 포함되어야 한다
          for (const [channelId, expectedVideos] of expectedSuccessChannels) {
            if (expectedVideos.length > 0) {
              const found = results.find((r) => r.channelId === channelId);
              expect(found).toBeDefined();
              // 성공한 채널의 영상 내용이 API 응답과 동일해야 한다
              expect(found!.videos).toEqual(expectedVideos);
            }
          }

          // 검증 2: 실패한 채널은 결과에서 제외되어야 한다
          for (const channelId of failedChannelIds) {
            const found = results.find((r) => r.channelId === channelId);
            expect(found).toBeUndefined();
          }

          // 검증 3: 결과에 포함된 채널은 모두 성공한 채널이어야 한다
          for (const result of results) {
            expect(failedChannelIds.has(result.channelId)).toBe(false);
            expect(expectedSuccessChannels.has(result.channelId)).toBe(true);
          }
        }
      ),
      { numRuns: 100 } // 최소 100회 반복
    );
  });
});
