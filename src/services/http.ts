import { requestUrl } from "obsidian";

export type RequestFn = (options: {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: string;
}) => Promise<{ status: number; json: unknown; text?: string }>;

/** Obsidian의 CORS 우회 요청을 사용한다. 인증값이나 응답 본문은 로그에 남기지 않는다. */
export const requestHttp: RequestFn = async (options) => {
  const response = await requestUrl({
    ...options,
    contentType: options.headers["Content-Type"],
    throw: false,
  });
  let json: unknown = null;
  try {
    json = JSON.parse(response.text);
  } catch {
    // HTML/XML 자막 응답은 text로 읽는다.
  }
  return { status: response.status, text: response.text, json };
};

/** requestUrl에는 취소 API가 없으므로 대기만 제한하고, 후속 처리와 노트 저장을 막는다. */
export async function withTimeout<T>(
  operation: Promise<T>,
  milliseconds: number,
  message: string
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(message)), milliseconds);
      }),
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}
