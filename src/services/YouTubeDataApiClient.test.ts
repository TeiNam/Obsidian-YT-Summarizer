// ============================================================
// YouTubeDataApiClient 단위 테스트
// RequestFn 모킹을 통한 YouTube Data API v3 클라이언트 동작 검증
// fetchChannelInfo (channels.list) 및 fetchRecentVideos (playlistItems.list)
// ============================================================

import { describe, it, expect, vi } from "vitest";
import { YouTubeDataApiClient, YouTubeDataApiError } from "./YouTubeDataApiClient";
import type { RequestFn } from "./YouTubeSummaryApiClient";

/** 모킹된 requestFn 생성 헬퍼 */
function createMockRequestFn(status: number, json: unknown): RequestFn {
  return vi.fn().mockResolvedValue({ status, json });
}

describe("YouTubeDataApiClient", () => {
  const API_KEY = "test-youtube-data-api-key";

  // ============================================================
  // fetchChannelInfo 테스트
  // ============================================================
  describe("fetchChannelInfo", () => {
    it("성공 시 채널 정보를 반환한다", async () => {
      const mockJson = {
        items: [
          {
            id: "UC_channel_1",
            snippet: {
              title: "테스트 채널",
              thumbnails: { default: { url: "https://example.com/thumb.jpg" } },
              description: "채널 설명",
            },
          },
        ],
      };
      const mockFn = createMockRequestFn(200, mockJson);
      const client = new YouTubeDataApiClient(API_KEY, mockFn);

      const result = await client.fetchChannelInfo("UC_channel_1");

      expect(result.channelId).toBe("UC_channel_1");
      expect(result.title).toBe("테스트 채널");
      expect(result.thumbnailUrl).toBe("https://example.com/thumb.jpg");
      expect(result.description).toBe("채널 설명");
    });

    it("채널 ID가 URL에 포함된다", async () => {
      const mockFn = createMockRequestFn(200, {
        items: [
          {
            id: "UC_test_123",
            snippet: {
              title: "채널",
              thumbnails: { default: { url: "" } },
              description: "",
            },
          },
        ],
      });
      const client = new YouTubeDataApiClient(API_KEY, mockFn);

      await client.fetchChannelInfo("UC_test_123");

      expect(mockFn).toHaveBeenCalledWith(
        expect.objectContaining({
          url: expect.stringContaining("id=UC_test_123"),
        })
      );
    });

    it("@핸들 입력 시 forHandle 파라미터가 URL에 포함된다", async () => {
      const mockFn = createMockRequestFn(200, {
        items: [
          {
            id: "UC_resolved_id",
            snippet: {
              title: "소수몽키",
              thumbnails: { default: { url: "https://example.com/thumb.jpg" } },
              description: "채널 설명",
            },
          },
        ],
      });
      const client = new YouTubeDataApiClient(API_KEY, mockFn);

      const result = await client.fetchChannelInfo("@sosumonkey");

      // forHandle 파라미터 사용 확인
      expect(mockFn).toHaveBeenCalledWith(
        expect.objectContaining({
          url: expect.stringContaining("forHandle=%40sosumonkey"),
        })
      );
      // id 파라미터가 아닌 forHandle 사용 확인
      expect(mockFn).toHaveBeenCalledWith(
        expect.objectContaining({
          url: expect.not.stringContaining("id="),
        })
      );
      // API 응답의 실제 channelId가 반환되는지 확인
      expect(result.channelId).toBe("UC_resolved_id");
      expect(result.title).toBe("소수몽키");
    });

    it("채널을 찾을 수 없으면 404 에러를 throw한다", async () => {
      const mockFn = createMockRequestFn(200, { items: [] });
      const client = new YouTubeDataApiClient(API_KEY, mockFn);

      await expect(client.fetchChannelInfo("UC_nonexistent")).rejects.toThrow(
        YouTubeDataApiError
      );

      try {
        await client.fetchChannelInfo("UC_nonexistent");
      } catch (e) {
        const err = e as YouTubeDataApiError;
        expect(err.statusCode).toBe(404);
      }
    });

    it("items 필드가 없으면 404 에러를 throw한다", async () => {
      const mockFn = createMockRequestFn(200, {});
      const client = new YouTubeDataApiClient(API_KEY, mockFn);

      await expect(client.fetchChannelInfo("UC_test")).rejects.toThrow(
        YouTubeDataApiError
      );
    });
  });

  // ============================================================
  // fetchRecentVideos 테스트
  // ============================================================
  describe("fetchRecentVideos", () => {
    it("성공 시 영상 목록을 반환한다", async () => {
      const mockJson = {
        items: [
          {
            snippet: {
              resourceId: { videoId: "vid_001" },
              title: "영상 제목 1",
              channelId: "UC_ch_1",
              channelTitle: "채널 A",
              publishedAt: "2024-01-15T10:00:00Z",
              thumbnails: { default: { url: "https://example.com/vid1.jpg" } },
            },
          },
          {
            snippet: {
              resourceId: { videoId: "vid_002" },
              title: "영상 제목 2",
              channelId: "UC_ch_1",
              channelTitle: "채널 A",
              publishedAt: "2024-01-14T08:00:00Z",
              thumbnails: { default: { url: "https://example.com/vid2.jpg" } },
            },
          },
        ],
        nextPageToken: null,
      };
      const mockFn = createMockRequestFn(200, mockJson);
      const client = new YouTubeDataApiClient(API_KEY, mockFn);

      const result = await client.fetchRecentVideos("UU_ch_1");

      expect(result.items).toHaveLength(2);
      expect(result.items[0].videoId).toBe("vid_001");
      expect(result.items[0].title).toBe("영상 제목 1");
      expect(result.items[0].channelId).toBe("UC_ch_1");
      expect(result.items[0].channelTitle).toBe("채널 A");
      expect(result.items[0].publishedAt).toBe("2024-01-15T10:00:00Z");
      expect(result.items[0].thumbnailUrl).toBe("https://example.com/vid1.jpg");
      expect(result.nextPageToken).toBeNull();
    });
  });

  // ============================================================
  // 오류 처리 테스트
  // ============================================================
  describe("오류 처리", () => {
    it("403 응답 시 YouTubeDataApiError를 throw한다", async () => {
      const mockFn = createMockRequestFn(403, {
        error: {
          message: "API Key가 유효하지 않습니다",
          errors: [{ reason: "forbidden" }],
        },
      });
      const client = new YouTubeDataApiClient(API_KEY, mockFn);

      await expect(client.fetchChannelInfo("UC_test")).rejects.toThrow(
        YouTubeDataApiError
      );

      try {
        await client.fetchChannelInfo("UC_test");
      } catch (e) {
        const err = e as YouTubeDataApiError;
        expect(err.statusCode).toBe(403);
        expect(err.message).toBe("API Key가 유효하지 않습니다");
      }
    });

    it("429 응답 시 YouTubeDataApiError를 throw한다", async () => {
      const mockFn = createMockRequestFn(429, {
        error: {
          message: "API 요청 한도를 초과했습니다. 잠시 후 다시 시도해주세요",
          errors: [{ reason: "rateLimitExceeded" }],
        },
      });
      const client = new YouTubeDataApiClient(API_KEY, mockFn);

      await expect(client.fetchRecentVideos("UU_test")).rejects.toThrow(
        YouTubeDataApiError
      );

      try {
        await client.fetchRecentVideos("UU_test");
      } catch (e) {
        const err = e as YouTubeDataApiError;
        expect(err.statusCode).toBe(429);
        expect(err.message).toContain("한도를 초과");
      }
    });

    it("기타 HTTP 오류 시 YouTubeDataApiError를 throw한다", async () => {
      const mockFn = createMockRequestFn(500, {
        error: {
          message: "Internal Server Error",
          errors: [{ reason: "backendError" }],
        },
      });
      const client = new YouTubeDataApiClient(API_KEY, mockFn);

      await expect(client.fetchChannelInfo("UC_test")).rejects.toThrow(
        YouTubeDataApiError
      );
    });

    it("네트워크 오류 시 예외가 전파된다", async () => {
      const networkError = new Error("Network request failed");
      const mockFn = vi.fn().mockRejectedValue(networkError);
      const client = new YouTubeDataApiClient(API_KEY, mockFn);

      await expect(client.fetchChannelInfo("UC_test")).rejects.toThrow(
        "Network request failed"
      );
    });
  });
});
