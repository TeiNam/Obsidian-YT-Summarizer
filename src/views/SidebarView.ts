// ============================================================
// 사이드바 뷰 컴포넌트
// 유튜브 영상 요약을 위한 사이드바 패널 UI
// URL 요약 탭과 구독 피드 탭 전환 지원
// ============================================================

import { ItemView, WorkspaceLeaf, Notice, App } from "obsidian";
import { validateYouTubeUrl } from "../utils/YouTubeUrlValidator";
import { SummarizerService } from "../services/SummarizerService";
import { PluginSettings, SummaryStage } from "../models/types";
import { t, Translations } from "../i18n";
import { SubscriptionManager } from "../services/SubscriptionManager";
import { FeedView } from "./FeedView";

/** 뷰 타입 식별자 상수 - main.ts에서 뷰 등록 시 사용 */
export const VIEW_TYPE_YOUTUBE_SUMMARIZER = "youtube-summarizer-view";

/**
 * SummarizerService 팩토리 타입
 * 매 요약 실행 시 최신 설정으로 서비스를 생성하기 위해 사용
 */
export type SummarizerServiceFactory = (saveFolderPath?: string) => SummarizerService;

/**
 * 구독 관련 의존성 인터페이스
 */
export interface SubscriptionDependencies {
  /** 구독 관리 서비스 */
  subscriptionManager: SubscriptionManager;
  /** 옵시디언 App 인스턴스 */
  app: App;
}

/**
 * 유튜브 요약 사이드바 뷰 클래스
 * URL 요약 탭과 구독 피드 탭을 전환하여 사용
 */
export class SidebarView extends ItemView {
  /** 마지막 선택 탭 상태를 메모리에서 유지 (뷰 재오픈 시 복원) */
  private static lastActiveTab: "url" | "feed" = "url";

  /** 현재 활성 탭 */
  private activeTab: "url" | "feed" = "url";

  /** 유튜브 URL 입력 필드 */
  private urlInput!: HTMLInputElement;
  /** 스크립트/자막 직접 입력 영역 */
  private scriptTextarea!: HTMLTextAreaElement;
  /** 요약 실행 버튼 */
  private summarizeButton!: HTMLButtonElement;
  /** 상태 메시지 표시 영역 */
  private statusMessage!: HTMLElement;

  /** 탭 콘텐츠 영역 */
  private tabContentEl!: HTMLElement;
  /** 탭 버튼 컨테이너 */
  private tabContainerEl!: HTMLElement;

  /** FeedView 인스턴스 (구독 피드 탭용) */
  private feedView: FeedView | null = null;

  /** 요약 서비스 팩토리 - 매 요약 시 최신 설정으로 서비스 생성 */
  private createSummarizerService: SummarizerServiceFactory | null = null;
  /** 플러그인 설정 getter */
  private getSettings: (() => PluginSettings) | null = null;
  /** 요약 진행 중 여부 - 더블클릭 방지용 */
  private isProcessing = false;

  /** 구독 관련 의존성 */
  private subscriptionDeps: SubscriptionDependencies | null = null;

  constructor(leaf: WorkspaceLeaf) {
    super(leaf);
    this.icon = "youtube-play";
    // 마지막 선택 탭 상태 복원
    this.activeTab = SidebarView.lastActiveTab;
  }

  /**
   * 현재 설정 언어에 맞는 번역 객체를 반환하는 헬퍼
   */
  private get tr(): Translations {
    const lang = this.getSettings?.()?.language ?? "en";
    return t(lang);
  }

  /**
   * 플러그인에서 의존성을 주입하는 메서드
   * 기존 시그니처를 유지하면서 구독 관련 의존성을 선택적으로 추가
   */
  setDependencies(
    serviceFactory: SummarizerServiceFactory | SummarizerService,
    getSettings: () => PluginSettings,
    subscriptionDeps?: SubscriptionDependencies
  ): void {
    if (typeof serviceFactory === "function") {
      this.createSummarizerService = serviceFactory as SummarizerServiceFactory;
    } else {
      this.createSummarizerService = () => serviceFactory;
    }
    this.getSettings = getSettings;
    if (subscriptionDeps) {
      this.subscriptionDeps = subscriptionDeps;
    }
  }

  getViewType(): string {
    return VIEW_TYPE_YOUTUBE_SUMMARIZER;
  }

  getDisplayText(): string {
    return "YouTube Summarizer";
  }

  /**
   * 사이드바 패널이 열릴 때 UI를 렌더링
   * 탭 UI를 먼저 렌더링하고, 마지막 선택 탭에 따라 콘텐츠 렌더링
   */
  async onOpen(): Promise<void> {
    const container = this.contentEl;
    container.empty();
    container.addClass("youtube-summarizer-container");

    const tr = this.tr;

    // 제목 영역
    const titleEl = container.createEl("h4", {
      text: tr.sidebarTitle,
    });
    titleEl.addClass("youtube-summarizer-title");

    // 탭 컨테이너 렌더링
    this.tabContainerEl = container.createDiv({
      cls: "youtube-summarizer-tabs",
    });

    // URL 요약 탭 버튼 (div 사용 - 기존 button 쿼리와 충돌 방지)
    const urlTabBtn = this.tabContainerEl.createDiv({
      cls: "youtube-summarizer-tab",
    });
    urlTabBtn.textContent = tr.tabUrlSummary;
    urlTabBtn.dataset.tab = "url";
    urlTabBtn.setAttribute("role", "tab");
    urlTabBtn.addEventListener("click", () => {
      this.switchTab("url");
    });

    // 구독 피드 탭 버튼
    const feedTabBtn = this.tabContainerEl.createDiv({
      cls: "youtube-summarizer-tab",
    });
    feedTabBtn.textContent = tr.tabSubscriptionFeed;
    feedTabBtn.dataset.tab = "feed";
    feedTabBtn.setAttribute("role", "tab");
    feedTabBtn.addEventListener("click", () => {
      this.switchTab("feed");
    });

    // 탭 콘텐츠 영역
    this.tabContentEl = container.createDiv({
      cls: "youtube-summarizer-tab-content",
    });

    // 현재 활성 탭에 따라 콘텐츠 렌더링
    this.switchTab(this.activeTab);
  }

  async onClose(): Promise<void> {
    // FeedView 정리
    if (this.feedView) {
      this.feedView.destroy();
      this.feedView = null;
    }
    this.contentEl.empty();
  }

  /**
   * 탭 전환 메서드
   * 1. activeTab 상태 업데이트
   * 2. 탭 버튼의 active 클래스 토글
   * 3. 탭 콘텐츠 영역 비우기
   * 4. 해당 탭의 콘텐츠 렌더링
   */
  private switchTab(tab: "url" | "feed"): void {
    this.activeTab = tab;
    // 마지막 선택 탭 상태를 static 변수에 저장 (뷰 재오픈 시 복원)
    SidebarView.lastActiveTab = tab;

    // 탭 버튼 active 클래스 토글
    const tabButtons = this.tabContainerEl.querySelectorAll(".youtube-summarizer-tab");
    tabButtons.forEach((btn) => {
      const btnEl = btn as HTMLElement;
      if (btnEl.dataset.tab === tab) {
        btnEl.classList.add("active");
      } else {
        btnEl.classList.remove("active");
      }
    });

    // 기존 FeedView 정리
    if (this.feedView) {
      this.feedView.destroy();
      this.feedView = null;
    }

    // 탭 콘텐츠 영역 비우기
    while (this.tabContentEl.firstChild) {
      this.tabContentEl.removeChild(this.tabContentEl.firstChild);
    }

    // 해당 탭의 콘텐츠 렌더링
    if (tab === "url") {
      this.renderUrlTab(this.tabContentEl);
    } else {
      this.renderFeedTab(this.tabContentEl);
    }
  }

  /**
   * URL 요약 탭 렌더링
   * 기존 onOpen()의 URL 입력 + 요약 버튼 + 상태 메시지 UI
   */
  private renderUrlTab(container: HTMLElement): void {
    const tr = this.tr;

    // 입력 영역 컨테이너
    const inputContainer = container.createDiv({
      cls: "youtube-summarizer-input-container",
    });

    // 유튜브 링크 입력창
    this.urlInput = inputContainer.createEl("input", {
      type: "text",
      placeholder: tr.urlPlaceholder,
      cls: "youtube-summarizer-url-input",
    });

    // 스크립트/자막 직접 입력 영역
    const scriptContainer = inputContainer.createDiv({
      cls: "youtube-summarizer-script-container",
    });

    scriptContainer.createEl("label", {
      text: tr.scriptLabel,
      cls: "youtube-summarizer-script-label",
    });

    this.scriptTextarea = scriptContainer.createEl("textarea", {
      placeholder: tr.scriptPlaceholder,
      cls: "youtube-summarizer-script-textarea",
    });

    scriptContainer.createDiv({
      text: tr.scriptHint,
      cls: "youtube-summarizer-script-hint",
    });

    // 요약 버튼
    this.summarizeButton = inputContainer.createEl("button", {
      text: tr.summarizeButton,
      cls: "youtube-summarizer-button",
    });
    this.summarizeButton.addEventListener("click", () => {
      this.handleSummarize();
    });

    // 상태 메시지 영역
    this.statusMessage = container.createDiv({
      cls: "youtube-summarizer-status",
    });
  }

  /**
   * 구독 피드 탭 렌더링
   * FeedView 인스턴스를 생성하여 container에 렌더링
   */
  private renderFeedTab(container: HTMLElement): void {
    if (!this.subscriptionDeps || !this.createSummarizerService || !this.getSettings) {
      // 의존성이 없으면 안내 메시지 표시
      container.createDiv({
        text: this.tr.feedNoChannels,
        cls: "youtube-feed-empty",
      });
      return;
    }

    // FeedView 인스턴스 생성 및 렌더링
    this.feedView = new FeedView(container, {
      subscriptionManager: this.subscriptionDeps.subscriptionManager,
      summarizerServiceFactory: this.createSummarizerService,
      getSettings: this.getSettings,
      app: this.subscriptionDeps.app,
    });

    this.feedView.render();
    this.feedView.loadFeed();
  }

  /**
   * 요약 버튼 클릭 시 실행되는 핸들러
   * URL 검증 → API Key 검증 → SummarizerService.summarize() 호출
   */
  private async handleSummarize(): Promise<void> {
    if (this.isProcessing) return;

    const tr = this.tr;
    const url = this.urlInput.value.trim();

    // URL 유효성 검증
    const validation = validateYouTubeUrl(url);
    if (!validation.isValid) {
      this.showError(validation.error ?? tr.errorInvalidUrl);
      return;
    }

    // 의존성 확인
    if (!this.createSummarizerService || !this.getSettings) {
      this.showError(tr.errorNotInitialized);
      return;
    }

    const settings = this.getSettings();

    // API Key 미설정 사전 검증
    if (!settings.apiKey) {
      this.showError(tr.errorMissingApiKey);
      return;
    }

    try {
      this.isProcessing = true;
      this.setLoading(true, this.resolveStageText(SummaryStage.VALIDATING));

      const summarizerService = this.createSummarizerService();

      // 스크립트 입력값 가져오기
      const manualTranscript = this.scriptTextarea?.value?.trim() || undefined;

      // API 시그니처: (videoUrl, targetLanguage, onProgress, manualTranscript?)
      await summarizerService.summarize(
        url,
        settings.language,
        (stage: string) => {
          this.setLoading(true, this.resolveStageText(stage));
        },
        manualTranscript
      );

      this.showSuccess(this.resolveStageText(SummaryStage.COMPLETE));
      new Notice(tr.noticeSummaryComplete);
      this.resetForm();
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : tr.errorSummarizeFailed;
      this.showError(errorMessage);
      this.summarizeButton.disabled = false;
      this.summarizeButton.textContent = tr.summarizeButton;
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * SummaryStage enum 값을 현재 언어의 텍스트로 변환
   */
  private resolveStageText(stage: string): string {
    const tr = this.tr;
    const stageMap: Record<string, string> = {
      [SummaryStage.VALIDATING]: tr.stageValidating,
      [SummaryStage.PENDING]: tr.stagePending,
      [SummaryStage.EXTRACTING]: tr.stageExtracting,
      [SummaryStage.TRANSLATING]: tr.stageTranslating,
      [SummaryStage.SUMMARIZING]: tr.stageSummarizing,
      [SummaryStage.CREATING_NOTE]: tr.stageCreatingNote,
      [SummaryStage.COMPLETE]: tr.stageComplete,
    };
    return stageMap[stage] ?? stage;
  }

  setLoading(loading: boolean, message?: string): void {
    const tr = this.tr;
    this.summarizeButton.disabled = loading;
    this.summarizeButton.textContent = loading ? tr.summarizingButton : tr.summarizeButton;

    if (loading && message) {
      this.statusMessage.textContent = message;
      this.statusMessage.className = "youtube-summarizer-status loading";
    } else if (!loading) {
      this.statusMessage.textContent = "";
      this.statusMessage.className = "youtube-summarizer-status";
    }
  }

  showError(message: string): void {
    this.statusMessage.textContent = message;
    this.statusMessage.className = "youtube-summarizer-status error";
  }

  showSuccess(message: string): void {
    this.statusMessage.textContent = message;
    this.statusMessage.className = "youtube-summarizer-status success";
  }

  resetForm(): void {
    const tr = this.tr;
    this.urlInput.value = "";
    if (this.scriptTextarea) {
      this.scriptTextarea.value = "";
    }
    this.summarizeButton.disabled = false;
    this.summarizeButton.textContent = tr.summarizeButton;
  }
}
