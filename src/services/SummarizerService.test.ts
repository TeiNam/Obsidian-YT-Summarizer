// ============================================================
// SummarizerService 단위 테스트
// API 클라이언트 모킹을 통한 요약 오케스트레이션 검증
// ============================================================

import { describe, it, expect, vi, beforeEach } from "vitest";
import { TFile } from "obsidian";
import { SummarizerService } from "./SummarizerService";
import { SummaryStage } from "../models/types";
import type { YouTubeSummaryApiClient } from "./YouTubeSummaryApiClient";
import type { NoteCreator } from "./NoteCreator";

// sleep을 즉시 resolve하도록 모킹
vi.mock("timers", () => ({}));

// 완료된 API 결과 데이터
const completedResult = {
  video_title: "테스트 영상 제목",
  summary: "AI가 생성한 요약 내용입니다.",
  key_points: ["포인트1", "포인트2", "포인트3"],
  original_language: "ko",
  extraction_method: "subtitle" as const,
  translated_text: "번역된 텍스트",
};

function createMockApiClient(): YouTubeSummaryApiClient {
  return {
    submitSummarize: vi.fn().mockResolvedValue({
      task_id: "task-123",
      status: "pending",
    }),
    getTaskStatus: vi.fn()
      .mockResolvedValueOnce({
        task_id: "task-123",
        status: "extracting",
        result: null,
        error: null,
      })
      .mockResolvedValueOnce({
        task_id: "task-123",
        status: "summarizing",
        result: null,
        error: null,
      })
      .mockResolvedValueOnce({
        task_id: "task-123",
        status: "completed",
        result: completedResult,
        error: null,
      }),
  } as unknown as YouTubeSummaryApiClient;
}

function createMockNoteCreator(): NoteCreator {
  return {
    createNote: vi.fn().mockResolvedValue(
      { path: "YouTube Summaries/테스트 영상 제목.md" } as TFile
    ),
  } as unknown as NoteCreator;
}

describe("SummarizerService", () => {
  let apiClient: YouTubeSummaryApiClient;
  let noteCreator: NoteCreator;
  let service: SummarizerService;
  let onProgress: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    apiClient = createMockApiClient();
    noteCreator = createMockNoteCreator();
    service = new SummarizerService(apiClient, noteCreator);
    onProgress = vi.fn();

    // sleep을 즉시 resolve하도록 private 메서드 모킹
    (service as any).sleep = vi.fn().mockResolvedValue(undefined);
  });

  describe("정상 플로우", () => {
    it("submitSummarize → 폴링 → 노트 생성 순서로 진행한다", async () => {
      const result = await service.summarize(
        "https://www.youtube.com/watch?v=abc123",
        "ko",
        onProgress
      );

      expect(result).toHaveProperty("path");
      expect(apiClient.submitSummarize).toHaveBeenCalledWith(
        "https://www.youtube.com/watch?v=abc123",
        "ko"
      );
      expect(apiClient.getTaskStatus).toHaveBeenCalledWith("task-123");
      expect(apiClient.getTaskStatus).toHaveBeenCalledTimes(3);
    });

    it("상태 변경 시 onProgress 콜백이 호출된다", async () => {
      await service.summarize(
        "https://www.youtube.com/watch?v=abc123",
        "ko",
        onProgress
      );

      expect(onProgress).toHaveBeenCalledWith(SummaryStage.PENDING);
      expect(onProgress).toHaveBeenCalledWith(SummaryStage.EXTRACTING);
      expect(onProgress).toHaveBeenCalledWith(SummaryStage.SUMMARIZING);
      expect(onProgress).toHaveBeenCalledWith(SummaryStage.CREATING_NOTE);
      expect(onProgress).toHaveBeenCalledWith(SummaryStage.COMPLETE);
    });

    it("completed 시 NoteCreator.createNote가 올바른 콘텐츠로 호출된다", async () => {
      await service.summarize(
        "https://www.youtube.com/watch?v=abc123",
        "ko",
        onProgress
      );

      const noteCall = vi.mocked(noteCreator.createNote).mock.calls[0][0];
      expect(noteCall.videoTitle).toBe("테스트 영상 제목");
      expect(noteCall.videoUrl).toBe("https://www.youtube.com/watch?v=abc123");
      expect(noteCall.summary).toBe("AI가 생성한 요약 내용입니다.");
      expect(noteCall.keyPoints).toEqual(["포인트1", "포인트2", "포인트3"]);
    });
  });

  describe("실패 플로우", () => {
    it("failed 상태 시 API 오류 메시지를 포함한 Error를 throw한다", async () => {
      vi.mocked(apiClient.getTaskStatus).mockReset();
      vi.mocked(apiClient.getTaskStatus).mockResolvedValue({
        task_id: "task-123",
        status: "failed",
        result: null,
        error: { code: "PIPELINE_ERROR", message: "번역 실패" },
      });

      await expect(
        service.summarize(
          "https://www.youtube.com/watch?v=abc123",
          "ko",
          onProgress
        )
      ).rejects.toThrow("번역 실패");
    });

    it("폴링 타임아웃(60회 초과) 시 타임아웃 오류를 throw한다", async () => {
      vi.mocked(apiClient.getTaskStatus).mockReset();
      vi.mocked(apiClient.getTaskStatus).mockResolvedValue({
        task_id: "task-123",
        status: "extracting",
        result: null,
        error: null,
      });

      await expect(
        service.summarize(
          "https://www.youtube.com/watch?v=abc123",
          "ko",
          onProgress
        )
      ).rejects.toThrow("요약 처리 시간이 초과되었습니다");

      // 60회 폴링이 수행되었는지 확인
      expect(apiClient.getTaskStatus).toHaveBeenCalledTimes(60);
    });
  });

  describe("API 요청 실패 전파", () => {
    it("submitSummarize 실패 시 오류가 상위로 전파된다", async () => {
      vi.mocked(apiClient.submitSummarize).mockRejectedValue(
        new Error("API 서버에 연결할 수 없습니다")
      );

      await expect(
        service.summarize(
          "https://www.youtube.com/watch?v=abc123",
          "ko",
          onProgress
        )
      ).rejects.toThrow("API 서버에 연결할 수 없습니다");
    });
  });
});
