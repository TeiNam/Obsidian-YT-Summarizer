// ============================================================
// SettingsTab - 플러그인 설정 탭
// API Key, 언어, 저장 폴더 설정
// 구독 피드 설정: 수동 채널 추가 방식 (채널 ID 입력 → channels.list API 조회 → 추가)
// ============================================================

import { App, Notice, PluginSettingTab, Setting } from "obsidian";
import { PluginSettings, SubscriptionChannel, MonitoredChannel } from "../models/types";
import { t, Language } from "../i18n";
import { FolderSuggest } from "./FolderSuggest";

/**
 * 플러그인과의 상호작용을 위한 인터페이스
 * 채널 정보 조회 메서드 포함
 */
export interface YouTubeSummarizerPluginInterface {
  settings: PluginSettings;
  saveSettings(): Promise<void>;
  /** 채널 ID로 채널 정보를 조회하는 메서드 (YouTube Data API 사용) */
  fetchChannelInfo?(channelId: string): Promise<SubscriptionChannel>;
}

/**
 * 플러그인 설정 탭 클래스
 * API Key, 언어 선택, 저장 폴더, 구독 피드 설정 UI 제공
 */
export class SettingsTab extends PluginSettingTab {
  private plugin: YouTubeSummarizerPluginInterface;
  /** 채널 추가 진행 중 여부 */
  private isAddingChannel = false;

  constructor(app: App, plugin: YouTubeSummarizerPluginInterface) {
    super(app, plugin as any);
    this.plugin = plugin;
  }

  /**
   * API Key 입력 필드에 눈 아이콘 토글 버튼을 추가하는 헬퍼
   * @param inputEl - 대상 input 요소
   */
  private addPasswordToggle(inputEl: HTMLInputElement): void {
    inputEl.type = "password";
    const toggleBtn = document.createElement("button");
    toggleBtn.type = "button";
    toggleBtn.className = "clickable-icon setting-editor-extra-setting-button";
    toggleBtn.setAttribute("aria-label", "Toggle visibility");
    toggleBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
    toggleBtn.addEventListener("click", () => {
      const isPassword = inputEl.type === "password";
      inputEl.type = isPassword ? "text" : "password";
      // 아이콘 변경: 눈 열림 ↔ 눈 닫힘
      toggleBtn.innerHTML = isPassword
        ? `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`
        : `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
    });
    inputEl.parentElement?.appendChild(toggleBtn);
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
    containerEl.createEl("h2", { text: tr.settingsHeader });
    const descEl = containerEl.createEl("p", { text: tr.settingsDescription });
    descEl.addClass("setting-item-description");

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

    // 요약 서버 API Key 입력 필드 (눈 아이콘 토글로 마스킹/표시 전환)
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
        this.addPasswordToggle(text.inputEl);
      });

    // 노트 저장 폴더 경로 설정 (볼트 폴더 자동완성)
    new Setting(containerEl)
      .setName(tr.saveFolderLabel)
      .setDesc(tr.saveFolderDesc)
      .addText((text) => {
        text
          .setPlaceholder("YouTube Summaries")
          .setValue(this.plugin.settings.saveFolderPath)
          .onChange(async (value: string) => {
            this.plugin.settings.saveFolderPath = value;
            await this.plugin.saveSettings();
          });
        new FolderSuggest(this.app, text.inputEl, async (value: string) => {
          this.plugin.settings.saveFolderPath = value;
          await this.plugin.saveSettings();
        });
      });

    // 구독 피드 설정 섹션 렌더링
    this.renderSubscriptionSection(containerEl, tr);
  }

  /**
   * 구독 피드 설정 섹션 렌더링
   * YouTube Data API Key 입력 + 수동 채널 추가 UI
   */
  private renderSubscriptionSection(
    containerEl: HTMLElement,
    tr: ReturnType<typeof t>
  ): void {
    const hasApiKey = this.plugin.settings.youtubeDataApiKey.trim().length > 0;

    // 구독 피드 섹션 헤더
    containerEl.createEl("h3", { text: tr.subscriptionSectionHeader });

    // YouTube Data API Key 입력 필드 (눈 아이콘 토글로 마스킹/표시 전환)
    const apiKeySetting = new Setting(containerEl)
      .setName(tr.youtubeDataApiKeyLabel)
      .setDesc(tr.youtubeDataApiKeyDesc)
      .addText((text) => {
        text
          .setPlaceholder("your-youtube-data-api-key")
          .setValue(this.plugin.settings.youtubeDataApiKey)
          .onChange(async (value: string) => {
            this.plugin.settings.youtubeDataApiKey = value;
            await this.plugin.saveSettings();
            this.display();
          });
        this.addPasswordToggle(text.inputEl);
      });

    // Google Cloud Console 링크 추가
    const linkEl = document.createElement("a");
    linkEl.href = "https://console.cloud.google.com/apis/credentials";
    linkEl.textContent = "Google Cloud Console";
    linkEl.className = "external-link";
    apiKeySetting.descEl.appendChild(document.createTextNode(" → "));
    apiKeySetting.descEl.appendChild(linkEl);

    // API Key가 있을 때만 채널 추가 및 목록 표시
    if (hasApiKey) {
      // 채널 ID 입력 + 추가 버튼
      let channelIdInput = "";
      new Setting(containerEl)
        .setName(tr.addChannelLabel)
        .setDesc(tr.addChannelDesc)
        .addText((text) => {
          text
            .setPlaceholder("@rastalion_dev")
            .onChange((value: string) => {
              channelIdInput = value;
            });
        })
        .addButton((button) => {
          button
            .setButtonText(
              this.isAddingChannel ? tr.addingChannel : tr.addChannelButton
            )
            .setCta()
            .onClick(async () => {
              await this.addChannel(channelIdInput);
            });
        });

      // 모니터링 채널 목록 표시
      if (this.plugin.settings.monitoredChannels.length > 0) {
        this.renderChannelList(containerEl, tr);
      }

      // 구독 영상 요약 저장 폴더 경로 설정 (볼트 폴더 자동완성)
      new Setting(containerEl)
        .setName(tr.subscriptionSaveFolderLabel)
        .setDesc(tr.subscriptionSaveFolderDesc)
        .addText((text) => {
          text
            .setPlaceholder("YouTube Subscriptions")
            .setValue(this.plugin.settings.subscriptionSaveFolderPath)
            .onChange(async (value: string) => {
              this.plugin.settings.subscriptionSaveFolderPath = value;
              await this.plugin.saveSettings();
            });
          new FolderSuggest(this.app, text.inputEl, async (value: string) => {
            this.plugin.settings.subscriptionSaveFolderPath = value;
            await this.plugin.saveSettings();
          });
        });

      // 채널당 표시할 최신 영상 개수 슬라이더 (범위: 1~10)
      new Setting(containerEl)
        .setName(tr.videosPerChannelLabel)
        .setDesc(tr.videosPerChannelDesc)
        .addSlider((slider) => {
          slider
            .setLimits(1, 10, 1)
            .setValue(this.plugin.settings.videosPerChannel)
            .setDynamicTooltip()
            .onChange(async (value: number) => {
              // 범위 클램핑: 1~10 정수로 제한
              const clamped = Math.min(10, Math.max(1, Math.round(value)));
              this.plugin.settings.videosPerChannel = clamped;
              await this.plugin.saveSettings();
            });
        });
    }
  }

  /**
   * 모니터링 채널 목록 렌더링
   * 각 채널에 대해 채널명 + 삭제 버튼 + 저장 폴더 입력 필드 표시
   */
  private renderChannelList(
    containerEl: HTMLElement,
    tr: ReturnType<typeof t>
  ): void {
    // 채널 목록 레이블
    containerEl.createEl("h4", { text: tr.subscriptionChannelsLabel });

    // 각 모니터링 채널에 대해 UI 생성
    for (const channel of this.plugin.settings.monitoredChannels) {
      // 채널명 + 그룹 입력 + 삭제 버튼
      new Setting(containerEl)
        .setName(channel.channelTitle)
        .setDesc(tr.channelGroupDesc)
        .addText((text) => {
          text
            .setPlaceholder(tr.channelGroupLabel)
            .setValue(channel.group ?? "")
            .onChange(async (value: string) => {
              const target = this.plugin.settings.monitoredChannels.find(
                (ch) => ch.channelId === channel.channelId
              );
              if (target) {
                // 빈 문자열/공백이면 그룹 미설정으로 처리
                const trimmed = value.trim();
                target.group = trimmed.length > 0 ? trimmed : undefined;
                await this.plugin.saveSettings();
              }
            });
        })
        .addButton((button) => {
          button
            .setButtonText(tr.removeChannelButton)
            .onClick(async () => {
              await this.removeChannel(channel.channelId);
            });
        });

      // 채널별 저장 폴더 텍스트 입력 + 볼트 폴더 자동완성
      new Setting(containerEl)
        .setName(tr.channelSaveFolderLabel)
        .setDesc(tr.channelSaveFolderDesc)
        .addText((text) => {
          text
            .setPlaceholder(this.plugin.settings.subscriptionSaveFolderPath)
            .setValue(channel.saveFolderPath ?? "")
            .onChange(async (value: string) => {
              const target = this.plugin.settings.monitoredChannels.find(
                (ch) => ch.channelId === channel.channelId
              );
              if (target) {
                target.saveFolderPath = value;
                await this.plugin.saveSettings();
              }
            });
          // 볼트 폴더 자동완성 연결
          new FolderSuggest(this.app, text.inputEl, async (value: string) => {
            const target = this.plugin.settings.monitoredChannels.find(
              (ch) => ch.channelId === channel.channelId
            );
            if (target) {
              target.saveFolderPath = value;
              await this.plugin.saveSettings();
            }
          });
        });
    }
  }

  /**
   * 채널 ID 또는 핸들로 채널 정보를 조회하여 모니터링 목록에 추가
   * @param channelIdOrHandle - YouTube 채널 ID (예: "UCxxxx") 또는 핸들 (예: "@sosumonkey")
   */
  async addChannel(channelIdOrHandle: string): Promise<void> {
    const trimmed = channelIdOrHandle.trim();
    if (!trimmed) return;
    if (!this.plugin.fetchChannelInfo) return;

    // 채널 ID 직접 입력 시 사전 중복 체크 (핸들은 API 호출 후 체크)
    if (!trimmed.startsWith("@")) {
      const existing = this.plugin.settings.monitoredChannels.find(
        (ch) => ch.channelId === trimmed
      );
      if (existing) return;
    }

    const lang = this.plugin.settings.language ?? "en";
    const tr = t(lang);

    this.isAddingChannel = true;
    this.display();

    try {
      const channelInfo = await this.plugin.fetchChannelInfo(trimmed);

      // API 응답의 실제 channelId로 중복 체크
      const alreadyExists = this.plugin.settings.monitoredChannels.find(
        (ch) => ch.channelId === channelInfo.channelId
      );
      if (alreadyExists) {
        this.isAddingChannel = false;
        this.display();
        return;
      }

      // 모니터링 목록에 추가
      const newChannel: MonitoredChannel = {
        channelId: channelInfo.channelId,
        channelTitle: channelInfo.title,
        thumbnailUrl: channelInfo.thumbnailUrl,
      };
      this.plugin.settings.monitoredChannels.push(newChannel);
      await this.plugin.saveSettings();

      this.isAddingChannel = false;
      this.display();
    } catch (error: unknown) {
      this.isAddingChannel = false;

      const err = error as { statusCode?: number; message?: string };
      if (err.statusCode === 404) {
        new Notice(tr.errorChannelNotFound, 10000);
      } else if (err.statusCode === 403) {
        const detail = err.message ? `\n${err.message}` : "";
        new Notice(tr.errorInvalidYoutubeDataApiKey + detail, 10000);
      } else {
        const detail = err.message ? `\n${err.message}` : "";
        new Notice(tr.errorFetchSubscriptions + detail, 10000);
      }

      this.display();
    }
  }

  /**
   * 모니터링 목록에서 채널 제거
   * @param channelId - 제거할 채널 ID
   */
  async removeChannel(channelId: string): Promise<void> {
    this.plugin.settings.monitoredChannels =
      this.plugin.settings.monitoredChannels.filter(
        (ch) => ch.channelId !== channelId
      );
    await this.plugin.saveSettings();
    this.display();
  }
}
