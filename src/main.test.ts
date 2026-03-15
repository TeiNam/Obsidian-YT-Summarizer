// ============================================================
// YouTubeSummarizerPlugin 단위 테스트
// API 마이그레이션 후: YouTubeSummaryApiClient 기반 서비스 팩토리 검증
// ============================================================

import { describe, it, expect, vi, beforeEach } from "vitest";
import YouTubeSummarizerPlugin from "./main";
import { DEFAULT_SETTINGS } from "./models/types";
import { VIEW_TYPE_YOUTUBE_SUMMARIZER } from "./views/SidebarView";

// obsidian 모듈 모킹
vi.mock("obsidian");

// App 모킹 헬퍼
function createMockApp() {
  return {
    vault: {
      create: vi.fn(),
      createFolder: vi.fn(),
      getAbstractFileByPath: vi.fn().mockReturnValue(null),
    },
    workspace: {
      getLeavesOfType: vi.fn().mockReturnValue([]),
      getRightLeaf: vi.fn().mockReturnValue(null),
      revealLeaf: vi.fn(),
      getLeaf: vi.fn(),
    },
  } as any;
}

describe("YouTubeSummarizerPlugin", () => {
  let plugin: YouTubeSummarizerPlugin;

  beforeEach(() => {
    // @ts-expect-error - 테스트 환경에서 인자 없이 생성
    plugin = new YouTubeSummarizerPlugin();
    plugin.app = createMockApp();
  });

  it("인스턴스가 정상적으로 생성된다", () => {
    expect(plugin).toBeDefined();
    expect(plugin).toBeInstanceOf(YouTubeSummarizerPlugin);
  });

  describe("loadSettings", () => {
    it("저장된 데이터가 없으면 기본 설정을 사용한다", async () => {
      vi.spyOn(plugin, "loadData").mockResolvedValue(null);
      await plugin.loadSettings();
      expect(plugin.settings).toEqual(DEFAULT_SETTINGS);
    });

    it("저장된 데이터가 있으면 기본값과 병합한다", async () => {
      const savedData = { apiKey: "saved-api-key" };
      vi.spyOn(plugin, "loadData").mockResolvedValue(savedData);
      await plugin.loadSettings();
      expect(plugin.settings.apiKey).toBe("saved-api-key");
      expect(plugin.settings.saveFolderPath).toBe(DEFAULT_SETTINGS.saveFolderPath);
    });

    it("AWS 관련 필드가 기본 설정에 존재하지 않는다", async () => {
      vi.spyOn(plugin, "loadData").mockResolvedValue(null);
      await plugin.loadSettings();
      expect((plugin.settings as any).awsRegion).toBeUndefined();
      expect((plugin.settings as any).bedrockModelId).toBeUndefined();
      expect((plugin.settings as any).awsAccessKeyId).toBeUndefined();
      expect((plugin.settings as any).awsSecretAccessKey).toBeUndefined();
    });
  });

  describe("saveSettings", () => {
    it("현재 설정을 saveData로 저장한다", async () => {
      const saveDataSpy = vi.spyOn(plugin, "saveData").mockResolvedValue(undefined);
      plugin.settings = { ...DEFAULT_SETTINGS, apiKey: "my-key" };
      await plugin.saveSettings();
      expect(saveDataSpy).toHaveBeenCalledWith(plugin.settings);
    });
  });

  describe("onload", () => {
    it("설정 로드, 뷰 등록, 리본 아이콘, 설정 탭을 초기화한다", async () => {
      vi.spyOn(plugin, "loadData").mockResolvedValue(null);
      const registerViewSpy = vi.spyOn(plugin, "registerView");
      const addRibbonIconSpy = vi.spyOn(plugin, "addRibbonIcon");
      const addSettingTabSpy = vi.spyOn(plugin, "addSettingTab");

      await plugin.onload();

      expect(plugin.settings).toEqual(DEFAULT_SETTINGS);
      expect(registerViewSpy).toHaveBeenCalledWith(
        VIEW_TYPE_YOUTUBE_SUMMARIZER,
        expect.any(Function)
      );
      expect(addRibbonIconSpy).toHaveBeenCalledWith(
        "youtube-play",
        "YouTube Summarizer",
        expect.any(Function)
      );
      expect(addSettingTabSpy).toHaveBeenCalled();
    });
  });

  describe("activateView", () => {
    it("기존 뷰가 없으면 우측 사이드바에 새 뷰를 생성한다", async () => {
      plugin.settings = { ...DEFAULT_SETTINGS };
      const mockLeaf = { setViewState: vi.fn().mockResolvedValue(undefined) };
      plugin.app.workspace.getLeavesOfType = vi.fn().mockReturnValue([]);
      plugin.app.workspace.getRightLeaf = vi.fn().mockReturnValue(mockLeaf);

      await plugin.activateView();

      expect(mockLeaf.setViewState).toHaveBeenCalledWith({
        type: VIEW_TYPE_YOUTUBE_SUMMARIZER,
        active: true,
      });
      expect(plugin.app.workspace.revealLeaf).toHaveBeenCalledWith(mockLeaf);
    });

    it("기존 뷰가 있으면 해당 뷰를 표시한다", async () => {
      plugin.settings = { ...DEFAULT_SETTINGS };
      const existingLeaf = {};
      plugin.app.workspace.getLeavesOfType = vi.fn().mockReturnValue([existingLeaf]);

      await plugin.activateView();

      expect(plugin.app.workspace.revealLeaf).toHaveBeenCalledWith(existingLeaf);
    });
  });

  describe("onunload", () => {
    it("오류 없이 실행된다", async () => {
      await expect(plugin.onunload()).resolves.not.toThrow();
    });
  });
});
