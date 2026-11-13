// ============================================================
// YouTubeSummarizerPlugin - 플러그인 진입점
// 옵시디언 Plugin 클래스를 상속하여 사이드바 뷰, 설정 탭,
// 서비스 의존성을 연결하는 메인 모듈
// 매 요약마다 최신 설정으로 로컬 자막·모델 서비스를 생성
// ============================================================

import { Notice, Plugin, WorkspaceLeaf, addIcon } from "obsidian";
import { detectLanguage, t } from "./i18n";
import { PluginSettings, DEFAULT_SETTINGS, SubscriptionChannel } from "./models/types";
import {
  SidebarView,
  VIEW_TYPE_YOUTUBE_SUMMARIZER,
} from "./views/SidebarView";
import { SettingsTab } from "./settings/SettingsTab";
import { NoteCreator } from "./services/NoteCreator";
import { SummarizerService } from "./services/SummarizerService";
import { AiModelClient } from "./services/AiModelClient";
import { requestHttp } from "./services/http";
import { migratePlaintextSecrets, resolveSecrets } from "./services/secrets";
import { YouTubeDataApiClient } from "./services/YouTubeDataApiClient";
import { SubscriptionManager } from "./services/SubscriptionManager";

/**
 * 유튜브 요약 플러그인 메인 클래스
 */
export default class YouTubeSummarizerPlugin extends Plugin {
  declare settings: PluginSettings;

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
          const settings = this.getResolvedSettings();
          const noteCreator = new NoteCreator(this.app, saveFolderPath ?? settings.saveFolderPath);
          // 프로필 실패로 Bearer 토큰을 쓰게 되면 조용히 넘어가지 않고 알린다.
          const model = new AiModelClient(settings, requestHttp, () => {
            new Notice(t(settings.language).noticeBearerFallback);
          });
          return new SummarizerService(settings, noteCreator, undefined, model);
        };

        // 채널이나 API 키를 바꾼 뒤에도 뷰를 다시 열 필요가 없도록, 조회할 때마다 최신 설정으로 만든다.
        const subscriptionManager = {
          lastFetchError: undefined as unknown,
          fetchNewVideos: async () => {
            const settings = this.getResolvedSettings();
            const manager = new SubscriptionManager(new YouTubeDataApiClient(settings.youtubeDataApiKey), settings);
            try {
              return await manager.fetchNewVideos();
            } finally {
              subscriptionManager.lastFetchError = manager.lastFetchError;
            }
          },
        };

        view.setDependencies(serviceFactory, () => this.getResolvedSettings(), {
          subscriptionManager,
          app: this.app,
          markSummarized: (videoId: string) => this.markVideoSummarized(videoId),
        });
        return view;
      }
    );

    // 좌측 리본 아이콘 등록
    this.addRibbonIcon("youtube-play", "YouTube LLM Summarizer", () => {
      void this.activateView();
    });

    // 리본을 숨긴 사용자도 명령 팔레트에서 사이드바를 열 수 있게 한다.
    this.addCommand({
      id: "open-sidebar",
      name: t(this.settings.language).commandOpenSidebar,
      callback: () => {
        void this.activateView();
      },
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
    const apiClient = new YouTubeDataApiClient(this.getResolvedSettings().youtubeDataApiKey);
    return apiClient.fetchChannelInfo(channelId);
  }

  /**
   * 영상 요약 완료를 설정에 영구 저장
   * 피드에서 "요약함" 표시를 뷰 재오픈 후에도 유지하기 위해 사용
   * @param videoId - 요약 완료한 영상 ID
   */
  async markVideoSummarized(videoId: string): Promise<void> {
    if (this.settings.summarizedVideoIds.includes(videoId)) return;
    // 불변 업데이트로 새 배열 생성
    this.settings = {
      ...this.settings,
      summarizedVideoIds: [...this.settings.summarizedVideoIds, videoId],
    };
    await this.saveSettings();
  }

  /** API 키 값을 비밀 저장소에서 채운 설정. 서비스와 뷰에는 항상 이 결과를 넘긴다 */
  getResolvedSettings(): PluginSettings {
    return resolveSecrets(this.settings, this.app.secretStorage);
  }

  async loadSettings(): Promise<void> {
    const saved = (await this.loadData()) as Partial<PluginSettings> | null;
    const merged = { ...DEFAULT_SETTINGS, ...saved };
    const settings: PluginSettings = {
      ...merged,
      // 저장된 UI 언어가 없으면(첫 실행) Obsidian에서 고른 언어로 초기화
      language: saved?.language ?? detectLanguage(),
      // 기본 배열을 다른 플러그인 인스턴스나 이전 설정 객체와 공유하지 않는다.
      monitoredChannels: [...merged.monitoredChannels],
      summarizedVideoIds: [...merged.summarizedVideoIds],
      bedrockModels: [...merged.bedrockModels],
    };
    // 예전 버전이 data.json에 평문으로 둔 API 키는 비밀 저장소로 옮기고 파일에서 지운다.
    const migrated = migratePlaintextSecrets(settings, this.app.secretStorage);
    this.settings = migrated ?? settings;
    if (migrated) await this.saveData(this.settings);
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
    // 열려 있는 사이드바의 UI 언어와 제공자·모델·구독 현황 표시를 새 설정에 맞춘다.
    for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE_YOUTUBE_SUMMARIZER)) {
      if (leaf.view instanceof SidebarView) leaf.view.onSettingsChanged();
    }
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
      await workspace.revealLeaf(leaf);
    }
  }
}
