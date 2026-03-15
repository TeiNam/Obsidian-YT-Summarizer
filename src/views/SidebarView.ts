// ============================================================
// 사이드바 뷰 컴포넌트
// 유튜브 영상 요약을 위한 사이드바 패널 UI
// API 마이그레이션 후: 스크립트 textarea 제거, API Key 검증 추가
// ============================================================

import { ItemView, WorkspaceLeaf, Notice } from "obsidian";
import { validateYouTubeUrl } from "../utils/YouTubeUrlValidator";
import { SummarizerService } from "../services/SummarizerService";
import { PluginSettings, SummaryStage } from "../models/types";
import { t, Translations } from "../i18n";

/** 뷰 타입 식별자 상수 - main.ts에서 뷰 등록 시 사용 */
export const VIEW_TYPE_YOUTUBE_SUMMARIZER = "youtube-summarizer-view";

/**
 * SummarizerService 팩토리 타입
 * 매 요약 실행 시 최신 설정으로 서비스를 생성하기 위해 사용
 */
export type SummarizerServiceFactory = () => SummarizerService;

/**
 * 유튜브 요약 사이드바 뷰 클래스
 * 사용자가 유튜브 링크를 입력하고 요약을 실행하는 UI를 제공
 */
export class SidebarView extends ItemView {
  /** 유튜브 URL 입력 필드 */
  private urlInput!: HTMLInputElement;
  /** 요약 실행 버튼 */
  private summarizeButton!: HTMLButtonElement;
  /** 상태 메시지 표시 영역 */
  private statusMessage!: HTMLElement;

  /** 요약 서비스 팩토리 - 매 요약 시 최신 설정으로 서비스 생성 */
  private createSummarizerService: SummarizerServiceFactory | null = null;
  /** 플러그인 설정 getter */
  private getSettings: (() => PluginSettings) | null = null;
  /** 요약 진행 중 여부 - 더블클릭 방지용 */
  private isProcessing = false;

  constructor(leaf: WorkspaceLeaf) {
    super(leaf);
    this.icon = "youtube-play";
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
   */
  setDependencies(
    serviceFactory: SummarizerServiceFactory | SummarizerService,
    getSettings: () => PluginSettings
  ): void {
    if (typeof serviceFactory === "function") {
      this.createSummarizerService = serviceFactory as SummarizerServiceFactory;
    } else {
      this.createSummarizerService = () => serviceFactory;
    }
    this.getSettings = getSettings;
  }

  getViewType(): string {
    return VIEW_TYPE_YOUTUBE_SUMMARIZER;
  }

  getDisplayText(): string {
    return "YouTube Summarizer";
  }

  /**
   * 사이드바 패널이 열릴 때 UI를 렌더링
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

    // 입력 영역 컨테이너
    const inputContainer = container.createDiv({
      cls: "youtube-summarizer-input-container",
    });

    // 유튜브 링크 입력창
    this.urlInput = inputContainer.createEl("input", {
      type: "text",
      placeholder: tr.urlPlaceholder,
    });
    this.urlInput.addClass("youtube-summarizer-url-input");

    // 요약 버튼
    this.summarizeButton = inputContainer.createEl("button", {
      text: tr.summarizeButton,
    });
    this.summarizeButton.addClass("youtube-summarizer-button");
    this.summarizeButton.addEventListener("click", () => {
      this.handleSummarize();
    });

    // 상태 메시지 영역
    this.statusMessage = container.createDiv({
      cls: "youtube-summarizer-status",
    });
  }

  async onClose(): Promise<void> {
    this.contentEl.empty();
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

      // 새 API 시그니처: (videoUrl, targetLanguage, onProgress)
      await summarizerService.summarize(
        url,
        settings.language,
        (stage: string) => {
          this.setLoading(true, this.resolveStageText(stage));
        }
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
    this.summarizeButton.disabled = false;
    this.summarizeButton.textContent = tr.summarizeButton;
  }
}
