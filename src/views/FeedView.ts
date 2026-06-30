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
  /** 영상 요약 완료를 영구 저장하는 콜백 (summarizedVideoIds에 추가) */
  markSummarized?: (videoId: string) => Promise<void>;
}

/** 채널당 처음에 보여줄 영상 개수 (나머지는 "더 보기"로 펼침) */
const INITIAL_VISIBLE_VIDEOS = 3;

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
  /** "더 보기"로 전체 영상이 펼쳐진 채널 ID 집합 */
  private expandedChannels: Set<string> = new Set();
  /** 마지막으로 로드한 채널별 영상 (더보기/재렌더 시 재사용) */
  private lastChannelVideos: ChannelVideos[] = [];

  constructor(containerEl: HTMLElement, deps: FeedViewDependencies) {
    this.containerEl = containerEl;
    this.deps = deps;
  }

  /**
   * 영상의 표시 상태를 결정
   * 메모리 상태 맵이 우선하고, 없으면 영구 저장된 요약 완료 목록을 확인
   */
  private resolveStatus(videoId: string): VideoSummaryStatus {
    const inMemory = this.videoStatusMap.get(videoId);
    if (inMemory) return inMemory;
    const summarizedIds = this.deps.getSettings().summarizedVideoIds ?? [];
    return summarizedIds.includes(videoId) ? "completed" : "idle";
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
    while (this.containerEl.firstChild) {
      this.containerEl.removeChild(this.containerEl.firstChild);
    }

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
      while (this.contentEl.firstChild) {
        this.contentEl.removeChild(this.contentEl.firstChild);
      }
      const noChannelsMsg = document.createElement("div");
      noChannelsMsg.className = "youtube-feed-empty";
      noChannelsMsg.textContent = this.tr.feedNoChannels;
      this.contentEl.appendChild(noChannelsMsg);
      return;
    }

    // 로딩 상태 표시
    while (this.contentEl.firstChild) {
      this.contentEl.removeChild(this.contentEl.firstChild);
    }
    const loadingMsg = document.createElement("div");
    loadingMsg.className = "youtube-feed-loading";
    loadingMsg.textContent = this.tr.feedLoading;
    this.contentEl.appendChild(loadingMsg);

    try {
      const channelVideos = await this.deps.subscriptionManager.fetchNewVideos();

      while (this.contentEl.firstChild) {
        this.contentEl.removeChild(this.contentEl.firstChild);
      }

      // 신규 영상이 없는 경우 빈 피드 메시지 표시
      if (channelVideos.length === 0) {
        this.lastChannelVideos = [];
        const emptyMsg = document.createElement("div");
        emptyMsg.className = "youtube-feed-empty";
        emptyMsg.textContent = this.tr.feedEmpty;
        this.contentEl.appendChild(emptyMsg);
        return;
      }

      // 로드 결과 보관 후 그룹 단위로 렌더링
      this.lastChannelVideos = channelVideos;
      this.renderGroups(channelVideos);
    } catch {
      // 피드 로드 실패 시 오류 메시지 표시
      if (this.contentEl) {
        while (this.contentEl.firstChild) {
          this.contentEl.removeChild(this.contentEl.firstChild);
        }
        const errorMsg = document.createElement("div");
        errorMsg.className = "youtube-feed-empty";
        errorMsg.textContent = this.tr.feedSummaryError;
        this.contentEl.appendChild(errorMsg);
      }
    }
  }

  /**
   * 채널을 그룹명(group) 기준으로 묶어 DOM으로 렌더링
   * 그룹명이 없는 채널은 마지막에 "그룹 없음" 섹션으로 모음
   * @param channelVideos - 채널별 신규 영상 그룹 배열
   */
  private renderGroups(channelVideos: ChannelVideos[]): void {
    if (!this.contentEl) return;

    const settings = this.deps.getSettings();
    const grouped = groupChannelsByGroupName(channelVideos, settings.monitoredChannels);

    // 명명된 그룹이 하나라도 있으면 "그룹 없음" 섹션도 헤더를 붙여 구분
    const hasNamedGroup = grouped.some((g) => g.groupName !== null);

    for (const { groupName, channels } of grouped) {
      const groupEl = document.createElement("div");
      groupEl.className = "youtube-feed-group";

      // 그룹 헤더: 명명된 그룹은 그룹명, 그룹 없음 섹션은 명명 그룹이 있을 때만 표시
      const headerText = groupName ?? (hasNamedGroup ? this.tr.feedUngrouped : null);
      if (headerText) {
        const headerEl = document.createElement("div");
        headerEl.className = "youtube-feed-group-header";
        headerEl.textContent = headerText;
        groupEl.appendChild(headerEl);
      }

      // 그룹 내 채널별 렌더링
      for (const channel of channels) {
        groupEl.appendChild(this.renderChannelGroup(channel));
      }

      this.contentEl.appendChild(groupEl);
    }
  }

  /**
   * 단일 채널 그룹을 렌더링 (채널 제목 + 페이지네이션된 영상 목록)
   * @param channel - 채널별 영상 그룹
   */
  private renderChannelGroup(channel: ChannelVideos): HTMLElement {
    const groupEl = document.createElement("div");
    groupEl.className = "youtube-feed-channel-group";

    // 채널 제목
    const titleEl = document.createElement("h5");
    titleEl.className = "youtube-feed-channel-title";
    titleEl.textContent = channel.channelTitle;
    groupEl.appendChild(titleEl);

    // 페이지네이션: 펼침 상태가 아니면 처음 INITIAL_VISIBLE_VIDEOS개만 표시
    const expanded = this.expandedChannels.has(channel.channelId);
    const visibleVideos = expanded
      ? channel.videos
      : channel.videos.slice(0, INITIAL_VISIBLE_VIDEOS);

    for (const video of visibleVideos) {
      groupEl.appendChild(this.renderVideoItem(video));
    }

    // 숨겨진 영상이 있으면 "더 보기" 버튼 표시
    const hiddenCount = channel.videos.length - visibleVideos.length;
    if (hiddenCount > 0) {
      const moreBtn = document.createElement("button");
      moreBtn.className = "youtube-feed-show-more-btn";
      moreBtn.textContent = `${this.tr.feedShowMore} (${hiddenCount})`;
      moreBtn.addEventListener("click", () => {
        this.expandedChannels.add(channel.channelId);
        this.rerenderFeed();
      });
      groupEl.appendChild(moreBtn);
    }

    return groupEl;
  }

  /**
   * 보관된 마지막 로드 결과를 사용해 피드 콘텐츠만 다시 렌더링
   * "더 보기" 펼침 등 상태 변경 시 API 재호출 없이 갱신
   */
  private rerenderFeed(): void {
    if (!this.contentEl) return;
    while (this.contentEl.firstChild) {
      this.contentEl.removeChild(this.contentEl.firstChild);
    }
    this.renderGroups(this.lastChannelVideos);
  }

  /**
   * 개별 영상 항목을 DOM 요소로 렌더링
   * 제목과 요약 버튼을 한 줄에 배치하고, 그 아래 메타 정보를 표시
   * @param video - 영상 정보 객체
   * @returns 영상 항목 DOM 요소
   */
  renderVideoItem(video: VideoItem): HTMLElement {
    const itemEl = document.createElement("div");
    itemEl.className = "youtube-feed-video-item";
    itemEl.dataset.videoId = video.videoId;

    // 제목 + 액션을 같은 줄에 두는 헤더 행
    const rowEl = document.createElement("div");
    rowEl.className = "youtube-feed-video-row";
    itemEl.appendChild(rowEl);

    // 영상 제목
    const titleEl = document.createElement("div");
    titleEl.className = "youtube-feed-video-title";
    titleEl.textContent = video.title;
    rowEl.appendChild(titleEl);

    // 메타 정보 (채널명, 업로드 날짜)
    const metaEl = document.createElement("div");
    metaEl.className = "youtube-feed-video-meta";
    const dateStr = video.publishedAt.slice(0, 10);
    metaEl.textContent = `${video.channelTitle} · ${dateStr}`;
    itemEl.appendChild(metaEl);

    // 요약 상태 및 버튼 영역 (영구 저장된 완료 상태 포함하여 해석)
    const currentStatus = this.resolveStatus(video.videoId);
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
    // 액션은 제목과 같은 줄(헤더 행)의 오른쪽에 배치
    // 행이 없으면(이론상 발생 안 함) 항목 자체를 대상으로 폴백
    const target =
      itemEl.querySelector<HTMLElement>(".youtube-feed-video-row") ?? itemEl;

    // 기존 액션 영역 제거
    const existingBtn = target.querySelector(".youtube-feed-summarize-btn");
    const existingStatus = target.querySelector(".youtube-feed-status");
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
      target.appendChild(btn);
    } else if (status === "summarizing") {
      // 요약 진행 중 - 비활성화된 버튼 + 상태 텍스트
      const btn = document.createElement("button");
      btn.className = "youtube-feed-summarize-btn";
      btn.textContent = this.tr.feedSummarizing;
      btn.disabled = true;
      target.appendChild(btn);

      const statusEl = document.createElement("span");
      statusEl.className = "youtube-feed-status";
      statusEl.textContent = this.tr.feedSummarizing;
      target.appendChild(statusEl);
    } else if (status === "completed") {
      // 요약 완료 상태 (영구 표시)
      const statusEl = document.createElement("span");
      statusEl.className = "youtube-feed-status completed";
      statusEl.textContent = this.tr.feedSummarized;
      target.appendChild(statusEl);
    } else if (status === "error") {
      // 요약 실패 상태
      const statusEl = document.createElement("span");
      statusEl.className = "youtube-feed-status error";
      statusEl.textContent = this.tr.feedSummaryError;
      target.appendChild(statusEl);
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
      // 노트 파일명 접두사로 쓰도록 원본 영상 업로드 날짜를 전달
      const summarizerService = this.deps.summarizerServiceFactory(saveFolderPath);
      await summarizerService.summarize(
        videoUrl,
        settings.language,
        () => {
          // 진행 상태 콜백 - 상태는 이미 "summarizing"으로 표시 중
        },
        undefined,
        video.publishedAt
      );

      // 상태를 "completed"로 변경
      this.updateVideoStatus(video.videoId, "completed");

      // 요약 완료를 영구 저장 (뷰를 닫아도 "요약함" 표시 유지)
      if (this.deps.markSummarized) {
        await this.deps.markSummarized(video.videoId);
      }
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
    this.expandedChannels.clear();
    this.lastChannelVideos = [];
    while (this.containerEl.firstChild) {
      this.containerEl.removeChild(this.containerEl.firstChild);
    }
    this.contentEl = null;
  }
}

/** groupChannelsByGroupName 반환 항목: 그룹명과 그에 속한 채널 영상 목록 */
export interface FeedGroup {
  /** 그룹명 (그룹 없음은 null) */
  groupName: string | null;
  /** 그룹에 속한 채널별 영상 그룹 */
  channels: ChannelVideos[];
}

/**
 * 채널별 영상 목록을 그룹명(MonitoredChannel.group) 기준으로 묶는 순수 함수
 * - 입력 순서를 기준으로 그룹이 처음 등장한 순서를 유지
 * - 그룹명이 없는(또는 공백) 채널은 null 그룹으로 모아 항상 마지막에 배치
 * @param channelVideos - 채널별 영상 그룹 배열
 * @param monitoredChannels - 그룹 정보를 담은 모니터링 채널 목록
 * @returns 그룹 단위로 묶인 배열 (그룹 없음 그룹이 있으면 맨 끝)
 */
export function groupChannelsByGroupName(
  channelVideos: ChannelVideos[],
  monitoredChannels: MonitoredChannel[]
): FeedGroup[] {
  const groupOf = (channelId: string): string | null => {
    const channel = monitoredChannels.find((ch) => ch.channelId === channelId);
    const name = channel?.group?.trim();
    return name && name.length > 0 ? name : null;
  };

  const order: (string | null)[] = [];
  const buckets = new Map<string | null, ChannelVideos[]>();

  for (const cv of channelVideos) {
    const name = groupOf(cv.channelId);
    if (!buckets.has(name)) {
      buckets.set(name, []);
      order.push(name);
    }
    buckets.get(name)!.push(cv);
  }

  // 그룹 없음(null)은 항상 마지막으로
  const named = order.filter((n) => n !== null);
  const result: FeedGroup[] = named.map((groupName) => ({
    groupName,
    channels: buckets.get(groupName)!,
  }));
  if (buckets.has(null)) {
    result.push({ groupName: null, channels: buckets.get(null)! });
  }
  return result;
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
