// ============================================================
// YouTubeSummarizerPlugin - 플러그인 진입점
// 옵시디언 Plugin 클래스를 상속하여 사이드바 뷰, 설정 탭,
// 서비스 의존성을 연결하는 메인 모듈
// API 마이그레이션 후: YouTubeSummaryApiClient 사용
// ============================================================

import { Plugin, WorkspaceLeaf, addIcon } from "obsidian";
import { PluginSettings, DEFAULT_SETTINGS, SubscriptionChannel } from "./models/types";
import {
  SidebarView,
  VIEW_TYPE_YOUTUBE_SUMMARIZER,
} from "./views/SidebarView";
import { SettingsTab } from "./settings/SettingsTab";
import { YouTubeSummaryApiClient } from "./services/YouTubeSummaryApiClient";
import { NoteCreator } from "./services/NoteCreator";
import { SummarizerService } from "./services/SummarizerService";
import { YouTubeDataApiClient } from "./services/YouTubeDataApiClient";
import { SubscriptionManager } from "./services/SubscriptionManager";

/**
 * 유튜브 요약 플러그인 메인 클래스
 */
export default class YouTubeSummarizerPlugin extends Plugin {
  settings!: PluginSettings;

  async onload(): Promise<void> {
    await this.loadSettings();

    // 유튜브 커스텀 아이콘 등록 (뷰 탭 아이콘용)
    addIcon("youtube-play", '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 17a24.12 24.12 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.56 49.56 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24.12 24.12 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.55 49.55 0 0 1-16.2 0A2 2 0 0 1 2.5 17"/><path d="m10 15 5-3-5-3z"/></svg>');

    // 사이드바 뷰 등록
    this.registerView(
      VIEW_TYPE_YOUTUBE_SUMMARIZER,
      (leaf: WorkspaceLeaf) => {
        const view = new SidebarView(leaf);

        // 서비스 팩토리: 매 요약 시 최신 설정으로 서비스 인스턴스 생성
        // saveFolderPath가 전달되면 해당 경로 사용 (채널별 폴더), 아니면 기본 폴더
        const serviceFactory = (saveFolderPath?: string) => {
          const apiClient = new YouTubeSummaryApiClient(this.settings.apiKey);
          const noteCreator = new NoteCreator(
            this.app,
            saveFolderPath ?? this.settings.saveFolderPath
          );
          return new SummarizerService(apiClient, noteCreator);
        };

        // 구독 관련 의존성 생성 (매번 최신 설정으로 생성)
        const dataApiClient = new YouTubeDataApiClient(this.settings.youtubeDataApiKey);
        const subscriptionManager = new SubscriptionManager(dataApiClient, this.settings);

        view.setDependencies(serviceFactory, () => this.settings, {
          subscriptionManager,
          app: this.app,
        });
        return view;
      }
    );

    // 좌측 리본 아이콘 등록
    this.addRibbonIcon("youtube-play", "YouTube Summarizer", () => {
      this.activateView();
    });

    // 설정 탭 추가
    this.addSettingTab(new SettingsTab(this.app, this));
  }

  onunload(): void {
    // Obsidian이 registerView, addRibbonIcon, addSettingTab 등은 자동 정리
    // 추가 정리가 필요한 리소스가 있으면 여기에 추가
  }

  /**
   * 채널 ID로 채널 정보를 조회하는 메서드
   * 최신 youtubeDataApiKey로 YouTubeDataApiClient를 생성하여 호출
   * SettingsTab의 YouTubeSummarizerPluginInterface를 만족시킴
   */
  async fetchChannelInfo(channelId: string): Promise<SubscriptionChannel> {
    const apiClient = new YouTubeDataApiClient(this.settings.youtubeDataApiKey);
    return apiClient.fetchChannelInfo(channelId);
  }

  async loadSettings(): Promise<void> {
    this.settings = Object.assign(
      {},
      DEFAULT_SETTINGS,
      await this.loadData()
    );
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  async activateView(): Promise<void> {
    const { workspace } = this.app;
    let leaf = workspace.getLeavesOfType(VIEW_TYPE_YOUTUBE_SUMMARIZER)[0];

    if (!leaf) {
      const rightLeaf = workspace.getRightLeaf(false);
      if (rightLeaf) {
        await rightLeaf.setViewState({
          type: VIEW_TYPE_YOUTUBE_SUMMARIZER,
          active: true,
        });
        leaf = rightLeaf;
      }
    }

    if (leaf) {
      workspace.revealLeaf(leaf);
    }
  }
}
