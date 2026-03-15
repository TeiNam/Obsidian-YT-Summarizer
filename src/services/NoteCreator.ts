// ============================================================
// 노트 생성 서비스
// 마크다운 노트를 생성하고 옵시디언 Vault에 저장하는 서비스
// YAML 프론트매터, 영상 임베딩, 요약 내용을 포함한 노트 생성
// ============================================================

import { App, TFile, TFolder } from "obsidian";
import { NoteContent } from "../models/types";

/**
 * 파일명에 사용할 수 없는 특수 문자를 제거하는 함수
 * 옵시디언 및 OS 파일 시스템에서 허용되지 않는 문자를 제거
 * @param title - 원본 제목 문자열
 * @returns 특수 문자가 제거된 안전한 파일명
 */
export function sanitizeFileName(title: string): string {
  // 파일명에 사용할 수 없는 특수 문자 제거: \ / : * ? " < > |
  const sanitized = title.replace(/[\\/:*?"<>|]/g, "").trim();
  // 모든 문자가 제거된 경우 기본 파일명 사용
  return sanitized.length > 0 ? sanitized : "Untitled";
}

/**
 * 마크다운 노트 생성 서비스 클래스
 * 유튜브 영상 요약 내용을 옵시디언 마크다운 노트로 변환하고 저장
 */
export class NoteCreator {
  private app: App;
  private savePath: string;

  /**
   * @param app - 옵시디언 App 인스턴스 (Vault API 접근용)
   * @param savePath - 노트 저장 폴더 경로 (예: "YouTube Summaries")
   */
  constructor(app: App, savePath: string) {
    this.app = app;
    this.savePath = savePath;
  }

  /**
   * NoteContent 객체를 마크다운 문자열로 변환하는 순수 함수
   * YAML 프론트매터, 영상 임베딩, 요약 내용, 핵심 인사이트를 포함
   * @param content - 노트 생성용 콘텐츠 객체
   * @returns 마크다운 형식의 문자열
   */
  generateMarkdown(content: NoteContent): string {
    const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD 형식

    // YAML 프론트매터 생성
    const frontmatter = [
      "---",
      "tags:",
      "  - youtube-summary",
      `date: ${today}`,
      `url: ${content.videoUrl}`,
      "---",
    ].join("\n");

    // h1 헤더 (영상 제목)
    const header = `# ${content.videoTitle}`;

    // 옵시디언 네이티브 임베딩 문법 (원본 URL 사용)
    const embed = `![](${content.videoUrl})`;

    // 구분선
    const separator = "---";

    // 마크다운 조립
    const parts: string[] = [frontmatter, "", header, "", embed, "", separator];

    // 요약 섹션
    parts.push("");
    parts.push("## 요약");
    parts.push("");
    parts.push(content.summary);

    // 핵심 인사이트 섹션
    if (content.keyPoints && content.keyPoints.length > 0) {
      parts.push("");
      parts.push("## 핵심 인사이트");
      parts.push("");
      for (const point of content.keyPoints) {
        parts.push(`- ${point}`);
      }
    }

    return parts.join("\n");
  }

  /**
   * 파일 경로를 결정하는 메서드
   * 동일 제목의 파일이 이미 존재하면 타임스탬프를 추가하여 중복 방지
   * Property 6 테스트에서 직접 접근 가능하도록 public으로 구현
   * @param title - 영상 제목 (파일명으로 사용)
   * @returns 고유한 파일 경로 문자열
   */
  async resolveFilePath(title: string): Promise<string> {
    const safeName = sanitizeFileName(title);
    const basePath = `${this.savePath}/${safeName}.md`;

    // 동일 파일명이 존재하는지 확인
    const existingFile = this.app.vault.getAbstractFileByPath(basePath);

    if (!existingFile) {
      return basePath;
    }

    // 중복 시 타임스탬프 추가: {title} ({timestamp}).md
    const timestamp = Date.now();
    return `${this.savePath}/${safeName} (${timestamp}).md`;
  }

  /**
   * 저장 폴더가 존재하는지 확인하고, 없으면 자동 생성
   * 중첩 폴더 경로도 지원 (예: "Notes/YouTube Summaries")
   * 상위 폴더부터 순차적으로 생성
   */
  private async ensureFolderExists(): Promise<void> {
    const folder = this.app.vault.getAbstractFileByPath(this.savePath);

    if (folder instanceof TFolder) {
      return; // 폴더가 이미 존재
    }

    // 중첩 경로를 분할하여 상위 폴더부터 순차 생성
    const parts = this.savePath.split("/").filter((p) => p.length > 0);
    let currentPath = "";

    for (const part of parts) {
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      const existing = this.app.vault.getAbstractFileByPath(currentPath);
      if (!existing) {
        await this.app.vault.createFolder(currentPath);
      }
    }
  }

  /**
   * 노트를 생성하고 Vault에 저장하는 메서드
   * 저장 폴더 자동 생성, 마크다운 변환, 파일 생성을 순차적으로 수행
   * 파일명에 오늘 날짜(YYYY-MM-DD) 접두사를 포함
   * @param content - 노트 생성용 콘텐츠 객체
   * @returns 생성된 TFile 객체
   */
  async createNote(content: NoteContent): Promise<TFile> {
    // 저장 폴더 존재 확인 및 자동 생성
    await this.ensureFolderExists();

    // 오늘 날짜 접두사로 파일 경로 결정
    const today = new Date().toISOString();
    const filePath = this.resolveFilePathWithDatePrefix(content.videoTitle, today);

    // 마크다운 콘텐츠 생성
    const markdown = this.generateMarkdown(content);

    // Vault API로 파일 생성
    const file = await this.app.vault.create(filePath, markdown);

    return file;
  }

  /**
   * 날짜 접두사가 포함된 파일 경로를 결정하는 메서드
   * ISO 8601 형식의 업로드 날짜를 YY-MM-DD 형식으로 변환하여 파일명 접두사로 사용
   * 구독 피드 영상 요약 노트에 사용
   * @param title - 영상 제목 (파일명으로 사용)
   * @param uploadDate - ISO 8601 형식의 업로드 날짜 (예: "2024-06-15T10:30:00Z")
   * @returns 날짜 접두사가 포함된 파일 경로 문자열 (예: "폴더/24-06-15 영상제목.md")
   */
  resolveFilePathWithDatePrefix(title: string, uploadDate: string): string {
    // ISO 8601 날짜에서 YY-MM-DD 부분 추출 (연도 뒤 2자리)
    const datePrefix = uploadDate.slice(2, 10);
    // 특수 문자 제거
    const safeName = sanitizeFileName(title);
    return `${this.savePath}/${datePrefix} ${safeName}.md`;
  }

  /**
   * 날짜 접두사 파일명으로 노트를 생성하고 Vault에 저장하는 메서드
   * 구독 피드 영상 요약 시 사용하며, 별도의 저장 폴더 경로를 지정할 수 있음
   * @param content - 노트 생성용 콘텐츠 객체
   * @param uploadDate - ISO 8601 형식의 업로드 날짜
   * @param saveFolderPath - 노트 저장 폴더 경로 (구독 전용 폴더)
   * @returns 생성된 TFile 객체
   */
  async createNoteWithDatePrefix(
    content: NoteContent,
    uploadDate: string,
    saveFolderPath: string
  ): Promise<TFile> {
    // 저장 폴더 존재 확인 및 자동 생성 (지정된 폴더 경로 사용)
    const folder = this.app.vault.getAbstractFileByPath(saveFolderPath);
    if (!(folder instanceof TFolder)) {
      const parts = saveFolderPath.split("/").filter((p) => p.length > 0);
      let currentPath = "";
      for (const part of parts) {
        currentPath = currentPath ? `${currentPath}/${part}` : part;
        const existing = this.app.vault.getAbstractFileByPath(currentPath);
        if (!existing) {
          await this.app.vault.createFolder(currentPath);
        }
      }
    }

    // 날짜 접두사 파일 경로 결정 (YY-MM-DD 형식, 공백 구분)
    const datePrefix = uploadDate.slice(2, 10);
    const safeName = sanitizeFileName(content.videoTitle);
    const filePath = `${saveFolderPath}/${datePrefix} ${safeName}.md`;

    // 마크다운 콘텐츠 생성
    const markdown = this.generateMarkdown(content);

    // Vault API로 파일 생성
    const file = await this.app.vault.create(filePath, markdown);

    return file;
  }
}
