// ============================================================
// SubscriptionManager 단위 테스트
// 모니터링 대상 채널의 최신 영상 조회 및 관리 로직 검증
// YouTubeDataApiClient를 vi.fn()으로 모킹하여 테스트
// ============================================================

import { describe, it, expect, vi } from "vitest";
import { SubscriptionManager } from "./SubscriptionManager";
import type { YouTubeDataApiClient } from "./YouTubeDataApiClient";
import type { PluginSettings, VideoItem } from "../models/types";
import { DEFAULT_SETTINGS } from "../models/types";

/**
 * 모킹된 YouTubeDataApiClient 생성 헬퍼
 */
function createMockApiClient(): {
  fetchChannelInfo: ReturnType<typeof vi.fn>;
  fetchRecentVideos: ReturnType<typeof vi.fn>;
} & YouTubeDataApiClient {
  return {
    fetchChannelInfo: vi.fn(),
    fetchRecentVideos: vi.fn(),
  } as unknown as YouTubeDataApiClient & {
    fetchChannelInfo: ReturnType<typeof vi.fn>;
    fetchRecentVideos: ReturnType<typeof vi.fn>;
  };
}

/**
 * 테스트용 PluginSettings 생성 헬퍼
 */
function createTestSettings(overrides?: Partial<PluginSettings>): PluginSettings {
  return { ...DEFAULT_SETTINGS, ...overrides };
}

/**
 * 테스트용 VideoItem 생성 헬퍼
 */
function createVideoItem(overrides?: Partial<VideoItem>): VideoItem {
  return {
    videoId: "vid_001",
    title: "테스트 영상",
    channelId: "UC_ch_1",
    channelTitle: "테스트 채널",
    publishedAt: "2024-06-15T10:00:00Z",
    thumbnailUrl: "https://example.com/thumb.jpg",
    ...overrides,
  };
}

describe("SubscriptionManager", () => {
  // ============================================================
  // fetchNewVideos 테스트
  // ============================================================
  describe("fetchNewVideos", () => {
    // 테스트 1: 빈 모니터링 채널 목록일 때 빈 배열을 반환한다
    it("빈 모니터링 채널 목록일 때 빈 배열을 반환한다", async () => {
      const mockClient = createMockApiClient();
      const settings = createTestSettings({ monitoredChannels: [] });
      const manager = new SubscriptionManager(mockClient, settings);

      const result = await manager.fetchNewVideos();

      expect(result).toEqual([]);
      // API 클라이언트가 호출되지 않아야 한다
      expect(mockClient.fetchRecentVideos).not.toHaveBeenCalled();
    });

    // 테스트 2: API가 빈 영상 목록을 반환하면 빈 배열을 반환한다
    it("API가 빈 영상 목록을 반환하면 빈 배열을 반환한다", async () => {
      const mockClient = createMockApiClient();
      const settings = createTestSettings({
        monitoredChannels: [
          { channelId: "UC_ch_1", channelTitle: "채널 A", thumbnailUrl: "https://example.com/a.jpg" },
        ],
      });
      const manager = new SubscriptionManager(mockClient, settings);

      mockClient.fetchRecentVideos.mockResolvedValue({
        items: [],
        nextPageToken: null,
      });

      const result = await manager.fetchNewVideos();

      expect(result).toEqual([]);
    });

    // 테스트 3: 영상이 있는 경우 채널별로 그룹화하여 반환한다
    it("영상이 있는 경우 채널별로 그룹화하여 반환한다", async () => {
      const mockClient = createMockApiClient();
      const settings = createTestSettings({
        monitoredChannels: [
          { channelId: "UC_ch_1", channelTitle: "채널 A", thumbnailUrl: "https://example.com/a.jpg" },
          { channelId: "UC_ch_2", channelTitle: "채널 B", thumbnailUrl: "https://example.com/b.jpg" },
        ],
      });
      const manager = new SubscriptionManager(mockClient, settings);

      // 채널 A: 영상 2개
      mockClient.fetchRecentVideos.mockResolvedValueOnce({
        items: [
          createVideoItem({ videoId: "vid_a1", channelId: "UC_ch_1", channelTitle: "채널 A", publishedAt: "2024-06-15T10:00:00Z" }),
          createVideoItem({ videoId: "vid_a2", channelId: "UC_ch_1", channelTitle: "채널 A", publishedAt: "2024-06-10T10:00:00Z" }),
        ],
        nextPageToken: null,
      });

      // 채널 B: 영상 1개
      mockClient.fetchRecentVideos.mockResolvedValueOnce({
        items: [
          createVideoItem({ videoId: "vid_b1", channelId: "UC_ch_2", channelTitle: "채널 B", publishedAt: "2024-06-20T10:00:00Z" }),
        ],
        nextPageToken: null,
      });

      const result = await manager.fetchNewVideos();

      // 두 채널 모두 결과에 포함되어야 한다
      expect(result).toHaveLength(2);

      // 채널 A 그룹 검증
      const channelA = result.find((r) => r.channelId === "UC_ch_1");
      expect(channelA).toBeDefined();
      expect(channelA!.channelTitle).toBe("채널 A");
      expect(channelA!.videos).toHaveLength(2);

      // 채널 B 그룹 검증
      const channelB = result.find((r) => r.channelId === "UC_ch_2");
      expect(channelB).toBeDefined();
      expect(channelB!.channelTitle).toBe("채널 B");
      expect(channelB!.videos).toHaveLength(1);
    });

    // 테스트 4: 개별 채널 조회 실패 시 해당 채널만 건너뛰고 나머지 채널은 정상 처리한다
    it("개별 채널 조회 실패 시 해당 채널만 건너뛰고 나머지 채널은 정상 처리한다", async () => {
      const mockClient = createMockApiClient();
      const settings = createTestSettings({
        monitoredChannels: [
          { channelId: "UC_fail", channelTitle: "실패 채널", thumbnailUrl: "https://example.com/fail.jpg" },
          { channelId: "UC_ok", channelTitle: "정상 채널", thumbnailUrl: "https://example.com/ok.jpg" },
        ],
      });
      const manager = new SubscriptionManager(mockClient, settings);

      // 첫 번째 채널: API 오류 발생
      mockClient.fetchRecentVideos.mockRejectedValueOnce(new Error("API 오류"));

      // 두 번째 채널: 정상 응답
      mockClient.fetchRecentVideos.mockResolvedValueOnce({
        items: [
          createVideoItem({ videoId: "vid_ok", channelId: "UC_ok", channelTitle: "정상 채널", publishedAt: "2024-06-15T10:00:00Z" }),
        ],
        nextPageToken: null,
      });

      const result = await manager.fetchNewVideos();

      // 실패한 채널은 건너뛰고 정상 채널만 결과에 포함
      expect(result).toHaveLength(1);
      expect(result[0].channelId).toBe("UC_ok");
      expect(result[0].videos).toHaveLength(1);
    });
  });

  // ============================================================
  // videosPerChannel 기반 동작 테스트
  // ============================================================
  describe("videosPerChannel 기반 동작", () => {
    // 테스트 5: videosPerChannel 값이 fetchRecentVideos의 maxResults로 전달된다
    it("videosPerChannel 값이 fetchRecentVideos의 maxResults로 전달된다", async () => {
      const mockClient = createMockApiClient();
      const settings = createTestSettings({
        monitoredChannels: [
          { channelId: "UC_ch_1", channelTitle: "채널 A", thumbnailUrl: "https://example.com/a.jpg" },
        ],
        videosPerChannel: 7,
      });
      const manager = new SubscriptionManager(mockClient, settings);

      mockClient.fetchRecentVideos.mockResolvedValue({
        items: [createVideoItem()],
        nextPageToken: null,
      });

      await manager.fetchNewVideos();

      // fetchRecentVideos 호출 시 maxResults로 videosPerChannel(7)이 전달되어야 한다
      expect(mockClient.fetchRecentVideos).toHaveBeenCalledWith(
        "UU_ch_1", // Uploads 플레이리스트 ID
        7,
      );
    });

    // 테스트 6: 기본값 6으로 동작한다
    it("기본값 6으로 동작한다", async () => {
      const mockClient = createMockApiClient();
      // videosPerChannel을 명시하지 않아 DEFAULT_SETTINGS의 기본값(6) 사용
      const settings = createTestSettings({
        monitoredChannels: [
          { channelId: "UC_ch_1", channelTitle: "채널 A", thumbnailUrl: "https://example.com/a.jpg" },
        ],
      });
      const manager = new SubscriptionManager(mockClient, settings);

      mockClient.fetchRecentVideos.mockResolvedValue({
        items: [createVideoItem()],
        nextPageToken: null,
      });

      await manager.fetchNewVideos();

      // 기본값 6이 maxResults로 전달되어야 한다
      expect(mockClient.fetchRecentVideos).toHaveBeenCalledWith(
        "UU_ch_1",
        6,
      );
    });
  });
});
