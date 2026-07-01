// @vitest-environment jsdom
// ============================================================
// FeedView 단위 테스트
// 구독 피드 뷰 컴포넌트의 렌더링, 상태 전환, 오류 격리 검증
// Requirements: 5.4, 6.5, 6.6, 6.7
// ============================================================

import { describe, it, expect, vi, beforeEach } from "vitest";
import { App } from "obsidian";
import { FeedView, groupChannelsByGroupName } from "./FeedView";
import type { FeedViewDependencies } from "./FeedView";
import type { MonitoredChannel } from "../models/types";
import type { ChannelVideos, PluginSettings } from "../models/types";
import { DEFAULT_SETTINGS } from "../models/types";
import { t } from "../i18n";

// NoteCreator 모듈을 vi.mock으로 모킹하여 실제 파일 시스템 접근 방지
vi.mock("../services/NoteCreator", () => ({
  NoteCreator: vi.fn().mockImplementation(() => ({
    createNoteWithDatePrefix: vi.fn().mockResolvedValue({ path: "test.md" }),
  })),
  sanitizeFileName: vi.fn((title: string) => title),
}));

const tr = t("en");

// 테스트용 채널별 영상 데이터
const mockChannelVideos: ChannelVideos[] = [
  {
    channelId: "UC_test_1",
    channelTitle: "테스트 채널 1",
    videos: [
      {
        videoId: "video_1",
        title: "테스트 영상 1",
        channelId: "UC_test_1",
        channelTitle: "테스트 채널 1",
        publishedAt: "2024-06-15T10:30:00Z",
        thumbnailUrl: "https://example.com/thumb1.jpg",
      },
    ],
  },
];

/**
 * 모킹된 FeedViewDependencies 생성 헬퍼
 */
function createMockDeps(
  overrides?: Partial<FeedViewDependencies>
): FeedViewDependencies {
  return {
    subscriptionManager: {
      fetchNewVideos: vi.fn().mockResolvedValue([]),
      getUploadsPlaylistId: vi.fn(),
    } as any,
    summarizerServiceFactory: vi.fn(() => ({
      summarize: vi.fn().mockResolvedValue({ path: "test.md" }),
    })) as any,
    getSettings: () => ({ ...DEFAULT_SETTINGS, monitoredChannels: [] } as PluginSettings),
    app: new App(),
    ...overrides,
  };
}

describe("FeedView", () => {
  let containerEl: HTMLElement;
  let deps: FeedViewDependencies;
  let feedView: FeedView;

  beforeEach(() => {
    containerEl = document.createElement("div");
    deps = createMockDeps();
    feedView = new FeedView(containerEl, deps);
  });

  describe("빈 피드 상태 메시지 표시", () => {
    it("신규 영상이 없을 때 빈 피드 메시지를 표시한다", async () => {
      // 모니터링 채널은 있지만 신규 영상이 없는 경우
      deps = createMockDeps({
        subscriptionManager: {
          fetchNewVideos: vi.fn().mockResolvedValue([]),
          getUploadsPlaylistId: vi.fn(),
        } as any,
        getSettings: () => ({
          ...DEFAULT_SETTINGS,
          monitoredChannels: [
            { channelId: "UC_test_1", channelTitle: "채널1", thumbnailUrl: "" },
          ],
        }),
      });
      feedView = new FeedView(containerEl, deps);
      feedView.render();

      await feedView.loadFeed();

      const emptyMsg = containerEl.querySelector(".youtube-feed-empty");
      expect(emptyMsg).not.toBeNull();
      expect(emptyMsg!.textContent).toBe(tr.feedEmpty);
    });
  });

  describe("모니터링 대상 채널 없을 때 안내 메시지", () => {
    it("모니터링 채널이 없으면 설정 안내 메시지를 표시한다", async () => {
      // monitoredChannels가 빈 배열인 기본 deps 사용
      feedView.render();

      await feedView.loadFeed();

      const noChannelsMsg = containerEl.querySelector(".youtube-feed-empty");
      expect(noChannelsMsg).not.toBeNull();
      expect(noChannelsMsg!.textContent).toBe(tr.feedNoChannels);
    });
  });

  describe("채널별 그룹화된 영상 목록 렌더링", () => {
    it("채널별로 그룹화된 영상 목록이 올바르게 렌더링된다", async () => {
      deps = createMockDeps({
        subscriptionManager: {
          fetchNewVideos: vi.fn().mockResolvedValue(mockChannelVideos),
          getUploadsPlaylistId: vi.fn(),
        } as any,
        getSettings: () => ({
          ...DEFAULT_SETTINGS,
          monitoredChannels: [
            { channelId: "UC_test_1", channelTitle: "테스트 채널 1", thumbnailUrl: "" },
          ],
        }),
      });
      feedView = new FeedView(containerEl, deps);
      feedView.render();

      await feedView.loadFeed();

      // 채널 그룹이 렌더링되었는지 확인
      const channelGroup = containerEl.querySelector(".youtube-feed-channel-group");
      expect(channelGroup).not.toBeNull();

      // 채널 제목이 표시되는지 확인
      const channelTitle = containerEl.querySelector(".youtube-feed-channel-title");
      expect(channelTitle).not.toBeNull();
      expect(channelTitle!.textContent).toBe("테스트 채널 1");

      // 영상 항목이 렌더링되었는지 확인
      const videoItem = containerEl.querySelector(".youtube-feed-video-item");
      expect(videoItem).not.toBeNull();

      // 영상 제목이 표시되는지 확인
      const videoTitle = containerEl.querySelector(".youtube-feed-video-title");
      expect(videoTitle!.textContent).toBe("테스트 영상 1");

      // 요약하기 버튼이 표시되는지 확인
      const summarizeBtn = containerEl.querySelector(".youtube-feed-summarize-btn");
      expect(summarizeBtn).not.toBeNull();
      expect(summarizeBtn!.textContent).toBe(tr.feedSummarizeButton);
    });
  });

  describe("요약 진행 중 버튼 비활성화", () => {
    it("요약 진행 중 버튼이 비활성화되고 진행 상태가 표시된다", async () => {
      // summarize가 지연되도록 설정하여 진행 중 상태를 캡처
      let resolvePromise: () => void;
      const pendingPromise = new Promise<{ path: string }>((resolve) => {
        resolvePromise = () => resolve({ path: "test.md" });
      });

      const mockSummarize = vi.fn().mockReturnValue(pendingPromise);

      deps = createMockDeps({
        subscriptionManager: {
          fetchNewVideos: vi.fn().mockResolvedValue(mockChannelVideos),
          getUploadsPlaylistId: vi.fn(),
        } as any,
        summarizerServiceFactory: vi.fn(() => ({
          summarize: mockSummarize,
        })) as any,
        getSettings: () => ({
          ...DEFAULT_SETTINGS,
          monitoredChannels: [
            { channelId: "UC_test_1", channelTitle: "테스트 채널 1", thumbnailUrl: "" },
          ],
        }),
      });
      feedView = new FeedView(containerEl, deps);
      feedView.render();
      await feedView.loadFeed();

      // 요약 버튼 클릭 (Promise가 아직 resolve되지 않음)
      const summarizeBtn = containerEl.querySelector(
        ".youtube-feed-summarize-btn"
      ) as HTMLButtonElement;
      summarizeBtn.click();

      // 마이크로태스크 처리 대기
      await new Promise((r) => setTimeout(r, 10));

      // 진행 중 상태에서 버튼이 비활성화되었는지 확인
      const disabledBtn = containerEl.querySelector(
        ".youtube-feed-summarize-btn"
      ) as HTMLButtonElement;
      expect(disabledBtn.disabled).toBe(true);
      expect(disabledBtn.textContent).toBe(tr.feedSummarizing);

      // Promise 해결하여 정리
      resolvePromise!();
      await new Promise((r) => setTimeout(r, 10));
    });
  });

  describe("요약 완료 시 상태 전환", () => {
    it("요약 완료 시 상태가 '요약 완료'로 변경된다", async () => {
      deps = createMockDeps({
        subscriptionManager: {
          fetchNewVideos: vi.fn().mockResolvedValue(mockChannelVideos),
          getUploadsPlaylistId: vi.fn(),
        } as any,
        summarizerServiceFactory: vi.fn(() => ({
          summarize: vi.fn().mockResolvedValue({ path: "test.md" }),
        })) as any,
        getSettings: () => ({
          ...DEFAULT_SETTINGS,
          monitoredChannels: [
            { channelId: "UC_test_1", channelTitle: "테스트 채널 1", thumbnailUrl: "" },
          ],
        }),
      });
      feedView = new FeedView(containerEl, deps);
      feedView.render();
      await feedView.loadFeed();

      // 요약 버튼 클릭
      const summarizeBtn = containerEl.querySelector(
        ".youtube-feed-summarize-btn"
      ) as HTMLButtonElement;
      summarizeBtn.click();

      // 비동기 처리 완료 대기
      await new Promise((r) => setTimeout(r, 50));

      // 완료 상태 텍스트가 표시되는지 확인
      const statusEl = containerEl.querySelector(".youtube-feed-status");
      expect(statusEl).not.toBeNull();
      expect(statusEl!.textContent).toBe(tr.feedSummarized);
    });
  });

  describe("개별 영상 요약 실패 시 오류 격리", () => {
    it("요약 실패 시 해당 영상만 오류 상태로 표시된다", async () => {
      // 두 개의 영상이 있는 채널 데이터
      const twoVideoChannel: ChannelVideos[] = [
        {
          channelId: "UC_test_1",
          channelTitle: "테스트 채널 1",
          videos: [
            {
              videoId: "video_fail",
              title: "실패할 영상",
              channelId: "UC_test_1",
              channelTitle: "테스트 채널 1",
              publishedAt: "2024-06-15T10:30:00Z",
              thumbnailUrl: "https://example.com/thumb1.jpg",
            },
            {
              videoId: "video_ok",
              title: "정상 영상",
              channelId: "UC_test_1",
              channelTitle: "테스트 채널 1",
              publishedAt: "2024-06-15T11:00:00Z",
              thumbnailUrl: "https://example.com/thumb2.jpg",
            },
          ],
        },
      ];

      deps = createMockDeps({
        subscriptionManager: {
          fetchNewVideos: vi.fn().mockResolvedValue(twoVideoChannel),
          getUploadsPlaylistId: vi.fn(),
        } as any,
        summarizerServiceFactory: vi.fn(() => ({
          summarize: vi.fn().mockRejectedValue(new Error("요약 실패")),
        })) as any,
        getSettings: () => ({
          ...DEFAULT_SETTINGS,
          monitoredChannels: [
            { channelId: "UC_test_1", channelTitle: "테스트 채널 1", thumbnailUrl: "" },
          ],
        }),
      });
      feedView = new FeedView(containerEl, deps);
      feedView.render();
      await feedView.loadFeed();

      // 첫 번째 영상(실패할 영상)의 요약 버튼 클릭
      const videoItems = containerEl.querySelectorAll(".youtube-feed-video-item");
      expect(videoItems.length).toBe(2);

      const failVideoBtn = videoItems[0].querySelector(
        ".youtube-feed-summarize-btn"
      ) as HTMLButtonElement;
      failVideoBtn.click();

      await new Promise((r) => setTimeout(r, 50));

      // 실패한 영상은 오류 상태로 표시
      const failVideoStatus = videoItems[0].querySelector(".youtube-feed-status");
      expect(failVideoStatus).not.toBeNull();
      expect(failVideoStatus!.textContent).toBe(tr.feedSummaryError);

      // 두 번째 영상은 여전히 요약하기 버튼이 활성화 상태
      const okVideoBtn = videoItems[1].querySelector(
        ".youtube-feed-summarize-btn"
      ) as HTMLButtonElement;
      expect(okVideoBtn).not.toBeNull();
      expect(okVideoBtn.disabled).toBeFalsy();
      expect(okVideoBtn.textContent).toBe(tr.feedSummarizeButton);
    });

    it("요약 실패 후 재시도 버튼으로 올바른 영상 정보로 다시 요약할 수 있다", async () => {
      const summarizeMock = vi
        .fn()
        .mockRejectedValueOnce(new Error("요약 실패"))
        .mockResolvedValueOnce({ path: "test.md" });

      deps = createMockDeps({
        subscriptionManager: {
          fetchNewVideos: vi.fn().mockResolvedValue(mockChannelVideos),
          getUploadsPlaylistId: vi.fn(),
        } as any,
        summarizerServiceFactory: vi.fn(() => ({
          summarize: summarizeMock,
        })) as any,
        getSettings: () => ({
          ...DEFAULT_SETTINGS,
          monitoredChannels: [
            { channelId: "UC_test_1", channelTitle: "테스트 채널 1", thumbnailUrl: "" },
          ],
        }),
      });
      feedView = new FeedView(containerEl, deps);
      feedView.render();
      await feedView.loadFeed();

      const firstBtn = containerEl.querySelector(
        ".youtube-feed-summarize-btn"
      ) as HTMLButtonElement;
      firstBtn.click();
      await new Promise((r) => setTimeout(r, 50));

      // 실패 후 재시도 버튼이 표시됨
      const retryBtn = containerEl.querySelector(
        ".youtube-feed-summarize-btn"
      ) as HTMLButtonElement;
      expect(retryBtn).not.toBeNull();
      expect(retryBtn.disabled).toBeFalsy();

      retryBtn.click();
      await new Promise((r) => setTimeout(r, 50));

      // 두 번째 호출도 원본 영상의 URL/업로드 날짜로 실행됐는지 확인
      expect(summarizeMock).toHaveBeenCalledTimes(2);
      expect(summarizeMock.mock.calls[1][0]).toBe(
        "https://www.youtube.com/watch?v=video_1"
      );
      expect(summarizeMock.mock.calls[1][4]).toBe("2024-06-15T10:30:00Z");

      const statusEl = containerEl.querySelector(".youtube-feed-status");
      expect(statusEl!.textContent).toBe(tr.feedSummarized);
    });
  });

  describe("새로고침 버튼 존재 확인", () => {
    it("render() 호출 시 새로고침 버튼이 상단에 표시된다", () => {
      feedView.render();

      const refreshBtn = containerEl.querySelector(
        ".youtube-feed-refresh-btn"
      ) as HTMLButtonElement;
      expect(refreshBtn).not.toBeNull();
      expect(refreshBtn.textContent).toBe(tr.feedRefreshButton);
    });
  });

  describe("채널별 저장 폴더 사용 (Requirements: 3.1, 3.2)", () => {
    it("채널에 saveFolderPath가 설정되어 있으면 해당 폴더 경로로 summarizerServiceFactory가 호출된다", async () => {
      // 채널별 저장 폴더가 설정된 채널 데이터
      const channelSaveFolderPath = "Custom/Channel1/Folder";
      const channelVideos: ChannelVideos[] = [
        {
          channelId: "UC_channel_custom",
          channelTitle: "커스텀 폴더 채널",
          videos: [
            {
              videoId: "video_custom_1",
              title: "커스텀 폴더 영상",
              channelId: "UC_channel_custom",
              channelTitle: "커스텀 폴더 채널",
              publishedAt: "2024-07-01T12:00:00Z",
              thumbnailUrl: "https://example.com/thumb.jpg",
            },
          ],
        },
      ];

      const mockFactory = vi.fn(() => ({
        summarize: vi.fn().mockResolvedValue({ path: "test.md" }),
      })) as any;

      deps = createMockDeps({
        subscriptionManager: {
          fetchNewVideos: vi.fn().mockResolvedValue(channelVideos),
          getUploadsPlaylistId: vi.fn(),
        } as any,
        summarizerServiceFactory: mockFactory,
        getSettings: () => ({
          ...DEFAULT_SETTINGS,
          subscriptionSaveFolderPath: "Default/Subscriptions",
          monitoredChannels: [
            {
              channelId: "UC_channel_custom",
              channelTitle: "커스텀 폴더 채널",
              thumbnailUrl: "",
              saveFolderPath: channelSaveFolderPath,
            },
          ],
        }),
      });
      feedView = new FeedView(containerEl, deps);
      feedView.render();
      await feedView.loadFeed();

      // 요약 버튼 클릭
      const summarizeBtn = containerEl.querySelector(
        ".youtube-feed-summarize-btn"
      ) as HTMLButtonElement;
      summarizeBtn.click();

      // 비동기 처리 완료 대기
      await new Promise((r) => setTimeout(r, 50));

      // summarizerServiceFactory에 채널별 폴더 경로가 전달되었는지 확인
      expect(mockFactory).toHaveBeenCalledWith(channelSaveFolderPath);
    });

    it("채널에 saveFolderPath가 설정되지 않으면 subscriptionSaveFolderPath(공통 폴더)로 summarizerServiceFactory가 호출된다", async () => {
      // saveFolderPath가 없는 채널 데이터
      const defaultFolder = "Default/Subscriptions";
      const channelVideos: ChannelVideos[] = [
        {
          channelId: "UC_channel_default",
          channelTitle: "기본 폴더 채널",
          videos: [
            {
              videoId: "video_default_1",
              title: "기본 폴더 영상",
              channelId: "UC_channel_default",
              channelTitle: "기본 폴더 채널",
              publishedAt: "2024-07-02T08:00:00Z",
              thumbnailUrl: "https://example.com/thumb2.jpg",
            },
          ],
        },
      ];

      const mockFactory = vi.fn(() => ({
        summarize: vi.fn().mockResolvedValue({ path: "test.md" }),
      })) as any;

      deps = createMockDeps({
        subscriptionManager: {
          fetchNewVideos: vi.fn().mockResolvedValue(channelVideos),
          getUploadsPlaylistId: vi.fn(),
        } as any,
        summarizerServiceFactory: mockFactory,
        getSettings: () => ({
          ...DEFAULT_SETTINGS,
          subscriptionSaveFolderPath: defaultFolder,
          monitoredChannels: [
            {
              channelId: "UC_channel_default",
              channelTitle: "기본 폴더 채널",
              thumbnailUrl: "",
              // saveFolderPath 미설정 → 공통 폴더 fallback
            },
          ],
        }),
      });
      feedView = new FeedView(containerEl, deps);
      feedView.render();
      await feedView.loadFeed();

      // 요약 버튼 클릭
      const summarizeBtn = containerEl.querySelector(
        ".youtube-feed-summarize-btn"
      ) as HTMLButtonElement;
      summarizeBtn.click();

      // 비동기 처리 완료 대기
      await new Promise((r) => setTimeout(r, 50));

      // summarizerServiceFactory에 공통 폴더 경로가 전달되었는지 확인
      expect(mockFactory).toHaveBeenCalledWith(defaultFolder);
    });
  });

  describe("destroy() 호출 시 DOM 비우기", () => {
    it("destroy() 호출 시 컨테이너가 비워진다", () => {
      feedView.render();

      // render 후 DOM에 자식 요소가 있는지 확인
      expect(containerEl.children.length).toBeGreaterThan(0);

      feedView.destroy();

      // destroy 후 DOM이 비워졌는지 확인
      expect(containerEl.innerHTML).toBe("");
    });
  });

  // ============================================================
  // 그룹화 헬퍼 (groupChannelsByGroupName)
  // ============================================================
  describe("groupChannelsByGroupName", () => {
    const cv = (channelId: string): ChannelVideos => ({
      channelId,
      channelTitle: channelId,
      videos: [],
    });
    const ch = (channelId: string, group?: string): MonitoredChannel => ({
      channelId,
      channelTitle: channelId,
      thumbnailUrl: "",
      group,
    });

    it("같은 그룹명의 채널을 한 그룹으로 묶고 등장 순서를 유지한다", () => {
      const result = groupChannelsByGroupName(
        [cv("A"), cv("B"), cv("C")],
        [ch("A", "주식"), ch("B", "스터디"), ch("C", "주식")]
      );
      expect(result.map((g) => g.groupName)).toEqual(["주식", "스터디"]);
      expect(result[0].channels.map((c) => c.channelId)).toEqual(["A", "C"]);
      expect(result[1].channels.map((c) => c.channelId)).toEqual(["B"]);
    });

    it("그룹명이 없거나 공백인 채널은 null 그룹으로 묶여 항상 마지막에 온다", () => {
      const result = groupChannelsByGroupName(
        [cv("A"), cv("B"), cv("C")],
        [ch("A"), ch("B", "주식"), ch("C", "   ")]
      );
      const last = result[result.length - 1];
      expect(last.groupName).toBeNull();
      expect(last.channels.map((c) => c.channelId)).toEqual(["A", "C"]);
    });
  });

  // ============================================================
  // 페이지네이션 ("더 보기")
  // ============================================================
  describe("채널당 영상 페이지네이션", () => {
    const manyVideos: ChannelVideos[] = [
      {
        channelId: "UC_test_1",
        channelTitle: "테스트 채널 1",
        videos: Array.from({ length: 6 }, (_, i) => ({
          videoId: `v${i}`,
          title: `영상 ${i}`,
          channelId: "UC_test_1",
          channelTitle: "테스트 채널 1",
          publishedAt: "2024-06-15T10:30:00Z",
          thumbnailUrl: "",
        })),
      },
    ];

    function setupManyVideos(): void {
      deps = createMockDeps({
        subscriptionManager: {
          fetchNewVideos: vi.fn().mockResolvedValue(manyVideos),
          getUploadsPlaylistId: vi.fn(),
        } as any,
        getSettings: () => ({
          ...DEFAULT_SETTINGS,
          monitoredChannels: [
            { channelId: "UC_test_1", channelTitle: "테스트 채널 1", thumbnailUrl: "" },
          ],
        }),
      });
      feedView = new FeedView(containerEl, deps);
      feedView.render();
    }

    it("처음에는 3개만 표시하고 '더 보기' 버튼이 나온다", async () => {
      setupManyVideos();
      await feedView.loadFeed();

      expect(containerEl.querySelectorAll(".youtube-feed-video-item").length).toBe(3);
      const moreBtn = containerEl.querySelector(".youtube-feed-show-more-btn");
      expect(moreBtn).not.toBeNull();
      expect(moreBtn!.textContent).toContain("3"); // 숨겨진 개수
    });

    it("'더 보기' 클릭 시 전체 영상이 표시되고 버튼이 사라진다", async () => {
      setupManyVideos();
      await feedView.loadFeed();

      (containerEl.querySelector(".youtube-feed-show-more-btn") as HTMLButtonElement).click();

      expect(containerEl.querySelectorAll(".youtube-feed-video-item").length).toBe(6);
      expect(containerEl.querySelector(".youtube-feed-show-more-btn")).toBeNull();
    });
  });

  // ============================================================
  // 영구 완료 표시 (summarizedVideoIds)
  // ============================================================
  describe("영구 완료 표시", () => {
    it("summarizedVideoIds에 있는 영상은 처음부터 완료 상태로 표시된다", async () => {
      deps = createMockDeps({
        subscriptionManager: {
          fetchNewVideos: vi.fn().mockResolvedValue(mockChannelVideos),
          getUploadsPlaylistId: vi.fn(),
        } as any,
        getSettings: () => ({
          ...DEFAULT_SETTINGS,
          summarizedVideoIds: ["video_1"],
          monitoredChannels: [
            { channelId: "UC_test_1", channelTitle: "테스트 채널 1", thumbnailUrl: "" },
          ],
        }),
      });
      feedView = new FeedView(containerEl, deps);
      feedView.render();
      await feedView.loadFeed();

      // 요약 버튼은 없고 완료 상태가 표시되어야 한다
      expect(containerEl.querySelector(".youtube-feed-summarize-btn")).toBeNull();
      const statusEl = containerEl.querySelector(".youtube-feed-status");
      expect(statusEl).not.toBeNull();
      expect(statusEl!.textContent).toBe(tr.feedSummarized);
    });

    it("요약 완료 시 markSummarized 콜백이 호출된다", async () => {
      const markSummarized = vi.fn().mockResolvedValue(undefined);
      deps = createMockDeps({
        subscriptionManager: {
          fetchNewVideos: vi.fn().mockResolvedValue(mockChannelVideos),
          getUploadsPlaylistId: vi.fn(),
        } as any,
        summarizerServiceFactory: vi.fn(() => ({
          summarize: vi.fn().mockResolvedValue({ path: "test.md" }),
        })) as any,
        getSettings: () => ({
          ...DEFAULT_SETTINGS,
          monitoredChannels: [
            { channelId: "UC_test_1", channelTitle: "테스트 채널 1", thumbnailUrl: "" },
          ],
        }),
        markSummarized,
      });
      feedView = new FeedView(containerEl, deps);
      feedView.render();
      await feedView.loadFeed();

      (containerEl.querySelector(".youtube-feed-summarize-btn") as HTMLButtonElement).click();
      await new Promise((r) => setTimeout(r, 50));

      expect(markSummarized).toHaveBeenCalledWith("video_1");
    });
  });
});
