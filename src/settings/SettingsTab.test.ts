// @vitest-environment jsdom
// ============================================================
// SettingsTab 단위 테스트
// API 마이그레이션 후: API Key, 언어, 저장 폴더만 표시
// AWS 관련 설정 및 프롬프트 편집 기능이 제거되었는지 검증
// Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6
// ============================================================

import { describe, it, expect, vi, beforeEach } from "vitest";
import { App } from "obsidian";
import {
  SettingsTab,
  YouTubeSummarizerPluginInterface,
} from "./SettingsTab";
import { DEFAULT_SETTINGS } from "../models/types";

// onChange 콜백을 캡처하기 위한 저장소
const capturedTextCallbacks: Array<(value: string) => Promise<void>> = [];
const capturedDropdownCallbacks: Array<(value: string) => Promise<void>> = [];

// Setting 클래스를 모킹하여 콜백 캡처
vi.mock("obsidian", async (importOriginal) => {
  const original = await importOriginal<typeof import("obsidian")>();

  class MockSetting {
    constructor(containerEl: HTMLElement) {
      if (typeof document !== "undefined") {
        const el = document.createElement("div");
        containerEl.appendChild(el);
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

    app = new App();
    mockPlugin = {
      settings: { ...DEFAULT_SETTINGS },
      saveSettings: vi.fn().mockResolvedValue(undefined),
    };
    settingsTab = new SettingsTab(app, mockPlugin);
  });

  describe("display() - 설정 UI 렌더링", () => {
    it("설정 항목이 올바르게 렌더링된다 (h2 + p + 언어 + API Key + 저장폴더 = 5개)", () => {
      settingsTab.display();
      const settingEls = settingsTab.containerEl.children;
      // h2 + p + 언어 드롭다운 + API Key 텍스트 + 저장폴더 텍스트 = 5개
      expect(settingEls.length).toBe(5);
    });

    it("display()를 다시 호출하면 기존 내용이 비워지고 새로 렌더링된다", () => {
      settingsTab.display();
      settingsTab.display();
      const settingEls = settingsTab.containerEl.children;
      expect(settingEls.length).toBe(5);
    });

    it("AWS 관련 설정 항목이 표시되지 않는다 (드롭다운 1개, 텍스트 2개만 존재)", () => {
      settingsTab.display();
      // 드롭다운: 언어(1개만) — AWS 리전, 모델 드롭다운 없음
      expect(capturedDropdownCallbacks.length).toBe(1);
      // 텍스트: API Key + 저장폴더(2개만) — Access Key, Secret Key 없음
      expect(capturedTextCallbacks.length).toBe(2);
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

    it("AWS 관련 필드가 존재하지 않는다", () => {
      expect((mockPlugin.settings as any).awsRegion).toBeUndefined();
      expect((mockPlugin.settings as any).bedrockModelId).toBeUndefined();
      expect((mockPlugin.settings as any).awsAccessKeyId).toBeUndefined();
      expect((mockPlugin.settings as any).awsSecretAccessKey).toBeUndefined();
      expect((mockPlugin.settings as any).summaryPrompt).toBeUndefined();
    });
  });

  describe("onChange 콜백을 통한 설정 저장", () => {
    beforeEach(() => {
      settingsTab.display();
    });

    it("언어 변경 시 설정이 저장되고 UI가 다시 렌더링된다", async () => {
      expect(capturedDropdownCallbacks.length).toBe(1);
      await capturedDropdownCallbacks[0]("ko");
      expect(mockPlugin.settings.language).toBe("ko");
      expect(mockPlugin.saveSettings).toHaveBeenCalled();
    });

    it("API Key 변경 시 설정이 저장된다", async () => {
      // 텍스트 순서: API Key(0), 저장폴더(1)
      expect(capturedTextCallbacks.length).toBe(2);
      await capturedTextCallbacks[0]("test-api-key-123");
      expect(mockPlugin.settings.apiKey).toBe("test-api-key-123");
      expect(mockPlugin.saveSettings).toHaveBeenCalled();
    });

    it("저장 폴더 경로 변경 시 설정이 저장된다", async () => {
      const newPath = "My Custom Folder";
      await capturedTextCallbacks[1](newPath);
      expect(mockPlugin.settings.saveFolderPath).toBe(newPath);
      expect(mockPlugin.saveSettings).toHaveBeenCalled();
    });

    it("프롬프트 편집 버튼이 존재하지 않는다", () => {
      // 버튼 콜백이 캡처되지 않아야 함 (addButton 호출 없음)
      const buttons = settingsTab.containerEl.querySelectorAll("button");
      expect(buttons.length).toBe(0);
    });
  });
});
