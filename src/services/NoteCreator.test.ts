// ============================================================
// NoteCreator 단위 테스트
// 마크다운 출력, YAML 프론트매터, 핵심 인사이트 섹션, 폴더 자동 생성 검증
// ============================================================

import { describe, it, expect, vi, beforeEach } from "vitest";
import { App, TFile, TFolder } from "obsidian";
import { NoteCreator, sanitizeFileName } from "./NoteCreator";
import { NoteContent } from "../models/types";

// ============================================================
// 테스트용 공통 데이터
// ============================================================

/** 일반 요약 노트 콘텐츠 */
const normalContent: NoteContent = {
  videoTitle: "TypeScript 입문 강의",
  videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  summary: "이 영상은 TypeScript의 기초 문법과 타입 시스템을 설명합니다.",
  keyPoints: ["타입 안전성 확보", "인터페이스 활용법", "제네릭 기초"],
};

/** keyPoints가 빈 배열인 콘텐츠 */
const noKeyPointsContent: NoteContent = {
  videoTitle: "간단한 영상",
  videoUrl: "https://www.youtube.com/watch?v=abc123",
  summary: "짧은 요약입니다.",
  keyPoints: [],
};

// ============================================================
// generateMarkdown 테스트
// ============================================================

describe("NoteCreator.generateMarkdown", () => {
  const mockApp = new App();
  const noteCreator = new NoteCreator(mockApp, "YouTube Summaries");

  it("올바른 마크다운 구조를 생성한다", () => {
    const markdown = noteCreator.generateMarkdown(normalContent);

    expect(markdown).toMatch(/^---\n/);
    expect(markdown).toContain("# TypeScript 입문 강의");
    expect(markdown).toContain("![](https://www.youtube.com/watch?v=dQw4w9WgXcQ)");
    expect(markdown).toContain("## 요약");
    expect(markdown).toContain("이 영상은 TypeScript의 기초 문법과 타입 시스템을 설명합니다.");
  });

  it("YAML 프론트매터에 tags, date, url이 포함된다", () => {
    const markdown = noteCreator.generateMarkdown(normalContent);
    const frontmatterMatch = markdown.match(/^---\n([\s\S]*?)\n---/);
    expect(frontmatterMatch).not.toBeNull();

    const frontmatter = frontmatterMatch![1];
    expect(frontmatter).toContain("tags:");
    expect(frontmatter).toContain("youtube-summary");
    expect(frontmatter).toMatch(/date: \d{4}-\d{2}-\d{2}/);
    expect(frontmatter).toContain("url: https://www.youtube.com/watch?v=dQw4w9WgXcQ");
  });

  it("videoUrl이 임베딩에 직접 사용된다", () => {
    const markdown = noteCreator.generateMarkdown(normalContent);
    expect(markdown).toContain("![](https://www.youtube.com/watch?v=dQw4w9WgXcQ)");
  });

  it("핵심 인사이트 섹션이 keyPoints 배열로 렌더링된다", () => {
    const markdown = noteCreator.generateMarkdown(normalContent);

    expect(markdown).toContain("## 핵심 인사이트");
    expect(markdown).toContain("- 타입 안전성 확보");
    expect(markdown).toContain("- 인터페이스 활용법");
    expect(markdown).toContain("- 제네릭 기초");
  });

  it("keyPoints가 빈 배열이면 핵심 인사이트 섹션이 생략된다", () => {
    const markdown = noteCreator.generateMarkdown(noKeyPointsContent);
    expect(markdown).not.toContain("## 핵심 인사이트");
  });

  it("isFallbackSummary callout이 더 이상 포함되지 않는다", () => {
    const markdown = noteCreator.generateMarkdown(normalContent);
    expect(markdown).not.toContain("이 요약은 자막이 아닌 영상 설명을 기반으로 생성되었습니다");
  });
});

// ============================================================
// resolveFilePath 테스트
// ============================================================

describe("NoteCreator.resolveFilePath", () => {
  it("파일이 존재하지 않을 때 기본 경로를 반환한다", async () => {
    const mockApp = new App();
    const noteCreator = new NoteCreator(mockApp, "YouTube Summaries");
    const path = await noteCreator.resolveFilePath("테스트 영상");
    expect(path).toBe("YouTube Summaries/테스트 영상.md");
  });

  it("파일이 존재할 때 타임스탬프가 추가된 경로를 반환한다", async () => {
    const mockApp = new App();
    const existingFile = { path: "YouTube Summaries/테스트 영상.md" } as TFile;
    mockApp.vault.getAbstractFileByPath = vi.fn((p: string) =>
      p === "YouTube Summaries/테스트 영상.md" ? existingFile : null
    );

    const noteCreator = new NoteCreator(mockApp, "YouTube Summaries");
    const path = await noteCreator.resolveFilePath("테스트 영상");

    expect(path).not.toBe("YouTube Summaries/테스트 영상.md");
    expect(path).toMatch(/YouTube Summaries\/테스트 영상 \(\d+\)\.md/);
  });
});

// ============================================================
// createNote 테스트
// ============================================================

describe("NoteCreator.createNote", () => {
  let mockApp: App;

  beforeEach(() => {
    mockApp = new App();
    mockApp.vault.create = vi.fn().mockResolvedValue(
      { path: "YouTube Summaries/TypeScript 입문 강의.md" } as TFile
    );
    mockApp.vault.createFolder = vi.fn().mockResolvedValue(undefined);
    mockApp.vault.getAbstractFileByPath = vi.fn().mockReturnValue(null);
  });

  it("폴더가 존재하지 않을 때 자동 생성한다", async () => {
    const noteCreator = new NoteCreator(mockApp, "YouTube Summaries");
    await noteCreator.createNote(normalContent);
    expect(mockApp.vault.createFolder).toHaveBeenCalledWith("YouTube Summaries");
  });

  it("폴더가 이미 존재할 때 생성하지 않는다", async () => {
    const existingFolder = { path: "YouTube Summaries" } as TFolder;
    mockApp.vault.getAbstractFileByPath = vi.fn((p: string) =>
      p === "YouTube Summaries" ? existingFolder : null
    );

    const noteCreator = new NoteCreator(mockApp, "YouTube Summaries");
    await noteCreator.createNote(normalContent);
    expect(mockApp.vault.createFolder).not.toHaveBeenCalled();
  });

  it("Vault.create가 올바른 경로와 콘텐츠로 호출된다", async () => {
    const noteCreator = new NoteCreator(mockApp, "YouTube Summaries");
    await noteCreator.createNote(normalContent);

    expect(mockApp.vault.create).toHaveBeenCalledTimes(1);
    const [filePath, content] = (mockApp.vault.create as ReturnType<typeof vi.fn>).mock.calls[0];

    expect(filePath).toBe("YouTube Summaries/TypeScript 입문 강의.md");
    expect(content).toContain("# TypeScript 입문 강의");
    expect(content).toContain("![](https://www.youtube.com/watch?v=dQw4w9WgXcQ)");
    expect(content).toContain("## 핵심 인사이트");
  });
});

// ============================================================
// sanitizeFileName 테스트
// ============================================================

describe("sanitizeFileName", () => {
  it("특수 문자가 제거된다", () => {
    expect(sanitizeFileName('파일명/테스트:영상*"제목"')).toBe("파일명테스트영상제목");
  });

  it("정상 문자열은 그대로 반환된다", () => {
    expect(sanitizeFileName("TypeScript 입문 강의")).toBe("TypeScript 입문 강의");
  });
});
