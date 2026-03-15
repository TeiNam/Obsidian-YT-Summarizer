// ============================================================
// YouTube Data API v3 클라이언트
// YouTube Data API v3와의 HTTP 통신을 담당
// 구독 채널 목록 조회 및 채널별 최근 영상 조회 기능 제공
// 옵시디언의 requestUrl API를 사용하여 CORS 제약 없이 호출
// ============================================================

import { requestUrl } from "obsidian";
import type { RequestFn } from "./YouTubeSummaryApiClient";
import type {
  SubscriptionChannel,
  VideoItem,
  PlaylistItemsResponse,
} from "../models/types";

/** YouTube Data API v3 기본 URL */
const YOUTUBE_API_BASE = "https://www.googleapis.com/youtube/v3";

/** playlistItems.list 기본 최대 결과 수 */
const DEFAULT_RECENT_VIDEOS_COUNT = 10;

/**
 * YouTube Data API 오류 클래스
 * HTTP 상태 코드와 오류 메시지를 포함
 */
export class YouTubeDataApiError extends Error {
  /** HTTP 상태 코드 */
  statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.name = "YouTubeDataApiError";
    this.statusCode = statusCode;
  }
}

/**
 * 옵시디언 requestUrl을 RequestFn 형태로 래핑하는 기본 구현
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
 * YouTube Data API v3 클라이언트 클래스
 * subscriptions.list, playlistItems.list 엔드포인트를 호출
 */
export class YouTubeDataApiClient {
  private apiKey: string;
  private requestFn: RequestFn;

  /**
   * @param apiKey - YouTube Data API v3 인증 키
   * @param requestFn - HTTP 요청 함수 (테스트 시 모킹용 의존성 주입)
   */
  constructor(apiKey: string, requestFn?: RequestFn) {
    this.apiKey = apiKey;
    this.requestFn = requestFn ?? defaultRequestFn;
  }

  /**
   * 채널 ID 또는 핸들로 채널 정보 조회
   * channels.list 엔드포인트를 호출하여 채널 정보를 반환
   * API Key만으로 동작 (OAuth 불필요)
   * @param channelIdOrHandle - YouTube 채널 ID (예: "UCxxxx") 또는 핸들 (예: "@sosumonkey")
   * @returns 채널 정보 (channelId, title, thumbnailUrl, description)
   * @throws YouTubeDataApiError - API 오류 또는 채널을 찾을 수 없을 때
   */
  async fetchChannelInfo(channelIdOrHandle: string): Promise<SubscriptionChannel> {
    // @로 시작하면 forHandle 파라미터, 아니면 id 파라미터 사용
    const isHandle = channelIdOrHandle.startsWith("@");
    const param = isHandle
      ? `forHandle=${encodeURIComponent(channelIdOrHandle)}`
      : `id=${encodeURIComponent(channelIdOrHandle)}`;
    const url = `${YOUTUBE_API_BASE}/channels?part=snippet&${param}&key=${this.apiKey}`;

    const response = await this.requestFn({
      url,
      method: "GET",
      headers: {},
    });

    if (response.status === 200) {
      return this.parseChannelResponse(response.json);
    }

    this.handleErrorResponse(response.status, response.json);
  }

  /**
   * 채널의 최근 영상 목록 조회
   * playlistItems.list 엔드포인트를 호출하여 최근 영상 목록을 반환
   * @param uploadsPlaylistId - Uploads 플레이리스트 ID (예: "UUxxxx")
   * @param maxResults - 최대 결과 수 (기본값: 10)
   * @returns 최근 영상 목록 응답 (items, nextPageToken)
   * @throws YouTubeDataApiError - API 오류 시
   */
  async fetchRecentVideos(
    uploadsPlaylistId: string,
    maxResults: number = DEFAULT_RECENT_VIDEOS_COUNT
  ): Promise<PlaylistItemsResponse> {
    const url = `${YOUTUBE_API_BASE}/playlistItems?part=snippet&playlistId=${uploadsPlaylistId}&maxResults=${maxResults}&key=${this.apiKey}`;

    const response = await this.requestFn({
      url,
      method: "GET",
      headers: {},
    });

    if (response.status === 200) {
      return this.parsePlaylistItemsResponse(response.json);
    }

    this.handleErrorResponse(response.status, response.json);
  }

  /**
   * channels.list API 응답을 SubscriptionChannel로 변환
   * @param json - API 응답 JSON
   * @returns 파싱된 채널 정보
   * @throws YouTubeDataApiError - 채널을 찾을 수 없을 때
   */
  private parseChannelResponse(json: unknown): SubscriptionChannel {
    const data = json as {
      items?: Array<{
        id?: string;
        snippet?: {
          title?: string;
          thumbnails?: { default?: { url?: string } };
          description?: string;
        };
      }>;
    };

    const items = data.items ?? [];
    if (items.length === 0) {
      throw new YouTubeDataApiError("채널을 찾을 수 없습니다", 404);
    }

    const item = items[0];
    return {
      channelId: item.id ?? "",
      title: item.snippet?.title ?? "",
      thumbnailUrl: item.snippet?.thumbnails?.default?.url ?? "",
      description: item.snippet?.description ?? "",
    };
  }

  /**
   * playlistItems.list API 응답을 PlaylistItemsResponse로 변환
   * @param json - API 응답 JSON
   * @returns 파싱된 영상 목록 응답
   */
  private parsePlaylistItemsResponse(json: unknown): PlaylistItemsResponse {
    const data = json as {
      items?: Array<{
        snippet?: {
          resourceId?: { videoId?: string };
          title?: string;
          channelId?: string;
          channelTitle?: string;
          publishedAt?: string;
          thumbnails?: { default?: { url?: string } };
        };
      }>;
      nextPageToken?: string;
    };

    const items: VideoItem[] = (data.items ?? []).map((item) => ({
      videoId: item.snippet?.resourceId?.videoId ?? "",
      title: item.snippet?.title ?? "",
      channelId: item.snippet?.channelId ?? "",
      channelTitle: item.snippet?.channelTitle ?? "",
      publishedAt: item.snippet?.publishedAt ?? "",
      thumbnailUrl: item.snippet?.thumbnails?.default?.url ?? "",
    }));

    return {
      items,
      nextPageToken: data.nextPageToken ?? null,
    };
  }

  /**
   * HTTP 오류 응답을 YouTubeDataApiError로 변환하여 throw
   * 403: 유효하지 않은 API Key, 429: 쿼터 초과, 기타: 일반 오류
   * @param status - HTTP 상태 코드
   * @param body - 응답 본문
   */
  private handleErrorResponse(status: number, body: unknown): never {
    const errorBody = body as {
      error?: { message?: string; errors?: Array<{ reason?: string }> };
    } | null;

    const reason = errorBody?.error?.errors?.[0]?.reason;
    const apiMessage = errorBody?.error?.message;

    if (status === 403) {
      throw new YouTubeDataApiError(
        apiMessage ?? "API Key가 유효하지 않습니다",
        403
      );
    }

    if (status === 429) {
      throw new YouTubeDataApiError(
        apiMessage ?? "API 요청 한도를 초과했습니다. 잠시 후 다시 시도해주세요",
        429
      );
    }

    // 네트워크 오류 또는 기타 HTTP 오류
    throw new YouTubeDataApiError(
      apiMessage ?? `HTTP ${status} 오류 (${reason ?? "unknown"})`,
      status
    );
  }
}
