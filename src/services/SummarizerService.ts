import { TFile } from "obsidian";
import { t } from "../i18n";
import { PluginSettings, SummaryLanguage, SummaryStage, ProgressCallback } from "../models/types";
import { validateYouTubeUrl } from "../utils/YouTubeUrlValidator";
import { AiModelClient, getAiConfigurationError } from "./AiModelClient";
import { NoteCreator } from "./NoteCreator";
import { SummaryEngine } from "./SummaryEngine";
import { YouTubeCaptionClient } from "./YouTubeCaptionClient";

/** 자막 수집 → 필요한 경우 번역 → 장르별 요약 → 노트 저장. */
export class SummarizerService {
  constructor(
    private settings: PluginSettings,
    private noteCreator: NoteCreator,
    private captions = new YouTubeCaptionClient(settings.language),
    private model = new AiModelClient(settings)
  ) {}

  async summarize(
    videoUrl: string,
    targetLanguage: SummaryLanguage,
    onProgress: ProgressCallback,
    manualTranscript?: string,
    uploadDate?: string
  ): Promise<TFile> {
    onProgress(SummaryStage.VALIDATING);
    const validation = validateYouTubeUrl(videoUrl);
    if (!validation.videoId) throw new Error(t(this.settings.language).errorInvalidUrl);
    const error = getAiConfigurationError(this.settings);
    if (error) throw new Error(error);
    const transcript = manualTranscript?.trim() || undefined;
    if (transcript && transcript.length > this.settings.maxInputChars) {
      throw new Error(t(this.settings.language).errorInputTooLong);
    }
    try {
      onProgress(SummaryStage.EXTRACTING);
      const video = await this.captions.getTranscript(validation.videoId, targetLanguage, transcript);
      const engine = new SummaryEngine(this.model, this.settings);
      const result = await engine.summarize(video.text, targetLanguage, onProgress, video.language);
      onProgress(SummaryStage.CREATING_NOTE);
      const file = await this.noteCreator.createNote(
        { videoTitle: video.title, videoUrl, language: targetLanguage, ...result },
        video.uploadDate || uploadDate
      );
      onProgress(SummaryStage.COMPLETE);
      return file;
    } finally {
      this.model.destroy();
    }
  }
}
