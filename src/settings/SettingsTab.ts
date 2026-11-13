// ============================================================
// SettingsTab - 플러그인 설정 탭
// 모델 제공자·인증, 언어, 저장 폴더 설정
// 구독 피드 설정: 수동 채널 추가 방식 (채널 ID 입력 → channels.list API 조회 → 추가)
// ============================================================

import { AbstractInputSuggest, App, Notice, Plugin, PluginSettingTab, Setting, setIcon } from "obsidian";
import {
  AI_MODEL_FIELDS, AI_PROVIDER_LABELS, AiProvider, PluginSettings, SubscriptionChannel, MonitoredChannel,
  SUMMARY_LANGUAGES, SummaryLanguage,
} from "../models/types";
import { t, Language } from "../i18n";
import { AiModelClient, canUseProfile, listAvailableModels } from "../services/AiModelClient";
import { FolderSuggest } from "./FolderSuggest";

/** 불러온 모델 ID 목록을 모델 입력란의 자동완성으로 제안 */
const SPONSOR_URL = "https://buymeacoffee.com/teinam";
const MANUAL_MODEL_OPTION = "__manual__";
/** 연결 테스트는 설정이 허용하는 최소 출력 토큰만 쓴다 */
const CONNECTION_TEST_MAX_TOKENS = 128;
const CONNECTION_TEST_PROMPT = "Reply with the single word OK.";
const NOTICE_DURATION_MS = 10000;

class ModelSuggest extends AbstractInputSuggest<string> {
  constructor(
    app: App,
    private textInputEl: HTMLInputElement,
    private getModels: () => string[],
    private onPick: (value: string) => void | Promise<void>
  ) {
    super(app, textInputEl);
  }

  getSuggestions(inputStr: string): string[] {
    const query = inputStr.toLowerCase();
    return this.getModels().filter((id) => id.toLowerCase().includes(query));
  }

  renderSuggestion(id: string, el: HTMLElement): void {
    el.setText(id);
  }

  selectSuggestion(id: string): void {
    if (!this.getModels().includes(id)) return;
    this.textInputEl.value = id;
    this.textInputEl.trigger("input");
    void this.onPick(id);
    this.close();
  }
}

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
  /** 불러온 모델 ID 목록 (제공자·접속 설정 변경 시 초기화) */
  private availableModels: string[] | null = null;
  private modelListVersion = 0;
  /** 모델 목록 로딩 진행 중 여부 */
  private isLoadingModels = false;
  /** 저장된 Bedrock 목록이 있어도 모델 ID를 직접 입력하는 중인지 여부 */
  private isManualModel = false;

  constructor(app: App, plugin: YouTubeSummarizerPluginInterface) {
    // 테스트에서 최소 인터페이스만 주입할 수 있도록 좁은 타입으로 받고, 상위 클래스에는 Plugin으로 넘긴다.
    super(app, plugin as unknown as Plugin);
    this.plugin = plugin;
  }

  /**
   * API Key 입력 필드에 눈 아이콘 토글 버튼을 추가하는 헬퍼
   * @param inputEl - 대상 input 요소
   */
  private addPasswordToggle(inputEl: HTMLInputElement): void {
    inputEl.type = "password";
    const toggleBtn = createEl("button");
    toggleBtn.type = "button";
    toggleBtn.className = "clickable-icon setting-editor-extra-setting-button";
    toggleBtn.setAttribute("aria-label", t(this.plugin.settings.language ?? "en").toggleVisibilityAria);
    setIcon(toggleBtn, "eye");
    toggleBtn.addEventListener("click", () => {
      const isPassword = inputEl.type === "password";
      inputEl.type = isPassword ? "text" : "password";
      // 아이콘 변경: 눈 열림 ↔ 눈 닫힘
      setIcon(toggleBtn, isPassword ? "eye-off" : "eye");
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

    // 플러그인 이름 헤딩은 심사 기준상 금지 — 설명만 표시
    const descEl = containerEl.createEl("p", { text: tr.settingsDescription });
    descEl.addClass("youtube-summarizer-settings-desc");

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

    this.renderAiSettings(containerEl, tr);

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
    this.renderSponsorBanner(containerEl, tr);
  }

  /** 설정 맨 아래의 후원 배너. 원격 이미지를 불러오지 않도록 버튼을 CSS와 아이콘으로 그린다 */
  private renderSponsorBanner(containerEl: HTMLElement, tr: ReturnType<typeof t>): void {
    const bannerEl = containerEl.createDiv({ cls: "youtube-summarizer-sponsor" });
    bannerEl.createSpan({ text: tr.sponsorLabel });
    const linkEl = bannerEl.createEl("a", { cls: "youtube-summarizer-sponsor-button" });
    linkEl.setAttribute("href", SPONSOR_URL);
    linkEl.setAttribute("target", "_blank");
    linkEl.setAttribute("rel", "noopener");
    setIcon(linkEl.createSpan({ cls: "youtube-summarizer-sponsor-icon" }), "coffee");
    linkEl.createSpan({ text: "Buy me a coffee" });
  }

  private renderAiSettings(containerEl: HTMLElement, tr: ReturnType<typeof t>): void {
    const settings = this.plugin.settings;
    new Setting(containerEl)
      .setName(tr.summaryLanguageLabel)
      .setDesc(tr.summaryLanguageDesc)
      .addDropdown((dropdown) => {
        for (const { code, label } of SUMMARY_LANGUAGES) dropdown.addOption(code, label);
        dropdown
          .setValue(settings.summaryLanguage)
          .onChange(async (value) => {
            this.plugin.settings.summaryLanguage = value as SummaryLanguage;
            await this.plugin.saveSettings();
          });
      });
    new Setting(containerEl)
      .setName(tr.providerLabel)
      .setDesc(tr.providerDesc)
      .addDropdown((dropdown) => {
        for (const [provider, label] of Object.entries(AI_PROVIDER_LABELS)) dropdown.addOption(provider, label);
        dropdown
          .setValue(settings.aiProvider)
          .onChange(async (value) => {
            this.plugin.settings.aiProvider = value as AiProvider;
            this.invalidateModelList();
            await this.plugin.saveSettings();
            this.display();
          });
      });

    if (settings.aiProvider === "bedrock") {
      this.modelText(containerEl, tr.bedrockRegionLabel, tr.bedrockRegionDesc, "bedrockRegion");
      this.modelText(containerEl, tr.bedrockProfileLabel, tr.bedrockProfileDesc, "bedrockProfile");
      this.modelText(containerEl, tr.bedrockTokenLabel, tr.bedrockTokenDesc, "bedrockBearerToken", true);
    } else {
      if (settings.aiProvider === "openai") {
        this.modelText(containerEl, tr.openaiBaseUrlLabel, tr.openaiBaseUrlDesc, "openaiBaseUrl");
      }
      const keyField = { openai: "openaiApiKey", anthropic: "anthropicApiKey", gemini: "geminiApiKey" } as const;
      this.modelText(containerEl, tr.modelApiKeyLabel, tr.modelApiKeyDesc, keyField[settings.aiProvider], true);
    }

    // 인증 정보 입력 뒤에 모델 선택 (불러오기 버튼 + 자동완성)
    this.renderModelSetting(containerEl, tr, AI_MODEL_FIELDS[settings.aiProvider]);
    this.renderConnectionTest(containerEl, tr);

    for (const [key, label, desc, min, max] of [
      ["maxInputChars", tr.maxInputCharsLabel, tr.maxInputCharsDesc, 1000, 1000000],
      ["maxOutputTokens", tr.maxOutputTokensLabel, tr.maxOutputTokensDesc, 128, 128000],
    ] as const) {
      new Setting(containerEl).setName(label).setDesc(desc).addText((text) => {
        text.inputEl.type = "number";
        text.inputEl.min = String(min);
        text.inputEl.max = String(max);
        text.inputEl.step = "1";
        text.setValue(String(settings[key])).onChange(async (value) => {
          const number = Number(value);
          if (!Number.isInteger(number) || number < min || number > max) {
            text.inputEl.setCustomValidity(tr.errorInvalidLimits);
            return;
          }
          text.inputEl.setCustomValidity("");
          this.plugin.settings[key] = number;
          await this.plugin.saveSettings();
        });
      });
    }
  }

  /**
   * 모델 ID 입력 행: 직접 입력 + "모델 불러오기" 버튼
   * 불러온 목록은 입력란 자동완성(ModelSuggest)으로 제안하고, 실패하면 Notice로 알린다
   */
  private renderModelSetting(
    containerEl: HTMLElement,
    tr: ReturnType<typeof t>,
    key: "bedrockModelId" | "openaiModel" | "anthropicModel" | "geminiModel"
  ): void {
    const savedModels = key === "bedrockModelId" ? this.plugin.settings.bedrockModels : [];
    const modelSetting = new Setting(containerEl).setName(tr.modelLabel).setDesc(tr.modelDesc);
    if (savedModels.length && !this.isManualModel) {
      // 저장된 Bedrock 목록이 있으면 드롭다운으로 고르고, 목록에 없는 ID는 "직접 입력"으로 넣는다.
      modelSetting.addDropdown((dropdown) => {
        const current = this.plugin.settings[key];
        for (const id of new Set([...savedModels, ...(current ? [current] : [])])) dropdown.addOption(id, id);
        dropdown.addOption(MANUAL_MODEL_OPTION, tr.modelManualOption)
          .setValue(current)
          .onChange(async (value) => {
            if (value === MANUAL_MODEL_OPTION) {
              this.isManualModel = true;
              this.display();
              return;
            }
            this.plugin.settings[key] = value;
            await this.plugin.saveSettings();
          });
      });
    } else {
      modelSetting.addText((text) => {
        const version = this.modelListVersion;
        text.setValue(this.plugin.settings[key]).onChange(async (value) => {
          this.plugin.settings[key] = value.trim();
          await this.plugin.saveSettings();
        });
        new ModelSuggest(
          this.app,
          text.inputEl,
          // Bedrock 목록은 설정에 저장해 두고 다시 불러오기 전까지 그대로 쓴다.
          () => key === "bedrockModelId" ? this.plugin.settings.bedrockModels
            : version === this.modelListVersion ? this.availableModels ?? [] : [],
          async (value) => {
            this.plugin.settings[key] = value;
            await this.plugin.saveSettings();
          }
        );
      });
    }
    modelSetting
      .addButton((button) => {
        button
          .setButtonText(this.isLoadingModels ? tr.modelListLoading : tr.modelListButton)
          .onClick(async () => {
            if (this.isLoadingModels) return;
            this.isLoadingModels = true;
            const version = this.modelListVersion;
            button.setButtonText(tr.modelListLoading);
            try {
              const models = await listAvailableModels({ ...this.plugin.settings });
              if (version !== this.modelListVersion) return;
              this.availableModels = models;
              if (key === "bedrockModelId") {
                this.isManualModel = false;
                this.plugin.settings.bedrockModels = models;
                await this.plugin.saveSettings();
              }
              new Notice(tr.modelListLoaded(this.availableModels.length));
            } catch (error) {
              if (version !== this.modelListVersion) return;
              this.availableModels = null;
              new Notice(error instanceof Error ? error.message : tr.errorModelList);
            } finally {
              this.isLoadingModels = false;
              this.display();
            }
          });
      });
  }

  /** 현재 설정으로 짧은 요청을 보내 인증·모델이 동작하는지, Bedrock은 어떤 인증이 쓰였는지 알려준다 */
  private renderConnectionTest(containerEl: HTMLElement, tr: ReturnType<typeof t>): void {
    new Setting(containerEl)
      .setName(tr.connectionTestLabel)
      .setDesc(tr.connectionTestDesc)
      .addButton((button) => {
        button.setButtonText(tr.connectionTestButton).onClick(async () => {
          const settings = { ...this.plugin.settings, maxOutputTokens: CONNECTION_TEST_MAX_TOKENS };
          let hasFallenBack = false;
          const client = new AiModelClient(settings, undefined, () => { hasFallenBack = true; });
          button.setDisabled(true).setButtonText(tr.connectionTesting);
          try {
            await client.generate(CONNECTION_TEST_PROMPT);
            const isBedrock = settings.aiProvider === "bedrock";
            new Notice(
              !isBedrock ? tr.connectionOk
                : hasFallenBack ? tr.connectionOkFallback
                : canUseProfile(settings) ? tr.connectionOkProfile : tr.connectionOkBearer,
              NOTICE_DURATION_MS
            );
          } catch (error) {
            new Notice(error instanceof Error ? error.message : tr.errorModelRequest, NOTICE_DURATION_MS);
          } finally {
            client.destroy();
            button.setDisabled(false).setButtonText(tr.connectionTestButton);
          }
        });
      });
  }

  private invalidateModelList(): void {
    this.availableModels = null;
    // 이전 설정으로 보낸 요청과 열려 있던 자동완성 제안을 모두 무효화한다.
    this.modelListVersion++;
  }

  private modelText(
    containerEl: HTMLElement,
    label: string,
    description: string,
    key: "bedrockModelId" | "bedrockRegion" | "bedrockProfile" | "bedrockBearerToken" |
      "openaiModel" | "openaiBaseUrl" | "openaiApiKey" | "anthropicModel" | "anthropicApiKey" |
      "geminiModel" | "geminiApiKey",
    secret = false
  ): void {
    new Setting(containerEl).setName(label).setDesc(description).addText((text) => {
      text.setValue(this.plugin.settings[key]).onChange(async (value) => {
        this.plugin.settings[key] = value.trim();
        this.invalidateModelList();
        await this.plugin.saveSettings();
      });
      if (secret) this.addPasswordToggle(text.inputEl);
    });
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
    new Setting(containerEl).setName(tr.subscriptionSectionHeader).setHeading();

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
    const linkEl = createEl("a");
    linkEl.href = "https://console.cloud.google.com/apis/credentials";
    linkEl.textContent = "Google Cloud Console";
    linkEl.className = "external-link";
    apiKeySetting.descEl.append(" → ", linkEl);

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
    new Setting(containerEl).setName(tr.subscriptionChannelsLabel).setHeading();

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
