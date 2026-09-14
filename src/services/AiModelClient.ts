import { Platform } from "obsidian";
import { t } from "../i18n";
import { PluginSettings } from "../models/types";
import { RequestFn, requestHttp, withTimeout } from "./http";
import type { BedrockRuntimeClient } from "@aws-sdk/client-bedrock-runtime";

const MODEL_TIMEOUT_MS = 180000;
const LIST_TIMEOUT_MS = 30000;
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

function hasText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
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
      if (settings.bedrockAuthMode === "profile") {
        if (!Platform.isDesktopApp) return tr.errorDesktopProfile;
        const nodeMajor = typeof process === "undefined" ? 0 : Number(process.versions?.node?.split(".")[0]);
        if (!Number.isFinite(nodeMajor) || nodeMajor < 20) return tr.errorProfileRuntime;
        if (!hasText(settings.bedrockProfile)) return tr.errorMissingProfile;
      } else if (settings.bedrockAuthMode !== "bearer" || !hasText(settings.bedrockBearerToken) ||
        !settings.bedrockBearerToken.trim().replace(/^Bearer(?:\s+|$)/i, "")) {
        return tr.errorMissingApiKey;
      }
      return undefined;
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
      if (settings.bedrockAuthMode !== "bearer") throw new Error(tr.errorModelListProfile);
      const token = settings.bedrockBearerToken.trim().replace(/^Bearer(?:\s+|$)/i, "");
      if (!token) throw new Error(tr.errorMissingApiKey);
      if (!/^[a-z]{2}(?:-[a-z]+)+-\d+$/.test(settings.bedrockRegion)) throw new Error(tr.errorInvalidRegion);
      const domain = settings.bedrockRegion.startsWith("cn-") ? "amazonaws.com.cn" : "amazonaws.com";
      const base = `https://bedrock.${settings.bedrockRegion}.${domain}`;
      const headers = { Authorization: `Bearer ${token}` };
      // 최신 모델은 교차 리전 추론 프로필 ID로만 온디맨드 호출 가능한 경우가 많아 둘 다 조회한다.
      const [profiles, models] = await Promise.all([
        get(`${base}/inference-profiles?maxResults=1000`, headers).catch(() => null),
        get(`${base}/foundation-models`, headers),
      ]);
      const profileIds = ((profiles as { inferenceProfileSummaries?: { inferenceProfileId?: string; status?: string }[] } | null)
        ?.inferenceProfileSummaries ?? [])
        .filter((profile) => profile.status === "ACTIVE")
        .map((profile) => profile.inferenceProfileId);
      const modelIds = ((models as { modelSummaries?: BedrockModelSummary[] })?.modelSummaries ?? [])
        .filter((model) =>
          model.modelLifecycle?.status !== "LEGACY" &&
          (model.outputModalities ?? []).includes("TEXT") &&
          (model.inferenceTypesSupported ?? []).includes("ON_DEMAND"))
        .map((model) => model.modelId);
      ids = [...profileIds, ...modelIds].filter(hasText);
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

function textBlocks(blocks: unknown): string {
  if (!Array.isArray(blocks)) return "";
  return blocks
    .filter((block) => block && typeof block.text === "string" && block.thought !== true &&
      (!block.type || block.type === "text"))
    .map((block) => block.text as string)
    .join("\n");
}

export class AiModelClient {
  private profileClient?: BedrockRuntimeClient;

  constructor(
    private settings: PluginSettings,
    private request: RequestFn = requestHttp
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
        if (settings.bedrockAuthMode === "profile") {
          response = await this.generateWithProfile(body);
        } else {
          const domain = settings.bedrockRegion.startsWith("cn-") ? "amazonaws.com.cn" : "amazonaws.com";
          response = await this.post(
            `https://bedrock-runtime.${settings.bedrockRegion}.${domain}/model/${encodeURIComponent(settings.bedrockModelId.trim())}/converse`,
            { Authorization: `Bearer ${settings.bedrockBearerToken.trim().replace(/^Bearer(?:\s+|$)/i, "")}` },
            body
          );
        }
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
    // Node 전용 SDK는 SSO/프로필 인증을 선택했을 때만 초기화하여 모바일의 토큰 호출을 보존한다.
    const { BedrockRuntimeClient, ConverseCommand } = await import("@aws-sdk/client-bedrock-runtime");
    if (!this.profileClient) {
      const { fromIni } = await import("@aws-sdk/credential-provider-ini");
      this.profileClient = new BedrockRuntimeClient({
        region: this.settings.bedrockRegion,
        credentials: fromIni({ profile: this.settings.bedrockProfile.trim(), ignoreCache: true }),
        // 환경에 남은 AWS_BEARER_TOKEN_BEDROCK이 명시한 SSO 계정을 덮어쓰지 않게 한다.
        authSchemePreference: ["aws.auth#sigv4"],
        maxAttempts: 1,
        requestHandler: { connectionTimeout: 10000, requestTimeout: MODEL_TIMEOUT_MS },
      });
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), MODEL_TIMEOUT_MS);
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
      if (controller.signal.aborted) throw new Error(tr.errorModelTimeout);
      const name = error instanceof Error ? error.name : "";
      if (/Credentials|Token|SSO|Unauthorized/.test(name)) throw new Error(tr.errorProfileCredentials);
      throw new Error(tr.errorModelRequest);
    } finally {
      clearTimeout(timer);
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
    return response.json as ModelResponse;
  }
}
