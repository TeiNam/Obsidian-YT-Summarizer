import { Language, t } from "../i18n";
import { VideoTranscript } from "../models/types";
import { isSameTranscriptLanguage } from "../utils/TranscriptLanguage";
import { RequestFn, requestHttp, withTimeout } from "./http";

interface CaptionTrack {
  baseUrl: string;
  languageCode: string;
  kind?: string;
}

interface PlayerResponse {
  playabilityStatus?: { status?: string };
  videoDetails?: { title?: string; lengthSeconds?: string; isLive?: boolean };
  microformat?: { playerMicroformatRenderer?: { uploadDate?: string; publishDate?: string } };
  captions?: { playerCaptionsTracklistRenderer?: {
    captionTracks?: CaptionTrack[];
    audioTracks?: { defaultCaptionTrackIndex?: number }[];
    defaultAudioTrackIndex?: number;
  } };
}

/** YouTube가 반환하는 srv1과 srv3 XML을 모두 읽는다. 화면에는 원본 HTML을 삽입하지 않는다. */
export function parseCaptionXml(xml: string): string {
  const doc = new DOMParser().parseFromString(xml, "text/xml");
  if (doc.querySelector("parsererror")) return "";
  return Array.from(doc.querySelectorAll("transcript > text, timedtext > body > p"))
    .map((cue) => (cue.textContent ?? "").replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join(" ");
}

export class YouTubeCaptionClient {
  constructor(
    private language: Language = "ko",
    private request: RequestFn = requestHttp
  ) {}

  async getTranscript(
    videoId: string,
    preferredLanguage: string,
    manualTranscript?: string
  ): Promise<VideoTranscript> {
    const tr = t(this.language);
    if (!/^[\w-]{11}$/.test(videoId)) throw new Error(tr.errorInvalidUrl);
    const manual = manualTranscript?.trim();
    let page: Document;
    let html: string;
    try {
      const response = await this.fetch(`https://www.youtube.com/watch?v=${videoId}&hl=en`);
      html = response.text ?? "";
      page = new DOMParser().parseFromString(html, "text/html");
    } catch (error) {
      // 사용자가 준 자막은 YouTube 차단 중에도 처리할 수 있어야 한다.
      if (manual) return { title: videoId, text: manual };
      throw error;
    }

    const metadata = {
      title: page.querySelector('meta[property="og:title"]')?.getAttribute("content") || videoId,
      uploadDate: this.date(page.querySelector('meta[itemprop="datePublished"]')?.getAttribute("content")),
    };
    if (manual) return { ...metadata, text: manual };

    const apiKey = html.match(/"INNERTUBE_API_KEY"\s*:\s*"([A-Za-z0-9_-]+)"/)?.[1];
    if (!apiKey) throw new Error(tr.errorCaptionAccess);

    // youtube-transcript-api와 같은 공개 플레이어 경로. 미디어/오디오는 다운로드하지 않는다.
    const response = await this.fetch(
      `https://www.youtube.com/youtubei/v1/player?key=${apiKey}`,
      {
        context: { client: { clientName: "ANDROID", clientVersion: "20.10.38" } },
        videoId,
      }
    );
    const player = response.json as PlayerResponse | null;
    if (!player || player.playabilityStatus?.status !== "OK" || player.videoDetails?.isLive) {
      throw new Error(tr.errorCaptionAccess);
    }
    const renderer = player.captions?.playerCaptionsTracklistRenderer;
    const tracks = renderer?.captionTracks;
    if (!Array.isArray(tracks) || !tracks.length) throw new Error(tr.errorNoCaptions);
    const validTracks = tracks.filter(
      (track) => typeof track.baseUrl === "string" && typeof track.languageCode === "string"
    );
    // 선호 언어 안에서 수동 자막을 우선하고, 없으면 다른 언어의 자막을 번역한다.
    const matchesTarget = (track: CaptionTrack): boolean =>
      isSameTranscriptLanguage(track.languageCode, preferredLanguage);
    const rank = (track: CaptionTrack): number =>
      (matchesTarget(track) ? 0 : 2)
      + (track.kind === "asr" ? 1 : 0);
    validTracks.sort((a, b) => rank(a) - rank(b));
    const preferred = validTracks.filter(matchesTarget);
    const defaultIndex = renderer?.audioTracks?.[renderer.defaultAudioTrackIndex ?? 0]?.defaultCaptionTrackIndex ?? 0;
    // 타겟 언어의 수동·자동 자막을 모두 확인한 뒤 다른 언어로 넘어간다.
    const candidates = [...new Set([...preferred, tracks[defaultIndex], validTracks.find((track) => track.kind === "asr"), ...validTracks])]
      .filter((track): track is CaptionTrack => !!track && validTracks.includes(track));
    let incomplete = false;
    for (const track of candidates) {
      let url: URL;
      try {
        url = new URL(track.baseUrl);
      } catch {
        throw new Error(tr.errorCaptionFormat);
      }
      if (
        url.protocol !== "https:" ||
        url.username !== "" || url.password !== "" || url.port !== "" ||
        !(url.hostname === "www.youtube.com" || url.hostname === "youtube.com") ||
        url.pathname !== "/api/timedtext"
      ) throw new Error(tr.errorCaptionFormat);
      url.searchParams.delete("fmt");
      const captions = await this.fetch(url.toString());
      const text = parseCaptionXml(captions.text ?? "");
      if (!text) continue;
      const duration = Number(player.videoDetails?.lengthSeconds);
      // 서버의 자막 충분성 기준을 유지하되, 부족하면 다른 자막을 확인한다.
      if (text.length < 100 || (duration > 0 && text.length / (duration / 60) < 100)) {
        incomplete = true;
        continue;
      }
      const microformat = player.microformat?.playerMicroformatRenderer;
      return {
        title: player.videoDetails?.title || metadata.title,
        uploadDate: this.date(microformat?.uploadDate || microformat?.publishDate) || metadata.uploadDate,
        text,
        language: track.languageCode,
      };
    }
    throw new Error(incomplete ? tr.errorCaptionIncomplete : tr.errorNoCaptions);
  }

  private date(value: string | null | undefined): string | undefined {
    return value?.match(/^\d{4}-\d{2}-\d{2}/)?.[0];
  }

  private async fetch(url: string, body?: unknown): ReturnType<RequestFn> {
    const tr = t(this.language);
    const response = await withTimeout(
      this.request({
        url,
        method: body ? "POST" : "GET",
        headers: {
          "Accept-Language": "en-US,en;q=0.9",
          ...(body ? { "Content-Type": "application/json" } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      }).catch(() => { throw new Error(tr.errorCaptionAccess); }),
      30000,
      tr.errorCaptionsTimeout
    );
    if (response.status !== 200) throw new Error(`${tr.errorCaptionAccess} (HTTP ${response.status})`);
    return response;
  }
}
