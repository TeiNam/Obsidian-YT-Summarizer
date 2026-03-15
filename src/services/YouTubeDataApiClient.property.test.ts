// ============================================================
// YouTubeDataApiClient 속성 기반 테스트 (Property-Based Test)
// fast-check 라이브러리를 사용한 fetchChannelInfo 응답 파싱 검증
// ============================================================

import { describe, it, expect, vi } from "vitest";
import * as fc from "fast-check";
import { YouTubeDataApiClient, YouTubeDataApiError } from "./YouTubeDataApiClient";
import type { RequestFn } from "./YouTubeSummaryApiClient";

describe("Feature: youtube-subscription-feed, Property: fetchChannelInfo 응답 파싱", () => {
  /**
   * 랜덤 채널 정보로 channels.list 응답을 생성하고,
   * fetchChannelInfo가 정확히 파싱하여 반환하는지 검증
   */
  it("랜덤 채널 정보가 포함된 API 응답을 정확히 파싱한다", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          channelId: fc.stringMatching(/^UC[A-Za-z0-9]{1,20}$/),
          title: fc.string({ minLength: 1, maxLength: 100 }),
          thumbnailUrl: fc.webUrl(),
          description: fc.string({ minLength: 0, maxLength: 200 }),
        }),
        async (channelData) => {
          // channels.list API 응답 모킹
          const mockJson = {
            items: [
              {
                id: channelData.channelId,
                snippet: {
                  title: channelData.title,
                  thumbnails: { default: { url: channelData.thumbnailUrl } },
                  description: channelData.description,
                },
              },
            ],
          };
          const mockFn = vi.fn().mockResolvedValue({
            status: 200,
            json: mockJson,
          }) as unknown as RequestFn;

          const client = new YouTubeDataApiClient("test-key", mockFn);
          const result = await client.fetchChannelInfo(channelData.channelId);

          // 파싱 결과가 원본 데이터와 일치해야 한다
          expect(result.channelId).toBe(channelData.channelId);
          expect(result.title).toBe(channelData.title);
          expect(result.thumbnailUrl).toBe(channelData.thumbnailUrl);
          expect(result.description).toBe(channelData.description);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * items 배열이 비어있는 응답에 대해 항상 404 에러를 throw하는지 검증
   */
  it("items가 비어있으면 항상 404 에러를 throw한다", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.stringMatching(/^UC[A-Za-z0-9]{1,20}$/),
        async (channelId) => {
          const mockFn = vi.fn().mockResolvedValue({
            status: 200,
            json: { items: [] },
          }) as unknown as RequestFn;

          const client = new YouTubeDataApiClient("test-key", mockFn);

          try {
            await client.fetchChannelInfo(channelId);
            // 여기에 도달하면 안 됨
            expect(true).toBe(false);
          } catch (e) {
            const err = e as YouTubeDataApiError;
            expect(err).toBeInstanceOf(YouTubeDataApiError);
            expect(err.statusCode).toBe(404);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
