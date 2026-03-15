// ============================================================
// YouTubeSummaryApiClient 단위 테스트
// requestFn 모킹을 통한 API 클라이언트 동작 검증
// ============================================================

import { describe, it, expect, vi } from "vitest";
import { YouTubeSummaryApiClient, ApiError, RequestFn } from "./YouTubeSummaryApiClient";

/** 모킹된 requestFn 생성 헬퍼 */
function createMockRequestFn(
  status: number,
  json: unknown
): RequestFn {
  return vi.fn().mockResolvedValue({ status, json });
}

describe("YouTubeSummaryApiClient", () => {
  const API_KEY = "test-api-key-123";

  describe("submitSummarize", () => {
    it("202 응답 시 task_id와 status를 반환한다", async () => {
      const mockFn = createMockRequestFn(202, {
        task_id: "abc-123",
        status: "pending",
      });
      const client = new YouTubeSummaryApiClient(API_KEY, mockFn);

      const result = await client.submitSummarize(
        "https://www.youtube.com/watch?v=test123",
        "ko"
      );

      expect(result.task_id).toBe("abc-123");
      expect(result.status).toBe("pending");
    });

    it("요청에 X-API-Key 헤더가 포함된다", async () => {
      const mockFn = createMockRequestFn(202, {
        task_id: "abc-123",
        status: "pending",
      });
      const client = new YouTubeSummaryApiClient(API_KEY, mockFn);

      await client.submitSummarize("https://www.youtube.com/watch?v=test123", "ko");

      expect(mockFn).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: expect.objectContaining({
            "X-API-Key": API_KEY,
          }),
        })
      );
    });

    it("요청 본문에 url과 target_language가 포함된다", async () => {
      const mockFn = createMockRequestFn(202, {
        task_id: "abc-123",
        status: "pending",
      });
      const client = new YouTubeSummaryApiClient(API_KEY, mockFn);

      await client.submitSummarize("https://www.youtube.com/watch?v=test123", "ko");

      expect(mockFn).toHaveBeenCalledWith(
        expect.objectContaining({
          body: JSON.stringify({
            url: "https://www.youtube.com/watch?v=test123",
            target_language: "ko",
          }),
        })
      );
    });

    it("401 응답 시 ApiError를 throw한다 (인증 오류)", async () => {
      const mockFn = createMockRequestFn(401, {
        error: { code: "INVALID_API_KEY", message: "유효하지 않은 API 키" },
      });
      const client = new YouTubeSummaryApiClient(API_KEY, mockFn);

      await expect(
        client.submitSummarize("https://www.youtube.com/watch?v=test123", "ko")
      ).rejects.toThrow(ApiError);

      try {
        await client.submitSummarize("https://www.youtube.com/watch?v=test123", "ko");
      } catch (e) {
        const err = e as ApiError;
        expect(err.code).toBe("INVALID_API_KEY");
        expect(err.statusCode).toBe(401);
      }
    });

    it("422 응답 시 ApiError를 throw한다 (유효하지 않은 URL)", async () => {
      const mockFn = createMockRequestFn(422, {
        error: { code: "INVALID_URL", message: "유효하지 않은 유튜브 URL입니다" },
      });
      const client = new YouTubeSummaryApiClient(API_KEY, mockFn);

      await expect(
        client.submitSummarize("https://example.com", "ko")
      ).rejects.toThrow(ApiError);

      try {
        await client.submitSummarize("https://example.com", "ko");
      } catch (e) {
        const err = e as ApiError;
        expect(err.code).toBe("INVALID_URL");
        expect(err.statusCode).toBe(422);
      }
    });
  });

  describe("getTaskStatus", () => {
    it("200 응답 시 TaskStatusResponse를 반환한다 (pending)", async () => {
      const mockFn = createMockRequestFn(200, {
        task_id: "abc-123",
        status: "pending",
        result: null,
        error: null,
      });
      const client = new YouTubeSummaryApiClient(API_KEY, mockFn);

      const result = await client.getTaskStatus("abc-123");

      expect(result.task_id).toBe("abc-123");
      expect(result.status).toBe("pending");
      expect(result.result).toBeNull();
    });

    it("200 응답 시 completed 상태와 결과를 반환한다", async () => {
      const mockFn = createMockRequestFn(200, {
        task_id: "abc-123",
        status: "completed",
        result: {
          video_title: "테스트 영상",
          summary: "요약 내용",
          key_points: ["포인트1", "포인트2"],
          original_language: "ko",
          extraction_method: "subtitle",
          translated_text: "번역 텍스트",
        },
        error: null,
      });
      const client = new YouTubeSummaryApiClient(API_KEY, mockFn);

      const result = await client.getTaskStatus("abc-123");

      expect(result.status).toBe("completed");
      expect(result.result?.video_title).toBe("테스트 영상");
      expect(result.result?.key_points).toEqual(["포인트1", "포인트2"]);
    });

    it("요청에 X-API-Key 헤더가 포함된다", async () => {
      const mockFn = createMockRequestFn(200, {
        task_id: "abc-123",
        status: "pending",
        result: null,
        error: null,
      });
      const client = new YouTubeSummaryApiClient(API_KEY, mockFn);

      await client.getTaskStatus("abc-123");

      expect(mockFn).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: expect.objectContaining({
            "X-API-Key": API_KEY,
          }),
        })
      );
    });

    it("404 응답 시 ApiError를 throw한다 (작업 미발견)", async () => {
      const mockFn = createMockRequestFn(404, {
        error: { code: "TASK_NOT_FOUND", message: "작업을 찾을 수 없습니다" },
      });
      const client = new YouTubeSummaryApiClient(API_KEY, mockFn);

      try {
        await client.getTaskStatus("invalid-id");
      } catch (e) {
        const err = e as ApiError;
        expect(err.code).toBe("TASK_NOT_FOUND");
        expect(err.statusCode).toBe(404);
      }
    });

    it("500 응답 시 ApiError를 throw한다 (서버 오류)", async () => {
      const mockFn = createMockRequestFn(500, {
        error: { code: "INTERNAL_ERROR", message: "내부 서버 오류" },
      });
      const client = new YouTubeSummaryApiClient(API_KEY, mockFn);

      try {
        await client.getTaskStatus("abc-123");
      } catch (e) {
        const err = e as ApiError;
        expect(err.code).toBe("INTERNAL_ERROR");
        expect(err.statusCode).toBe(500);
      }
    });

    it("504 응답 시 ApiError를 throw한다 (타임아웃)", async () => {
      const mockFn = createMockRequestFn(504, {
        error: { code: "SERVICE_TIMEOUT", message: "서비스 타임아웃" },
      });
      const client = new YouTubeSummaryApiClient(API_KEY, mockFn);

      try {
        await client.getTaskStatus("abc-123");
      } catch (e) {
        const err = e as ApiError;
        expect(err.code).toBe("SERVICE_TIMEOUT");
        expect(err.statusCode).toBe(504);
      }
    });
  });
});
