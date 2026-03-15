// ============================================================
// SettingsTab 속성 기반 테스트 (Property-Based Test)
// fast-check 라이브러리를 사용한 채널 토글 로직 검증
// - Property 3: 채널 토글 반영
// - Property 3 (per-channel-save-folder): 채널 설정 라운드트립
// ============================================================

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import type { MonitoredChannel, PluginSettings, SubscriptionChannel } from "../models/types";
import { DEFAULT_SETTINGS } from "../models/types";

// ============================================================
// 토글 로직 순수 함수 추출
// SettingsTab.toggleChannel 메서드의 핵심 로직을 순수 함수로 분리하여 테스트
// ============================================================

/**
 * 채널 토글 로직 (순수 함수)
 * enabled=true이면 채널을 monitoredChannels에 추가, false이면 제거
 * 중복 방지 로직 포함
 *
 * @param currentChannels - 현재 모니터링 중인 채널 배열
 * @param channel - 토글 대상 구독 채널
 * @param enabled - 활성화 여부 (true: 추가, false: 제거)
 * @returns 토글 후 새로운 모니터링 채널 배열
 */
function applyToggleChannel(
  currentChannels: MonitoredChannel[],
  channel: SubscriptionChannel,
  enabled: boolean
): MonitoredChannel[] {
  // 기존 배열을 복사하여 불변성 유지
  const channels = [...currentChannels];

  if (enabled) {
    // 중복 방지 후 추가 (SettingsTab.toggleChannel과 동일한 로직)
    const alreadyExists = channels.some(
      (ch) => ch.channelId === channel.channelId
    );
    if (!alreadyExists) {
      channels.push({
        channelId: channel.channelId,
        channelTitle: channel.title,
        thumbnailUrl: channel.thumbnailUrl,
      });
    }
    return channels;
  } else {
    // 해당 채널 제거 (SettingsTab.toggleChannel과 동일한 로직)
    return channels.filter((ch) => ch.channelId !== channel.channelId);
  }
}

// ============================================================
// fast-check Arbitrary 생성기
// ============================================================

/**
 * 랜덤 SubscriptionChannel 생성기
 * channelId를 외부에서 지정할 수 있도록 파라미터화
 */
function subscriptionChannelArbitrary(
  channelIdArb?: fc.Arbitrary<string>
): fc.Arbitrary<SubscriptionChannel> {
  return fc.record({
    channelId: channelIdArb ?? fc.string({ minLength: 1, maxLength: 30 }),
    title: fc.string({ minLength: 1, maxLength: 100 }),
    thumbnailUrl: fc.constant("https://example.com/thumb.jpg"),
    description: fc.string({ minLength: 0, maxLength: 200 }),
  });
}

/**
 * 랜덤 MonitoredChannel 생성기
 */
function monitoredChannelArbitrary(
  channelIdArb?: fc.Arbitrary<string>
): fc.Arbitrary<MonitoredChannel> {
  return fc.record({
    channelId: channelIdArb ?? fc.string({ minLength: 1, maxLength: 30 }),
    channelTitle: fc.string({ minLength: 1, maxLength: 100 }),
    thumbnailUrl: fc.constant("https://example.com/thumb.jpg"),
  });
}

// ============================================================
// Property 3: 채널 토글 반영
// ============================================================

describe("Feature: youtube-subscription-feed, Property 3: 채널 토글 반영", () => {
  /**
   * Validates: Requirements 3.1
   *
   * 채널을 enabled=true로 토글하면 monitoredChannels에 해당 채널이 포함되어야 한다
   */
  it("enabled=true로 토글하면 해당 채널이 monitoredChannels에 포함된다", () => {
    // 고유한 channelId를 보장하기 위해 인덱스 기반 ID 생성
    const uniqueChannelIdArb = fc.integer({ min: 1, max: 10000 }).map(
      (n) => `UC_channel_${n}`
    );

    fc.assert(
      fc.property(
        // 기존 모니터링 채널 목록 (고유 ID 보장)
        fc.array(monitoredChannelArbitrary(uniqueChannelIdArb), {
          minLength: 0,
          maxLength: 20,
        }),
        // 토글 대상 채널
        subscriptionChannelArbitrary(
          fc.integer({ min: 10001, max: 20000 }).map((n) => `UC_target_${n}`)
        ),
        (existingChannels, targetChannel) => {
          const result = applyToggleChannel(existingChannels, targetChannel, true);

          // 토글 후 해당 채널이 결과에 포함되어야 한다
          const found = result.some(
            (ch) => ch.channelId === targetChannel.channelId
          );
          expect(found).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Validates: Requirements 3.1
   *
   * 채널을 enabled=false로 토글하면 monitoredChannels에서 해당 채널이 제거되어야 한다
   */
  it("enabled=false로 토글하면 해당 채널이 monitoredChannels에서 제거된다", () => {
    fc.assert(
      fc.property(
        // 토글 대상 채널 (이 채널이 기존 목록에 포함된 상태에서 제거 테스트)
        subscriptionChannelArbitrary(
          fc.integer({ min: 1, max: 10000 }).map((n) => `UC_channel_${n}`)
        ),
        // 추가 모니터링 채널 목록
        fc.array(
          monitoredChannelArbitrary(
            fc.integer({ min: 10001, max: 20000 }).map((n) => `UC_other_${n}`)
          ),
          { minLength: 0, maxLength: 20 }
        ),
        (targetChannel, otherChannels) => {
          // 대상 채널을 포함한 기존 목록 구성
          const targetAsMonitored: MonitoredChannel = {
            channelId: targetChannel.channelId,
            channelTitle: targetChannel.title,
            thumbnailUrl: targetChannel.thumbnailUrl,
          };
          const existingChannels = [targetAsMonitored, ...otherChannels];

          const result = applyToggleChannel(existingChannels, targetChannel, false);

          // 토글 후 해당 채널이 결과에 포함되지 않아야 한다
          const found = result.some(
            (ch) => ch.channelId === targetChannel.channelId
          );
          expect(found).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Validates: Requirements 3.1
   *
   * 채널을 토글해도 다른 채널의 모니터링 상태는 변경되지 않아야 한다
   */
  it("채널을 토글해도 다른 채널의 모니터링 상태는 변경되지 않는다", () => {
    fc.assert(
      fc.property(
        // 기존 모니터링 채널 목록 (고유 ID)
        fc.array(
          monitoredChannelArbitrary(
            fc.integer({ min: 1, max: 10000 }).map((n) => `UC_existing_${n}`)
          ),
          { minLength: 0, maxLength: 20 }
        ),
        // 토글 대상 채널 (기존 목록과 다른 ID 범위)
        subscriptionChannelArbitrary(
          fc.integer({ min: 10001, max: 20000 }).map((n) => `UC_target_${n}`)
        ),
        // 토글 상태
        fc.boolean(),
        (existingChannels, targetChannel, enabled) => {
          const result = applyToggleChannel(existingChannels, targetChannel, enabled);

          // 기존 채널 중 대상 채널이 아닌 것들의 ID 집합
          const otherExistingIds = existingChannels
            .filter((ch) => ch.channelId !== targetChannel.channelId)
            .map((ch) => ch.channelId);

          // 결과에서 대상 채널이 아닌 것들의 ID 집합
          const otherResultIds = result
            .filter((ch) => ch.channelId !== targetChannel.channelId)
            .map((ch) => ch.channelId);

          // 다른 채널의 ID 목록이 동일해야 한다 (순서 포함)
          expect(otherResultIds).toEqual(otherExistingIds);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Validates: Requirements 3.1
   *
   * 이미 모니터링 중인 채널을 enabled=true로 다시 토글해도 중복 추가되지 않는다
   */
  it("이미 모니터링 중인 채널을 enabled=true로 토글해도 중복 추가되지 않는다", () => {
    fc.assert(
      fc.property(
        subscriptionChannelArbitrary(
          fc.integer({ min: 1, max: 10000 }).map((n) => `UC_dup_${n}`)
        ),
        fc.array(
          monitoredChannelArbitrary(
            fc.integer({ min: 10001, max: 20000 }).map((n) => `UC_other_${n}`)
          ),
          { minLength: 0, maxLength: 20 }
        ),
        (targetChannel, otherChannels) => {
          // 대상 채널이 이미 포함된 기존 목록
          const targetAsMonitored: MonitoredChannel = {
            channelId: targetChannel.channelId,
            channelTitle: targetChannel.title,
            thumbnailUrl: targetChannel.thumbnailUrl,
          };
          const existingChannels = [targetAsMonitored, ...otherChannels];

          const result = applyToggleChannel(existingChannels, targetChannel, true);

          // 대상 채널이 결과에 정확히 1번만 존재해야 한다
          const count = result.filter(
            (ch) => ch.channelId === targetChannel.channelId
          ).length;
          expect(count).toBe(1);

          // 전체 길이가 기존과 동일해야 한다 (중복 추가 없음)
          expect(result.length).toBe(existingChannels.length);
        }
      ),
      { numRuns: 100 }
    );
  });
});


// ============================================================
// Property 3 (per-channel-save-folder): 채널 설정 라운드트립
// saveFolderPath가 설정된 MonitoredChannel 배열의 Object.assign 라운드트립 검증
// ============================================================

describe("Feature: per-channel-save-folder, Property 3: 채널 설정 라운드트립", () => {
  /**
   * saveFolderPath를 포함한 랜덤 MonitoredChannel 생성기
   */
  const monitoredChannelWithSaveFolderArb: fc.Arbitrary<MonitoredChannel> =
    fc.record({
      channelId: fc.string({ minLength: 1, maxLength: 30 }),
      channelTitle: fc.string({ minLength: 1, maxLength: 100 }),
      thumbnailUrl: fc.constant("https://example.com/thumb.jpg"),
      saveFolderPath: fc.oneof(
        // saveFolderPath가 설정된 경우
        fc.string({ minLength: 1, maxLength: 100 }),
        // saveFolderPath가 undefined인 경우
        fc.constant(undefined)
      ),
    });

  /**
   * Validates: Requirements 2.5
   *
   * saveFolderPath가 설정된 MonitoredChannel 배열을 PluginSettings.monitoredChannels에
   * 저장한 후 Object.assign으로 다시 로드하면 각 채널의 saveFolderPath 값이 원본과 동일해야 한다.
   */
  it("MonitoredChannel 배열을 PluginSettings에 저장 후 Object.assign으로 로드하면 saveFolderPath가 보존된다", () => {
    fc.assert(
      fc.property(
        fc.array(monitoredChannelWithSaveFolderArb, {
          minLength: 0,
          maxLength: 20,
        }),
        (channels) => {
          // 원본 설정 구성: monitoredChannels에 랜덤 채널 배열 저장
          const originalSettings: PluginSettings = {
            ...DEFAULT_SETTINGS,
            monitoredChannels: channels,
          };

          // JSON 직렬화/역직렬화로 저장-로드 시뮬레이션
          const serialized = JSON.stringify(originalSettings);
          const deserialized = JSON.parse(serialized);

          // Object.assign으로 기본값과 병합 (Obsidian loadData 패턴)
          const loadedSettings: PluginSettings = Object.assign(
            {},
            DEFAULT_SETTINGS,
            deserialized
          );

          // 채널 수가 동일해야 한다
          expect(loadedSettings.monitoredChannels.length).toBe(channels.length);

          // 각 채널의 saveFolderPath가 원본과 동일해야 한다
          for (let i = 0; i < channels.length; i++) {
            const original = channels[i];
            const loaded = loadedSettings.monitoredChannels[i];

            expect(loaded.channelId).toBe(original.channelId);
            expect(loaded.channelTitle).toBe(original.channelTitle);
            expect(loaded.saveFolderPath).toBe(original.saveFolderPath);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Validates: Requirements 2.5
   *
   * saveFolderPath가 설정된 채널을 포함한 설정을 저장 후 로드하면,
   * saveFolderPath가 있는 채널과 없는 채널 모두 올바르게 복원되어야 한다.
   */
  it("saveFolderPath 유무가 혼합된 채널 배열도 라운드트립 후 정확히 복원된다", () => {
    // saveFolderPath가 반드시 설정된 채널 생성기
    const channelWithFolderArb: fc.Arbitrary<MonitoredChannel> = fc.record({
      channelId: fc.string({ minLength: 1, maxLength: 30 }),
      channelTitle: fc.string({ minLength: 1, maxLength: 100 }),
      thumbnailUrl: fc.constant("https://example.com/thumb.jpg"),
      saveFolderPath: fc.string({ minLength: 1, maxLength: 100 }),
    });

    // saveFolderPath가 없는 채널 생성기
    const channelWithoutFolderArb: fc.Arbitrary<MonitoredChannel> = fc.record({
      channelId: fc.string({ minLength: 1, maxLength: 30 }),
      channelTitle: fc.string({ minLength: 1, maxLength: 100 }),
      thumbnailUrl: fc.constant("https://example.com/thumb.jpg"),
    });

    fc.assert(
      fc.property(
        fc.array(channelWithFolderArb, { minLength: 1, maxLength: 10 }),
        fc.array(channelWithoutFolderArb, { minLength: 1, maxLength: 10 }),
        (withFolder, withoutFolder) => {
          // 두 종류의 채널을 혼합
          const mixedChannels = [...withFolder, ...withoutFolder];

          const originalSettings: PluginSettings = {
            ...DEFAULT_SETTINGS,
            monitoredChannels: mixedChannels,
          };

          // JSON 직렬화/역직렬화 라운드트립
          const serialized = JSON.stringify(originalSettings);
          const deserialized = JSON.parse(serialized);

          const loadedSettings: PluginSettings = Object.assign(
            {},
            DEFAULT_SETTINGS,
            deserialized
          );

          // 전체 채널 수 보존
          expect(loadedSettings.monitoredChannels.length).toBe(
            mixedChannels.length
          );

          // saveFolderPath가 설정된 채널은 값이 보존되어야 한다
          for (let i = 0; i < withFolder.length; i++) {
            const loaded = loadedSettings.monitoredChannels[i];
            expect(loaded.saveFolderPath).toBe(withFolder[i].saveFolderPath);
          }

          // saveFolderPath가 없는 채널은 undefined로 유지되어야 한다
          for (let i = 0; i < withoutFolder.length; i++) {
            const loaded =
              loadedSettings.monitoredChannels[withFolder.length + i];
            expect(loaded.saveFolderPath).toBeUndefined();
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});


// ============================================================
// Property 3 (latest-videos-feed): videosPerChannel 범위 제한
// 설정 UI에서 videosPerChannel 값 변경 시 클램핑 로직 검증
// ============================================================

/**
 * videosPerChannel 클램핑 로직 (순수 함수)
 * SettingsTab.ts의 슬라이더 onChange 콜백에서 사용하는 로직과 동일
 * 범위: 1 이상 10 이하의 정수
 *
 * @param value - 입력 값 (임의의 숫자)
 * @returns 1~10 범위로 클램핑된 정수
 */
function clampVideosPerChannel(value: number): number {
  return Math.min(10, Math.max(1, Math.round(value)));
}

describe("Feature: latest-videos-feed, Property 3: videosPerChannel 범위 제한", () => {
  /**
   * Validates: Requirements 3.4
   *
   * 임의의 정수 값에 대해, 클램핑 결과는 항상 1 이상 10 이하의 정수여야 한다
   */
  it("임의의 정수 값에 대해 클램핑 결과는 항상 1 이상 10 이하이다", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -1000, max: 1000 }),
        (value) => {
          const result = clampVideosPerChannel(value);

          // 결과는 항상 1 이상이어야 한다
          expect(result).toBeGreaterThanOrEqual(1);
          // 결과는 항상 10 이하이어야 한다
          expect(result).toBeLessThanOrEqual(10);
          // 결과는 정수여야 한다
          expect(Number.isInteger(result)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Validates: Requirements 3.4
   *
   * 1~10 범위 내의 정수는 클램핑 후에도 원래 값이 그대로 유지되어야 한다
   */
  it("1~10 범위 내의 정수는 클램핑 후에도 값이 변경되지 않는다", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10 }),
        (value) => {
          const result = clampVideosPerChannel(value);

          // 범위 내 정수는 그대로 반환되어야 한다
          expect(result).toBe(value);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Validates: Requirements 3.4
   *
   * 10을 초과하는 값은 항상 10으로 클램핑되어야 한다
   */
  it("10을 초과하는 값은 10으로 클램핑된다", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 11, max: 10000 }),
        (value) => {
          const result = clampVideosPerChannel(value);

          expect(result).toBe(10);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Validates: Requirements 3.4
   *
   * 1 미만의 값은 항상 1로 클램핑되어야 한다
   */
  it("1 미만의 값은 1로 클램핑된다", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -10000, max: 0 }),
        (value) => {
          const result = clampVideosPerChannel(value);

          expect(result).toBe(1);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Validates: Requirements 3.4
   *
   * 소수점이 포함된 값도 반올림 후 1~10 범위로 클램핑되어야 한다
   */
  it("소수점 값은 반올림 후 1~10 범위로 클램핑된다", () => {
    fc.assert(
      fc.property(
        fc.double({ min: -100, max: 100, noNaN: true, noDefaultInfinity: true }),
        (value) => {
          const result = clampVideosPerChannel(value);

          // 결과는 항상 1 이상 10 이하의 정수여야 한다
          expect(result).toBeGreaterThanOrEqual(1);
          expect(result).toBeLessThanOrEqual(10);
          expect(Number.isInteger(result)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });
});
