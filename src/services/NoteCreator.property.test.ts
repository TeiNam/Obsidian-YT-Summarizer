// ============================================================
// NoteCreator 속성 기반 테스트 (Property-Based Test)
// fast-check 라이브러리를 사용한 날짜 접두사 파일명 형식 검증
// - Property 7: 날짜 접두사 파일명 형식 (createNote의 uploadDate 경로)
// ============================================================

import { describe, it, expect, vi } from "vitest";
import * as fc from "fast-check";
import { App } from "obsidian";
import { NoteCreator } from "./NoteCreator";
import type { NoteContent } from "../models/types";

// ============================================================
// Property 7: 날짜 접두사 파일명 형식
// ============================================================

describe("Feature: youtube-subscription-feed, Property 7: 날짜 접두사 파일명 형식", () => {
  /**
   * Validates: Requirements 6.4
   *
   * 랜덤 영상 제목과 ISO 8601 업로드 날짜로 createNote를 호출하면,
   * 생성되는 파일 경로가 YY-MM-DD(업로드 날짜) 접두사로 시작하고
   * 파일명에 특수 문자를 포함하지 않는지 검증
   */
  it("uploadDate 전달 시 파일명이 업로드 날짜 YY-MM-DD 접두사로 시작하고 특수 문자를 포함하지 않는다", async () => {
    // 랜덤 영상 제목 생성기 (유니코드 포함, 빈 문자열 허용)
    const titleArbitrary = fc.string({ minLength: 0, maxLength: 200 });

    // 유효한 ISO 8601 날짜 문자열 생성기
    const isoDateArbitrary = fc.date({
      min: new Date("2000-01-01T00:00:00Z"),
      max: new Date("2099-12-31T23:59:59Z"),
    }).map((d) => d.toISOString());

    await fc.assert(
      fc.asyncProperty(titleArbitrary, isoDateArbitrary, async (title, uploadDate) => {
        // 매 실행마다 새 mock으로 격리
        const mockApp = new App();
        const createdPaths: string[] = [];
        mockApp.vault.create = vi.fn((path: string) => {
          createdPaths.push(path);
          return Promise.resolve({ path } as any);
        }) as any;
        mockApp.vault.createFolder = vi.fn().mockResolvedValue(undefined);
        mockApp.vault.getAbstractFileByPath = vi.fn().mockReturnValue(null);

        const noteCreator = new NoteCreator(mockApp, "YouTube Subscriptions");
        const content: NoteContent = {
          videoTitle: title,
          videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
          summary: "요약",
          keyPoints: [],
        };

        await noteCreator.createNote(content, uploadDate);
        const result = createdPaths[0];

        // 파일명 부분 추출 (폴더 경로 이후)
        const fileName = result.split("/").pop()!;

        // 속성 1: 파일명이 업로드 날짜 YY-MM-DD 접두사로 시작해야 한다 (2자리 연도, 공백 구분)
        const datePrefix = uploadDate.slice(2, 10);
        expect(fileName.startsWith(`${datePrefix} `)).toBe(true);

        // 속성 2: 날짜 접두사가 YY-MM-DD 형식이어야 한다
        const datePart = fileName.slice(0, 8);
        expect(datePart).toMatch(/^\d{2}-\d{2}-\d{2}$/);

        // 속성 3: 파일명에 사용할 수 없는 특수 문자가 포함되지 않아야 한다
        // (폴더 구분자 "/" 제외, 파일명 부분만 검사)
        const forbiddenChars = /[\\/:*?"<>|]/;
        expect(forbiddenChars.test(fileName)).toBe(false);

        // 속성 4: 파일 확장자가 .md여야 한다
        expect(result.endsWith(".md")).toBe(true);
      }),
      { numRuns: 100 } // 최소 100회 반복
    );
  });
});
