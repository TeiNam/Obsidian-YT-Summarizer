// ============================================================
// YouTubeSummarizerPlugin - 플러그인 진입점
// 옵시디언 Plugin 클래스를 상속하여 사이드바 뷰, 설정 탭,
// 서비스 의존성을 연결하는 메인 모듈
// API 마이그레이션 후: YouTubeSummaryApiClient 사용
// ============================================================

import { Plugin, WorkspaceLeaf, addIcon } from "obsidian";
import { PluginSettings, DEFAULT_SETTINGS } from "./models/types";
import {
  SidebarView,
  VIEW_TYPE_YOUTUBE_SUMMARIZER,
} from "./views/SidebarView";
import { SettingsTab } from "./settings/SettingsTab";
import { YouTubeSummaryApiClient } from "./services/YouTubeSummaryApiClient";
import { NoteCreator } from "./services/NoteCreator";
import { SummarizerService } from "./services/SummarizerService";

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
        const serviceFactory = () => {
          const apiClient = new YouTubeSummaryApiClient(this.settings.apiKey);
          const noteCreator = new NoteCreator(
            this.app,
            this.settings.saveFolderPath
          );
          return new SummarizerService(apiClient, noteCreator);
        };

        view.setDependencies(serviceFactory, () => this.settings);
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

  async onunload(): Promise<void> {}

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
