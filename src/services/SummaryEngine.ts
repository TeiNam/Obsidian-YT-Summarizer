import summaryTemplate from "../prompts/summarize.md?raw";
import translationTemplate from "../prompts/translate.md?raw";
import genericTranslationTemplate from "../prompts/translate-any.md?raw";
import { t } from "../i18n";
import {
  NoteContent, PluginSettings, ProgressCallback,
  SUMMARY_LANGUAGES, SummaryLanguage, SummaryStage,
} from "../models/types";
import { AiModelClient } from "./AiModelClient";
import { isSameTranscriptLanguage } from "../utils/TranscriptLanguage";

/** 서버와 동일한 단일 패스 치환. 자막 속 {{TEXT}} 등을 다시 치환하지 않는다. */
export function renderPrompt(template: string, values: Record<string, string>): string {
  return template.replace(/\{\{([A-Z_][A-Z0-9_]*)\}\}/g, (match, name: string) => values[name] ?? match);
}

/** 원문을 버리지 않고 공백·문장 경계에 가까운 곳에서 나눈다. */
export function splitTranscript(text: string, limit: number): string[] {
  const chunks: string[] = [];
  for (let start = 0; start < text.length;) {
    let end = Math.min(start + limit, text.length);
    if (end < text.length) {
      const boundary = Math.max(text.lastIndexOf("\n", end - 1), text.lastIndexOf(" ", end - 1));
      if (boundary > start + limit / 2) end = boundary + 1;
      const code = text.charCodeAt(end - 1);
      if (code >= 0xd800 && code <= 0xdbff) end--;
    }
    chunks.push(text.slice(start, end));
    start = end;
  }
  return chunks;
}

/** ../youtube_summarizer의 구분자·목록 파싱과 노트 조립 형식을 유지한다. 라벨은 ko만 한국어, 그 외 언어는 영어. */
export function parseSummary(text: string, language: SummaryLanguage = "ko"): Pick<NoteContent, "summary" | "keyPoints"> {
  const parts = text.replace(/\r\n?/g, "\n").split(/^===[ \t]*([A-Z_]+)[ \t]*===[ \t]*$/m);
  const sections: Record<string, string> = {};
  for (let i = 1; i + 1 < parts.length; i += 2) sections[parts[i]] = parts[i + 1].trim();
  const korean = language === "ko";
  if (!sections.DETAILED) throw new Error(t(korean ? "ko" : "en").errorSummaryFormat);
  const genre = ["NEWS", "LECTURE", "TECH", "BUSINESS", "FINANCE", "OTHER"]
    .find((name) => (sections.GENRE ?? "").toUpperCase().includes(name)) ?? "OTHER";
  const summary = [
    `🏷️ ${korean ? "장르" : "Genre"}: ${genre}`,
    `\n📌 ${korean ? "한줄 요약" : "One-line summary"}\n${sections.ONE_LINE ?? ""}`,
    `\n📋 ${korean ? "핵심 내용" : "Details"}\n${sections.DETAILED}`,
  ];
  if (sections.KEYWORDS) summary.push(`\n🔑 ${korean ? "키워드 & 용어" : "Keywords & terms"}\n${sections.KEYWORDS}`);
  if (sections.FURTHER) summary.push(`\n❓ ${korean ? "추가 탐색 주제" : "Further exploration"}\n${sections.FURTHER}`);

  const items: string[] = [];
  for (const raw of (sections.INSIGHTS ?? "").split("\n")) {
    const line = raw.trim();
    const marker = /^(?:[-*•]|\d{1,2}[.)])[ \t]+/.exec(line);
    if (!line) items.push("");
    else if (marker) items.push(line.slice(marker[0].length).trim());
    else if (items.length && items[items.length - 1]) items[items.length - 1] += ` ${line}`;
    else items.push(line);
  }
  return { summary: summary.join("\n"), keyPoints: items.filter(Boolean) };
}

export class SummaryEngine {
  constructor(
    private model: Pick<AiModelClient, "generate">,
    private settings: PluginSettings
  ) {}

  async summarize(
    text: string,
    targetLanguage: SummaryLanguage,
    onProgress: ProgressCallback,
    sourceLanguage?: string
  ): Promise<Pick<NoteContent, "summary" | "keyPoints">> {
    this.checkLength(text);
    const korean = targetLanguage === "ko";
    const languageName = SUMMARY_LANGUAGES.find((entry) => entry.code === targetLanguage)?.english ?? "Korean";
    let summaryText = text;
    if (!isSameTranscriptLanguage(sourceLanguage, targetLanguage)) {
      onProgress(SummaryStage.TRANSLATING);
      const translations: string[] = [];
      // ponytail: 글자 수로 번역 청크를 나눈다. 모델별 토크나이저 대신 응답 종료 사유로 잘림을 검출한다.
      const chunks = splitTranscript(text, Math.min(6000, this.settings.maxOutputTokens));
      for (const chunk of chunks) {
        translations.push(await this.model.generate(renderPrompt(
          korean ? translationTemplate : genericTranslationTemplate,
          { TARGET_LANGUAGE: korean ? "한국어" : languageName, TEXT: chunk }
        )));
        this.checkLength(translations.join("\n\n"));
      }
      summaryText = translations.join("\n\n");
    }
    onProgress(SummaryStage.SUMMARIZING);
    let prompt = renderPrompt(summaryTemplate, { TEXT: summaryText });
    if (!korean) {
      prompt += `\n\n출력 언어: ${languageName}. 모든 섹션의 본문을 해당 언어로 작성하세요. 한국어 문법 지침은 적용하지 말고 ===NAME=== 구분자는 유지하세요.`;
    }
    return parseSummary(await this.model.generate(prompt), targetLanguage);
  }

  private checkLength(text: string): void {
    const tr = t(this.settings.language);
    if (!text.trim()) throw new Error(tr.errorNoCaptions);
    if (text.length > this.settings.maxInputChars) throw new Error(tr.errorInputTooLong);
  }
}
