import { describe, expect, it } from "vitest";
import { SecretStorage } from "obsidian";
import { DEFAULT_SETTINGS, PluginSettings } from "../models/types";
import { migratePlaintextSecrets, resolveSecrets, storeSecret } from "./secrets";

describe("비밀 저장소 연결", () => {
  it("비밀 이름이 가리키는 값을 채우고, 원본 설정은 바꾸지 않는다", () => {
    const storage = new SecretStorage();
    storage.setSecret("my-openai", "sk-value");
    const settings: PluginSettings = { ...DEFAULT_SETTINGS, openaiApiKeySecret: "my-openai", geminiApiKeySecret: "missing" };

    const resolved = resolveSecrets(settings, storage);

    expect(resolved.openaiApiKey).toBe("sk-value");
    // 지워졌거나 다른 기기에서 아직 만들지 않은 비밀은 빈 값으로 본다.
    expect(resolved.geminiApiKey).toBe("");
    expect(settings.openaiApiKey).toBe("");
  });

  it("평문 키를 비밀 저장소로 옮기고 설정에서는 지운다. 옮길 것이 없으면 null을 돌려준다", () => {
    const storage = new SecretStorage();
    const settings: PluginSettings = {
      ...DEFAULT_SETTINGS,
      bedrockBearerToken: "  bedrock-value  ",
      // 이미 비밀을 고른 항목은 남아 있는 평문이 있어도 건드리지 않는다.
      anthropicApiKey: "stale",
      anthropicApiKeySecret: "chosen",
    };

    const migrated = migratePlaintextSecrets(settings, storage)!;

    expect(migrated.bedrockBearerToken).toBe("");
    expect(migrated.bedrockBearerTokenSecret).toBe("youtube-llm-summarizer-bedrock-token");
    expect(storage.getSecret("youtube-llm-summarizer-bedrock-token")).toBe("bedrock-value");
    expect(migrated.anthropicApiKeySecret).toBe("chosen");
    expect(storage.listSecrets()).toEqual(["youtube-llm-summarizer-bedrock-token"]);
    expect(resolveSecrets(migrated, storage).bedrockBearerToken).toBe("bedrock-value");
    expect(migratePlaintextSecrets(migrated, storage)).toBeNull();
    expect(migratePlaintextSecrets(DEFAULT_SETTINGS, storage)).toBeNull();
  });

  it("입력한 키를 저장하고 비밀 이름을 돌려주며, 빈 값이면 연결을 끊는다", () => {
    const storage = new SecretStorage();
    // 처음 입력하면 플러그인이 정한 이름으로 만든다.
    expect(storeSecret(storage, "geminiApiKeySecret", "", "  key-1  ")).toBe("youtube-llm-summarizer-gemini-key");
    expect(storage.getSecret("youtube-llm-summarizer-gemini-key")).toBe("key-1");
    // 이미 연결된 이름이 있으면 그 비밀을 덮어쓴다.
    expect(storeSecret(storage, "geminiApiKeySecret", "custom-name", "key-2")).toBe("custom-name");
    expect(storage.getSecret("custom-name")).toBe("key-2");
    expect(storeSecret(storage, "geminiApiKeySecret", "custom-name", "   ")).toBe("");
  });
});
