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

  describe("loadSettings - 구독 관련 기본값 병합", () => {
    it("저장된 데이터에 구독 관련 필드가 없으면 DEFAULT_SETTINGS의 기본값이 적용된다", async () => {
      // 구독 관련 필드가 전혀 없는 저장 데이터
      vi.spyOn(plugin, "loadData").mockResolvedValue({ apiKey: "some-key" });
      await plugin.loadSettings();

      // 구독 관련 기본값 검증
      expect(plugin.settings.youtubeDataApiKey).toBe(DEFAULT_SETTINGS.youtubeDataApiKey);
      expect(plugin.settings.monitoredChannels).toEqual(DEFAULT_SETTINGS.monitoredChannels);
      expect(plugin.settings.subscriptionSaveFolderPath).toBe(DEFAULT_SETTINGS.subscriptionSaveFolderPath);
      expect(plugin.settings.videosPerChannel).toBe(DEFAULT_SETTINGS.videosPerChannel);
    });

    it("저장된 구독 설정이 있으면 올바르게 병합된다", async () => {
      const savedData = {
        apiKey: "saved-api-key",
        youtubeDataApiKey: "saved-data-api-key",
        monitoredChannels: [
          { channelId: "UC123", channelTitle: "Test Channel", thumbnailUrl: "https://example.com/thumb.jpg" },
        ],
        subscriptionSaveFolderPath: "My Subscriptions",
        videosPerChannel: 5,
      };
      vi.spyOn(plugin, "loadData").mockResolvedValue(savedData);
      await plugin.loadSettings();

      // 저장된 구독 설정이 반영되는지 확인
      expect(plugin.settings.youtubeDataApiKey).toBe("saved-data-api-key");
      expect(plugin.settings.monitoredChannels).toEqual(savedData.monitoredChannels);
      expect(plugin.settings.subscriptionSaveFolderPath).toBe("My Subscriptions");
      expect(plugin.settings.videosPerChannel).toBe(5);
      // 기존 필드도 유지
      expect(plugin.settings.apiKey).toBe("saved-api-key");
      expect(plugin.settings.saveFolderPath).toBe(DEFAULT_SETTINGS.saveFolderPath);
    });

    it("기존 저장 데이터에 lastCheckedAt이 있어도 정상 동작한다", async () => {
      // 하위 호환성: 기존 lastCheckedAt 필드가 있는 저장 데이터
      const savedData = {
        apiKey: "old-key",
        lastCheckedAt: { UC123: "2024-01-01T00:00:00Z" },
      };
      vi.spyOn(plugin, "loadData").mockResolvedValue(savedData);
      await plugin.loadSettings();

      // videosPerChannel은 기본값이 적용되어야 함
      expect(plugin.settings.videosPerChannel).toBe(DEFAULT_SETTINGS.videosPerChannel);
      expect(plugin.settings.apiKey).toBe("old-key");
    });
  });

  describe("fetchChannelInfo", () => {
    it("fetchChannelInfo 메서드가 함수로 존재한다", () => {
      expect(typeof plugin.fetchChannelInfo).toBe("function");
    });
  });

  describe("onload - registerView 콜백 구독 의존성 주입", () => {
    it("registerView 콜백이 SidebarView를 반환하고 setDependencies를 3개 인자로 호출한다", async () => {
      vi.spyOn(plugin, "loadData").mockResolvedValue(null);

      // SidebarView.prototype.setDependencies를 미리 스파이
      const { SidebarView: ActualSidebarView } = await import("./views/SidebarView");
      const setDepsSpy = vi.fn();
      vi.spyOn(ActualSidebarView.prototype, "setDependencies").mockImplementation(setDepsSpy);

      // registerView 호출 시 콜백을 캡처
      let capturedViewCreator: ((leaf: any) => any) | null = null;
      vi.spyOn(plugin, "registerView").mockImplementation((_type: string, creator: any) => {
        capturedViewCreator = creator;
      });
      vi.spyOn(plugin, "addRibbonIcon").mockReturnValue({} as HTMLElement);
      vi.spyOn(plugin, "addSettingTab").mockImplementation(() => {});

      await plugin.onload();

      // registerView 콜백이 캡처되었는지 확인
      expect(capturedViewCreator).not.toBeNull();

      // 모킹된 leaf로 콜백 실행
      const mockLeaf = { app: plugin.app } as any;
      const view = capturedViewCreator!(mockLeaf);

      // SidebarView 인스턴스인지 확인
      expect(view).toBeInstanceOf(ActualSidebarView);

      // setDependencies가 3개 인자로 호출되었는지 확인
      expect(setDepsSpy).toHaveBeenCalledTimes(1);
      const callArgs = setDepsSpy.mock.calls[0];
      expect(callArgs).toHaveLength(3);

      // 첫 번째 인자: serviceFactory (함수)
      expect(typeof callArgs[0]).toBe("function");

      // 두 번째 인자: getSettings (함수)
      expect(typeof callArgs[1]).toBe("function");

      // 세 번째 인자: subscriptionDeps (subscriptionManager, app 포함 객체)
      expect(callArgs[2]).toBeDefined();
      expect(callArgs[2]).toHaveProperty("subscriptionManager");
      expect(callArgs[2]).toHaveProperty("app");
    });
  });

  describe("onunload", () => {
    it("오류 없이 실행된다", async () => {
      await expect(plugin.onunload()).resolves.not.toThrow();
    });
  });
});
