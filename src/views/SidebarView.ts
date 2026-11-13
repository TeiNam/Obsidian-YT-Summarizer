// ============================================================
// 사이드바 뷰 컴포넌트
// 유튜브 영상 요약을 위한 사이드바 패널 UI
// URL 요약 탭과 구독 피드 탭 전환 지원
// ============================================================

import { ItemView, WorkspaceLeaf, Notice, App, TFile, setIcon } from "obsidian";
import { validateYouTubeUrl } from "../utils/YouTubeUrlValidator";
import { SummarizerService } from "../services/SummarizerService";
import { getAiConfigurationError } from "../services/AiModelClient";
import { AI_MODEL_FIELDS, AI_PROVIDER_LABELS, PluginSettings, SummaryStage } from "../models/types";
import { t, Translations } from "../i18n";
import { SubscriptionManager } from "../services/SubscriptionManager";
import { FeedView } from "./FeedView";
import { stageText } from "./stageText";

const STATUS_ICONS = { loading: "loader", error: "alert-triangle", success: "check" } as const;
type StatusKind = keyof typeof STATUS_ICONS;

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
  /** 영상 요약 완료를 영구 저장하는 콜백 (FeedView로 전달) */
  markSummarized?: (videoId: string) => Promise<void>;
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
  /** 벌크(여러 URL) 입력 영역 */
  private bulkTextarea!: HTMLTextAreaElement;
  /** 벌크 요약 실행 버튼 */
  private bulkButton!: HTMLButtonElement;
  private bulkCancelButton!: HTMLButtonElement;
  private scriptDetails!: HTMLDetailsElement;
  private isBulkCancelled = false;
  /** 요약 실행 버튼 */
  private summarizeButton!: HTMLButtonElement;
  /** 상태 메시지 표시 영역 */
  private statusMessage!: HTMLElement;
  private infoEl: HTMLElement | null = null;

  /** 탭 콘텐츠 영역 */
  private tabContentEl!: HTMLElement;
  /** 탭 버튼 컨테이너 */
  private tabContainerEl!: HTMLElement;
  /** 탭별 DOM을 보관해 입력값과 진행 중인 작업의 화면을 유지한다. */
  private tabPanels: Partial<Record<"url" | "feed", HTMLElement>> = {};

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
    return "YouTube LLM Summarizer";
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

    // 상태 메시지는 어느 탭에서도 볼 수 있도록 탭 위에 배치한다.
    this.statusMessage = container.createDiv({
      cls: "youtube-summarizer-status",
    });
    this.statusMessage.setAttribute("role", "status");

    // 탭 컨테이너 렌더링
    this.tabContainerEl = container.createDiv({
      cls: "youtube-summarizer-tabs",
    });

    // 탭은 키보드로도 전환할 수 있어야 한다 (Enter·Space로 선택, 좌우 화살표로 이동)
    this.tabContainerEl.setAttribute("role", "tablist");
    for (const [tab, label] of [["url", tr.tabUrlSummary], ["feed", tr.tabSubscriptionFeed]] as const) {
      const tabEl = this.tabContainerEl.createDiv({ cls: "youtube-summarizer-tab" });
      tabEl.textContent = label;
      tabEl.dataset.tab = tab;
      tabEl.setAttribute("role", "tab");
      tabEl.addEventListener("click", () => this.switchTab(tab));
      tabEl.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          this.switchTab(tab);
        } else if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
          event.preventDefault();
          this.switchTab(tab === "url" ? "feed" : "url", true);
        }
      });
    }

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
    this.tabPanels = {};
    this.contentEl.empty();
  }

  /**
   * 탭은 처음 열 때만 생성하고, 전환 시 보관한 DOM을 다시 표시한다.
   * 비활성 탭의 요약 콜백도 같은 DOM을 갱신하므로 결과가 유지된다.
   */
  private switchTab(tab: "url" | "feed", shouldFocus = false): void {
    this.activeTab = tab;
    // 마지막 선택 탭 상태를 static 변수에 저장 (뷰 재오픈 시 복원)
    SidebarView.lastActiveTab = tab;

    // 탭 버튼 active 클래스 토글
    const tabButtons = this.tabContainerEl.querySelectorAll(".youtube-summarizer-tab");
    tabButtons.forEach((btn) => {
      const btnEl = btn as HTMLElement;
      const isActive = btnEl.dataset.tab === tab;
      btnEl.classList.toggle("active", isActive);
      btnEl.setAttribute("aria-selected", String(isActive));
      btnEl.tabIndex = isActive ? 0 : -1;
      if (isActive && shouldFocus) btnEl.focus();
    });

    let panel = this.tabPanels[tab];
    if (!panel) {
      panel = this.tabContentEl.createDiv();
      this.tabPanels[tab] = panel;
      if (tab === "url") this.renderUrlTab(panel);
      else this.renderFeedTab(panel);
    }
    this.tabContentEl.replaceChildren(panel);
  }

  /**
   * URL 요약 탭 렌더링
   * URL 입력과 단일/일괄 요약 폼 생성
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
    this.urlInput.addEventListener("keydown", (event) => {
      // 한글 조합 중의 Enter는 글자 확정이므로 요약을 시작하지 않는다.
      if (event.key === "Enter" && !event.isComposing) this.handleSummarize();
    });

    // 요약 버튼 (URL 바로 아래에 배치하여 주 동선을 단순화)
    this.summarizeButton = inputContainer.createEl("button", {
      text: tr.summarizeButton,
      cls: "youtube-summarizer-button",
    });
    this.summarizeButton.addClass("mod-cta");
    this.summarizeButton.addEventListener("click", () => {
      this.handleSummarize();
    });

    // 스크립트/자막 직접 입력 영역 - 잘 안 쓰는 기능이라 기본 접힘(native <details>)
    const scriptContainer = inputContainer.createEl("details", {
      cls: "youtube-summarizer-script-container",
    });
    this.scriptDetails = scriptContainer;

    // summary가 곧 접기/펼치기 토글이자 라벨 역할
    scriptContainer.createEl("summary", {
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

    // 벌크 입력 영역 - 한 줄에 링크 하나씩, 큐처럼 순차 실행 (기본 접힘)
    const bulkContainer = inputContainer.createEl("details", {
      cls: "youtube-summarizer-script-container",
    });

    bulkContainer.createEl("summary", {
      text: tr.bulkLabel,
      cls: "youtube-summarizer-script-label",
    });

    this.bulkTextarea = bulkContainer.createEl("textarea", {
      placeholder: tr.bulkPlaceholder,
      cls: "youtube-summarizer-script-textarea",
    });

    this.bulkButton = bulkContainer.createEl("button", {
      text: tr.bulkButton,
      cls: "youtube-summarizer-button",
    });
    this.bulkButton.addClass("mod-cta");
    this.bulkButton.addEventListener("click", () => {
      this.handleBulkSummarize();
    });

    // 진행 중에만 보이는 중단 버튼: 현재 영상이 끝나면 남은 링크를 건너뛴다.
    this.bulkCancelButton = bulkContainer.createEl("button", {
      text: tr.bulkCancelButton,
      cls: "youtube-summarizer-cancel-button",
    });
    this.bulkCancelButton.hidden = true;
    this.bulkCancelButton.addEventListener("click", () => {
      this.isBulkCancelled = true;
      this.bulkCancelButton.disabled = true;
    });

    bulkContainer.createDiv({
      text: tr.bulkHint,
      cls: "youtube-summarizer-script-hint",
    });

    this.infoEl = container.createDiv({ cls: "youtube-summarizer-info" });
    this.refreshInfo();
  }

  /** URL 탭 아래의 현황: 요약에 쓰는 제공자·모델과 구독 피드 상태. 설정이 저장될 때마다 다시 그린다 */
  refreshInfo(): void {
    const settings = this.getSettings?.();
    if (!this.infoEl || !settings) return;
    const tr = this.tr;
    const channels = settings.monitoredChannels ?? [];
    const groupCount = new Set(channels.map((channel) => channel.group?.trim()).filter(Boolean)).size;
    const feedStatus = !settings.youtubeDataApiKey.trim() ? tr.infoFeedNeedsKey
      : channels.length ? tr.infoFeedReady : tr.infoFeedNoChannels;

    this.infoEl.empty();
    const rows: [string, string][] = [
      [tr.infoProviderLabel, AI_PROVIDER_LABELS[settings.aiProvider]],
      [tr.infoModelLabel, settings[AI_MODEL_FIELDS[settings.aiProvider]].trim() || tr.infoNotSet],
      [tr.infoFeedLabel, feedStatus],
      [tr.infoGroupsLabel, String(groupCount)],
      [tr.infoChannelsLabel, String(channels.length)],
    ];
    for (const [label, value] of rows) {
      const row = this.infoEl.createDiv({ cls: "youtube-summarizer-info-row" });
      row.createEl("span", { text: label, cls: "youtube-summarizer-info-label" });
      row.createEl("span", { text: value, cls: "youtube-summarizer-info-value" });
    }
    if (channels.length) {
      const listEl = this.infoEl.createEl("ul", { cls: "youtube-summarizer-info-channels" });
      for (const channel of channels) {
        const itemEl = listEl.createEl("li", { text: channel.channelTitle });
        const group = channel.group?.trim();
        if (group) itemEl.createEl("span", { text: group, cls: "youtube-summarizer-info-channel-group" });
      }
    }
    // 지금 설정으로는 요약할 수 없는 경우 이유를 바로 보여준다.
    const configurationError = getAiConfigurationError(settings);
    if (configurationError) {
      this.infoEl.createDiv({ text: configurationError, cls: "youtube-summarizer-info-warning" });
    }
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
      markSummarized: this.subscriptionDeps.markSummarized,
    });

    this.feedView.render();
    this.feedView.loadFeed();
  }

  /**
   * 요약 버튼 클릭 시 실행되는 핸들러
   * URL 검증 → 모델 설정 검증 → SummarizerService.summarize() 호출
   */
  private async handleSummarize(): Promise<void> {
    if (this.isProcessing) return;

    const tr = this.tr;
    const url = this.urlInput.value.trim();

    // URL 유효성 검증
    const validation = validateYouTubeUrl(url);
    if (!validation.isValid) {
      this.showError(validation.error === "empty" ? tr.errorEmptyUrl : tr.errorInvalidUrl);
      return;
    }

    // 의존성 확인
    if (!this.createSummarizerService || !this.getSettings) {
      this.showError(tr.errorNotInitialized);
      return;
    }

    const settings = this.getSettings();

    const configurationError = getAiConfigurationError(settings);
    if (configurationError) {
      this.showError(configurationError);
      return;
    }

    try {
      this.isProcessing = true;
      this.setLoading(true, stageText(tr, SummaryStage.VALIDATING));

      const summarizerService = this.createSummarizerService();

      // 스크립트 입력값 가져오기
      const manualTranscript = this.scriptTextarea?.value?.trim() || undefined;

      const file = await summarizerService.summarize(
        url,
        settings.summaryLanguage,
        (stage: string) => {
          this.setLoading(true, stageText(tr, stage));
        },
        manualTranscript
      );

      this.showSuccess(stageText(tr, SummaryStage.COMPLETE), file);
      new Notice(tr.noticeSummaryComplete);
      this.resetForm();
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : tr.errorSummarizeFailed;
      this.showError(errorMessage);
      // 자막을 못 가져온 경우 다음 행동(자막 직접 붙여넣기)을 바로 보여준다.
      const isCaptionError = [
        tr.errorNoCaptions, tr.errorCaptionAccess, tr.errorCaptionFormat,
        tr.errorCaptionIncomplete, tr.errorCaptionsTimeout,
      ].some((message) => errorMessage.startsWith(message));
      if (isCaptionError && this.scriptDetails) this.scriptDetails.open = true;
      this.summarizeButton.disabled = false;
      this.summarizeButton.textContent = tr.summarizeButton;
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * 벌크 요약 핸들러
   * textarea를 줄 단위로 파싱 → 유효한 유튜브 URL만 큐로 만들어 순차 처리
   * 각 항목은 handleSummarize와 동일한 파이프라인(summarize)을 재사용
   */
  private async handleBulkSummarize(): Promise<void> {
    if (this.isProcessing) return;

    const tr = this.tr;
    const lines = this.bulkTextarea.value
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
    const urls = lines.filter((line) => validateYouTubeUrl(line).isValid);
    const skippedLines = lines.filter((line) => !validateYouTubeUrl(line).isValid);

    if (urls.length === 0) {
      this.showError(tr.errorInvalidUrl);
      return;
    }

    if (!this.createSummarizerService || !this.getSettings) {
      this.showError(tr.errorNotInitialized);
      return;
    }

    const settings = this.getSettings();
    const configurationError = getAiConfigurationError(settings);
    if (configurationError) {
      this.showError(configurationError);
      return;
    }

    let ok = 0;
    const failures: { url: string; reason: string }[] = [];
    let remainingUrls: string[] = [];

    try {
      this.isProcessing = true;
      this.isBulkCancelled = false;
      this.bulkButton.disabled = true;
      this.bulkCancelButton.disabled = false;
      this.bulkCancelButton.hidden = false;
      this.setLoading(true, tr.bulkProgress(0, urls.length));

      // 큐 순차 실행: 하나 끝나야 다음 시작 (API/노트 순서 보존)
      for (let i = 0; i < urls.length; i++) {
        if (this.isBulkCancelled) {
          remainingUrls = urls.slice(i);
          break;
        }
        const url = urls[i];
        try {
          const service = this.createSummarizerService();
          await service.summarize(url, settings.summaryLanguage, (stage) => {
            this.setLoading(true, `${tr.bulkProgress(i, urls.length)} ${stageText(tr, stage)}`);
          });
          ok++;
        } catch (error) {
          failures.push({ url, reason: error instanceof Error ? error.message : tr.errorSummarizeFailed });
        }
      }

      const summary = tr.bulkDone(ok, failures.length);
      const details = [
        summary,
        skippedLines.length ? tr.bulkSkipped(skippedLines.length) : "",
        remainingUrls.length ? tr.bulkCancelled(remainingUrls.length) : "",
        ...failures.map(({ url, reason }) => `${url} — ${reason}`),
      ].filter(Boolean).join("\n");
      if (failures.length) this.showError(details);
      else this.showSuccess(details);
      new Notice(summary);
      // 실패·중단·건너뛴 줄은 입력란에 남겨 고치거나 바로 재시도할 수 있게 한다.
      this.bulkTextarea.value = [...failures.map(({ url }) => url), ...remainingUrls, ...skippedLines].join("\n");
    } finally {
      this.isProcessing = false;
      this.bulkButton.disabled = false;
      this.bulkCancelButton.hidden = true;
      this.summarizeButton.disabled = false;
      this.summarizeButton.textContent = tr.summarizeButton;
    }
  }

  setLoading(loading: boolean, message?: string): void {
    const tr = this.tr;
    this.summarizeButton.disabled = loading;
    this.summarizeButton.textContent = loading ? tr.summarizingButton : tr.summarizeButton;

    if (loading && message) this.setStatus("loading", message);
    else if (!loading) this.setStatus(null, "");
  }

  showError(message: string): void {
    this.setStatus("error", message);
  }

  /** file을 넘기면 완료 문구 옆에 생성된 노트를 여는 링크를 붙인다 */
  showSuccess(message: string, file?: TFile): void {
    this.setStatus("success", message);
    if (!file) return;
    const link = this.statusMessage.createEl("a", {
      text: this.tr.openNoteLink,
      cls: "youtube-summarizer-open-note",
    });
    link.setAttribute("href", "#");
    link.addEventListener("click", (event) => {
      event.preventDefault();
      void this.app.workspace.getLeaf(false).openFile(file);
    });
  }

  private setStatus(kind: StatusKind | null, message: string): void {
    const el = this.statusMessage;
    el.empty();
    el.className = kind ? `youtube-summarizer-status ${kind}` : "youtube-summarizer-status";
    // 오류는 스크린 리더가 즉시 읽도록 alert로 알린다.
    el.setAttribute("role", kind === "error" ? "alert" : "status");
    if (!kind || !message) return;
    setIcon(el.createEl("span", { cls: "youtube-summarizer-status-icon" }), STATUS_ICONS[kind]);
    el.createEl("span", { text: message, cls: "youtube-summarizer-status-text" });
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
