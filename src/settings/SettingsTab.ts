// ============================================================
// SettingsTab - 플러그인 설정 탭
// 모델 제공자·인증, 언어, 저장 폴더 설정
// 구독 피드 설정: 수동 채널 추가 방식 (채널 ID 입력 → channels.list API 조회 → 추가)
// ============================================================

import {
  AbstractInputSuggest, App, Notice, Plugin, PluginSettingTab, Setting, SettingDefinition, SettingDefinitionItem, setIcon,
} from "obsidian";
import {
  AI_MODEL_FIELDS, AI_PROVIDER_LABELS, AiProvider, PluginSettings, SubscriptionChannel, MonitoredChannel,
  SUMMARY_LANGUAGES, SummaryLanguage,
} from "../models/types";
import { t, Language } from "../i18n";
import { AiModelClient, canUseProfile, listAvailableModels } from "../services/AiModelClient";
import { SecretIdField, isSecretIdField } from "../services/secrets";
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
  /** API 키 값을 비밀 저장소에서 채운 설정 (모델 호출·목록 조회·연결 테스트용) */
  getResolvedSettings(): PluginSettings;
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
   * 설정 항목 정의. Obsidian이 이 목록으로 화면을 그리고 설정 검색에 색인한다.
   * update()마다, 그리고 탭 등록 시 한 번 호출되므로 여기서는 DOM·네트워크·저장을 하지 않는다.
   */
  getSettingDefinitions(): SettingDefinitionItem[] {
    const settings = this.plugin.settings;
    const tr = t(settings.language ?? "en");
    const hasYoutubeKey = settings.youtubeDataApiKeySecret.trim().length > 0;
    const secret = (name: string, desc: string, key: SecretIdField): SettingDefinition =>
      ({ name, desc, control: { type: "secret", key } });

    return [
      // 플러그인 이름 헤딩은 심사 기준상 금지 — 설명만 표시
      { name: "", desc: tr.settingsDescription, searchable: false, render: () => {} },
      {
        name: tr.languageLabel,
        desc: tr.languageDesc,
        render: (setting) => {
          setting.addDropdown((dropdown) => {
            dropdown.addOption("en", "English");
            dropdown.addOption("ko", "한국어");
            dropdown
              .setValue(settings.language ?? "en")
              .onChange(async (value: string) => {
                this.plugin.settings.language = value as Language;
                await this.plugin.saveSettings();
                this.update();
              });
          });
        },
      },
      ...this.aiDefinitions(tr, secret),
      {
        name: tr.saveFolderLabel,
        desc: tr.saveFolderDesc,
        render: (setting) => {
          setting.addText((text) => {
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
        },
      },
      {
        type: "group",
        heading: tr.subscriptionSectionHeader,
        items: [
          secret(tr.youtubeDataApiKeyLabel, tr.youtubeDataApiKeyDesc, "youtubeDataApiKeySecret"),
          // API 키가 있을 때만 채널 추가와 구독 설정을 표시
          ...(hasYoutubeKey ? this.subscriptionDefinitions(tr) : []),
        ],
      },
      ...(hasYoutubeKey && settings.monitoredChannels.length > 0
        ? [{ type: "group" as const, heading: tr.subscriptionChannelsLabel, items: this.channelDefinitions(tr) }]
        : []),
      // 후원 배너. 원격 이미지를 불러오지 않도록 버튼을 CSS와 아이콘으로 그린다.
      {
        name: tr.sponsorLabel,
        searchable: false,
        render: (setting) => {
          const bannerEl = setting.settingEl;
          bannerEl.empty();
          bannerEl.addClass("youtube-summarizer-sponsor");
          bannerEl.createSpan({ text: tr.sponsorLabel });
          const linkEl = bannerEl.createEl("a", { cls: "youtube-summarizer-sponsor-button" });
          linkEl.setAttribute("href", SPONSOR_URL);
          linkEl.setAttribute("target", "_blank");
          linkEl.setAttribute("rel", "noopener");
          setIcon(linkEl.createSpan({ cls: "youtube-summarizer-sponsor-icon" }), "coffee");
          linkEl.createSpan({ text: "Buy me a coffee" });
        },
      },
    ];
  }

  /**
   * 선언형 control(비밀 선택)의 저장도 플러그인의 saveSettings를 거치게 한다.
   * 기본 구현은 저장만 하므로, 사이드바 갱신과 모델 목록 무효화가 빠진다.
   */
  async setControlValue(key: string, value: unknown): Promise<void> {
    if (!isSecretIdField(key) || typeof value !== "string") return;
    this.plugin.settings[key] = value;
    this.invalidateModelList();
    await this.plugin.saveSettings();
    // YouTube Data API 키 유무에 따라 구독 설정 항목이 나타나거나 사라진다.
    this.update();
  }

  private aiDefinitions(
    tr: ReturnType<typeof t>,
    secret: (name: string, desc: string, key: SecretIdField) => SettingDefinition
  ): SettingDefinition[] {
    const settings = this.plugin.settings;
    const keyField = {
      openai: "openaiApiKeySecret", anthropic: "anthropicApiKeySecret", gemini: "geminiApiKeySecret",
    } as const;
    const authDefinitions = settings.aiProvider === "bedrock"
      ? [
        this.modelText(tr.bedrockRegionLabel, tr.bedrockRegionDesc, "bedrockRegion"),
        this.modelText(tr.bedrockProfileLabel, tr.bedrockProfileDesc, "bedrockProfile"),
        secret(tr.bedrockTokenLabel, tr.bedrockTokenDesc, "bedrockBearerTokenSecret"),
      ]
      : [
        ...(settings.aiProvider === "openai"
          ? [this.modelText(tr.openaiBaseUrlLabel, tr.openaiBaseUrlDesc, "openaiBaseUrl")]
          : []),
        secret(tr.modelApiKeyLabel, tr.modelApiKeyDesc, keyField[settings.aiProvider]),
      ];

    return [
      {
        name: tr.summaryLanguageLabel,
        desc: tr.summaryLanguageDesc,
        render: (setting) => {
          setting.addDropdown((dropdown) => {
            for (const { code, label } of SUMMARY_LANGUAGES) dropdown.addOption(code, label);
            dropdown
              .setValue(settings.summaryLanguage)
              .onChange(async (value) => {
                this.plugin.settings.summaryLanguage = value as SummaryLanguage;
                await this.plugin.saveSettings();
              });
          });
        },
      },
      {
        name: tr.providerLabel,
        desc: tr.providerDesc,
        render: (setting) => {
          setting.addDropdown((dropdown) => {
            for (const [provider, label] of Object.entries(AI_PROVIDER_LABELS)) dropdown.addOption(provider, label);
            dropdown
              .setValue(settings.aiProvider)
              .onChange(async (value) => {
                this.plugin.settings.aiProvider = value as AiProvider;
                this.invalidateModelList();
                await this.plugin.saveSettings();
                this.update();
              });
          });
        },
      },
      ...authDefinitions,
      // 인증 정보 입력 뒤에 모델 선택 (불러오기 버튼 + 자동완성)
      {
        name: tr.modelLabel,
        desc: tr.modelDesc,
        render: (setting) => this.renderModelSetting(setting, tr, AI_MODEL_FIELDS[settings.aiProvider]),
      },
      {
        name: tr.connectionTestLabel,
        desc: tr.connectionTestDesc,
        render: (setting) => this.renderConnectionTest(setting, tr),
      },
      ...([
        ["maxInputChars", tr.maxInputCharsLabel, tr.maxInputCharsDesc, 1000, 1000000],
        ["maxOutputTokens", tr.maxOutputTokensLabel, tr.maxOutputTokensDesc, 128, 128000],
      ] as const).map(([key, name, desc, min, max]): SettingDefinition => ({
        name,
        desc,
        render: (setting) => {
          setting.addText((text) => {
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
        },
      })),
    ];
  }

  /**
   * 모델 ID 입력 행: 직접 입력 + "모델 불러오기" 버튼
   * 불러온 목록은 입력란 자동완성(ModelSuggest)으로 제안하고, 실패하면 Notice로 알린다
   */
  private renderModelSetting(
    modelSetting: Setting,
    tr: ReturnType<typeof t>,
    key: "bedrockModelId" | "openaiModel" | "anthropicModel" | "geminiModel"
  ): void {
    const savedModels = key === "bedrockModelId" ? this.plugin.settings.bedrockModels : [];
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
              this.update();
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
              const models = await listAvailableModels(this.plugin.getResolvedSettings());
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
              this.update();
            }
          });
      });
  }

  /** 현재 설정으로 짧은 요청을 보내 인증·모델이 동작하는지, Bedrock은 어떤 인증이 쓰였는지 알려준다 */
  private renderConnectionTest(setting: Setting, tr: ReturnType<typeof t>): void {
    setting
      .addButton((button) => {
        button.setButtonText(tr.connectionTestButton).onClick(async () => {
          const settings = { ...this.plugin.getResolvedSettings(), maxOutputTokens: CONNECTION_TEST_MAX_TOKENS };
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
    name: string,
    desc: string,
    key: "bedrockRegion" | "bedrockProfile" | "openaiBaseUrl"
  ): SettingDefinition {
    return {
      name,
      desc,
      render: (setting) => {
        setting.addText((text) => {
          text.setValue(this.plugin.settings[key]).onChange(async (value) => {
            this.plugin.settings[key] = value.trim();
            this.invalidateModelList();
            await this.plugin.saveSettings();
          });
        });
      },
    };
  }

  /** 구독 피드 설정: 채널 추가, 구독 저장 폴더, 채널당 영상 수 */
  private subscriptionDefinitions(tr: ReturnType<typeof t>): SettingDefinition[] {
    return [
      {
        name: tr.addChannelLabel,
        desc: tr.addChannelDesc,
        render: (setting) => {
          // 채널 ID 입력 + 추가 버튼
          let channelIdInput = "";
          setting
            .addText((text) => {
              text
                .setPlaceholder("@rastalion_dev")
                .onChange((value: string) => {
                  channelIdInput = value;
                });
            })
            .addButton((button) => {
              button
                .setButtonText(this.isAddingChannel ? tr.addingChannel : tr.addChannelButton)
                .setCta()
                .onClick(async () => {
                  await this.addChannel(channelIdInput);
                });
            });
        },
      },
      {
        name: tr.subscriptionSaveFolderLabel,
        desc: tr.subscriptionSaveFolderDesc,
        render: (setting) => {
          setting.addText((text) => {
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
        },
      },
      {
        name: tr.videosPerChannelLabel,
        desc: tr.videosPerChannelDesc,
        render: (setting) => {
          // 채널당 표시할 최신 영상 개수 슬라이더 (범위: 1~10)
          setting.addSlider((slider) => {
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
        },
      },
    ];
  }

  /** 모니터링 채널마다 채널명 + 그룹 입력 + 삭제 버튼, 그리고 채널별 저장 폴더 */
  private channelDefinitions(tr: ReturnType<typeof t>): SettingDefinition[] {
    const findChannel = (channelId: string): MonitoredChannel | undefined =>
      this.plugin.settings.monitoredChannels.find((ch) => ch.channelId === channelId);

    return this.plugin.settings.monitoredChannels.flatMap((channel): SettingDefinition[] => [
      {
        name: channel.channelTitle,
        desc: tr.channelGroupDesc,
        render: (setting) => {
          setting
            .addText((text) => {
              text
                .setPlaceholder(tr.channelGroupLabel)
                .setValue(channel.group ?? "")
                .onChange(async (value: string) => {
                  const target = findChannel(channel.channelId);
                  if (!target) return;
                  // 빈 문자열/공백이면 그룹 미설정으로 처리
                  const trimmed = value.trim();
                  target.group = trimmed.length > 0 ? trimmed : undefined;
                  await this.plugin.saveSettings();
                });
            })
            .addButton((button) => {
              button
                .setButtonText(tr.removeChannelButton)
                .onClick(async () => {
                  await this.removeChannel(channel.channelId);
                });
            });
        },
      },
      {
        name: tr.channelSaveFolderLabel,
        desc: tr.channelSaveFolderDesc,
        render: (setting) => {
          const saveFolder = async (value: string): Promise<void> => {
            const target = findChannel(channel.channelId);
            if (!target) return;
            target.saveFolderPath = value;
            await this.plugin.saveSettings();
          };
          setting.addText((text) => {
            text
              .setPlaceholder(this.plugin.settings.subscriptionSaveFolderPath)
              .setValue(channel.saveFolderPath ?? "")
              .onChange(saveFolder);
            // 볼트 폴더 자동완성 연결
            new FolderSuggest(this.app, text.inputEl, saveFolder);
          });
        },
      },
    ]);
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
    this.update();

    try {
      const channelInfo = await this.plugin.fetchChannelInfo(trimmed);

      // API 응답의 실제 channelId로 중복 체크
      const alreadyExists = this.plugin.settings.monitoredChannels.find(
        (ch) => ch.channelId === channelInfo.channelId
      );
      if (alreadyExists) {
        this.isAddingChannel = false;
        this.update();
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
      this.update();
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

      this.update();
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
    this.update();
  }
}
