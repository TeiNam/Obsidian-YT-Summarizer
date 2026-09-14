// @vitest-environment jsdom
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { App, Platform } from "obsidian";
import { DEFAULT_SETTINGS, PluginSettings, SummaryStage } from "../models/types";
import { t } from "../i18n";
import { AiModelClient, getAiConfigurationError, listAvailableModels } from "./AiModelClient";
import { NoteCreator } from "./NoteCreator";
import { SummarizerService } from "./SummarizerService";
import { SummaryEngine, parseSummary, renderPrompt, splitTranscript } from "./SummaryEngine";
import { YouTubeCaptionClient, parseCaptionXml } from "./YouTubeCaptionClient";
import { RequestFn } from "./http";

const sdk = vi.hoisted(() => ({ config: vi.fn(), fromIni: vi.fn(), send: vi.fn(), destroy: vi.fn() }));
vi.mock("@aws-sdk/client-bedrock-runtime", () => ({
  BedrockRuntimeClient: class {
    constructor(config: unknown) { sdk.config(config); }
    send = sdk.send;
    destroy = sdk.destroy;
  },
  ConverseCommand: class {
    constructor(public input: unknown) {}
  },
}));
vi.mock("@aws-sdk/credential-provider-ini", () => ({ fromIni: sdk.fromIni }));

const VIDEO_ID = "dQw4w9WgXcQ";
const VIDEO_URL = `https://www.youtube.com/watch?v=${VIDEO_ID}`;
const TEXT = "자동 자막의 개념과 구체적인 예시를 함께 공부합니다. ".repeat(20);
const SUMMARY = [
  "===GENRE===", "LECTURE (강의)", "===ONE_LINE===", "핵심 개념과 사례를 연결한다.",
  "===DETAILED===", '## 개념\n"인용"과 C:\\notes 경로를 그대로 적는다.',
  "===INSIGHTS===", "1) 첫째 인사이트.\n   근거가 이어진다.\n2) 2026. 하반기에는 공급이 늘어난다.",
  "===KEYWORDS===", "- **개념**: 정의", "===FURTHER===", "- 추가 주제",
].join("\n");
const SETTINGS: PluginSettings = { ...DEFAULT_SETTINGS, language: "ko", bedrockBearerToken: "bedrock-secret" };

function createPipeline(captionLanguage = "ko") {
  const settings = { ...SETTINGS, apiKey: "legacy-server-secret" };
  const state = {
    modelCalls: 0,
    truncateAt: 0,
    xml: `<transcript><text start="0" dur="60">${TEXT}</text></transcript>`,
    captionsByLanguage: {} as Record<string, string>,
    player: {
      playabilityStatus: { status: "OK" },
      videoDetails: { title: "테스트 영상", lengthSeconds: "60" },
      microformat: { playerMicroformatRenderer: { uploadDate: "2026-09-01" } },
      captions: { playerCaptionsTracklistRenderer: { audioTracks: [{ defaultCaptionTrackIndex: 0 }], captionTracks: [
        { baseUrl: `https://www.youtube.com/api/timedtext?v=test&fmt=srv3&lang=${captionLanguage}`, languageCode: captionLanguage, kind: "asr" },
      ] } },
    },
  };
  const request = vi.fn<Parameters<RequestFn>, ReturnType<RequestFn>>().mockImplementation(async (options) => {
    if (options.url.includes("/watch?")) return {
      status: 200, json: null,
      text: '<meta property="og:title" content="영상 제목"><meta itemprop="datePublished" content="2026-08-30"><script>"INNERTUBE_API_KEY":"public-player-key"</script>',
    };
    if (options.url.includes("/youtubei/")) return { status: 200, json: state.player };
    if (options.url.includes("/api/timedtext")) return {
      status: 200, json: null,
      text: state.captionsByLanguage[new URL(options.url).searchParams.get("lang") ?? ""] ?? state.xml,
    };
    state.modelCalls++;
    const prompt = JSON.parse(options.body!).messages[0].content[0].text as string;
    return { status: 200, json: {
      stopReason: state.modelCalls === state.truncateAt ? "max_tokens" : "end_turn",
      output: { message: { content: [{ text: prompt.startsWith("# 역할") ? SUMMARY : "번역된 전체 자막" }] } },
    } };
  });
  const app = new App();
  const save = vi.spyOn(app.vault, "create");
  const captions = new YouTubeCaptionClient("ko", request);
  const model = new AiModelClient(settings, request);
  const service = new SummarizerService(settings, new NoteCreator(app, "학습/영상"), captions, model);
  return { settings, state, request, save, captions, model, service };
}

beforeEach(() => {
  vi.clearAllMocks();
  Platform.isDesktopApp = true;
  sdk.fromIni.mockReturnValue(async () => ({ accessKeyId: "test", secretAccessKey: "test" }));
  sdk.send.mockResolvedValue({ stopReason: "end_turn", output: { message: { content: [{ text: "SSO 결과" }] } } });
});
afterEach(() => { vi.unstubAllEnvs(); vi.useRealTimers(); });

describe("로컬 자막 요약", () => {
  it("자막 → 번역 → 기존 형식의 요약 → 업로드 날짜 노트 저장을 서버 없이 수행한다", async () => {
    const { request, save, service } = createPipeline("en");
    const progress = vi.fn();
    const file = await service.summarize(VIDEO_URL, "ko", progress);
    expect(file.path).toBe("학습/영상/26-09-01 테스트 영상.md");
    expect(save).toHaveBeenCalledOnce();
    const markdown = save.mock.calls[0][1];
    expect(markdown).toContain("🏷️ 장르: LECTURE");
    expect(markdown).toContain('"인용"과 C:\\notes');
    expect(markdown).toContain("- 첫째 인사이트. 근거가 이어진다.");
    expect(markdown).toContain("2026. 하반기에는 공급이 늘어난다.");
    expect(progress.mock.calls.flat()).toEqual([
      SummaryStage.VALIDATING, SummaryStage.EXTRACTING, SummaryStage.TRANSLATING,
      SummaryStage.SUMMARIZING, SummaryStage.CREATING_NOTE, SummaryStage.COMPLETE,
    ]);
    expect(request).toHaveBeenCalledTimes(5);
    expect(request.mock.calls[2][0].url).not.toContain("fmt=");
    expect(JSON.stringify(request.mock.calls)).not.toContain("legacy-server-secret");
    expect(request.mock.calls.slice(0, 3).some(([r]) => "Authorization" in r.headers)).toBe(false);
    expect(request.mock.calls[3][0].headers.Authorization).toBe("Bearer bedrock-secret");
    expect(request.mock.calls.every(([r]) => !r.url.includes("rastalion.me"))).toBe(true);
  });

  it.each([
    ["ko", "ko", false],
    ["ko-KR", "ko", false],
    ["en-US", "en", false],
    ["en", "ko", true],
    ["zh-Hans", "zh-CN", false],
    ["zh-Hant", "zh-TW", false],
    ["zh-Hant", "zh-CN", true],
  ] as const)("자막 %s → 타겟 %s에서 필요한 경우에만 번역한다", async (source, target, translate) => {
    const p = createPipeline(source);
    const progress = vi.fn();
    await p.service.summarize(VIDEO_URL, target, progress);
    expect(p.state.modelCalls).toBe(translate ? 2 : 1);
    expect(progress.mock.calls.flat().includes(SummaryStage.TRANSLATING)).toBe(translate);
    expect(p.save).toHaveBeenCalledOnce();
    const modelRequests = p.request.mock.calls.filter(([r]) => r.url.includes("/model/"));
    const lastPrompt = JSON.parse(modelRequests[modelRequests.length - 1][0].body!).messages[0].content[0].text;
    expect(lastPrompt).toContain(translate ? "번역된 전체 자막" : TEXT.trim());
  });

  it("불완전한 수동 자막 다음에는 외국어 기본 자막보다 같은 언어의 자동 자막을 먼저 확인한다", async () => {
    const p = createPipeline();
    const renderer = p.state.player.captions.playerCaptionsTracklistRenderer;
    renderer.captionTracks[0].kind = "";
    renderer.captionTracks.push(
      { baseUrl: "https://www.youtube.com/api/timedtext?v=test&lang=en", languageCode: "en", kind: "" },
      { baseUrl: "https://www.youtube.com/api/timedtext?v=test&lang=ko&kind=asr", languageCode: "ko", kind: "asr" },
    );
    renderer.audioTracks[0].defaultCaptionTrackIndex = 1;
    p.state.captionsByLanguage.ko = '<transcript><text>앞부분만 있음</text></transcript>';
    const original = p.request.getMockImplementation()!;
    p.request.mockImplementation((options) =>
      options.url.includes("kind=asr")
        ? Promise.resolve({ status: 200, json: null, text: p.state.xml })
        : original(options)
    );
    await p.service.summarize(VIDEO_URL, "ko", vi.fn());
    const captions = p.request.mock.calls.filter(([r]) => r.url.includes("/api/timedtext"));
    expect(captions.map(([r]) => new URL(r.url).searchParams.get("lang"))).toEqual(["ko", "ko"]);
    expect(p.state.modelCalls).toBe(1);
  });

  it("자막이 없으면 유료 모델 호출과 노트 저장 없이 재시도를 안내한다", async () => {
    const p = createPipeline();
    p.state.player.captions.playerCaptionsTracklistRenderer.captionTracks = [];
    await expect(p.service.summarize(VIDEO_URL, "ko", vi.fn())).rejects.toThrow(t("ko").errorNoCaptions);
    expect(p.state.modelCalls).toBe(0);
    expect(p.save).not.toHaveBeenCalled();
  });

  it("접근 제한과 불완전한 자막을 구분하고 음성 인식으로 넘어가지 않는다", async () => {
    const p = createPipeline();
    p.state.player.playabilityStatus.status = "LOGIN_REQUIRED";
    await expect(p.service.summarize(VIDEO_URL, "ko", vi.fn())).rejects.toThrow(t("ko").errorCaptionAccess);
    p.state.player.playabilityStatus.status = "OK";
    p.state.xml = '<transcript><text start="0">짧음</text></transcript>';
    await expect(p.service.summarize(VIDEO_URL, "ko", vi.fn())).rejects.toThrow(t("ko").errorCaptionIncomplete);
    expect(p.state.modelCalls).toBe(0);
  });

  it("선호 언어 자막이 앞부분만 있으면 전체 기본 자막으로 요약한다", async () => {
    const p = createPipeline();
    const renderer = p.state.player.captions.playerCaptionsTracklistRenderer;
    renderer.captionTracks.push({
      baseUrl: "https://www.youtube.com/api/timedtext?v=test&lang=en",
      languageCode: "en", kind: "",
    });
    renderer.audioTracks[0].defaultCaptionTrackIndex = 1;
    p.state.captionsByLanguage.ko = '<transcript><text start="0">앞부분만 번역됨</text></transcript>';
    const transcript = await p.captions.getTranscript(VIDEO_ID, "ko");
    expect(transcript.language).toBe("en");
    expect(transcript.text).toBe(TEXT.trim());
    expect(p.request).toHaveBeenCalledTimes(4);
  });

  it("선호·기본 자막이 불완전하면 나머지 수동 자막으로 한국어 요약을 완료한다", async () => {
    const p = createPipeline();
    const renderer = p.state.player.captions.playerCaptionsTracklistRenderer;
    renderer.captionTracks[0].kind = "";
    renderer.captionTracks.push({
      baseUrl: "https://www.youtube.com/api/timedtext?v=test&lang=en",
      languageCode: "en", kind: "",
    });
    p.state.captionsByLanguage.ko = '<transcript><text>앞부분만 있음</text></transcript>';

    const progress = vi.fn();
    await p.service.summarize(VIDEO_URL, "ko", progress);

    const captionRequests = p.request.mock.calls.filter(([r]) => r.url.includes("/api/timedtext"));
    expect(captionRequests.map(([r]) => new URL(r.url).searchParams.get("lang"))).toEqual(["ko", "en"]);
    expect(p.save).toHaveBeenCalledOnce();
    expect(p.save.mock.calls[0][1]).toContain("## 요약");
    expect(p.state.modelCalls).toBe(2);
    expect(progress).toHaveBeenCalledWith(SummaryStage.TRANSLATING);
  });

  it("직접 입력한 자막은 YouTube 연결 실패 중에도 요약하고 피드 날짜를 유지한다", async () => {
    const p = createPipeline();
    p.request.mockRejectedValueOnce(new Error("offline"));
    const file = await p.service.summarize(VIDEO_URL, "ko", vi.fn(), "  직접 입력한 자막  ", "2026-08-20");
    expect(file.path).toBe(`학습/영상/26-08-20 ${VIDEO_ID}.md`);
    expect(p.request).toHaveBeenCalledTimes(3);
    expect(p.request.mock.calls[1][0].body).toContain("직접 입력한 자막");
    expect(p.request.mock.calls.some(([r]) => r.url.includes("/youtubei/") || r.url.includes("/timedtext"))).toBe(false);
  });

  it.each([1, 2])("%i번째 모델 응답이 잘리면 불완전한 노트를 저장하지 않는다", async (call) => {
    const p = createPipeline("en");
    p.state.truncateAt = call;
    await expect(p.service.summarize(VIDEO_URL, "ko", vi.fn())).rejects.toThrow(t("ko").errorModelTruncated);
    expect(p.save).not.toHaveBeenCalled();
    expect(p.state.modelCalls).toBe(call);
  });

  it("모델 요청 시간이 초과된 뒤 늦은 응답이 와도 노트나 다음 호출을 만들지 않는다", async () => {
    vi.useFakeTimers();
    const p = createPipeline("en");
    const original = p.request.getMockImplementation()!;
    let finish!: (response: Awaited<ReturnType<RequestFn>>) => void;
    p.request.mockImplementation((options) =>
      options.url.includes("/model/")
        ? new Promise((resolve) => { finish = resolve; })
        : original(options)
    );
    const rejection = expect(p.service.summarize(VIDEO_URL, "ko", vi.fn()))
      .rejects.toThrow(t("ko").errorModelTimeout);
    await vi.advanceTimersByTimeAsync(180001);
    await rejection;
    finish({ status: 200, json: { output: { message: { content: [{ text: "늦은 번역" }] } }, stopReason: "end_turn" } });
    await vi.advanceTimersByTimeAsync(1);
    expect(p.request).toHaveBeenCalledTimes(4);
    expect(p.save).not.toHaveBeenCalled();
  });

  it("기존 서버 키를 모델 키로 재사용하지 않고 잘못된 설정은 요청 전에 거부한다", async () => {
    const p = createPipeline();
    p.settings.bedrockBearerToken = "";
    await expect(p.service.summarize(VIDEO_URL, "ko", vi.fn())).rejects.toThrow(t("ko").errorMissingApiKey);
    expect(p.request).not.toHaveBeenCalled();
    p.settings.bedrockBearerToken = "valid-token";
    await expect(p.service.summarize(VIDEO_URL, "ko", vi.fn(), "a".repeat(200001))).rejects.toThrow(t("ko").errorInputTooLong);
    expect(p.request).not.toHaveBeenCalled();
  });

  it.each([
    "https://example.com/captions",
    "http://www.youtube.com/api/timedtext",
    "https://user@www.youtube.com/api/timedtext",
    "https://:test@www.youtube.com/api/timedtext",
    "https://www.youtube.com:8443/api/timedtext",
    "https://www.youtube.com/other",
  ])("허용되지 않은 자막 URL에는 요청하지 않는다: %s", async (baseUrl) => {
    const p = createPipeline();
    p.state.player.captions.playerCaptionsTracklistRenderer.captionTracks[0].baseUrl = baseUrl;
    await expect(p.service.summarize(VIDEO_URL, "ko", vi.fn())).rejects.toThrow(t("ko").errorCaptionFormat);
    expect(p.request).toHaveBeenCalledTimes(2);
  });

  it("srv1/srv3 자막에서 XML 이스케이프와 인라인 텍스트를 보존한다", () => {
    expect(parseCaptionXml('<transcript><text start="0">A &amp; B &lt; C</text><text>다음 줄</text></transcript>'))
      .toBe("A & B < C 다음 줄");
    expect(parseCaptionXml('<timedtext><body><p t="0"><s>자동 </s><s>자막</s></p><p>끝</p></body></timedtext>'))
      .toBe("자동 자막 끝");
    expect(parseCaptionXml("<invalid>")).toBe("");
  });

  it("긴 자막의 모든 청크를 번역한 뒤 전체 번역문을 한 번 요약한다", async () => {
    const source = "가나다 😀 example\n".repeat(500);
    const chunks = splitTranscript(source, 1024);
    expect(chunks.join("")).toBe(source);
    expect(chunks.every((chunk) => chunk.length <= 1024 && !/[\uD800-\uDBFF]$/.test(chunk))).toBe(true);
    const generate = vi.fn().mockImplementation(async (prompt: string) =>
      prompt.startsWith("# 역할") ? SUMMARY : `번역 청크 ${generate.mock.calls.length}`);
    const engine = new SummaryEngine({ generate }, { ...SETTINGS, maxOutputTokens: 1024 });
    await engine.summarize(source, "ko", vi.fn());
    expect(generate).toHaveBeenCalledTimes(chunks.length + 1);
    const summaryPrompt = generate.mock.calls[generate.mock.calls.length - 1][0];
    for (let i = 1; i <= chunks.length; i++) expect(summaryPrompt).toContain(`번역 청크 ${i}`);
  });

  it("번역문 길이 초과와 요약 형식 오류를 성공으로 처리하지 않는다", async () => {
    const generate = vi.fn().mockResolvedValue("a".repeat(1001));
    const engine = new SummaryEngine({ generate }, { ...SETTINGS, maxInputChars: 1000 });
    await expect(engine.summarize("원문", "ko", vi.fn())).rejects.toThrow(t("ko").errorInputTooLong);
    expect(generate).toHaveBeenCalledOnce();
    expect(() => parseSummary("요약 형식을 따르지 않은 응답")).toThrow(t("ko").errorSummaryFormat);
    expect(parseSummary(SUMMARY.replace(/\n/g, "\r\n")).keyPoints).toEqual([
      "첫째 인사이트. 근거가 이어진다.", "2026. 하반기에는 공급이 늘어난다.",
    ]);
    expect(renderPrompt("{{TARGET_LANGUAGE}} {{TEXT}}", { TARGET_LANGUAGE: "ko", TEXT: "{{TARGET_LANGUAGE}} $&" }))
      .toBe("ko {{TARGET_LANGUAGE}} $&");
  });

  it.each([
    { provider: "openai", model: "openaiModel", key: "openaiApiKey", url: "/chat/completions", header: "Authorization", value: "Bearer provider-key", json: { choices: [{ message: { content: "결과" }, finish_reason: "stop" }] } },
    { provider: "anthropic", model: "anthropicModel", key: "anthropicApiKey", url: "/v1/messages", header: "x-api-key", value: "provider-key", json: { content: [{ type: "thinking", thinking: "비공개" }, { type: "text", text: "결과" }], stop_reason: "end_turn" } },
    { provider: "gemini", model: "geminiModel", key: "geminiApiKey", url: ":generateContent", header: "x-goog-api-key", value: "provider-key", json: { candidates: [{ content: { parts: [{ thought: true, text: "비공개" }, { text: "결과" }] }, finishReason: "STOP" }] } },
  ] as const)("$provider의 API 키·모델·응답 규격을 사용한다", async (test) => {
    const request = vi.fn<Parameters<RequestFn>, ReturnType<RequestFn>>().mockResolvedValue({ status: 200, json: test.json });
    const settings = { ...SETTINGS, aiProvider: test.provider, [test.key]: "provider-key", [test.model]: "test-model" };
    const model = new AiModelClient(settings, request);
    expect(await model.generate("프롬프트")).toBe("결과");
    const options = request.mock.calls[0][0];
    expect(options.url).toContain(test.url);
    expect(options.headers[test.header]).toBe(test.value);
    expect(options.url + options.body).toContain("test-model");
    expect(JSON.stringify(options)).not.toContain("bedrock-secret");
  });

  it("로컬 OpenAI 호환 서버는 키 없이 max_tokens로 호출하고 원격 HTTP는 거부한다", async () => {
    const settings: PluginSettings = { ...SETTINGS, aiProvider: "openai", openaiBaseUrl: "http://localhost:11434/v1/" };
    const request = vi.fn<Parameters<RequestFn>, ReturnType<RequestFn>>().mockResolvedValue({ status: 200, json: { choices: [{ message: { content: "로컬 결과" }, finish_reason: "stop" }] } });
    expect(await new AiModelClient(settings, request).generate("질문")).toBe("로컬 결과");
    expect(request.mock.calls[0][0].url).toBe("http://localhost:11434/v1/chat/completions");
    expect(request.mock.calls[0][0].headers.Authorization).toBeUndefined();
    expect(JSON.parse(request.mock.calls[0][0].body!).max_tokens).toBe(65536);
    settings.openaiBaseUrl = "http://remote.example/v1";
    expect(getAiConfigurationError(settings)).toBe(t("ko").errorInvalidBaseUrl);
  });

  it("SSO 프로필을 명시하고 환경의 Bearer 토큰보다 SigV4를 우선한다", async () => {
    vi.stubEnv("AWS_BEARER_TOKEN_BEDROCK", "environment-token");
    const settings: PluginSettings = { ...SETTINGS, bedrockAuthMode: "profile", bedrockProfile: "my-sso" };
    const request = vi.fn<Parameters<RequestFn>, ReturnType<RequestFn>>();
    const model = new AiModelClient(settings, request);
    expect(await model.generate("질문")).toBe("SSO 결과");
    expect(sdk.fromIni).toHaveBeenCalledWith({ profile: "my-sso", ignoreCache: true });
    expect(sdk.config).toHaveBeenCalledWith(expect.objectContaining({ authSchemePreference: ["aws.auth#sigv4"], region: "us-east-1" }));
    expect(sdk.config.mock.calls[0][0].token).toBeUndefined();
    expect(request).not.toHaveBeenCalled();
    model.destroy();
    expect(sdk.destroy).toHaveBeenCalledOnce();
    Platform.isDesktopApp = false;
    expect(getAiConfigurationError(settings)).toBe(t("ko").errorDesktopProfile);
  });

  it("SSO 만료는 로그인 안내로, HTTP 오류는 키가 없는 메시지로 반환한다", async () => {
    sdk.send.mockRejectedValue(Object.assign(new Error("private credentials"), { name: "CredentialsProviderError" }));
    const model = new AiModelClient({ ...SETTINGS, bedrockAuthMode: "profile" });
    await expect(model.generate("질문")).rejects.toThrow(t("ko").errorProfileCredentials);
    model.destroy();
    const request = vi.fn<Parameters<RequestFn>, ReturnType<RequestFn>>().mockResolvedValue({ status: 401, json: { message: "provider-key" } });
    await expect(new AiModelClient(SETTINGS, request).generate("질문")).rejects.toThrow("HTTP 401");
  });

  it.each(["length", "MAX_TOKENS", "content_filter"])("모델의 종료 사유 %s를 정상 응답으로 저장하지 않는다", async (reason) => {
    const request = vi.fn<Parameters<RequestFn>, ReturnType<RequestFn>>().mockResolvedValue({ status: 200, json: { choices: [{ message: { content: "부분 결과" }, finish_reason: reason }] } });
    const model = new AiModelClient({ ...SETTINGS, aiProvider: "openai", openaiApiKey: "key" }, request);
    await expect(model.generate("질문")).rejects.toThrow(reason === "content_filter" ? t("ko").errorModelBlocked : t("ko").errorModelTruncated);
  });
});

describe("listAvailableModels", () => {
  it.each([
    "http://remote.example/v1",
    "ftp://remote.example/v1",
    "https://user:password@remote.example/v1",
    "https://remote.example/v1?key=value",
    "https://remote.example/v1#fragment",
  ])("요약과 모델 목록 조회가 모두 안전하지 않은 주소를 요청 전에 거부한다: %s", async (url) => {
    const request = vi.fn<Parameters<RequestFn>, ReturnType<RequestFn>>().mockResolvedValue({
      status: 200, json: { data: [{ id: "test-model" }] },
    });
    const settings: PluginSettings = {
      ...SETTINGS, aiProvider: "openai", openaiApiKey: "test-key", openaiBaseUrl: url,
    };
    await expect(new AiModelClient(settings, request).generate("질문")).rejects.toThrow(t("ko").errorInvalidBaseUrl);
    await expect(listAvailableModels(settings, request)).rejects.toThrow(t("ko").errorInvalidBaseUrl);
    expect(request).not.toHaveBeenCalled();
  });

  it("모델을 선택하기 전에도 목록을 조회하되 원격 서버의 키 누락은 거부한다", async () => {
    const request = vi.fn<Parameters<RequestFn>, ReturnType<RequestFn>>().mockResolvedValue({
      status: 200, json: { data: [{ id: "gpt-4.1-mini" }] },
    });
    const settings: PluginSettings = { ...SETTINGS, aiProvider: "openai", openaiModel: "", openaiApiKey: "" };
    await expect(listAvailableModels(settings, request)).rejects.toThrow(t("ko").errorMissingApiKey);
    expect(request).not.toHaveBeenCalled();
    settings.openaiApiKey = "test-key";
    await expect(listAvailableModels(settings, request)).resolves.toEqual(["gpt-4.1-mini"]);
  });

  it("Bedrock은 추론 프로필과 온디맨드 텍스트 모델을 합쳐 정렬해 반환한다", async () => {
    const request = vi.fn<Parameters<RequestFn>, ReturnType<RequestFn>>().mockImplementation(async (options) => {
      expect(options.headers.Authorization).toBe("Bearer bedrock-secret");
      if (options.url.includes("/inference-profiles")) return {
        status: 200,
        json: { inferenceProfileSummaries: [
          { inferenceProfileId: "us.anthropic.claude-sonnet-4-6", status: "ACTIVE" },
          { inferenceProfileId: "us.stale-profile", status: "INACTIVE" },
        ] },
      };
      return {
        status: 200,
        json: { modelSummaries: [
          { modelId: "anthropic.claude-haiku", outputModalities: ["TEXT"], inferenceTypesSupported: ["ON_DEMAND"] },
          { modelId: "amazon.titan-image", outputModalities: ["IMAGE"], inferenceTypesSupported: ["ON_DEMAND"] },
          { modelId: "anthropic.claude-legacy", modelLifecycle: { status: "LEGACY" }, outputModalities: ["TEXT"], inferenceTypesSupported: ["ON_DEMAND"] },
          { modelId: "anthropic.claude-provisioned", outputModalities: ["TEXT"], inferenceTypesSupported: ["PROVISIONED"] },
        ] },
      };
    });
    await expect(listAvailableModels(SETTINGS, request)).resolves.toEqual([
      "anthropic.claude-haiku",
      "us.anthropic.claude-sonnet-4-6",
    ]);
  });

  it("Bedrock 프로필 인증은 목록 조회를 거부하고 수동 입력을 안내한다", async () => {
    const request = vi.fn<Parameters<RequestFn>, ReturnType<RequestFn>>();
    await expect(listAvailableModels({ ...SETTINGS, bedrockAuthMode: "profile" }, request))
      .rejects.toThrow(t("ko").errorModelListProfile);
    expect(request).not.toHaveBeenCalled();
  });

  it("Gemini는 generateContent 지원 모델만 models/ 접두사 없이 반환한다", async () => {
    const request = vi.fn<Parameters<RequestFn>, ReturnType<RequestFn>>().mockResolvedValue({
      status: 200,
      json: { models: [
        { name: "models/gemini-2.5-flash", supportedGenerationMethods: ["generateContent"] },
        { name: "models/embedding-001", supportedGenerationMethods: ["embedContent"] },
      ] },
    });
    const settings = { ...SETTINGS, aiProvider: "gemini" as const, geminiApiKey: "gemini-key" };
    await expect(listAvailableModels(settings, request)).resolves.toEqual(["gemini-2.5-flash"]);
  });

  it("OpenAI 호환 서버는 /models의 id 목록을 반환하고, 키 누락·HTTP 오류를 구분한다", async () => {
    const request = vi.fn<Parameters<RequestFn>, ReturnType<RequestFn>>().mockResolvedValue({
      status: 200,
      json: { data: [{ id: "gpt-4.1-mini" }, { id: "gpt-4.1" }] },
    });
    const settings = { ...SETTINGS, aiProvider: "openai" as const, openaiApiKey: "" , openaiBaseUrl: "http://localhost:11434/v1"};
    await expect(listAvailableModels(settings, request)).resolves.toEqual(["gpt-4.1", "gpt-4.1-mini"]);
    expect(request.mock.calls[0][0].headers.Authorization).toBeUndefined();

    await expect(listAvailableModels({ ...SETTINGS, aiProvider: "anthropic", anthropicApiKey: "" }, request))
      .rejects.toThrow(t("ko").errorMissingApiKey);
    request.mockResolvedValue({ status: 403, json: null });
    await expect(listAvailableModels({ ...SETTINGS, aiProvider: "anthropic", anthropicApiKey: "key" }, request))
      .rejects.toThrow("HTTP 403");
  });
});

describe("SummaryEngine - 다국어 타겟", () => {
  it("비한국어 타겟은 범용 번역 템플릿과 출력 언어 지시를 사용하고 영어 라벨로 조립한다", async () => {
    const generate = vi.fn<[string], Promise<string>>()
      .mockResolvedValueOnce("日本語訳")
      .mockResolvedValueOnce(SUMMARY);
    const engine = new SummaryEngine({ generate }, { ...SETTINGS });
    const result = await engine.summarize("자막 원문 ".repeat(30), "ja", () => {});
    const translatePrompt = generate.mock.calls[0][0];
    const summaryPrompt = generate.mock.calls[1][0];
    expect(translatePrompt).toContain("Japanese로 번역");
    expect(translatePrompt).not.toContain("한국인이 쓴");
    expect(summaryPrompt).toContain("출력 언어: Japanese");
    expect(result.summary).toContain("Genre: LECTURE");
  });

  it("한국어 타겟은 기존 한국어 번역 원칙 템플릿을 유지한다", async () => {
    const generate = vi.fn<[string], Promise<string>>()
      .mockResolvedValueOnce("번역문")
      .mockResolvedValueOnce(SUMMARY);
    const engine = new SummaryEngine({ generate }, { ...SETTINGS });
    const result = await engine.summarize("자막 원문 ".repeat(30), "ko", () => {});
    expect(generate.mock.calls[0][0]).toContain("한국인이 쓴");
    expect(generate.mock.calls[1][0]).not.toContain("출력 언어");
    expect(result.summary).toContain("장르: LECTURE");
  });
});
