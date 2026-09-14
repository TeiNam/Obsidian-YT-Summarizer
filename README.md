# Obsidian YouTube Summarizer

![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue.svg)
![Obsidian](https://img.shields.io/badge/Obsidian-1.5%2B-7C3AED.svg)
![AWS Bedrock](https://img.shields.io/badge/AWS-Bedrock-FF9900.svg)
![Vitest](https://img.shields.io/badge/Vitest-1.6-6E9F18.svg)
![License](https://img.shields.io/badge/License-MIT-green.svg)

[![Buy Me A Coffee](https://img.shields.io/badge/Buy%20Me%20A%20Coffee-FFDD00?style=for-the-badge&logo=buy-me-a-coffee&logoColor=black)](https://buymeacoffee.com/teinam)

## 개요

유튜브 자막을 옵시디언에서 가져와 원하는 AI 모델로 번역·요약하고, 공부 노트를 생성합니다.
별도 YouTube Summary API 서버, Python, yt-dlp, 오디오 다운로드, AWS Transcribe 없이 동작합니다.

여기서 **로컬 처리**는 자막 수집과 요약 흐름을 플러그인이 직접 실행한다는 뜻입니다. 클라우드 모델을 선택하면 자막이 해당 AI 제공자에게 전송되며 사용 요금이 발생할 수 있습니다. Ollama·LM Studio 등의 OpenAI 호환 서버를 로컬 주소로 설정하면 모델 실행도 PC에서 처리할 수 있습니다.

## 주요 기능

- 자동·수동 자막 수집, 자막 직접 붙여넣기
- Bedrock Bearer 토큰 또는 AWS 프로필·SSO 인증
- OpenAI 및 OpenAI 호환 서버, Anthropic Claude, Google Gemini 지원
- 타겟 언어 자막은 바로 요약, 다른 언어 자막은 번역 후 기존 API의 장르별 공부 노트 방식으로 요약
- 한줄 요약, 상세 내용, 핵심 인사이트, 키워드, 추가 탐색 주제
- 긴 자막 분할 번역, 입력 상한·응답 잘림 검사
- 여러 URL 순차 요약, 실패한 URL 보존 및 재시도
- 구독 채널 피드, 채널 그룹, 채널별 저장 폴더, 요약 완료 표시
- 한국어·영어 UI 및 별도 요약 언어 설정
- `YY-MM-DD 영상제목.md` 파일명, 업로드 날짜·영상 임베딩·YAML 프론트매터

## 설치

```bash
# 의존성 설치
npm ci

# 테스트와 프로덕션 빌드
npm test
npm run build
```

`main.js`, `manifest.json`, `styles.css`를 볼트의 `.obsidian/plugins/obsidian-youtube-summarizer/`에 복사한 다음 플러그인을 활성화합니다. AWS SDK와 요약 프롬프트는 `main.js`에 포함됩니다.

API 키 방식은 데스크톱·모바일에서 사용할 수 있습니다. **AWS 프로필·SSO는 Node.js 20 이상을 포함한 옵시디언 데스크톱 런타임이 필요합니다.** 런타임이 오래되었다면 옵시디언 설치 프로그램을 업데이트하세요.

## 모델 설정

설정 → YouTube Summarizer에서 AI 제공자와 모델 ID를 선택합니다. 인증값과 모델 ID는 제공자마다 따로 보관됩니다. 기존 요약 서버의 API 키는 AI 제공자 키로 사용할 수 없습니다.

| 제공자 | 필요한 설정 | 호출 방식 |
|------|------|------|
| Amazon Bedrock · Bearer | Bedrock API 키, AWS 리전, 모델 또는 추론 프로필 ID/ARN | Converse + Bearer 인증 |
| Amazon Bedrock · 프로필 | AWS 프로필 이름, 리전, 모델 또는 추론 프로필 ID/ARN | AWS SDK 자격 증명 + SigV4 |
| OpenAI / OpenAI 호환 | 기본 URL, 모델 ID, API 키 | Chat Completions |
| Anthropic Claude | 모델 ID, Anthropic API 키 | Messages |
| Google Gemini | 모델 ID, Gemini API 키 | generateContent |

모델 ID는 직접 입력할 수 있습니다. Bedrock의 기본 예시는 `us-east-1` / `us.anthropic.claude-sonnet-4-6`이며, 계정에서 접근 가능한 모델·추론 프로필과 리전을 지정해야 합니다.

### Bedrock Bearer 토큰

Bedrock 콘솔에서 발급한 API 키를 **Bedrock Bearer 토큰**에 입력합니다. `Bearer` 접두사는 생략할 수 있습니다. IAM 액세스 키 ID나 SSO 로그인 토큰을 넣는 필드는 아닙니다.

### AWS 프로필·SSO

먼저 AWS CLI에서 사용할 프로필을 구성하고 로그인합니다.

```bash
# 이미 프로필이 있으면 구성 단계는 생략
aws configure sso --profile my-bedrock
aws sso login --profile my-bedrock
```

플러그인에서 인증 방식을 **AWS 프로필 / SSO**로 바꾸고 `my-bedrock`을 입력합니다. SDK가 `~/.aws/config`와 SSO 캐시에서 자격 증명을 읽습니다. 기존 AWS 공유 프로필도 사용할 수 있습니다. 인증이 만료되면 같은 로그인 명령으로 갱신하세요.

프로필을 선택하면 인증 방식을 SigV4로 고정하므로, 환경변수에 남아 있는 `AWS_BEARER_TOKEN_BEDROCK`이 선택한 프로필을 대신 사용하지 않습니다.

### OpenAI 호환 서버 / 로컬 모델

기본 URL은 `/v1`까지 입력합니다.

| 서버 | 기본 URL 예시 | 모델 ID / API 키 |
|------|------|------|
| OpenAI | `https://api.openai.com/v1` | 사용 가능한 모델 ID / OpenAI API 키 |
| Ollama | `http://localhost:11434/v1` | 설치한 모델 이름 / 키 생략 가능 |
| LM Studio | `http://localhost:1234/v1` | 서버에서 제공하는 모델 ID / 키 생략 가능 |
| 그 밖의 호환 서버 | 제공자의 HTTPS 기본 URL | 해당 제공자의 모델 ID / API 키 |

HTTP는 `localhost`, `127.0.0.1`, `[::1]`만 허용합니다. 나머지 주소는 HTTPS와 API 키가 필요합니다. 기본 URL을 바꾸면 현재 OpenAI 호환 키가 새 주소로 전송되므로 주소와 키를 함께 확인하세요.

### 키 저장

API 키는 볼트의 `.obsidian/plugins/obsidian-youtube-summarizer/data.json`에 평문으로 저장됩니다. 눈 아이콘의 마스킹은 화면 표시만 숨깁니다. 볼트 동기화·백업에 이 파일이 포함될 수 있습니다. SSO를 사용하면 플러그인 설정에는 프로필 이름만 저장하고 AWS 자격 증명은 기존 AWS 캐시에서 읽습니다.

## 자막과 요약 흐름

1. 유튜브 페이지에서 제목·업로드 날짜와 자막 트랙을 가져옵니다.
2. 타겟 언어의 수동 자막과 자동 자막을 먼저 확인합니다. 사용할 수 있는 자막이 있으면 번역을 생략합니다.
3. 타겟 언어 자막이 없거나 불완전하면 기본 자막·자동 자막·나머지 트랙에서 대체 자막을 찾아 번역합니다. 긴 입력은 나누어 번역한 뒤 전체 번역문을 모읍니다.
4. 동일 언어 자막 원문 또는 전체 번역문에 장르별 요약 프롬프트를 한 번 적용합니다.
5. 정상적으로 완료된 결과만 노트로 저장합니다.

`ko`와 `ko-KR`처럼 지역만 다른 언어는 동일하게 취급하되, 중국어 간체·번체는 구분합니다. 직접 붙여넣은 자막은 언어 정보가 없으므로 번역 단계를 거칩니다.

`src/prompts/translate.md`, `src/prompts/summarize.md`는 `../youtube_summarizer/app/prompts/`에서 가져온 원본입니다. 장르 판별과 공부 노트 작성 지침, `===GENRE===` 등 6개 섹션, 인사이트 목록 파싱을 유지했습니다. 실행 시 옆 저장소는 필요하지 않습니다. 영어 요약은 같은 구조를 유지하면서 출력 언어 지침을 추가합니다.

자동 자막의 생성 시점은 영상마다 다르며 하루 안에 생성된다는 보장은 없습니다. 자막이 없거나 불완전하면 음성 인식으로 넘어가지 않고 재시도·직접 입력을 안내합니다. 유튜브가 요청을 제한하거나 로그인·연령 제한을 요구하는 경우에도 **스크립트 / 자막** 입력을 사용할 수 있습니다. 이때 영상 정보를 가져오지 못하면 영상 ID를 제목으로 사용합니다.

자막 수집은 유튜브의 공개 플레이어 응답에 의존하므로 유튜브 측 변경이나 요청 제한에 영향을 받을 수 있습니다.

## 기타 설정

| 항목 | 설명 |
|------|------|
| 최대 입력 글자 수 | 기본 200,000자. 자막 또는 번역문이 넘으면 중단하며 임의로 자르지 않습니다 |
| 호출당 최대 출력 토큰 | 기본 65,536. 사용하는 모델이 지원하는 출력 한도 내에서 조정합니다 |
| 요약 언어 | 기본 한국어. UI 언어와 별도로 설정합니다 |
| YouTube Data API 키 | 구독 채널 등록·최신 영상 피드용입니다. URL 직접 요약에는 필요하지 않습니다 |
| 저장 폴더 / 구독 저장 폴더 | 일반 요약·피드 요약 저장 경로 |
| 채널별 폴더 / 그룹 | 채널별 저장 위치·피드 그룹 |
| 채널당 영상 수 | 최신 영상 1~10개 |

입력 글자 수는 토큰 수와 다르므로 모델의 컨텍스트 한도에 맞게 설정하세요. 번역·요약 응답이 출력 한도로 잘리면 노트를 저장하지 않습니다. 모델 요청의 대기 한도는 호출당 3분이며, Obsidian의 `requestUrl`은 네트워크 취소 API를 제공하지 않아 시간 초과 후에도 제공자 쪽 처리가 끝날 수 있습니다.

## 기존 버전에서 전환

기존 채널·폴더·그룹·요약 완료 기록은 유지합니다. 이전 서버 키도 이전 버전으로 돌아갈 때를 위해 보존하지만 새 요약 경로에서는 전송하지 않습니다. 업데이트 후 AI 제공자의 인증 정보와 모델을 설정하세요.

## 개발

```bash
npm run dev   # 변경 감지 빌드
npm test      # 자막·요약·인증·노트·피드 테스트
npm run build # 타입 검사 + 배포 번들
```

핵심 구현은 `YouTubeCaptionClient.ts`(자막), `AiModelClient.ts`(인증·모델 호출), `SummaryEngine.ts`(번역·요약 형식), `SummarizerService.ts`(노트 저장까지의 전체 흐름)에 있습니다.

## 라이선스

MIT
