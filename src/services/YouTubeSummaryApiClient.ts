// ============================================================
// YouTube Summary API 클라이언트
// 외부 YouTube Summary API와의 모든 HTTP 통신을 담당
// 옵시디언의 requestUrl API를 사용하여 CORS 제약 없이 호출
// ============================================================

import { requestUrl } from "obsidian";
import {
  SummarizeApiResponse,
  TaskStatusResponse,
} from "../models/types";

/** API Base URL */
const BASE_URL = "https://api.rastalion.me/yts/api";

/**
 * HTTP 요청 함수 타입 (테스트용 의존성 주입)
 */
export type RequestFn = (options: {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: string;
}) => Promise<{ status: number; json: unknown }>;

/**
 * API 오류 클래스
 * HTTP 상태 코드와 API 오류 코드를 포함
 */
export class ApiError extends Error {
  /** API 오류 코드 (MISSING_API_KEY, INVALID_API_KEY, INVALID_URL 등) */
  code: string;
  /** HTTP 상태 코드 */
  statusCode: number;

  constructor(message: string, code: string, statusCode: number) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

/**
 * 옵시디언 requestUrl을 RequestFn 형태로 래핑하는 기본 구현
 * contentType을 명시적으로 전달하여 HTTP/2 프로토콜 호환성 확보
 */
async function defaultRequestFn(options: {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: string;
}): Promise<{ status: number; json: unknown }> {
  try {
    const response = await requestUrl({
      url: options.url,
      method: options.method,
      headers: options.headers,
      body: options.body,
      contentType: options.headers["Content-Type"] ?? "application/json",
    });
    // text를 먼저 읽고 JSON.parse — json getter 지연 방지
    let json: unknown = null;
    try {
      json = JSON.parse(response.text);
    } catch {
      // JSON 파싱 실패 시 null 유지
    }
    return { status: response.status, json };
  } catch (error: unknown) {
    // requestUrl은 4xx/5xx 시 예외를 throw — status와 json 추출
    const err = error as { status?: number; text?: string; json?: unknown };
    if (err.status) {
      let json: unknown = null;
      try {
        json = err.text ? JSON.parse(err.text) : err.json ?? null;
      } catch {
        json = err.json ?? null;
      }
      return { status: err.status, json };
    }
    // 네트워크 오류 등 예상치 못한 오류
    throw error;
  }
}

/**
 * YouTube Summary API 클라이언트 클래스
 * POST /summarize, GET /tasks/{task_id} 엔드포인트를 호출
 */
export class YouTubeSummaryApiClient {
  private apiKey: string;
  private requestFn: RequestFn;

  /**
   * @param apiKey - YouTube Summary API 인증 키
   * @param requestFn - HTTP 요청 함수 (테스트 시 모킹용 의존성 주입)
   */
  constructor(apiKey: string, requestFn?: RequestFn) {
    this.apiKey = apiKey;
    this.requestFn = requestFn ?? defaultRequestFn;
  }

  /**
   * POST /summarize — 요약 작업 생성
   * @param url - 유튜브 영상 URL
   * @param targetLanguage - 번역 대상 언어 코드
   * @returns 작업 ID와 상태를 포함한 응답
   * @throws ApiError - HTTP 오류 시 (401, 422 등)
   */
  async submitSummarize(url: string, targetLanguage: string): Promise<SummarizeApiResponse> {
    const response = await this.requestFn({
      url: `${BASE_URL}/summarize`,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": this.apiKey,
      },
      body: JSON.stringify({ url, target_language: targetLanguage }),
    });

    if (response.status === 202) {
      return response.json as SummarizeApiResponse;
    }

    // HTTP 오류 처리
    this.handleErrorResponse(response.status, response.json);
    // handleErrorResponse는 항상 throw하므로 여기에 도달하지 않음
    throw new ApiError("알 수 없는 오류", "UNKNOWN_ERROR", response.status);
  }

  /**
   * GET /tasks/{task_id} — 작업 상태 조회
   * @param taskId - 작업 ID (UUID)
   * @returns 작업 상태 응답
   * @throws ApiError - HTTP 오류 시 (404, 500, 504 등)
   */
  async getTaskStatus(taskId: string): Promise<TaskStatusResponse> {
    const response = await this.requestFn({
      url: `${BASE_URL}/tasks/${taskId}`,
      method: "GET",
      headers: {
        "X-API-Key": this.apiKey,
      },
    });

    if (response.status === 200) {
      return response.json as TaskStatusResponse;
    }

    // HTTP 오류 처리
    this.handleErrorResponse(response.status, response.json);
    throw new ApiError("알 수 없는 오류", "UNKNOWN_ERROR", response.status);
  }

  /**
   * HTTP 오류 응답을 ApiError로 변환하여 throw
   * @param status - HTTP 상태 코드
   * @param body - 응답 본문
   */
  private handleErrorResponse(status: number, body: unknown): never {
    const errorBody = body as { error?: { code?: string; message?: string } } | null;
    const code = errorBody?.error?.code ?? "UNKNOWN_ERROR";
    const message = errorBody?.error?.message ?? `HTTP ${status} 오류`;

    throw new ApiError(message, code, status);
  }
}
