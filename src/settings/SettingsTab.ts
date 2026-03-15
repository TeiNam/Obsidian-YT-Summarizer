// ============================================================
// SettingsTab - 플러그인 설정 탭
// API 마이그레이션 후: API Key, 언어, 저장 폴더만 표시
// AWS 관련 설정 및 프롬프트 편집 기능 제거
// ============================================================

import { App, PluginSettingTab, Setting } from "obsidian";
import { PluginSettings } from "../models/types";
import { t, Language } from "../i18n";

/**
 * 플러그인과의 상호작용을 위한 인터페이스
 */
export interface YouTubeSummarizerPluginInterface {
  settings: PluginSettings;
  saveSettings(): Promise<void>;
}

/**
 * 플러그인 설정 탭 클래스
 * API Key, 언어 선택, 저장 폴더 설정 UI 제공
 */
export class SettingsTab extends PluginSettingTab {
  private plugin: YouTubeSummarizerPluginInterface;

  constructor(app: App, plugin: YouTubeSummarizerPluginInterface) {
    super(app, plugin as any);
    this.plugin = plugin;
  }

  /**
   * 설정 UI 렌더링
   */
  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    const lang = this.plugin.settings.language ?? "en";
    const tr = t(lang);

    // 앱 이름 및 설명 헤더
    const h2 = document.createElement("h2");
    h2.textContent = tr.settingsHeader;
    containerEl.appendChild(h2);
    const descEl = document.createElement("p");
    descEl.textContent = tr.settingsDescription;
    descEl.className = "setting-item-description";
    containerEl.appendChild(descEl);

    // 언어 선택 드롭다운
    new Setting(containerEl)
      .setName(tr.languageLabel)
      .setDesc(tr.languageDesc)
      .addDropdown((dropdown) => {
        dropdown.addOption("en", "English");
        dropdown.addOption("ko", "한국어");
        dropdown
          .setValue(lang)
          .onChange(async (value: string) => {
            this.plugin.settings.language = value as Language;
            await this.plugin.saveSettings();
            this.display();
          });
      });

    // API Key 입력 필드 (password 타입으로 평문 노출 방지)
    new Setting(containerEl)
      .setName(tr.apiKeyLabel)
      .setDesc(tr.apiKeyDesc)
      .addText((text) => {
        text
          .setPlaceholder("your-api-key-here")
          .setValue(this.plugin.settings.apiKey)
          .onChange(async (value: string) => {
            this.plugin.settings.apiKey = value;
            await this.plugin.saveSettings();
          });
        text.inputEl.type = "password";
      });

    // 노트 저장 폴더 경로 설정
    new Setting(containerEl)
      .setName(tr.saveFolderLabel)
      .setDesc(tr.saveFolderDesc)
      .addText((text) =>
        text
          .setPlaceholder("YouTube Summaries")
          .setValue(this.plugin.settings.saveFolderPath)
          .onChange(async (value: string) => {
            this.plugin.settings.saveFolderPath = value;
            await this.plugin.saveSettings();
          })
      );
  }
}
