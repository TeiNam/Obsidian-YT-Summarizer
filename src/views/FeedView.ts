// ============================================================
// 구독 피드 뷰 컴포넌트
// 사이드바에서 신규 영상 목록과 요약 버튼을 표시하는 뷰
// 채널별 그룹화, 영상별 요약 상태 추적, 오류 격리 지원
// ============================================================

import { App } from "obsidian";
import { SubscriptionManager } from "../services/SubscriptionManager";
import { SummarizerService } from "../services/SummarizerService";
import {
  PluginSettings,
  VideoItem,
  ChannelVideos,
  VideoSummaryStatus,
  MonitoredChannel,
} from "../models/types";
import { t, Translations } from "../i18n";

/**
 * FeedView 의존성 인터페이스
 * 외부에서 의존성 주입을 통해 테스트 가능하도록 설계
 */
export interface FeedViewDependencies {
  /** 구독 관리 서비스 */
  subscriptionManager: SubscriptionManager;
  /** SummarizerService 팩토리 - 저장 폴더 경로를 받아 새 인스턴스 생성 */
  summarizerServiceFactory: (saveFolderPath?: string) => SummarizerService;
  /** 플러그인 설정 getter */
  getSettings: () => PluginSettings;
  /** 옵시디언 App 인스턴스 */
  app: App;
}

/**
 * 구독 피드 뷰 컴포넌트 클래스
 * 신규 영상 목록을 채널별로 그룹화하여 렌더링하고
 * 개별 영상 요약 실행 및 상태 추적을 담당
 */
export class FeedView {
  private containerEl: HTMLElement;
  private deps: FeedViewDependencies;
  /** 피드 콘텐츠 영역 */
  private contentEl: HTMLElement | null = null;
  /** 영상별 요약 상태 추적 맵 (videoId → 상태) */
  private videoStatusMap: Map<string, VideoSummaryStatus> = new Map();

  constructor(containerEl: HTMLElement, deps: FeedViewDependencies) {
    this.containerEl = containerEl;
    this.deps = deps;
  }

  /**
   * 현재 설정 언어에 맞는 번역 객체를 반환하는 헬퍼
   */
  private get tr(): Translations {
    const lang = this.deps.getSettings().language;
    return t(lang);
  }

  /**
   * 피드 UI 초기 렌더링
   * 새로고침 버튼 + 피드 콘텐츠 영역을 생성
   */
  render(): void {
    this.containerEl.innerHTML = "";

    // 새로고침 버튼
    const refreshBtn = document.createElement("button");
    refreshBtn.textContent = this.tr.feedRefreshButton;
    refreshBtn.className = "youtube-feed-refresh-btn";
    refreshBtn.addEventListener("click", () => {
      this.loadFeed();
    });
    this.containerEl.appendChild(refreshBtn);

    // 피드 콘텐츠 영역
    this.contentEl = document.createElement("div");
    this.contentEl.className = "youtube-feed-content";
    this.containerEl.appendChild(this.contentEl);
  }

  /**
   * 신규 영상 목록을 로드하고 렌더링
   * SubscriptionManager.fetchNewVideos()를 호출하여 채널별 그룹화된 영상 목록을 가져옴
   */
  async loadFeed(): Promise<void> {
    if (!this.contentEl) return;

    const settings = this.deps.getSettings();

    // 모니터링 대상 채널이 없는 경우 안내 메시지 표시
    if (!settings.monitoredChannels || settings.monitoredChannels.length === 0) {
      this.contentEl.innerHTML = "";
      const noChannelsMsg = document.createElement("div");
      noChannelsMsg.className = "youtube-feed-empty";
      noChannelsMsg.textContent = this.tr.feedNoChannels;
      this.contentEl.appendChild(noChannelsMsg);
      return;
    }

    // 로딩 상태 표시
    this.contentEl.innerHTML = "";
    const loadingMsg = document.createElement("div");
    loadingMsg.className = "youtube-feed-loading";
    loadingMsg.textContent = this.tr.feedLoading;
    this.contentEl.appendChild(loadingMsg);

    try {
      const channelVideos = await this.deps.subscriptionManager.fetchNewVideos();

      this.contentEl.innerHTML = "";

      // 신규 영상이 없는 경우 빈 피드 메시지 표시
      if (channelVideos.length === 0) {
        const emptyMsg = document.createElement("div");
        emptyMsg.className = "youtube-feed-empty";
        emptyMsg.textContent = this.tr.feedEmpty;
        this.contentEl.appendChild(emptyMsg);
        return;
      }

      // 채널별 그룹화된 영상 목록 렌더링
      this.renderChannelGroups(channelVideos);
    } catch {
      // 피드 로드 실패 시 오류 메시지 표시
      if (this.contentEl) {
        this.contentEl.innerHTML = "";
        const errorMsg = document.createElement("div");
        errorMsg.className = "youtube-feed-empty";
        errorMsg.textContent = this.tr.feedSummaryError;
        this.contentEl.appendChild(errorMsg);
      }
    }
  }

  /**
   * 채널별 그룹화된 영상 목록을 DOM으로 렌더링
   * @param channelVideos - 채널별 신규 영상 그룹 배열
   */
  private renderChannelGroups(channelVideos: ChannelVideos[]): void {
    if (!this.contentEl) return;

    for (const group of channelVideos) {
      const groupEl = document.createElement("div");
      groupEl.className = "youtube-feed-channel-group";

      // 채널 제목
      const titleEl = document.createElement("h5");
      titleEl.className = "youtube-feed-channel-title";
      titleEl.textContent = group.channelTitle;
      groupEl.appendChild(titleEl);

      // 영상 항목 렌더링
      for (const video of group.videos) {
        const videoEl = this.renderVideoItem(video);
        groupEl.appendChild(videoEl);
      }

      this.contentEl.appendChild(groupEl);
    }
  }

  /**
   * 개별 영상 항목을 DOM 요소로 렌더링
   * 영상 제목, 채널 이름, 업로드 날짜, 요약하기 버튼을 포함
   * @param video - 영상 정보 객체
   * @returns 영상 항목 DOM 요소
   */
  renderVideoItem(video: VideoItem): HTMLElement {
    const itemEl = document.createElement("div");
    itemEl.className = "youtube-feed-video-item";
    itemEl.dataset.videoId = video.videoId;

    // 영상 제목
    const titleEl = document.createElement("div");
    titleEl.className = "youtube-feed-video-title";
    titleEl.textContent = video.title;
    itemEl.appendChild(titleEl);

    // 메타 정보 (채널명, 업로드 날짜)
    const metaEl = document.createElement("div");
    metaEl.className = "youtube-feed-video-meta";
    const dateStr = video.publishedAt.slice(0, 10);
    metaEl.textContent = `${video.channelTitle} · ${dateStr}`;
    itemEl.appendChild(metaEl);

    // 요약 상태 및 버튼 영역
    const currentStatus = this.videoStatusMap.get(video.videoId) ?? "idle";
    this.renderVideoActions(itemEl, video, currentStatus);

    return itemEl;
  }

  /**
   * 영상 항목의 액션 영역(버튼/상태)을 렌더링
   * 현재 요약 상태에 따라 다른 UI를 표시
   * @param itemEl - 영상 항목 DOM 요소
   * @param video - 영상 정보 객체
   * @param status - 현재 요약 상태
   */
  private renderVideoActions(
    itemEl: HTMLElement,
    video: VideoItem,
    status: VideoSummaryStatus
  ): void {
    // 기존 액션 영역 제거
    const existingBtn = itemEl.querySelector(".youtube-feed-summarize-btn");
    const existingStatus = itemEl.querySelector(".youtube-feed-status");
    if (existingBtn) existingBtn.remove();
    if (existingStatus) existingStatus.remove();

    if (status === "idle") {
      // 요약하기 버튼
      const btn = document.createElement("button");
      btn.className = "youtube-feed-summarize-btn";
      btn.textContent = this.tr.feedSummarizeButton;
      btn.addEventListener("click", () => {
        this.summarizeVideo(video);
      });
      itemEl.appendChild(btn);
    } else if (status === "summarizing") {
      // 요약 진행 중 - 비활성화된 버튼 + 상태 텍스트
      const btn = document.createElement("button");
      btn.className = "youtube-feed-summarize-btn";
      btn.textContent = this.tr.feedSummarizing;
      btn.disabled = true;
      itemEl.appendChild(btn);

      const statusEl = document.createElement("span");
      statusEl.className = "youtube-feed-status";
      statusEl.textContent = this.tr.feedSummarizing;
      itemEl.appendChild(statusEl);
    } else if (status === "completed") {
      // 요약 완료 상태
      const statusEl = document.createElement("span");
      statusEl.className = "youtube-feed-status";
      statusEl.textContent = this.tr.feedSummarized;
      itemEl.appendChild(statusEl);
    } else if (status === "error") {
      // 요약 실패 상태
      const statusEl = document.createElement("span");
      statusEl.className = "youtube-feed-status";
      statusEl.textContent = this.tr.feedSummaryError;
      itemEl.appendChild(statusEl);
    }
  }

  /**
   * 개별 영상 요약을 실행
   * 1. 상태를 "summarizing"으로 변경
   * 2. SummarizerService로 요약 실행
   * 3. NoteCreator로 날짜 접두사 노트 생성
   * 4. 완료 시 "completed", 실패 시 "error"로 상태 변경
   * @param video - 요약할 영상 정보
   */
  async summarizeVideo(video: VideoItem): Promise<void> {
    // 상태를 "summarizing"으로 변경하고 UI 업데이트
    this.updateVideoStatus(video.videoId, "summarizing");

    try {
      const settings = this.deps.getSettings();
      const videoUrl = `https://www.youtube.com/watch?v=${video.videoId}`;

      // 채널별 저장 폴더 결정: 채널 설정 → 공통 폴더 fallback
      const saveFolderPath = resolveChannelSaveFolderPath(
        settings.monitoredChannels,
        video.channelId,
        settings.subscriptionSaveFolderPath
      );

      // 채널별 폴더 경로로 SummarizerService 생성하여 요약 실행 (노트 생성 포함)
      const summarizerService = this.deps.summarizerServiceFactory(saveFolderPath);
      await summarizerService.summarize(
        videoUrl,
        settings.language,
        () => {
          // 진행 상태 콜백 - 상태는 이미 "summarizing"으로 표시 중
        }
      );

      // 상태를 "completed"로 변경
      this.updateVideoStatus(video.videoId, "completed");
    } catch {
      // 실패 시 해당 영상만 오류 상태로 표시 (다른 영상에 영향 없음)
      this.updateVideoStatus(video.videoId, "error");
    }
  }

  /**
   * 영상의 요약 상태를 업데이트하고 해당 영상 항목의 UI를 갱신
   * @param videoId - 영상 ID
   * @param status - 새로운 요약 상태
   */
  private updateVideoStatus(videoId: string, status: VideoSummaryStatus): void {
    this.videoStatusMap.set(videoId, status);

    // 해당 영상 항목의 DOM 요소를 찾아 액션 영역만 갱신
    if (!this.contentEl) return;
    const itemEl = this.contentEl.querySelector(
      `[data-video-id="${videoId}"]`
    ) as HTMLElement | null;
    if (!itemEl) return;

    // videoId로 원본 VideoItem을 복원할 수 없으므로 DOM에서 정보 추출
    // renderVideoActions는 상태에 따라 버튼/상태 텍스트만 변경
    const dummyVideo: VideoItem = {
      videoId,
      title: "",
      channelId: "",
      channelTitle: "",
      publishedAt: "",
      thumbnailUrl: "",
    };
    this.renderVideoActions(itemEl, dummyVideo, status);
  }

  /**
   * UI 정리 - 이벤트 리스너 정리 및 DOM 비우기
   */
  destroy(): void {
    this.videoStatusMap.clear();
    this.containerEl.innerHTML = "";
    this.contentEl = null;
  }
}


/**
 * 채널별 저장 폴더 경로를 결정하는 순수 함수
 * 채널에 개별 저장 폴더가 설정되어 있으면 해당 경로를 반환하고,
 * 미설정(undefined, 빈 문자열, 공백만)이면 기본 폴더 경로를 반환한다.
 * @param monitoredChannels - 모니터링 대상 채널 목록
 * @param channelId - 대상 채널 ID
 * @param defaultFolderPath - 기본 저장 폴더 경로 (fallback)
 * @returns 결정된 저장 폴더 경로
 */
export function resolveChannelSaveFolderPath(
  monitoredChannels: MonitoredChannel[],
  channelId: string,
  defaultFolderPath: string
): string {
  const channel = monitoredChannels.find(ch => ch.channelId === channelId);
  const channelPath = channel?.saveFolderPath?.trim();
  return channelPath && channelPath.length > 0 ? channelPath : defaultFolderPath;
}
