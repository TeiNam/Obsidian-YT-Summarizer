// ============================================================
// 구독 관리 서비스
// 모니터링 대상 채널의 최신 영상 조회 및 관리를 담당
// 채널 ID → Uploads 플레이리스트 ID 변환,
// 채널별 그룹화 기능 제공
// ============================================================

import type { YouTubeDataApiClient } from "./YouTubeDataApiClient";
import type {
  PluginSettings,
  ChannelVideos,
} from "../models/types";

/**
 * 구독 관리 서비스 클래스
 * 모니터링 대상 채널의 최신 영상을 조회하고 채널별로 그룹화하여 반환
 */
export class SubscriptionManager {
  private apiClient: YouTubeDataApiClient;
  private settings: PluginSettings;

  /**
   * @param apiClient - YouTube Data API v3 클라이언트
   * @param settings - 플러그인 설정 (모니터링 채널, 채널당 영상 개수 등)
   */
  constructor(apiClient: YouTubeDataApiClient, settings: PluginSettings) {
    this.apiClient = apiClient;
    this.settings = settings;
  }

  /**
   * 채널 ID로부터 Uploads 플레이리스트 ID를 도출
   * 채널 ID의 두 번째 문자를 "U"로 교체 (예: "UCxxxx" → "UUxxxx")
   * @param channelId - YouTube 채널 ID
   * @returns Uploads 플레이리스트 ID
   */
  getUploadsPlaylistId(channelId: string): string {
    return channelId[0] + "U" + channelId.slice(2);
  }

  /**
   * 모니터링 대상 채널의 최신 영상을 채널별로 그룹화하여 반환
   * 개별 채널 조회 실패 시 해당 채널만 건너뛰고 나머지 채널은 계속 처리
   * @returns 채널별 최신 영상 그룹 배열
   */
  async fetchNewVideos(): Promise<ChannelVideos[]> {
    const results: ChannelVideos[] = [];
    const { monitoredChannels, videosPerChannel } = this.settings;

    for (const channel of monitoredChannels) {
      try {
        const playlistId = this.getUploadsPlaylistId(channel.channelId);
        const response = await this.apiClient.fetchRecentVideos(playlistId, videosPerChannel);

        if (response.items.length > 0) {
          results.push({
            channelId: channel.channelId,
            channelTitle: channel.channelTitle,
            videos: response.items,
          });
        }
      } catch {
        // 개별 채널 실패 시 해당 채널만 건너뛰고 계속 진행
        continue;
      }
    }

    return results;
  }
}
