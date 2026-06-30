// ============================================================
// 요약 오케스트레이션 서비스
// API 요약 요청 → 폴링 → 결과 처리 → 노트 생성 순서로 진행
// YouTubeSummaryApiClient를 통해 외부 API와 통신
// ============================================================

import { TFile } from "obsidian";
import { SummaryStage, ProgressCallback, NoteContent } from "../models/types";
import { YouTubeSummaryApiClient } from "./YouTubeSummaryApiClient";
import { NoteCreator } from "./NoteCreator";

/** 폴링 간격 (밀리초) */
const POLL_INTERVAL_MS = 5000;
/** 최대 폴링 횟수 (약 5분) */
const MAX_POLL_COUNT = 60;

/**
 * 요약 오케스트레이션 서비스 클래스
 * API 요약 요청, 상태 폴링, 노트 생성을 순차적으로 수행
 */
export class SummarizerService {
  private apiClient: YouTubeSummaryApiClient;
  private noteCreator: NoteCreator;

  /**
   * @param apiClient - YouTube Summary API 클라이언트
   * @param noteCreator - 마크다운 노트 생성 서비스
   */
  constructor(apiClient: YouTubeSummaryApiClient, noteCreator: NoteCreator) {
    this.apiClient = apiClient;
    this.noteCreator = noteCreator;
  }

  /**
   * 유튜브 영상 요약 프로세스를 실행하는 메인 메서드
   *
   * 플로우:
   * 1. submitSummarize → task_id 수신 (manualTranscript 있으면 함께 전달)
   * 2. 5초 간격 폴링 → 상태 변경 시 onProgress 콜백
   * 3. completed 시 노트 생성
   * 4. failed 시 오류 throw
   *
   * @param videoUrl - 유튜브 영상 전체 URL
   * @param targetLanguage - 번역 대상 언어 코드
   * @param onProgress - 진행 상태 콜백 함수
   * @param manualTranscript - 수동 입력 스크립트/자막 (선택사항)
   * @param uploadDate - ISO 8601 영상 업로드 날짜 (선택사항, 노트 파일명 접두사용)
   * @returns 생성된 TFile 객체
   */
  async summarize(
    videoUrl: string,
    targetLanguage: string,
    onProgress: ProgressCallback,
    manualTranscript?: string,
    uploadDate?: string
  ): Promise<TFile> {
    // 1단계: API 요약 요청 (스크립트가 있으면 함께 전달)
    onProgress(SummaryStage.PENDING);
    const transcript = manualTranscript?.trim() || undefined;
    const submitResponse = await this.apiClient.submitSummarize(videoUrl, targetLanguage, transcript);
    const taskId = submitResponse.task_id;

    // 2단계: 폴링으로 작업 상태 추적
    let lastStatus = "";
    for (let i = 0; i < MAX_POLL_COUNT; i++) {
      await this.sleep(POLL_INTERVAL_MS);

      const taskStatus = await this.apiClient.getTaskStatus(taskId);
      const currentStatus = taskStatus.status;

      // 상태 변경 시 onProgress 콜백 호출
      if (currentStatus !== lastStatus) {
        lastStatus = currentStatus;
        this.reportProgress(currentStatus, onProgress);
      }

      // 완료 처리
      if (currentStatus === "completed" && taskStatus.result) {
        onProgress(SummaryStage.CREATING_NOTE);

        const noteContent: NoteContent = {
          videoTitle: taskStatus.result.video_title,
          videoUrl,
          summary: taskStatus.result.summary,
          keyPoints: taskStatus.result.key_points,
        };

        // 업로드 날짜 우선순위: API 응답(upload_date) → 호출 인자(피드 publishedAt) → 오늘(createNote 내부 폴백)
        const resolvedUploadDate = taskStatus.result.upload_date || uploadDate;
        const file = await this.noteCreator.createNote(noteContent, resolvedUploadDate);
        onProgress(SummaryStage.COMPLETE);
        return file;
      }

      // 실패 처리
      if (currentStatus === "failed") {
        const errorMessage = taskStatus.error?.message ?? "요약 처리에 실패했습니다";
        throw new Error(errorMessage);
      }
    }

    // 타임아웃
    throw new Error("요약 처리 시간이 초과되었습니다. 다시 시도해주세요");
  }

  /**
   * API 작업 상태를 SummaryStage로 매핑하여 onProgress 호출
   */
  private reportProgress(status: string, onProgress: ProgressCallback): void {
    const stageMap: Record<string, string> = {
      pending: SummaryStage.PENDING,
      extracting: SummaryStage.EXTRACTING,
      translating: SummaryStage.TRANSLATING,
      summarizing: SummaryStage.SUMMARIZING,
    };
    const stage = stageMap[status];
    if (stage) {
      onProgress(stage);
    }
  }

  /**
   * 지정된 시간만큼 대기하는 유틸리티
   * @param ms - 대기 시간 (밀리초)
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
