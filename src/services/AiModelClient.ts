import { Platform } from "obsidian";
import { t } from "../i18n";
import { PluginSettings } from "../models/types";
import { RequestFn, requestHttp, withTimeout } from "./http";
import type { BedrockRuntimeClient } from "@aws-sdk/client-bedrock-runtime";

const MODEL_TIMEOUT_MS = 180000;
const LIST_TIMEOUT_MS = 30000;
const MIN_PROFILE_NODE_MAJOR = 20;
const SDK_CONNECTION_TIMEOUT_MS = 10000;
const CLAUDE_FAMILIES = ["haiku", "opus", "sonnet"] as const;
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

function hasText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function bedrockToken(settings: PluginSettings): string {
  return settings.bedrockBearerToken.trim().replace(/^Bearer(?:\s+|$)/i, "");
}

function hasProfileRuntime(): boolean {
  const nodeMajor = typeof process === "undefined" ? 0 : Number(process.versions?.node?.split(".")[0]);
  return Platform.isDesktopApp && Number.isFinite(nodeMajor) && nodeMajor >= MIN_PROFILE_NODE_MAJOR;
}

/** 이 설정으로 호출하면 AWS 프로필을 먼저 시도하는지 여부 (연결 테스트 결과 표시용) */
export function canUseProfile(settings: PluginSettings): boolean {
  return hasText(settings.bedrockProfile) && hasProfileRuntime();
}

/** 프로필을 쓸 수 없어도 Bearer 토큰이 있으면 폴백할 수 있으므로 오류가 아니다. */
function getBedrockAuthError(settings: PluginSettings): string | undefined {
  const tr = t(settings.language);
  if (bedrockToken(settings) || canUseProfile(settings)) return undefined;
  if (!hasText(settings.bedrockProfile)) return tr.errorMissingApiKey;
  return Platform.isDesktopApp ? tr.errorProfileRuntime : tr.errorDesktopProfile;
}

/** 프로필(SSO·Roles Anywhere) 자격 증명을 얻지 못한 경우만 Bearer 폴백 대상으로 구분한다. */
class ProfileCredentialsError extends Error {}

function isCredentialsError(error: unknown): boolean {
  return /Credentials|Token|SSO|Unauthorized/.test(error instanceof Error ? error.name : "");
}

/** 프로필 자격 증명 실패이고 토큰이 있을 때만 Bearer로 다시 시도한다. 권한·모델 오류는 다른 계정으로 넘기지 않는다. */
function withBearerFallback<T>(
  settings: PluginSettings,
  viaProfile: () => Promise<T>,
  viaBearer: () => Promise<T>,
  onFallback?: () => void
): Promise<T> {
  if (!canUseProfile(settings)) return viaBearer();
  return viaProfile().catch((error: unknown) => {
    if (!bedrockToken(settings) || !(error instanceof ProfileCredentialsError)) throw error;
    onFallback?.();
    return viaBearer();
  });
}

async function profileClientConfig(settings: PluginSettings, requestTimeout: number) {
  const { fromIni } = await import("@aws-sdk/credential-provider-ini");
  return {
    region: settings.bedrockRegion,
    credentials: fromIni({ profile: settings.bedrockProfile.trim(), ignoreCache: true }),
    // 환경에 남은 AWS_BEARER_TOKEN_BEDROCK이 명시한 프로필 계정을 덮어쓰지 않게 한다.
    authSchemePreference: ["aws.auth#sigv4"],
    maxAttempts: 1,
    requestHandler: { connectionTimeout: SDK_CONNECTION_TIMEOUT_MS, requestTimeout },
  };
}

/** `claude-sonnet-4-6`, `claude-3-5-sonnet-20241022-v2:0` 두 표기에서 계열과 버전을 읽는다. */
function parseClaudeModel(id: string): { family: string; version: number } | undefined {
  const parts = /anthropic\.claude-([a-z0-9-]+)/.exec(id)?.[1].replace(/-\d{8}.*$/, "").split("-") ?? [];
  const family = CLAUDE_FAMILIES.find((candidate) => parts.includes(candidate));
  if (!family) return undefined;
  const [major = 0, minor = 0] = parts.filter((part) => /^\d{1,2}$/.test(part)).map(Number);
  return { family, version: major * 100 + minor };
}

/** haiku·opus·sonnet 계열마다 가장 높은 버전의 ID만 남긴다 (리전 접두사가 다른 ID는 함께 남는다). */
function latestClaudeModels(ids: string[]): string[] {
  const models = ids.flatMap((id) => {
    const model = parseClaudeModel(id);
    return model ? [{ id, ...model }] : [];
  });
  return models
    .filter((model) => !models.some((other) => other.family === model.family && other.version > model.version))
    .map((model) => model.id);
}

/** 요약과 모델 목록 조회에서 동일한 주소·인증 검증을 사용한다. */
function getOpenAiConnectionError(settings: PluginSettings): string | undefined {
  const tr = t(settings.language);
  let url: URL;
  try {
    url = new URL(settings.openaiBaseUrl.trim());
  } catch {
    return tr.errorInvalidBaseUrl;
  }
  const local = LOCAL_HOSTS.has(url.hostname);
  if (
    (url.protocol !== "https:" && !(local && url.protocol === "http:")) ||
    url.username || url.password || url.search || url.hash
  ) return tr.errorInvalidBaseUrl;
  if (!local && !hasText(settings.openaiApiKey)) return tr.errorMissingApiKey;
  return undefined;
}

/** URL·벌크·피드에서 같은 설정 검증을 사용한다. */
export function getAiConfigurationError(settings: PluginSettings): string | undefined {
  const tr = t(settings.language);
  if (
    !Number.isInteger(settings.maxInputChars) || settings.maxInputChars < 1000 || settings.maxInputChars > 1000000 ||
    !Number.isInteger(settings.maxOutputTokens) || settings.maxOutputTokens < 128 || settings.maxOutputTokens > 128000
  ) return tr.errorInvalidLimits;

  switch (settings.aiProvider) {
    case "bedrock":
      if (!hasText(settings.bedrockModelId)) return tr.errorMissingModel;
      if (!/^[a-z]{2}(?:-[a-z]+)+-\d+$/.test(settings.bedrockRegion)) return tr.errorInvalidRegion;
      return getBedrockAuthError(settings);
    case "openai": {
      if (!hasText(settings.openaiModel)) return tr.errorMissingModel;
      return getOpenAiConnectionError(settings);
    }
    case "anthropic":
      if (!hasText(settings.anthropicModel)) return tr.errorMissingModel;
      return hasText(settings.anthropicApiKey) ? undefined : tr.errorMissingApiKey;
    case "gemini":
      if (!hasText(settings.geminiModel)) return tr.errorMissingModel;
      return hasText(settings.geminiApiKey) ? undefined : tr.errorMissingApiKey;
    default:
      return tr.errorModelRequest;
  }
}

interface BedrockModelSummary {
  modelId?: string;
  modelLifecycle?: { status?: string };
  outputModalities?: string[];
  inferenceTypesSupported?: string[];
}

interface BedrockCatalog {
  inferenceProfileSummaries?: { inferenceProfileId?: string; status?: string }[];
  modelSummaries?: BedrockModelSummary[];
}

/** 한쪽 조회 권한만 있는 역할·키도 있으므로 둘 중 하나만 성공해도 목록을 만든다. */
async function mergeCatalogs(profiles: Promise<unknown>, models: Promise<unknown>): Promise<BedrockCatalog> {
  const results = await Promise.allSettled([profiles, models]);
  const failures = results.flatMap((result) => result.status === "rejected" ? [result.reason as unknown] : []);
  if (failures.length === results.length) throw failures.find(isCredentialsError) ?? failures[failures.length - 1];
  const [profileCatalog, modelCatalog] = results.map((result) =>
    result.status === "fulfilled" ? result.value as BedrockCatalog | null : null);
  return { ...profileCatalog, ...modelCatalog };
}

async function listBedrockWithProfile(settings: PluginSettings): Promise<BedrockCatalog> {
  const tr = t(settings.language);
  const { BedrockClient, ListFoundationModelsCommand, ListInferenceProfilesCommand } = await import("@aws-sdk/client-bedrock");
  const client = new BedrockClient(await profileClientConfig(settings, LIST_TIMEOUT_MS));
  try {
    return await withTimeout(
      mergeCatalogs(
        client.send(new ListInferenceProfilesCommand({ maxResults: 1000 })),
        client.send(new ListFoundationModelsCommand({}))
      ),
      LIST_TIMEOUT_MS,
      tr.errorModelList
    );
  } catch (error) {
    if (isCredentialsError(error)) throw new ProfileCredentialsError(tr.errorProfileCredentials, { cause: error });
    throw new Error(tr.errorModelList, { cause: error });
  } finally {
    client.destroy();
  }
}

interface GeminiModelSummary {
  name?: string;
  supportedGenerationMethods?: string[];
}

/** 설정의 인증 정보로 현재 제공자의 텍스트 모델 ID 목록을 조회한다 (설정 탭 모델 선택용) */
export async function listAvailableModels(
  settings: PluginSettings,
  request: RequestFn = requestHttp
): Promise<string[]> {
  const tr = t(settings.language);
  const get = async (url: string, headers: Record<string, string> = {}): Promise<unknown> => {
    const response = await withTimeout(
      request({ url, method: "GET", headers })
        .catch(() => { throw new Error(tr.errorModelList); }),
      LIST_TIMEOUT_MS,
      tr.errorModelList
    );
    if (response.status < 200 || response.status >= 300) {
      throw new Error(`${tr.errorModelList} (HTTP ${response.status})`);
    }
    return response.json;
  };

  let ids: string[];
  switch (settings.aiProvider) {
    case "bedrock": {
      if (!/^[a-z]{2}(?:-[a-z]+)+-\d+$/.test(settings.bedrockRegion)) throw new Error(tr.errorInvalidRegion);
      const authError = getBedrockAuthError(settings);
      if (authError) throw new Error(authError);
      const domain = settings.bedrockRegion.startsWith("cn-") ? "amazonaws.com.cn" : "amazonaws.com";
      const base = `https://bedrock.${settings.bedrockRegion}.${domain}`;
      const headers = { Authorization: `Bearer ${bedrockToken(settings)}` };
      // 최신 모델은 교차 리전 추론 프로필 ID로만 온디맨드 호출 가능한 경우가 많아 둘 다 조회한다.
      const catalog = await withBearerFallback(settings, () => listBedrockWithProfile(settings), () => mergeCatalogs(
        get(`${base}/inference-profiles?maxResults=1000`, headers),
        get(`${base}/foundation-models`, headers)
      ));
      const profileIds = (catalog.inferenceProfileSummaries ?? [])
        .filter((profile) => profile.status === "ACTIVE")
        .map((profile) => profile.inferenceProfileId);
      const modelIds = (catalog.modelSummaries ?? [])
        .filter((model) =>
          model.modelLifecycle?.status !== "LEGACY" &&
          (model.outputModalities ?? []).includes("TEXT") &&
          (model.inferenceTypesSupported ?? []).includes("ON_DEMAND"))
        .map((model) => model.modelId);
      const allIds = [...profileIds, ...modelIds].filter(hasText);
      const latestIds = latestClaudeModels(allIds);
      // Claude 접근 권한이 없는 계정은 전체 목록을 그대로 보여준다.
      ids = latestIds.length ? latestIds : allIds;
      break;
    }
    case "openai": {
      const error = getOpenAiConnectionError(settings);
      if (error) throw new Error(error);
      const baseUrl = settings.openaiBaseUrl.trim().replace(/\/+$/, "");
      const data = await get(
        `${baseUrl}/models`,
        hasText(settings.openaiApiKey) ? { Authorization: `Bearer ${settings.openaiApiKey.trim()}` } : {}
      );
      ids = ((data as { data?: { id?: string }[] })?.data ?? []).map((model) => model.id).filter(hasText);
      break;
    }
    case "anthropic": {
      if (!hasText(settings.anthropicApiKey)) throw new Error(tr.errorMissingApiKey);
      const data = await get("https://api.anthropic.com/v1/models?limit=1000", {
        "x-api-key": settings.anthropicApiKey.trim(),
        "anthropic-version": "2023-06-01",
      });
      ids = ((data as { data?: { id?: string }[] })?.data ?? []).map((model) => model.id).filter(hasText);
      break;
    }
    case "gemini": {
      if (!hasText(settings.geminiApiKey)) throw new Error(tr.errorMissingApiKey);
      const data = await get(
        "https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000",
        { "x-goog-api-key": settings.geminiApiKey.trim() }
      );
      ids = ((data as { models?: GeminiModelSummary[] })?.models ?? [])
        .filter((model) => (model.supportedGenerationMethods ?? []).includes("generateContent"))
        .map((model) => model.name?.replace(/^models\//, ""))
        .filter(hasText);
      break;
    }
    default:
      throw new Error(tr.errorModelList);
  }

  const unique = [...new Set(ids)].sort();
  if (!unique.length) throw new Error(tr.errorModelList);
  return unique;
}

interface ModelResponse {
  output?: { message?: { content?: unknown } };
  stopReason?: string;
  content?: unknown;
  stop_reason?: string;
  choices?: { message?: { content?: string }; finish_reason?: string }[];
  candidates?: { content?: { parts?: unknown }; finishReason?: string }[];
}

interface ContentBlock {
  text?: unknown;
  thought?: unknown;
  type?: unknown;
}

function textBlocks(blocks: unknown): string {
  if (!Array.isArray(blocks)) return "";
  return (blocks as (ContentBlock | null)[])
    .flatMap((block) => block && typeof block.text === "string" && block.thought !== true &&
      (!block.type || block.type === "text") ? [block.text] : [])
    .join("\n");
}

export class AiModelClient {
  private profileClient?: BedrockRuntimeClient;
  private hasFallenBack = false;

  constructor(
    private settings: PluginSettings,
    private request: RequestFn = requestHttp,
    /** 프로필 자격 증명 실패로 Bearer 토큰을 쓰게 됐을 때 한 번 호출된다 */
    private onBearerFallback?: () => void
  ) {}

  async generate(prompt: string): Promise<string> {
    const settings = this.settings;
    const tr = t(settings.language);
    const error = getAiConfigurationError(settings);
    if (error) throw new Error(error);
    let response: ModelResponse;
    switch (settings.aiProvider) {
      case "bedrock": {
        const body = {
          messages: [{ role: "user" as const, content: [{ text: prompt }] }],
          inferenceConfig: { maxTokens: settings.maxOutputTokens },
        };
        const domain = settings.bedrockRegion.startsWith("cn-") ? "amazonaws.com.cn" : "amazonaws.com";
        const viaBearer = () => this.post(
          `https://bedrock-runtime.${settings.bedrockRegion}.${domain}/model/${encodeURIComponent(settings.bedrockModelId.trim())}/converse`,
          { Authorization: `Bearer ${bedrockToken(settings)}` },
          body
        );
        // 한 번 폴백한 뒤에는 번역 조각마다 프로필(credential_process)을 다시 시도하지 않는다.
        response = this.hasFallenBack ? await viaBearer() : await withBearerFallback(
          settings, () => this.generateWithProfile(body), viaBearer,
          () => {
            this.hasFallenBack = true;
            this.onBearerFallback?.();
          }
        );
        break;
      }
      case "openai": {
        const baseUrl = settings.openaiBaseUrl.trim().replace(/\/+$/, "");
        const tokenField = new URL(baseUrl).hostname === "api.openai.com" ? "max_completion_tokens" : "max_tokens";
        response = await this.post(
          `${baseUrl}/chat/completions`,
          hasText(settings.openaiApiKey) ? { Authorization: `Bearer ${settings.openaiApiKey.trim()}` } : {},
          {
            model: settings.openaiModel.trim(),
            messages: [{ role: "user", content: prompt }],
            [tokenField]: settings.maxOutputTokens,
            stream: false,
          }
        );
        break;
      }
      case "anthropic":
        response = await this.post(
          "https://api.anthropic.com/v1/messages",
          { "x-api-key": settings.anthropicApiKey.trim(), "anthropic-version": "2023-06-01" },
          {
            model: settings.anthropicModel.trim(),
            max_tokens: settings.maxOutputTokens,
            messages: [{ role: "user", content: prompt }],
          }
        );
        break;
      case "gemini":
        response = await this.post(
          `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(settings.geminiModel.trim().replace(/^models\//, ""))}:generateContent`,
          { "x-goog-api-key": settings.geminiApiKey.trim() },
          {
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: { maxOutputTokens: settings.maxOutputTokens },
          }
        );
        break;
    }

    const stop = response.stopReason ?? response.stop_reason ??
      response.choices?.[0]?.finish_reason ?? response.candidates?.[0]?.finishReason;
    if (stop && ["max_tokens", "length", "MAX_TOKENS", "model_context_window_exceeded"].includes(stop)) {
      throw new Error(tr.errorModelTruncated);
    }
    if (stop && !["end_turn", "stop_sequence", "stop", "STOP"].includes(stop)) {
      throw new Error(tr.errorModelBlocked);
    }
    const text = (
      textBlocks(response.output?.message?.content) ||
      textBlocks(response.content) ||
      response.choices?.[0]?.message?.content ||
      textBlocks(response.candidates?.[0]?.content?.parts)
    );
    if (typeof text !== "string" || !text.trim()) throw new Error(tr.errorModelEmpty);
    return text.trim();
  }

  destroy(): void {
    this.profileClient?.destroy();
    this.profileClient = undefined;
  }

  private async generateWithProfile(
    body: { messages: { role: "user"; content: { text: string }[] }[]; inferenceConfig: { maxTokens: number } }
  ): Promise<ModelResponse> {
    const tr = t(this.settings.language);
    // Node 전용 SDK는 프로필을 쓸 때만 초기화하여 모바일의 토큰 호출을 보존한다.
    const { BedrockRuntimeClient, ConverseCommand } = await import("@aws-sdk/client-bedrock-runtime");
    if (!this.profileClient) {
      this.profileClient = new BedrockRuntimeClient(await profileClientConfig(this.settings, MODEL_TIMEOUT_MS));
    }
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), MODEL_TIMEOUT_MS);
    try {
      return await withTimeout(
        this.profileClient.send(
          new ConverseCommand({ modelId: this.settings.bedrockModelId.trim(), ...body }),
          { abortSignal: controller.signal }
        ),
        MODEL_TIMEOUT_MS,
        tr.errorModelTimeout
      );
    } catch (error) {
      if (controller.signal.aborted) throw new Error(tr.errorModelTimeout, { cause: error });
      if (isCredentialsError(error)) throw new ProfileCredentialsError(tr.errorProfileCredentials, { cause: error });
      throw new Error(tr.errorModelRequest, { cause: error });
    } finally {
      window.clearTimeout(timer);
    }
  }

  private async post(url: string, headers: Record<string, string>, body: unknown): Promise<ModelResponse> {
    const tr = t(this.settings.language);
    const response = await withTimeout(
      this.request({
        url,
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify(body),
      }).catch(() => { throw new Error(tr.errorModelRequest); }),
      MODEL_TIMEOUT_MS,
      tr.errorModelTimeout
    );
    if (response.status < 200 || response.status >= 300) {
      throw new Error(`${tr.errorModelRequest} (HTTP ${response.status})`);
    }
    if (!response.json || typeof response.json !== "object") throw new Error(tr.errorModelEmpty);
    return response.json;
  }
}
