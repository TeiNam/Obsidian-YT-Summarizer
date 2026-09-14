/** 지역 코드 차이는 허용하되, 중국어 간체·번체처럼 문자 체계가 다르면 구분한다. */
export function isSameTranscriptLanguage(source: string | undefined, target: string): boolean {
  if (!source) return false;
  try {
    const from = new Intl.Locale(source).maximize();
    const to = new Intl.Locale(target).maximize();
    return from.language === to.language && from.script === to.script;
  } catch {
    // 언어를 확인할 수 없으면 번역을 생략하지 않는다.
    return false;
  }
}
