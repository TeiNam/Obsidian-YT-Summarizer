import { Translations } from "../i18n";
import { SummaryStage } from "../models/types";

/** 요약 진행 단계를 UI 언어 문구로 바꾼다 (URL 탭과 구독 피드가 함께 사용) */
export function stageText(tr: Translations, stage: string): string {
  const stageMap: Record<string, string> = {
    [SummaryStage.VALIDATING]: tr.stageValidating,
    [SummaryStage.PENDING]: tr.stagePending,
    [SummaryStage.EXTRACTING]: tr.stageExtracting,
    [SummaryStage.TRANSLATING]: tr.stageTranslating,
    [SummaryStage.SUMMARIZING]: tr.stageSummarizing,
    [SummaryStage.CREATING_NOTE]: tr.stageCreatingNote,
    [SummaryStage.COMPLETE]: tr.stageComplete,
  };
  return stageMap[stage] ?? stage;
}
