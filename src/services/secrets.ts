// ============================================================
// API 키를 Obsidian 비밀 저장소(SecretStorage)에 두기 위한 연결 계층
// 설정(data.json)에는 비밀의 이름만 저장하고, 서비스에는 값을 채운 설정을 넘긴다.
// ============================================================

import type { SecretStorage } from "obsidian";
import type { PluginSettings } from "../models/types";

/**
 * 비밀 값 필드와, 그 비밀의 이름을 저장하는 설정 필드의 짝.
 * `defaultId`는 예전에 data.json에 평문으로 저장된 키를 옮길 때 쓰는 비밀 이름이다.
 */
export const SECRET_FIELDS = [
  { value: "bedrockBearerToken", id: "bedrockBearerTokenSecret", defaultId: "youtube-llm-summarizer-bedrock-token" },
  { value: "openaiApiKey", id: "openaiApiKeySecret", defaultId: "youtube-llm-summarizer-openai-key" },
  { value: "anthropicApiKey", id: "anthropicApiKeySecret", defaultId: "youtube-llm-summarizer-anthropic-key" },
  { value: "geminiApiKey", id: "geminiApiKeySecret", defaultId: "youtube-llm-summarizer-gemini-key" },
  { value: "youtubeDataApiKey", id: "youtubeDataApiKeySecret", defaultId: "youtube-llm-summarizer-youtube-data-key" },
] as const;

export type SecretIdField = typeof SECRET_FIELDS[number]["id"];

/**
 * 설정 화면에서 입력한 키를 비밀 저장소에 쓰고, 설정에 저장할 비밀 이름을 돌려준다.
 * 빈 값이면 연결만 끊는다 (SecretStorage에는 삭제 API가 없고 빈 값을 받지 않는다).
 */
export function storeSecret(storage: SecretStorage, idField: SecretIdField, currentId: string, value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  const id = currentId || SECRET_FIELDS.find((field) => field.id === idField)!.defaultId;
  storage.setSecret(id, trimmed);
  return id;
}

/** 비밀 이름이 가리키는 실제 값을 채운 설정을 돌려준다. 서비스와 뷰는 이 결과만 사용한다 */
export function resolveSecrets(settings: PluginSettings, storage: SecretStorage): PluginSettings {
  const values = Object.fromEntries(SECRET_FIELDS.map((field) => {
    const id = settings[field.id];
    return [field.value, id ? storage.getSecret(id) ?? "" : settings[field.value]];
  }));
  return { ...settings, ...values };
}

/**
 * 예전 버전이 data.json에 평문으로 저장한 키를 비밀 저장소로 옮긴다.
 * 옮긴 것이 있으면 평문을 지우고 비밀 이름을 채운 새 설정을, 없으면 null을 돌려준다.
 */
export function migratePlaintextSecrets(settings: PluginSettings, storage: SecretStorage): PluginSettings | null {
  const pending = SECRET_FIELDS.filter((field) => settings[field.value].trim() && !settings[field.id]);
  if (!pending.length) return null;
  for (const field of pending) storage.setSecret(field.defaultId, settings[field.value].trim());
  return {
    ...settings,
    ...Object.fromEntries(pending.flatMap((field) => [[field.value, ""], [field.id, field.defaultId]])),
  };
}
