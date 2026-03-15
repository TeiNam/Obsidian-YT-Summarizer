// @vitest-environment jsdom
// ============================================================
// SettingsTab 단위 테스트
// 수동 채널 추가 방식: 채널 ID 입력 → channels.list API 조회 → 추가
// ============================================================

import { describe, it, expect, vi, beforeEach } from "vitest";
import { App } from "obsidian";
import {
  SettingsTab,
  YouTubeSummarizerPluginInterface,
} from "./SettingsTab";
import { DEFAULT_SETTINGS, SubscriptionChannel } from "../models/types";

// onChange 콜백을 캡처하기 위한 저장소
const capturedTextCallbacks: Array<(value: string) => Promise<void>> = [];
const capturedDropdownCallbacks: Array<(value: string) => Promise<void>> = [];
const capturedButtonCallbacks: Array<() => Promise<void>> = [];
const capturedSliderCallbacks: Array<(value: number) => Promise<void>> = [];

// Setting 클래스를 모킹하여 콜백 캡처
vi.mock("obsidian", async (importOriginal) => {
  const original = await importOriginal<typeof import("obsidian")>();

  class MockSetting {
    descEl: HTMLElement;
    constructor(containerEl: HTMLElement) {
      if (typeof document !== "undefined") {
        const el = document.createElement("div");
        this.descEl = document.createElement("div");
        el.appendChild(this.descEl);
        containerEl.appendChild(el);
      } else {
        this.descEl = {} as HTMLElement;
      }
    }
    setName(): MockSetting { return this; }
    setDesc(): MockSetting { return this; }
    addText(cb: (text: any) => any): MockSetting {
      const text = {
        setPlaceholder: () => text,
        setValue: () => text,
        onChange: (fn: (value: string) => Promise<void>) => {
          capturedTextCallbacks.push(fn);
          return text;
        },
        inputEl: document.createElement("input"),
      };
      cb(text);
      return this;
    }
    addDropdown(cb: (dropdown: any) => any): MockSetting {
      const dropdown = {
        addOption: () => dropdown,
        setValue: () => dropdown,
        onChange: (fn: (value: string) => Promise<void>) => {
          capturedDropdownCallbacks.push(fn);
          return dropdown;
        },
      };
      cb(dropdown);
      return this;
    }
    addButton(cb: (button: any) => any): MockSetting {
      const button = {
        setButtonText: () => button,
        setCta: () => button,
        onClick: (fn: () => Promise<void>) => {
          capturedButtonCallbacks.push(fn);
          return button;
        },
      };
      cb(button);
      return this;
    }
    addSlider(cb: (slider: any) => any): MockSetting {
      const slider = {
        setLimits: () => slider,
        setValue: () => slider,
        setDynamicTooltip: () => slider,
        onChange: (fn: (value: number) => Promise<void>) => {
          capturedSliderCallbacks.push(fn);
          return slider;
        },
      };
      cb(slider);
      return this;
    }
  }

  return {
    ...original,
    Setting: MockSetting,
  };
});

describe("SettingsTab", () => {
  let settingsTab: SettingsTab;
  let mockPlugin: YouTubeSummarizerPluginInterface;
  let app: App;

  beforeEach(() => {
    capturedTextCallbacks.length = 0;
    capturedDropdownCallbacks.length = 0;
    capturedButtonCallbacks.length = 0;
    capturedSliderCallbacks.length = 0;

    app = new App();
    mockPlugin = {
      settings: { ...DEFAULT_SETTINGS, monitoredChannels: [] },
      saveSettings: vi.fn().mockResolvedValue(undefined),
    };
    settingsTab = new SettingsTab(app, mockPlugin);
  });

  describe("display() - 설정 UI 렌더링", () => {
    it("기본 설정 항목이 올바르게 렌더링된다 (h2 + p + 언어 + API Key + 저장폴더 + h3 + YouTube Data API Key = 7개)", () => {
      settingsTab.display();
      const settingEls = settingsTab.containerEl.children;
      expect(settingEls.length).toBe(7);
    });

    it("display()를 다시 호출하면 기존 내용이 비워지고 새로 렌더링된다", () => {
      settingsTab.display();
      settingsTab.display();
      const settingEls = settingsTab.containerEl.children;
      expect(settingEls.length).toBe(7);
    });

    it("YouTube Data API Key가 비어있으면 텍스트 입력은 3개만 존재한다", () => {
      settingsTab.display();
      // API Key(0) + 저장폴더(1) + YouTube Data API Key(2) = 3개
      expect(capturedTextCallbacks.length).toBe(3);
    });

    it("YouTube Data API Key가 비어있으면 버튼 콜백이 캡처되지 않는다", () => {
      settingsTab.display();
      expect(capturedButtonCallbacks.length).toBe(0);
    });
  });

  describe("기본 설정값 검증", () => {
    it("SettingsTab 인스턴스가 올바르게 생성된다", () => {
      expect(settingsTab).toBeDefined();
      expect(settingsTab.containerEl).toBeDefined();
    });

    it("기본 설정값이 올바르게 설정되어 있다", () => {
      expect(mockPlugin.settings.language).toBe("en");
      expect(mockPlugin.settings.saveFolderPath).toBe("YouTube Summaries");
      expect(mockPlugin.settings.apiKey).toBe("");
    });
  });

  describe("onChange 콜백을 통한 설정 저장", () => {
    beforeEach(() => {
      settingsTab.display();
    });

    it("언어 변경 시 설정이 저장된다", async () => {
      await capturedDropdownCallbacks[0]("ko");
      expect(mockPlugin.settings.language).toBe("ko");
      expect(mockPlugin.saveSettings).toHaveBeenCalled();
    });

    it("API Key 변경 시 설정이 저장된다", async () => {
      await capturedTextCallbacks[0]("test-api-key-123");
      expect(mockPlugin.settings.apiKey).toBe("test-api-key-123");
      expect(mockPlugin.saveSettings).toHaveBeenCalled();
    });

    it("저장 폴더 경로 변경 시 설정이 저장된다", async () => {
      await capturedTextCallbacks[1]("My Custom Folder");
      expect(mockPlugin.settings.saveFolderPath).toBe("My Custom Folder");
      expect(mockPlugin.saveSettings).toHaveBeenCalled();
    });
  });

  // ============================================================
  // 구독 피드 설정 - API Key 입력 시
  // ============================================================
  describe("구독 피드 설정 - API Key 입력 시", () => {
    beforeEach(() => {
      mockPlugin.settings.youtubeDataApiKey = "test-youtube-data-api-key";
      mockPlugin.fetchChannelInfo = vi.fn().mockResolvedValue({
        channelId: "UC_test",
        title: "테스트 채널",
        thumbnailUrl: "https://example.com/thumb.jpg",
        description: "설명",
      });
      settingsTab = new SettingsTab(app, mockPlugin);
    });

    it("YouTube Data API Key가 있으면 채널 추가 버튼이 표시된다", () => {
      settingsTab.display();
      // 채널 추가 버튼 1개
      expect(capturedButtonCallbacks.length).toBe(1);
    });

    it("YouTube Data API Key가 있으면 채널 ID 입력 + 구독 저장폴더가 추가된다", () => {
      settingsTab.display();
      // API Key(0) + 저장폴더(1) + YouTube Data API Key(2) + 채널 ID 입력(3) + 구독 저장폴더(4) = 5개
      expect(capturedTextCallbacks.length).toBe(5);
    });
  });

  // ============================================================
  // 수동 채널 추가 테스트
  // ============================================================
  describe("수동 채널 추가", () => {
    const mockChannelInfo: SubscriptionChannel = {
      channelId: "UC_channel_1",
      title: "테스트 채널 1",
      thumbnailUrl: "https://example.com/thumb1.jpg",
      description: "채널 1 설명",
    };

    beforeEach(() => {
      mockPlugin.settings.youtubeDataApiKey = "test-youtube-data-api-key";
      mockPlugin.fetchChannelInfo = vi.fn().mockResolvedValue(mockChannelInfo);
      settingsTab = new SettingsTab(app, mockPlugin);
    });

    it("addChannel 호출 시 fetchChannelInfo가 호출된다", async () => {
      await settingsTab.addChannel("UC_channel_1");
      expect(mockPlugin.fetchChannelInfo).toHaveBeenCalledWith("UC_channel_1");
    });

    it("addChannel 성공 시 monitoredChannels에 채널이 추가된다", async () => {
      await settingsTab.addChannel("UC_channel_1");
      expect(mockPlugin.settings.monitoredChannels).toHaveLength(1);
      expect(mockPlugin.settings.monitoredChannels[0].channelId).toBe("UC_channel_1");
      expect(mockPlugin.settings.monitoredChannels[0].channelTitle).toBe("테스트 채널 1");
      expect(mockPlugin.saveSettings).toHaveBeenCalled();
    });

    it("이미 추가된 채널은 중복 추가되지 않는다", async () => {
      mockPlugin.settings.monitoredChannels = [
        {
          channelId: "UC_channel_1",
          channelTitle: "테스트 채널 1",
          thumbnailUrl: "https://example.com/thumb1.jpg",
        },
      ];
      await settingsTab.addChannel("UC_channel_1");
      expect(mockPlugin.settings.monitoredChannels).toHaveLength(1);
    });

    it("빈 문자열은 무시된다", async () => {
      await settingsTab.addChannel("");
      expect(mockPlugin.fetchChannelInfo).not.toHaveBeenCalled();
    });

    it("공백만 있는 문자열은 무시된다", async () => {
      await settingsTab.addChannel("   ");
      expect(mockPlugin.fetchChannelInfo).not.toHaveBeenCalled();
    });

    it("@핸들로 채널을 추가할 수 있다", async () => {
      await settingsTab.addChannel("@sosumonkey");
      expect(mockPlugin.fetchChannelInfo).toHaveBeenCalledWith("@sosumonkey");
      expect(mockPlugin.settings.monitoredChannels).toHaveLength(1);
      expect(mockPlugin.settings.monitoredChannels[0].channelId).toBe("UC_channel_1");
      expect(mockPlugin.saveSettings).toHaveBeenCalled();
    });

    it("@핸들로 추가 시 이미 같은 channelId가 있으면 중복 추가되지 않는다", async () => {
      mockPlugin.settings.monitoredChannels = [
        {
          channelId: "UC_channel_1",
          channelTitle: "테스트 채널 1",
          thumbnailUrl: "https://example.com/thumb1.jpg",
        },
      ];
      await settingsTab.addChannel("@testhandle");
      // fetchChannelInfo는 호출되지만 (핸들이라 사전 체크 불가), 결과의 channelId로 중복 체크
      expect(mockPlugin.fetchChannelInfo).toHaveBeenCalled();
      expect(mockPlugin.settings.monitoredChannels).toHaveLength(1);
      expect(mockPlugin.saveSettings).not.toHaveBeenCalled();
    });
  });

  // ============================================================
  // 채널 삭제 테스트
  // ============================================================
  describe("채널 삭제", () => {
    beforeEach(() => {
      mockPlugin.settings.youtubeDataApiKey = "test-youtube-data-api-key";
      mockPlugin.settings.monitoredChannels = [
        {
          channelId: "UC_channel_1",
          channelTitle: "테스트 채널 1",
          thumbnailUrl: "https://example.com/thumb1.jpg",
        },
        {
          channelId: "UC_channel_2",
          channelTitle: "테스트 채널 2",
          thumbnailUrl: "https://example.com/thumb2.jpg",
        },
      ];
      mockPlugin.fetchChannelInfo = vi.fn();
      settingsTab = new SettingsTab(app, mockPlugin);
    });

    it("removeChannel 호출 시 해당 채널이 제거된다", async () => {
      await settingsTab.removeChannel("UC_channel_1");
      expect(mockPlugin.settings.monitoredChannels).toHaveLength(1);
      expect(mockPlugin.settings.monitoredChannels[0].channelId).toBe("UC_channel_2");
      expect(mockPlugin.saveSettings).toHaveBeenCalled();
    });

    it("다른 채널의 모니터링 상태는 변경되지 않는다", async () => {
      await settingsTab.removeChannel("UC_channel_1");
      expect(mockPlugin.settings.monitoredChannels.some(
        (ch) => ch.channelId === "UC_channel_2"
      )).toBe(true);
    });
  });

  // ============================================================
  // 채널별 저장 폴더 설정 테스트
  // ============================================================
  describe("채널별 저장 폴더 설정", () => {
    beforeEach(() => {
      mockPlugin.settings.youtubeDataApiKey = "test-youtube-data-api-key";
      mockPlugin.settings.monitoredChannels = [
        {
          channelId: "UC_channel_1",
          channelTitle: "테스트 채널 1",
          thumbnailUrl: "https://example.com/thumb1.jpg",
        },
      ];
      mockPlugin.fetchChannelInfo = vi.fn();
      settingsTab = new SettingsTab(app, mockPlugin);
    });

    it("모니터링 중인 채널에 삭제 버튼과 저장 폴더 입력 필드가 표시된다", () => {
      settingsTab.display();
      // 채널 추가 버튼 1개 + 삭제 버튼 1개 = 2개
      expect(capturedButtonCallbacks.length).toBe(2);
    });

    it("채널별 저장 폴더 텍스트 입력 변경 시 saveFolderPath가 업데이트된다", async () => {
      settingsTab.display();
      // 텍스트 입력 순서: API Key(0) + 저장폴더(1) + YouTube Data API Key(2) + 채널 ID 입력(3) + 채널별 저장폴더(4) + 구독 저장폴더(5)
      expect(capturedTextCallbacks.length).toBe(6);
      await capturedTextCallbacks[4]("Custom Channel Folder");

      const updatedChannel = mockPlugin.settings.monitoredChannels.find(
        (ch) => ch.channelId === "UC_channel_1"
      );
      expect(updatedChannel?.saveFolderPath).toBe("Custom Channel Folder");
      expect(mockPlugin.saveSettings).toHaveBeenCalled();
    });
  });

  // ============================================================
  // videosPerChannel 설정 테스트
  // ============================================================
  describe("videosPerChannel 설정", () => {
    beforeEach(() => {
      mockPlugin.settings.youtubeDataApiKey = "test-youtube-data-api-key";
      mockPlugin.fetchChannelInfo = vi.fn();
      settingsTab = new SettingsTab(app, mockPlugin);
    });

    it("기본값이 3이다", () => {
      expect(DEFAULT_SETTINGS.videosPerChannel).toBe(3);
      expect(mockPlugin.settings.videosPerChannel).toBe(3);
    });

    it("YouTube Data API Key가 있으면 videosPerChannel 슬라이더가 렌더링된다", () => {
      settingsTab.display();
      // 슬라이더 콜백이 1개 캡처되어야 한다
      expect(capturedSliderCallbacks.length).toBe(1);
    });

    it("슬라이더 값 변경 시 settings.videosPerChannel이 업데이트된다", async () => {
      settingsTab.display();
      await capturedSliderCallbacks[0](5);
      expect(mockPlugin.settings.videosPerChannel).toBe(5);
      expect(mockPlugin.saveSettings).toHaveBeenCalled();
    });
  });
});
