// @vitest-environment jsdom
// ============================================================
// SettingsTab 단위 테스트
// 수동 채널 추가 방식: 채널 ID 입력 → channels.list API 조회 → 추가
// ============================================================

import { describe, it, expect, vi, beforeEach } from "vitest";
import { App, Notice } from "obsidian";
import {
  SettingsTab,
  YouTubeSummarizerPluginInterface,
} from "./SettingsTab";
import { DEFAULT_SETTINGS, SubscriptionChannel } from "../models/types";
import { t } from "../i18n";
import { listAvailableModels } from "../services/AiModelClient";

vi.mock("../services/AiModelClient", () => ({ listAvailableModels: vi.fn() }));

const tr = t("en");
// onChange 콜백을 캡처하기 위한 저장소
const capturedTextCallbacks: Array<(value: string) => Promise<void>> = [];
const capturedDropdownCallbacks: Array<(value: string) => Promise<void>> = [];
const capturedButtonCallbacks: Array<() => Promise<void>> = [];
const capturedSliderCallbacks: Array<(value: number) => Promise<void>> = [];
const textByName = new Map<string, (value: string) => Promise<void>>();
const dropdownByName = new Map<string, (value: string) => Promise<void>>();
const suggestionsByName = new Map<string, {
  getSuggestions(input: string): string[];
  selectSuggestion(id: string): void;
}>();

// Setting 클래스를 모킹하여 콜백 캡처
vi.mock("obsidian", async (importOriginal) => {
  const original = await importOriginal<typeof import("obsidian")>();

  class CapturedInputSuggest extends original.AbstractInputSuggest<string> {
    constructor(app: App, inputEl: HTMLInputElement) {
      super(app, inputEl);
      suggestionsByName.set(inputEl.dataset.settingName!, this);
    }
    getSuggestions(): string[] { return []; }
    renderSuggestion(): void {}
    selectSuggestion(): void {}
  }

  class MockSetting {
    descEl: HTMLElement;
    name = "";
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
    setName(name: string): MockSetting { this.name = name; return this; }
    setDesc(): MockSetting { return this; }
    setHeading(): MockSetting { return this; }
    addText(cb: (text: any) => any): MockSetting {
      const text = {
        setPlaceholder: () => text,
        setValue: () => text,
        onChange: (fn: (value: string) => Promise<void>) => {
          capturedTextCallbacks.push(fn);
          textByName.set(this.name, fn);
          return text;
        },
        inputEl: document.createElement("input"),
      };
      text.inputEl.dataset.settingName = this.name;
      text.inputEl.trigger = vi.fn();
      cb(text);
      return this;
    }
    addDropdown(cb: (dropdown: any) => any): MockSetting {
      const dropdown = {
        addOption: () => dropdown,
        setValue: () => dropdown,
        onChange: (fn: (value: string) => Promise<void>) => {
          capturedDropdownCallbacks.push(fn);
          dropdownByName.set(this.name, fn);
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
    AbstractInputSuggest: CapturedInputSuggest,
    Notice: vi.fn(),
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
    textByName.clear();
    dropdownByName.clear();
    suggestionsByName.clear();
    vi.mocked(listAvailableModels).mockReset();
    vi.mocked(Notice).mockClear();

    app = new App();
    mockPlugin = {
      settings: { ...DEFAULT_SETTINGS, monitoredChannels: [] },
      saveSettings: vi.fn().mockResolvedValue(undefined),
    };
    settingsTab = new SettingsTab(app, mockPlugin);
  });

  describe("display() - 설정 UI 렌더링", () => {
    it("서버 키 대신 모델 제공자·Bedrock 인증 설정을 렌더링한다", () => {
      settingsTab.display();
      expect(dropdownByName.has(tr.providerLabel)).toBe(true);
      expect(textByName.has(tr.bedrockTokenLabel)).toBe(true);
      // 제거된 요약 서버 필드가 다시 생기지 않는지 확인 (i18n 키도 삭제됨)
      expect(textByName.has("Summary Server API Key")).toBe(false);
    });

    it("display()를 다시 호출하면 기존 내용이 비워지고 새로 렌더링된다", () => {
      settingsTab.display();
      const count = settingsTab.containerEl.children.length;
      settingsTab.display();
      const settingEls = settingsTab.containerEl.children;
      expect(settingEls.length).toBe(count);
    });

    it("YouTube Data API Key가 비어있으면 채널 추가 입력을 표시하지 않는다", () => {
      settingsTab.display();
      expect(textByName.has(tr.youtubeDataApiKeyLabel)).toBe(true);
      expect(textByName.has(tr.addChannelLabel)).toBe(false);
    });

    it("YouTube Data API Key가 비어있으면 채널 추가 버튼이 캡처되지 않는다", () => {
      settingsTab.display();
      // 모델 불러오기 버튼 1개만 존재
      expect(capturedButtonCallbacks.length).toBe(1);
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
      await dropdownByName.get(tr.languageLabel)!("ko");
      expect(mockPlugin.settings.language).toBe("ko");
      expect(mockPlugin.saveSettings).toHaveBeenCalled();
    });

    it("API Key 변경 시 설정이 저장된다", async () => {
      await textByName.get(tr.bedrockTokenLabel)!("test-api-key-123");
      expect(mockPlugin.settings.bedrockBearerToken).toBe("test-api-key-123");
      expect(mockPlugin.saveSettings).toHaveBeenCalled();
    });

    it("저장 폴더 경로 변경 시 설정이 저장된다", async () => {
      await textByName.get(tr.saveFolderLabel)!("My Custom Folder");
      expect(mockPlugin.settings.saveFolderPath).toBe("My Custom Folder");
      expect(mockPlugin.saveSettings).toHaveBeenCalled();
    });
  });

  describe("모델·인증 방식 전환", () => {
    it("제공자별 API 키와 모델을 따로 보존한다", async () => {
      settingsTab.display();
      await textByName.get(tr.bedrockTokenLabel)!("bedrock-token");
      await dropdownByName.get(tr.providerLabel)!("openai");
      await textByName.get(tr.modelApiKeyLabel)!("openai-key");
      await textByName.get(tr.modelLabel)!("openai-model");
      await dropdownByName.get(tr.providerLabel)!("gemini");
      await textByName.get(tr.modelApiKeyLabel)!("gemini-key");
      await textByName.get(tr.modelLabel)!("gemini-model");
      await dropdownByName.get(tr.providerLabel)!("openai");
      expect(mockPlugin.settings.openaiApiKey).toBe("openai-key");
      expect(mockPlugin.settings.openaiModel).toBe("openai-model");
      expect(mockPlugin.settings.geminiApiKey).toBe("gemini-key");
      expect(mockPlugin.settings.geminiModel).toBe("gemini-model");
      expect(mockPlugin.settings.bedrockBearerToken).toBe("bedrock-token");
    });

    it("SSO 프로필을 저장하고 토큰은 별도로 보존한다", async () => {
      settingsTab.display();
      await textByName.get(tr.bedrockTokenLabel)!("token");
      await dropdownByName.get(tr.bedrockAuthLabel)!("profile");
      await textByName.get(tr.bedrockProfileLabel)!("my-sso");
      expect(mockPlugin.settings.bedrockAuthMode).toBe("profile");
      expect(mockPlugin.settings.bedrockProfile).toBe("my-sso");
      expect(mockPlugin.settings.bedrockBearerToken).toBe("token");
    });

    it("실행 도중 설정 객체가 교체되어도 최신 객체에 UI·요약 언어를 저장한다", async () => {
      settingsTab.display();
      mockPlugin.settings = { ...mockPlugin.settings, summarizedVideoIds: ["done"] };
      await dropdownByName.get(tr.summaryLanguageLabel)!("en");
      await dropdownByName.get(tr.providerLabel)!("anthropic");
      expect(mockPlugin.settings.summaryLanguage).toBe("en");
      expect(mockPlugin.settings.aiProvider).toBe("anthropic");
      expect(mockPlugin.settings.summarizedVideoIds).toEqual(["done"]);
    });

    it("출력 한도의 비정상 입력은 저장하지 않는다", async () => {
      settingsTab.display();
      for (const value of ["", "-1", "NaN", "1.5", "128001"]) {
        await textByName.get(tr.maxOutputTokensLabel)!(value);
      }
      expect(mockPlugin.settings.maxOutputTokens).toBe(DEFAULT_SETTINGS.maxOutputTokens);
      expect(mockPlugin.saveSettings).not.toHaveBeenCalled();
      await textByName.get(tr.maxOutputTokensLabel)!("64000");
      expect(mockPlugin.settings.maxOutputTokens).toBe(64000);
    });
  });

  describe("모델 목록의 설정 변경 처리", () => {
    it.each(["success", "error"] as const)("제공자 전환 후 도착한 이전 조회 결과를 무시한다 (%s)", async (outcome) => {
      let resolve!: (models: string[]) => void;
      let reject!: (error: Error) => void;
      vi.mocked(listAvailableModels).mockReturnValueOnce(new Promise((done, fail) => {
        resolve = done;
        reject = fail;
      }));
      mockPlugin.settings.aiProvider = "openai";
      settingsTab.display();
      const loading = capturedButtonCallbacks[0]();
      await dropdownByName.get(tr.providerLabel)!("bedrock");
      if (outcome === "success") resolve(["gpt-4.1-mini"]);
      else reject(new Error("이전 제공자의 오류"));
      await loading;

      expect(suggestionsByName.get(tr.modelLabel)!.getSuggestions("")).toEqual([]);
      expect(Notice).not.toHaveBeenCalled();
      expect(mockPlugin.settings.bedrockModelId).toBe(DEFAULT_SETTINGS.bedrockModelId);

      // 이전 요청이 끝나면 새 제공자의 목록 조회와 선택은 정상 동작해야 한다.
      vi.mocked(listAvailableModels).mockResolvedValueOnce(["new-bedrock-model"]);
      await capturedButtonCallbacks[capturedButtonCallbacks.length - 1]();
      const suggest = suggestionsByName.get(tr.modelLabel)!;
      expect(suggest.getSuggestions("")).toEqual(["new-bedrock-model"]);
      suggest.selectSuggestion("new-bedrock-model");
      expect(mockPlugin.settings.bedrockModelId).toBe("new-bedrock-model");
    });

    it("주소·인증 정보 변경 시 이미 표시한 제안과 진행 중인 조회를 모두 무효화한다", async () => {
      mockPlugin.settings.aiProvider = "openai";
      settingsTab.display();
      vi.mocked(listAvailableModels).mockResolvedValueOnce(["old-model"]);
      await capturedButtonCallbacks[0]();
      const oldSuggest = suggestionsByName.get(tr.modelLabel)!;
      expect(oldSuggest.getSuggestions("")).toEqual(["old-model"]);
      await textByName.get(tr.openaiBaseUrlLabel)!("http://localhost:11434/v1");
      expect(oldSuggest.getSuggestions("")).toEqual([]);
      oldSuggest.selectSuggestion("old-model");
      expect(mockPlugin.settings.openaiModel).toBe(DEFAULT_SETTINGS.openaiModel);

      let resolve!: (models: string[]) => void;
      vi.mocked(listAvailableModels).mockReturnValueOnce(new Promise(done => { resolve = done; }));
      const loading = capturedButtonCallbacks[capturedButtonCallbacks.length - 1]();
      await textByName.get(tr.modelApiKeyLabel)!("changed-key");
      resolve(["stale-model"]);
      await loading;
      expect(suggestionsByName.get(tr.modelLabel)!.getSuggestions("")).toEqual([]);
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
      // 모델 불러오기 버튼 1개 + 채널 추가 버튼 1개
      expect(capturedButtonCallbacks.length).toBe(2);
    });

    it("YouTube Data API Key가 있으면 채널 ID 입력 + 구독 저장폴더가 추가된다", () => {
      settingsTab.display();
      expect(textByName.has(tr.addChannelLabel)).toBe(true);
      expect(textByName.has(tr.subscriptionSaveFolderLabel)).toBe(true);
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
      // 모델 불러오기 1개 + 채널 추가 1개 + 삭제 버튼 1개 = 3개
      expect(capturedButtonCallbacks.length).toBe(3);
    });

    it("채널별 저장 폴더 텍스트 입력 변경 시 saveFolderPath가 업데이트된다", async () => {
      settingsTab.display();
      await textByName.get(tr.channelSaveFolderLabel)!("Custom Channel Folder");

      const updatedChannel = mockPlugin.settings.monitoredChannels.find(
        (ch) => ch.channelId === "UC_channel_1"
      );
      expect(updatedChannel?.saveFolderPath).toBe("Custom Channel Folder");
      expect(mockPlugin.saveSettings).toHaveBeenCalled();
    });

    it("채널 그룹 텍스트 입력 변경 시 group이 업데이트된다", async () => {
      settingsTab.display();
      await textByName.get(mockPlugin.settings.monitoredChannels[0].channelTitle)!("주식");

      const updatedChannel = mockPlugin.settings.monitoredChannels.find(
        (ch) => ch.channelId === "UC_channel_1"
      );
      expect(updatedChannel?.group).toBe("주식");
      expect(mockPlugin.saveSettings).toHaveBeenCalled();
    });

    it("채널 그룹을 공백으로 비우면 group이 undefined가 된다", async () => {
      mockPlugin.settings.monitoredChannels[0].group = "주식";
      settingsTab.display();
      await textByName.get(mockPlugin.settings.monitoredChannels[0].channelTitle)!("   ");

      const updatedChannel = mockPlugin.settings.monitoredChannels.find(
        (ch) => ch.channelId === "UC_channel_1"
      );
      expect(updatedChannel?.group).toBeUndefined();
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

    it("기본값이 6이다", () => {
      expect(DEFAULT_SETTINGS.videosPerChannel).toBe(6);
      expect(mockPlugin.settings.videosPerChannel).toBe(6);
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
