// @vitest-environment jsdom
// ============================================================
// SidebarView 단위 테스트
// API 마이그레이션 후: 스크립트 textarea 제거, API Key 검증 추가
// 새 진행 단계 매핑 및 summarize() 시그니처 변경 검증
// ============================================================

import { describe, it, expect, vi, beforeEach } from "vitest";
import { WorkspaceLeaf } from "obsidian";
import { SidebarView, VIEW_TYPE_YOUTUBE_SUMMARIZER } from "./SidebarView";
import { SummarizerService } from "../services/SummarizerService";
import { PluginSettings, DEFAULT_SETTINGS, SummaryStage } from "../models/types";
import { t } from "../i18n";

// FeedView 모킹 - 실제 FeedView 인스턴스 생성 방지
vi.mock("./FeedView", () => ({
  FeedView: vi.fn().mockImplementation(() => ({
    render: vi.fn(),
    loadFeed: vi.fn(),
    destroy: vi.fn(),
  })),
}));

const tr = t("en");

// contentEl에 옵시디언 DOM 헬퍼 메서드 추가
function patchContentEl(el: HTMLElement): void {
  (el as any).empty = function () { this.innerHTML = ""; };
  (el as any).addClass = function (cls: string) { this.classList.add(cls); };
  (el as any).createEl = function (
    tag: string,
    opts?: { text?: string; type?: string; placeholder?: string; cls?: string }
  ) {
    const child = document.createElement(tag);
    if (opts?.text) child.textContent = opts.text;
    if (opts?.type) (child as HTMLInputElement).type = opts.type;
    if (opts?.placeholder) (child as HTMLInputElement).placeholder = opts.placeholder;
    if (opts?.cls) child.classList.add(opts.cls);
    patchContentEl(child);
    this.appendChild(child);
    return child;
  };
  (el as any).createDiv = function (opts?: { cls?: string; text?: string }) {
    const div = document.createElement("div");
    if (opts?.text) div.textContent = opts.text;
    if (opts?.cls) div.classList.add(opts.cls);
    patchContentEl(div);
    this.appendChild(div);
    return div;
  };
}

describe("SidebarView", () => {
  let view: SidebarView;
  let leaf: WorkspaceLeaf;

  beforeEach(() => {
    // 테스트 간 격리를 위해 마지막 활성 탭 상태를 URL 탭으로 리셋
    (SidebarView as any).lastActiveTab = "url";
    leaf = new WorkspaceLeaf();
    view = new SidebarView(leaf);
    view.contentEl = document.createElement("div");
    patchContentEl(view.contentEl);
  });

  describe("기본 속성", () => {
    it("getViewType()은 올바른 뷰 타입 식별자를 반환한다", () => {
      expect(view.getViewType()).toBe(VIEW_TYPE_YOUTUBE_SUMMARIZER);
    });

    it("getDisplayText()는 사이드바 탭 표시 텍스트를 반환한다", () => {
      expect(view.getDisplayText()).toBe("YouTube Summarizer");
    });
  });

  describe("onOpen() - UI 렌더링", () => {
    beforeEach(async () => {
      await view.onOpen();
    });

    it("유튜브 링크 입력창이 올바른 플레이스홀더와 함께 렌더링된다", () => {
      const input = view.contentEl.querySelector("input") as HTMLInputElement;
      expect(input).not.toBeNull();
      expect(input.placeholder).toBe(tr.urlPlaceholder);
    });

    it("요약 버튼이 렌더링된다", () => {
      const button = view.contentEl.querySelector("button") as HTMLButtonElement;
      expect(button).not.toBeNull();
      expect(button.textContent).toBe(tr.summarizeButton);
    });

    it("상태 메시지 영역이 렌더링된다", () => {
      const status = view.contentEl.querySelector(".youtube-summarizer-status");
      expect(status).not.toBeNull();
    });

    it("스크립트 textarea가 렌더링된다", () => {
      const textarea = view.contentEl.querySelector("textarea");
      expect(textarea).not.toBeNull();
      expect(textarea!.placeholder).toBe(tr.scriptPlaceholder);
    });

    it("스크립트 라벨과 힌트가 렌더링된다", () => {
      const label = view.contentEl.querySelector(".youtube-summarizer-script-label");
      expect(label).not.toBeNull();
      expect(label!.textContent).toBe(tr.scriptLabel);

      const hint = view.contentEl.querySelector(".youtube-summarizer-script-hint");
      expect(hint).not.toBeNull();
      expect(hint!.textContent).toBe(tr.scriptHint);
    });

    it("제목이 렌더링된다", () => {
      const title = view.contentEl.querySelector("h4");
      expect(title).not.toBeNull();
      expect(title!.textContent).toBe(tr.sidebarTitle);
    });
  });

  describe("onClose() - 정리", () => {
    it("패널이 닫힐 때 컨텐츠가 비워진다", async () => {
      await view.onOpen();
      expect(view.contentEl.children.length).toBeGreaterThan(0);
      await view.onClose();
      expect(view.contentEl.innerHTML).toBe("");
    });
  });

  describe("setLoading() - 로딩 상태 전환", () => {
    beforeEach(async () => { await view.onOpen(); });

    it("로딩 시작 시 버튼이 비활성화되고 상태 메시지가 표시된다", () => {
      view.setLoading(true, tr.stageExtracting);
      const button = view.contentEl.querySelector("button") as HTMLButtonElement;
      expect(button.disabled).toBe(true);
      expect(button.textContent).toBe(tr.summarizingButton);
      const status = view.contentEl.querySelector(".youtube-summarizer-status") as HTMLElement;
      expect(status.textContent).toBe(tr.stageExtracting);
      expect(status.classList.contains("loading")).toBe(true);
    });

    it("로딩 종료 시 버튼이 활성화되고 상태 메시지가 초기화된다", () => {
      view.setLoading(true, "Loading...");
      view.setLoading(false);
      const button = view.contentEl.querySelector("button") as HTMLButtonElement;
      expect(button.disabled).toBe(false);
      const status = view.contentEl.querySelector(".youtube-summarizer-status") as HTMLElement;
      expect(status.textContent).toBe("");
    });
  });

  describe("showError() / showSuccess()", () => {
    beforeEach(async () => { await view.onOpen(); });

    it("오류 메시지가 상태 영역에 표시된다", () => {
      view.showError(tr.errorInvalidUrl);
      const status = view.contentEl.querySelector(".youtube-summarizer-status") as HTMLElement;
      expect(status.textContent).toBe(tr.errorInvalidUrl);
      expect(status.classList.contains("error")).toBe(true);
    });

    it("성공 메시지가 상태 영역에 표시된다", () => {
      view.showSuccess(tr.stageComplete);
      const status = view.contentEl.querySelector(".youtube-summarizer-status") as HTMLElement;
      expect(status.textContent).toBe(tr.stageComplete);
      expect(status.classList.contains("success")).toBe(true);
    });
  });

  describe("resetForm() - 폼 초기화", () => {
    beforeEach(async () => { await view.onOpen(); });

    it("입력창이 비워지고 버튼이 활성화된다", () => {
      const input = view.contentEl.querySelector("input") as HTMLInputElement;
      const button = view.contentEl.querySelector("button") as HTMLButtonElement;
      input.value = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";
      button.disabled = true;
      view.resetForm();
      expect(input.value).toBe("");
      expect(button.disabled).toBe(false);
      expect(button.textContent).toBe(tr.summarizeButton);
    });
  });

  describe("요약 버튼 클릭 - URL 검증", () => {
    beforeEach(async () => { await view.onOpen(); });

    it("빈 입력 시 오류 메시지를 표시한다", async () => {
      const button = view.contentEl.querySelector("button") as HTMLButtonElement;
      button.click();
      await new Promise((r) => setTimeout(r, 10));
      const status = view.contentEl.querySelector(".youtube-summarizer-status") as HTMLElement;
      expect(status.textContent).toBe("유튜브 링크를 입력해주세요");
      expect(status.classList.contains("error")).toBe(true);
    });

    it("유효하지 않은 URL 입력 시 오류 메시지를 표시한다", async () => {
      const input = view.contentEl.querySelector("input") as HTMLInputElement;
      input.value = "https://example.com/not-youtube";
      const button = view.contentEl.querySelector("button") as HTMLButtonElement;
      button.click();
      await new Promise((r) => setTimeout(r, 10));
      const status = view.contentEl.querySelector(".youtube-summarizer-status") as HTMLElement;
      expect(status.textContent).toBe("유효한 유튜브 링크를 입력해주세요");
    });

    it("의존성이 없을 때 오류 메시지를 표시한다", async () => {
      const input = view.contentEl.querySelector("input") as HTMLInputElement;
      input.value = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";
      const button = view.contentEl.querySelector("button") as HTMLButtonElement;
      button.click();
      await new Promise((r) => setTimeout(r, 10));
      const status = view.contentEl.querySelector(".youtube-summarizer-status") as HTMLElement;
      expect(status.textContent).toBe(tr.errorNotInitialized);
    });
  });

  describe("요약 버튼 클릭 - API Key 검증", () => {
    beforeEach(async () => {
      const mockService = { summarize: vi.fn() } as unknown as SummarizerService;
      view.setDependencies(mockService, () => ({ ...DEFAULT_SETTINGS, apiKey: "" }));
      await view.onOpen();
    });

    it("API Key 미설정 시 오류 메시지를 표시한다", async () => {
      const input = view.contentEl.querySelector("input") as HTMLInputElement;
      input.value = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";
      const button = view.contentEl.querySelector("button") as HTMLButtonElement;
      button.click();
      await new Promise((r) => setTimeout(r, 10));
      const status = view.contentEl.querySelector(".youtube-summarizer-status") as HTMLElement;
      expect(status.textContent).toBe(tr.errorMissingApiKey);
      expect(status.classList.contains("error")).toBe(true);
    });
  });

  describe("요약 버튼 클릭 - 요약 플로우", () => {
    let mockSummarizerService: SummarizerService;
    let mockSettings: PluginSettings;

    beforeEach(async () => {
      mockSummarizerService = {
        summarize: vi.fn(),
      } as unknown as SummarizerService;
      mockSettings = { ...DEFAULT_SETTINGS, apiKey: "test-key" };
      view.setDependencies(mockSummarizerService, () => mockSettings);
      await view.onOpen();
    });

    it("유효한 URL로 요약 시 새 시그니처로 summarize()가 호출된다", async () => {
      const mockFile = { path: "test.md" };
      (mockSummarizerService.summarize as ReturnType<typeof vi.fn>).mockResolvedValue(mockFile);

      const input = view.contentEl.querySelector("input") as HTMLInputElement;
      input.value = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";
      const button = view.contentEl.querySelector("button") as HTMLButtonElement;
      button.click();
      await new Promise((r) => setTimeout(r, 50));

      // 새 시그니처: (videoUrl, targetLanguage, onProgress, manualTranscript?)
      expect(mockSummarizerService.summarize).toHaveBeenCalledWith(
        "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        "en",
        expect.any(Function),
        undefined
      );
    });

    it("요약 성공 시 성공 메시지가 표시되고 폼이 초기화된다", async () => {
      (mockSummarizerService.summarize as ReturnType<typeof vi.fn>).mockResolvedValue({ path: "test.md" });

      const input = view.contentEl.querySelector("input") as HTMLInputElement;
      input.value = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";
      const button = view.contentEl.querySelector("button") as HTMLButtonElement;
      button.click();
      await new Promise((r) => setTimeout(r, 50));

      const status = view.contentEl.querySelector(".youtube-summarizer-status") as HTMLElement;
      expect(status.textContent).toBe(tr.stageComplete);
      expect(input.value).toBe("");
    });

    it("요약 실패 시 오류 메시지가 표시되고 버튼이 다시 활성화된다", async () => {
      (mockSummarizerService.summarize as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("네트워크 오류가 발생했습니다")
      );

      const input = view.contentEl.querySelector("input") as HTMLInputElement;
      input.value = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";
      const button = view.contentEl.querySelector("button") as HTMLButtonElement;
      button.click();
      await new Promise((r) => setTimeout(r, 50));

      const status = view.contentEl.querySelector(".youtube-summarizer-status") as HTMLElement;
      expect(status.textContent).toBe("네트워크 오류가 발생했습니다");
      expect(status.classList.contains("error")).toBe(true);
      expect(button.disabled).toBe(false);
    });

    it("진행 단계별 상태 메시지가 콜백을 통해 업데이트된다", async () => {
      const progressStages: string[] = [];

      (mockSummarizerService.summarize as ReturnType<typeof vi.fn>).mockImplementation(
        async (_url: string, _lang: string, onProgress: (stage: string) => void) => {
          onProgress(SummaryStage.PENDING);
          progressStages.push(SummaryStage.PENDING);
          onProgress(SummaryStage.EXTRACTING);
          progressStages.push(SummaryStage.EXTRACTING);
          onProgress(SummaryStage.TRANSLATING);
          progressStages.push(SummaryStage.TRANSLATING);
          onProgress(SummaryStage.SUMMARIZING);
          progressStages.push(SummaryStage.SUMMARIZING);
          onProgress(SummaryStage.CREATING_NOTE);
          progressStages.push(SummaryStage.CREATING_NOTE);
          return { path: "test.md" };
        }
      );

      const input = view.contentEl.querySelector("input") as HTMLInputElement;
      input.value = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";
      const button = view.contentEl.querySelector("button") as HTMLButtonElement;
      button.click();
      await new Promise((r) => setTimeout(r, 50));

      expect(progressStages).toEqual([
        SummaryStage.PENDING,
        SummaryStage.EXTRACTING,
        SummaryStage.TRANSLATING,
        SummaryStage.SUMMARIZING,
        SummaryStage.CREATING_NOTE,
      ]);
    });

    it("요약 중 버튼이 비활성화된다", async () => {
      let buttonDuringProcess = false;

      (mockSummarizerService.summarize as ReturnType<typeof vi.fn>).mockImplementation(
        async (_url: string, _lang: string, onProgress: (stage: string) => void) => {
          onProgress(SummaryStage.SUMMARIZING);
          const btn = view.contentEl.querySelector("button") as HTMLButtonElement;
          buttonDuringProcess = btn.disabled;
          return { path: "test.md" };
        }
      );

      const input = view.contentEl.querySelector("input") as HTMLInputElement;
      input.value = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";
      const button = view.contentEl.querySelector("button") as HTMLButtonElement;
      button.click();
      await new Promise((r) => setTimeout(r, 50));

      expect(buttonDuringProcess).toBe(true);
    });
  });

  // ============================================================
  // 탭 전환 UI 테스트
  // Requirements: 7.1, 7.2, 7.3
  // ============================================================
  describe("탭 전환 UI", () => {
    beforeEach(async () => {
      // 마지막 활성 탭을 URL로 리셋하여 기본 상태에서 시작
      (SidebarView as any).lastActiveTab = "url";
      leaf = new WorkspaceLeaf();
      view = new SidebarView(leaf);
      view.contentEl = document.createElement("div");
      patchContentEl(view.contentEl);
      await view.onOpen();
    });

    it("탭 컨테이너와 URL 요약 탭, 구독 피드 탭 버튼이 렌더링된다", () => {
      // 탭 컨테이너 존재 확인
      const tabContainer = view.contentEl.querySelector(".youtube-summarizer-tabs");
      expect(tabContainer).not.toBeNull();

      // URL 요약 탭 버튼 확인
      const urlTab = view.contentEl.querySelector('[data-tab="url"]') as HTMLElement;
      expect(urlTab).not.toBeNull();
      expect(urlTab.textContent).toBe(tr.tabUrlSummary);
      expect(urlTab.getAttribute("role")).toBe("tab");

      // 구독 피드 탭 버튼 확인
      const feedTab = view.contentEl.querySelector('[data-tab="feed"]') as HTMLElement;
      expect(feedTab).not.toBeNull();
      expect(feedTab.textContent).toBe(tr.tabSubscriptionFeed);
      expect(feedTab.getAttribute("role")).toBe("tab");
    });

    it("기본 탭이 URL 요약 탭이다", () => {
      // URL 탭 버튼이 active 클래스를 가짐
      const urlTab = view.contentEl.querySelector('[data-tab="url"]') as HTMLElement;
      expect(urlTab.classList.contains("active")).toBe(true);

      // 피드 탭 버튼은 active가 아님
      const feedTab = view.contentEl.querySelector('[data-tab="feed"]') as HTMLElement;
      expect(feedTab.classList.contains("active")).toBe(false);

      // URL 탭 콘텐츠(입력창)가 표시됨
      const input = view.contentEl.querySelector("input") as HTMLInputElement;
      expect(input).not.toBeNull();
    });

    it("구독 피드 탭 클릭 시 피드 콘텐츠로 전환된다", () => {
      const feedTab = view.contentEl.querySelector('[data-tab="feed"]') as HTMLElement;
      feedTab.click();

      // URL 입력창이 사라짐 (피드 콘텐츠로 전환)
      const input = view.contentEl.querySelector(".youtube-summarizer-url-input");
      expect(input).toBeNull();

      // 탭 콘텐츠 영역이 존재
      const tabContent = view.contentEl.querySelector(".youtube-summarizer-tab-content");
      expect(tabContent).not.toBeNull();
    });

    it("URL 요약 탭 클릭 시 URL 입력 UI로 전환된다", () => {
      // 먼저 피드 탭으로 전환
      const feedTab = view.contentEl.querySelector('[data-tab="feed"]') as HTMLElement;
      feedTab.click();

      // 다시 URL 탭으로 전환
      const urlTab = view.contentEl.querySelector('[data-tab="url"]') as HTMLElement;
      urlTab.click();

      // URL 입력창이 다시 표시됨
      const input = view.contentEl.querySelector("input") as HTMLInputElement;
      expect(input).not.toBeNull();
      expect(input.placeholder).toBe(tr.urlPlaceholder);

      // 요약 버튼도 다시 표시됨
      const button = view.contentEl.querySelector("button") as HTMLButtonElement;
      expect(button).not.toBeNull();
      expect(button.textContent).toBe(tr.summarizeButton);
    });

    it("탭 전환 시 active 클래스가 올바르게 토글된다", () => {
      const urlTab = view.contentEl.querySelector('[data-tab="url"]') as HTMLElement;
      const feedTab = view.contentEl.querySelector('[data-tab="feed"]') as HTMLElement;

      // 초기 상태: URL 탭이 active
      expect(urlTab.classList.contains("active")).toBe(true);
      expect(feedTab.classList.contains("active")).toBe(false);

      // 피드 탭 클릭: 피드 탭이 active, URL 탭은 비활성
      feedTab.click();
      expect(urlTab.classList.contains("active")).toBe(false);
      expect(feedTab.classList.contains("active")).toBe(true);

      // 다시 URL 탭 클릭: URL 탭이 active, 피드 탭은 비활성
      urlTab.click();
      expect(urlTab.classList.contains("active")).toBe(true);
      expect(feedTab.classList.contains("active")).toBe(false);
    });

    it("마지막 선택 탭 상태가 뷰 재오픈 시 복원된다", async () => {
      // 피드 탭으로 전환하여 lastActiveTab을 "feed"로 설정
      const feedTab = view.contentEl.querySelector('[data-tab="feed"]') as HTMLElement;
      feedTab.click();

      // 새로운 뷰 인스턴스 생성 (뷰 재오픈 시뮬레이션)
      const newLeaf = new WorkspaceLeaf();
      const newView = new SidebarView(newLeaf);
      newView.contentEl = document.createElement("div");
      patchContentEl(newView.contentEl);
      await newView.onOpen();

      // 피드 탭이 active 상태로 복원됨
      const newFeedTab = newView.contentEl.querySelector('[data-tab="feed"]') as HTMLElement;
      const newUrlTab = newView.contentEl.querySelector('[data-tab="url"]') as HTMLElement;
      expect(newFeedTab.classList.contains("active")).toBe(true);
      expect(newUrlTab.classList.contains("active")).toBe(false);

      // URL 입력창이 없음 (피드 탭이 활성 상태이므로)
      const input = newView.contentEl.querySelector(".youtube-summarizer-url-input");
      expect(input).toBeNull();
    });
  });
});
