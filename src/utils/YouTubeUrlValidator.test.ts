// ============================================================
// YouTubeUrlValidator 단위 테스트
// 핵심 기능 검증 및 에지 케이스 테스트
// ============================================================

import { describe, it, expect } from "vitest";
import { validateYouTubeUrl, extractVideoId } from "./YouTubeUrlValidator";

describe("validateYouTubeUrl", () => {
  // 빈 문자열 입력 테스트
  describe("빈 입력 처리", () => {
    it("빈 문자열 입력 시 오류 메시지를 반환한다", () => {
      const result = validateYouTubeUrl("");
      expect(result.isValid).toBe(false);
      expect(result.videoId).toBeNull();
      expect(result.error).toBe("유튜브 링크를 입력해주세요");
    });

    it("공백만 있는 문자열 입력 시 오류 메시지를 반환한다", () => {
      const result = validateYouTubeUrl("   ");
      expect(result.isValid).toBe(false);
      expect(result.videoId).toBeNull();
      expect(result.error).toBe("유튜브 링크를 입력해주세요");
    });
  });

  // 유효한 youtube.com/watch URL 테스트
  describe("youtube.com/watch 형식", () => {
    it("https://www.youtube.com/watch?v=VIDEO_ID 형식을 인식한다", () => {
      const result = validateYouTubeUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
      expect(result.isValid).toBe(true);
      expect(result.videoId).toBe("dQw4w9WgXcQ");
      expect(result.error).toBeNull();
    });

    it("http 프로토콜도 인식한다", () => {
      const result = validateYouTubeUrl("http://www.youtube.com/watch?v=dQw4w9WgXcQ");
      expect(result.isValid).toBe(true);
      expect(result.videoId).toBe("dQw4w9WgXcQ");
    });

    it("www 없이도 인식한다", () => {
      const result = validateYouTubeUrl("https://youtube.com/watch?v=dQw4w9WgXcQ");
      expect(result.isValid).toBe(true);
      expect(result.videoId).toBe("dQw4w9WgXcQ");
    });

    it("추가 쿼리 파라미터가 있어도 인식한다", () => {
      const result = validateYouTubeUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=120");
      expect(result.isValid).toBe(true);
      expect(result.videoId).toBe("dQw4w9WgXcQ");
    });

    it("v 파라미터가 첫 번째가 아니어도 인식한다", () => {
      const result = validateYouTubeUrl("https://www.youtube.com/watch?feature=share&v=dQw4w9WgXcQ");
      expect(result.isValid).toBe(true);
      expect(result.videoId).toBe("dQw4w9WgXcQ");
    });
  });

  // 유효한 youtu.be URL 테스트
  describe("youtu.be 형식", () => {
    it("https://youtu.be/VIDEO_ID 형식을 인식한다", () => {
      const result = validateYouTubeUrl("https://youtu.be/dQw4w9WgXcQ");
      expect(result.isValid).toBe(true);
      expect(result.videoId).toBe("dQw4w9WgXcQ");
    });

    it("쿼리 파라미터가 있어도 인식한다", () => {
      const result = validateYouTubeUrl("https://youtu.be/dQw4w9WgXcQ?t=30");
      expect(result.isValid).toBe(true);
      expect(result.videoId).toBe("dQw4w9WgXcQ");
    });
  });

  // 유효한 youtube.com/shorts URL 테스트
  describe("youtube.com/shorts 형식", () => {
    it("https://www.youtube.com/shorts/VIDEO_ID 형식을 인식한다", () => {
      const result = validateYouTubeUrl("https://www.youtube.com/shorts/dQw4w9WgXcQ");
      expect(result.isValid).toBe(true);
      expect(result.videoId).toBe("dQw4w9WgXcQ");
    });
  });

  // 유효하지 않은 URL 테스트
  describe("유효하지 않은 URL 처리", () => {
    it("일반 문자열은 거부한다", () => {
      const result = validateYouTubeUrl("not a url");
      expect(result.isValid).toBe(false);
      expect(result.videoId).toBeNull();
      expect(result.error).toBe("유효한 유튜브 링크를 입력해주세요");
    });

    it("다른 사이트 URL은 거부한다", () => {
      const result = validateYouTubeUrl("https://www.google.com");
      expect(result.isValid).toBe(false);
      expect(result.videoId).toBeNull();
      expect(result.error).toBe("유효한 유튜브 링크를 입력해주세요");
    });

    it("유튜브 URL이지만 영상 ID가 없는 경우 거부한다", () => {
      const result = validateYouTubeUrl("https://www.youtube.com/watch");
      expect(result.isValid).toBe(false);
      expect(result.videoId).toBeNull();
    });

    it("영상 ID가 11자리가 아닌 경우 거부한다", () => {
      const result = validateYouTubeUrl("https://www.youtube.com/watch?v=short");
      expect(result.isValid).toBe(false);
      expect(result.videoId).toBeNull();
    });
  });
});

describe("extractVideoId", () => {
  it("유효한 URL에서 영상 ID를 추출한다", () => {
    expect(extractVideoId("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(extractVideoId("https://youtu.be/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(extractVideoId("https://www.youtube.com/shorts/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });

  it("빈 문자열에서는 null을 반환한다", () => {
    expect(extractVideoId("")).toBeNull();
  });

  it("유효하지 않은 URL에서는 null을 반환한다", () => {
    expect(extractVideoId("not a url")).toBeNull();
  });

  it("하이픈과 언더스코어가 포함된 영상 ID를 추출한다", () => {
    expect(extractVideoId("https://youtu.be/abc-_123AbC")).toBe("abc-_123AbC");
  });
});


// ============================================================
// 에지 케이스 테스트 (태스크 2.4)
// Requirements: 2.1, 2.2, 2.3, 2.4
// ============================================================

describe("validateYouTubeUrl - 에지 케이스", () => {
  // 특수 공백 문자 처리
  describe("특수 공백 문자 처리", () => {
    it("탭 문자만 있는 입력은 빈 입력으로 처리한다", () => {
      const result = validateYouTubeUrl("\t\t");
      expect(result.isValid).toBe(false);
      expect(result.videoId).toBeNull();
      expect(result.error).toBe("유튜브 링크를 입력해주세요");
    });

    it("개행 문자만 있는 입력은 빈 입력으로 처리한다", () => {
      const result = validateYouTubeUrl("\n\n");
      expect(result.isValid).toBe(false);
      expect(result.videoId).toBeNull();
      expect(result.error).toBe("유튜브 링크를 입력해주세요");
    });

    it("혼합 공백 문자(스페이스, 탭, 개행)만 있는 입력은 빈 입력으로 처리한다", () => {
      const result = validateYouTubeUrl("  \t \n  ");
      expect(result.isValid).toBe(false);
      expect(result.videoId).toBeNull();
      expect(result.error).toBe("유튜브 링크를 입력해주세요");
    });
  });

  // 유사하지만 유효하지 않은 URL
  describe("유사하지만 유효하지 않은 URL", () => {
    it("youtube.com만 있는 URL은 거부한다 (경로 없음)", () => {
      const result = validateYouTubeUrl("https://www.youtube.com");
      expect(result.isValid).toBe(false);
      expect(result.videoId).toBeNull();
      expect(result.error).toBe("유효한 유튜브 링크를 입력해주세요");
    });

    it("youtube.com/watch만 있는 URL은 거부한다 (v 파라미터 없음)", () => {
      const result = validateYouTubeUrl("https://www.youtube.com/watch");
      expect(result.isValid).toBe(false);
      expect(result.videoId).toBeNull();
    });

    it("youtube.com/watch?v= 빈 v 파라미터는 거부한다", () => {
      const result = validateYouTubeUrl("https://www.youtube.com/watch?v=");
      expect(result.isValid).toBe(false);
      expect(result.videoId).toBeNull();
    });

    it("11자리 미만 영상 ID는 거부한다", () => {
      const result = validateYouTubeUrl("https://www.youtube.com/watch?v=short");
      expect(result.isValid).toBe(false);
      expect(result.videoId).toBeNull();
    });

    it("11자리 초과 영상 ID는 거부한다", () => {
      const result = validateYouTubeUrl("https://www.youtube.com/watch?v=toolongvideoid123");
      expect(result.isValid).toBe(false);
      expect(result.videoId).toBeNull();
    });

    it("youtu.be/ 뒤에 영상 ID가 없는 경우 거부한다", () => {
      const result = validateYouTubeUrl("https://youtu.be/");
      expect(result.isValid).toBe(false);
      expect(result.videoId).toBeNull();
    });

    it("youtube.com/shorts/ 뒤에 영상 ID가 없는 경우 거부한다", () => {
      const result = validateYouTubeUrl("https://www.youtube.com/shorts/");
      expect(result.isValid).toBe(false);
      expect(result.videoId).toBeNull();
    });
  });

  // 모바일 URL 테스트
  describe("모바일 URL 처리", () => {
    it("m.youtube.com/watch?v=VIDEO_ID 형식을 인식한다", () => {
      const result = validateYouTubeUrl("https://m.youtube.com/watch?v=dQw4w9WgXcQ");
      expect(result.isValid).toBe(true);
      expect(result.videoId).toBe("dQw4w9WgXcQ");
    });

    it("m.youtube.com에 추가 파라미터가 있어도 인식한다", () => {
      const result = validateYouTubeUrl("https://m.youtube.com/watch?v=dQw4w9WgXcQ&t=60");
      expect(result.isValid).toBe(true);
      expect(result.videoId).toBe("dQw4w9WgXcQ");
    });
  });

  // 프로토콜 없는 URL 테스트
  describe("프로토콜 없는 URL 처리", () => {
    it("프로토콜 없는 youtube.com/watch URL을 인식한다", () => {
      const result = validateYouTubeUrl("youtube.com/watch?v=dQw4w9WgXcQ");
      expect(result.isValid).toBe(true);
      expect(result.videoId).toBe("dQw4w9WgXcQ");
    });

    it("프로토콜 없는 youtu.be URL을 인식한다", () => {
      const result = validateYouTubeUrl("youtu.be/dQw4w9WgXcQ");
      expect(result.isValid).toBe(true);
      expect(result.videoId).toBe("dQw4w9WgXcQ");
    });

    it("프로토콜 없는 youtube.com/shorts URL을 인식한다", () => {
      const result = validateYouTubeUrl("youtube.com/shorts/dQw4w9WgXcQ");
      expect(result.isValid).toBe(true);
      expect(result.videoId).toBe("dQw4w9WgXcQ");
    });
  });

  // 특수 문자가 포함된 URL 테스트
  describe("특수 문자가 포함된 URL", () => {
    it("URL 앞뒤 공백은 트리밍하여 처리한다", () => {
      const result = validateYouTubeUrl("  https://youtu.be/dQw4w9WgXcQ  ");
      expect(result.isValid).toBe(true);
      expect(result.videoId).toBe("dQw4w9WgXcQ");
    });

    it("유튜브가 아닌 유사 도메인은 거부한다", () => {
      const result = validateYouTubeUrl("https://www.fakeyoutube.com/watch?v=dQw4w9WgXcQ");
      expect(result.isValid).toBe(false);
      expect(result.videoId).toBeNull();
    });

    it("youtube 도메인이지만 다른 TLD는 거부한다", () => {
      const result = validateYouTubeUrl("https://www.youtube.org/watch?v=dQw4w9WgXcQ");
      expect(result.isValid).toBe(false);
      expect(result.videoId).toBeNull();
    });
  });

  // null/undefined 유사 입력 테스트
  describe("null/undefined 유사 입력", () => {
    it("'null' 문자열은 유효하지 않은 URL로 처리한다", () => {
      const result = validateYouTubeUrl("null");
      expect(result.isValid).toBe(false);
      expect(result.videoId).toBeNull();
    });

    it("'undefined' 문자열은 유효하지 않은 URL로 처리한다", () => {
      const result = validateYouTubeUrl("undefined");
      expect(result.isValid).toBe(false);
      expect(result.videoId).toBeNull();
    });
  });
});

describe("extractVideoId - 에지 케이스", () => {
  // 다양한 영상 ID 형식 테스트
  describe("다양한 영상 ID 형식", () => {
    it("하이픈으로 시작하는 영상 ID를 추출한다", () => {
      expect(extractVideoId("https://youtu.be/-abcdefghij")).toBe("-abcdefghij");
    });

    it("언더스코어로 시작하는 영상 ID를 추출한다", () => {
      expect(extractVideoId("https://youtu.be/_abcdefghij")).toBe("_abcdefghij");
    });

    it("모두 숫자인 영상 ID를 추출한다", () => {
      expect(extractVideoId("https://youtu.be/12345678901")).toBe("12345678901");
    });
  });

  // 잘못된 입력 처리
  describe("잘못된 입력 처리", () => {
    it("공백만 있는 문자열에서는 null을 반환한다", () => {
      expect(extractVideoId("   ")).toBeNull();
    });

    it("탭 문자만 있는 문자열에서는 null을 반환한다", () => {
      expect(extractVideoId("\t")).toBeNull();
    });

    it("youtube.com 경로만 있는 URL에서는 null을 반환한다", () => {
      expect(extractVideoId("https://youtube.com")).toBeNull();
    });

    it("빈 v 파라미터에서는 null을 반환한다", () => {
      expect(extractVideoId("https://youtube.com/watch?v=")).toBeNull();
    });
  });
});
