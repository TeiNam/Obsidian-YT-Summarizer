# YouTube LLM Summarizer

![TypeScript](https://img.shields.io/badge/TypeScript-6.0-blue.svg)
![Obsidian](https://img.shields.io/badge/Obsidian-1.13.2%2B-7C3AED.svg)
![AWS Bedrock](https://img.shields.io/badge/AWS-Bedrock-FF9900.svg)
![Vitest](https://img.shields.io/badge/Vitest-5.1-6E9F18.svg)
![GitHub Actions](https://img.shields.io/badge/GitHub%20Actions-CI/CD-2088FF.svg)
![License](https://img.shields.io/badge/License-MIT-green.svg)

[![Buy Me A Coffee](https://img.shields.io/badge/Buy%20Me%20A%20Coffee-FFDD00?style=for-the-badge&logo=buy-me-a-coffee&logoColor=black)](https://buymeacoffee.com/teinam)

[English](README.md) | [한국어](README-KR.md)

## 개요

유튜브 자막을 옵시디언에서 가져와 원하는 AI 모델로 번역·요약하고, 공부 노트를 생성합니다.
별도 YouTube Summary API 서버, Python, yt-dlp, 오디오 다운로드, AWS Transcribe 없이 동작합니다.

여기서 **로컬 처리**는 자막 수집과 요약 흐름을 플러그인이 직접 실행한다는 뜻입니다. 클라우드 모델을 선택하면 자막이 해당 AI 제공자에게 전송되며 사용 요금이 발생할 수 있습니다. Ollama·LM Studio 등의 OpenAI 호환 서버를 로컬 주소로 설정하면 모델 실행도 PC에서 처리할 수 있습니다.

## 주요 기능

- 자동·수동 자막 수집, 자막 직접 붙여넣기
- Bedrock AWS 프로필(IAM Roles Anywhere·SSO) 우선 인증, 실패 시 Bearer 토큰 폴백
- OpenAI 및 OpenAI 호환 서버, Anthropic Claude, Google Gemini 지원
- 타겟 언어 자막은 바로 요약, 다른 언어 자막은 번역 후 장르별 공부 노트 방식으로 요약
- 한줄 요약, 상세 내용, 핵심 인사이트, 키워드, 추가 탐색 주제
- 긴 자막 분할 번역, 입력 상한·응답 잘림 검사
- 여러 URL 순차 요약, 실패한 URL 보존 및 재시도
- 구독 채널 피드, 채널 그룹, 채널별 저장 폴더, 요약 완료 표시
- 한국어·영어 UI 및 별도 요약 언어 설정
- 요약 완료 후 노트 바로 열기, 구독 피드의 단계별 진행 표시, 벌크 요약 중단
- 사이드바 현황 패널: 사용 중인 AI 제공자·모델, 구독 피드 상태, 그룹·채널 수와 채널 목록
- API 키는 플러그인 데이터 파일이 아닌 Obsidian 비밀 저장소에 보관, Obsidian 설정 검색에서 설정 항목 검색 가능
- 설정의 연결 테스트로 인증·모델 확인 (Bedrock은 실제로 쓰인 인증 방식 표시)
- `YY-MM-DD 영상제목.md` 파일명, 업로드 날짜·영상 임베딩·YAML 프론트매터

## 설치

```bash
git clone https://github.com/TeiNam/obsidian-youtube-llm-summarizer.git
cd obsidian-youtube-llm-summarizer

# 의존성 설치
npm ci

# 테스트와 프로덕션 빌드
npm test
npm run build
```

`main.js`, `manifest.json`, `styles.css`를 볼트의 `.obsidian/plugins/youtube-llm-summarizer/`에 복사한 다음 플러그인을 활성화합니다. 이전 ID(`obsidian-youtube-summarizer`) 폴더로 설치했다면 그 폴더의 `data.json`을 새 폴더로 옮겨야 설정이 유지됩니다. AWS SDK와 요약 프롬프트는 `main.js`에 포함됩니다.

Obsidian 1.13.2 이상이 필요합니다. API 키 방식은 데스크톱·모바일에서 사용할 수 있습니다. **AWS 프로필·SSO는 Node.js 20 이상을 포함한 옵시디언 데스크톱 런타임이 필요합니다.** 런타임이 오래되었다면 옵시디언 설치 프로그램을 업데이트하세요.

## 사용법

왼쪽 리본의 유튜브 아이콘을 누르거나 명령 팔레트에서 **사이드바 열기**를 실행하면 사이드바가 열립니다. 탭은 Enter·Space와 좌우 화살표로도 전환할 수 있습니다.

### URL 요약 탭

- **단일 요약**: 유튜브 링크를 붙여넣고 Enter를 누르거나 **요약**을 누릅니다. 자막 추출 → 번역 → 요약 → 노트 생성 단계가 표시되고, 완료되면 **노트 열기** 링크로 만든 노트를 엽니다.
- **스크립트 / 자막**: 자막을 직접 붙여넣어 요약합니다. 유튜브에서 자막을 가져오지 못하면 이 영역이 자동으로 펼쳐집니다.
- **여러 개 한번에 요약**: 한 줄에 링크 하나씩 넣으면 순서대로 요약합니다. 진행 중에는 **현재 영상까지만 하고 중단**할 수 있고, 끝나면 실패한 링크별 사유를 보여줍니다. 실패·중단된 링크와 유튜브 링크가 아닌 줄은 입력란에 남습니다.
- **현황 패널**: 탭 아래에 현재 요약에 쓰는 AI 제공자와 모델, 구독 피드 상태(사용 가능 / YouTube Data API 키 필요 / 추가된 채널 없음), 그룹 수, 구독 채널 수와 채널 목록을 보여줍니다. 지금 설정으로 요약할 수 없으면 그 이유도 함께 표시하며, 설정을 저장하면 바로 갱신됩니다.

### 구독 피드 탭

설정에서 YouTube Data API 키를 넣고 채널을 추가하면 채널별 최신 영상이 그룹 단위로 표시됩니다. 영상 제목을 누르면 유튜브에서 열리고, **요약하기**를 누르면 진행 단계가 항목에 표시됩니다. 요약한 영상은 완료로 표시되며, 방금 만든 노트는 완료 표시를 눌러 엽니다. 채널을 불러오지 못하면 이유(API 키 오류 등)를 보여줍니다.

## 모델 설정

설정 → YouTube LLM Summarizer에서 AI 제공자와 모델 ID를 선택합니다. 인증값과 모델 ID는 제공자마다 따로 보관됩니다. 기존 요약 서버의 API 키는 AI 제공자 키로 사용할 수 없습니다.

| 제공자 | 필요한 설정 | 호출 방식 |
|------|------|------|
| Amazon Bedrock | AWS 리전, 모델 또는 추론 프로필 ID/ARN, AWS 프로필 이름과 Bedrock API 키 중 하나 이상 | 프로필이 있으면 AWS SDK 자격 증명 + SigV4, 없거나 자격 증명을 못 얻으면 Converse + Bearer 인증 |
| OpenAI / OpenAI 호환 | 기본 URL, 모델 ID, API 키 | Chat Completions |
| Anthropic Claude | 모델 ID, Anthropic API 키 | Messages |
| Google Gemini | 모델 ID, Gemini API 키 | generateContent |

모델 ID는 직접 입력할 수 있습니다. Bedrock의 기본 예시는 `us-east-1` / `us.anthropic.claude-sonnet-4-6`이며, 계정에서 접근 가능한 모델·추론 프로필과 리전을 지정해야 합니다.

**모델 불러오기**를 누르면 Bedrock에서는 Claude haiku·opus·sonnet 계열별 최신 버전만 가져와 설정에 저장합니다. 저장한 목록은 버튼을 다시 누를 때까지 그대로 사용하며, 목록이 있으면 드롭다운에서 고릅니다. 목록에 없는 모델·추론 프로필 ARN은 드롭다운의 **직접 입력...** 으로 넣습니다. 목록 조회에는 추론 프로필 또는 파운데이션 모델 목록 조회 권한 중 하나가 필요합니다.

**연결 테스트**는 현재 설정으로 짧은 요청을 보내 인증과 모델이 동작하는지 확인합니다. Bedrock은 AWS 프로필, Bearer 토큰, 프로필 실패 후 Bearer 폴백 중 무엇으로 연결됐는지 알려줍니다. 토큰을 소량 사용합니다.

### Bedrock 인증 순서

1. 데스크톱에서 **AWS 프로필**이 입력되어 있으면 그 프로필로 먼저 호출합니다.
2. 프로필이 비어 있거나, 모바일이거나, 프로필의 자격 증명을 불러오지 못하면 **Bedrock Bearer 토큰**으로 호출합니다.
3. 자격 증명은 받았지만 권한·모델 오류로 실패한 경우에는 Bearer로 넘어가지 않고 오류를 표시합니다.

프로필 실패로 Bearer 토큰을 쓰게 되면 알림으로 알려주고, 같은 요약 안에서는 프로필을 다시 시도하지 않습니다.

### Bedrock Bearer 토큰

Bedrock 콘솔에서 발급한 API 키를 비밀로 만들고 **Bedrock Bearer 토큰**에서 그 비밀을 선택합니다. `Bearer` 접두사는 생략할 수 있습니다. IAM 액세스 키 ID나 SSO 로그인 토큰을 넣는 곳은 아닙니다.

### AWS 프로필 (IAM Roles Anywhere·SSO)

IAM Roles Anywhere는 `~/.aws/config`에 `credential_process`로 `aws_signing_helper`를 지정한 프로필을 만들고 그 이름을 입력합니다. 헬퍼와 인증서 경로는 이 컴퓨터의 절대 경로여야 합니다.

SSO는 AWS CLI에서 사용할 프로필을 구성하고 로그인합니다.

```bash
# 이미 프로필이 있으면 구성 단계는 생략
aws configure sso --profile my-bedrock
aws sso login --profile my-bedrock
```

플러그인의 **AWS 프로필**에 `my-bedrock`을 입력합니다. SDK가 `~/.aws/config`와 SSO 캐시에서 자격 증명을 읽습니다. 기존 AWS 공유 프로필도 사용할 수 있습니다. 인증이 만료되면 같은 로그인 명령으로 갱신하세요.

프로필로 호출할 때는 인증 방식을 SigV4로 고정하므로, 환경변수에 남아 있는 `AWS_BEARER_TOKEN_BEDROCK`이 입력한 프로필을 대신 사용하지 않습니다.

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

API 키는 플러그인의 `data.json`이 아니라 Obsidian의 비밀 저장소에 보관합니다. 설정의 키 항목에서 비밀을 고르거나 새로 만들며, `data.json`에는 그 비밀의 이름만 저장됩니다. 비밀 저장소는 기기마다 따로이므로 다른 기기에서는 비밀을 다시 선택해야 합니다. AWS 프로필만 사용하면 플러그인 설정에는 프로필 이름만 저장하고 AWS 자격 증명은 기존 AWS 캐시에서 읽습니다.

이전 빌드가 `data.json`에 평문으로 저장한 키는 플러그인을 처음 로드할 때 비밀 저장소로 옮기고 파일에서 지웁니다.

## 네트워크와 볼트 밖 접근

- **네트워크**: 자막을 가져오기 위해 YouTube에, 번역·요약을 위해 선택한 AI 제공자(Amazon Bedrock, OpenAI 또는 지정한 호환 서버, Anthropic, Google Gemini)에 요청합니다. 구독 피드를 쓰면 YouTube Data API에도 요청합니다. 자막 본문이 선택한 AI 제공자에게 전송됩니다.
- **계정·요금**: AI 제공자의 계정과 API 키(또는 AWS 자격 증명)가 필요하며, 사용량에 따라 제공자 요금이 발생할 수 있습니다. 플러그인 자체는 무료입니다.
- **볼트 밖 파일**: Bedrock에 AWS 프로필을 입력한 경우에만(데스크톱) AWS SDK가 `~/.aws/config`, `~/.aws/credentials`, SSO 캐시를 읽고, 프로필에 `credential_process`가 있으면 그 명령(예: `aws_signing_helper`)을 실행합니다. 프로필을 비워 두면 볼트 밖 파일에 접근하지 않습니다.
- **후원 링크**: 설정 화면 맨 아래에 Buy Me a Coffee 후원 링크가 있습니다. 원격 이미지를 불러오지 않으며, 눌렀을 때만 브라우저에서 열립니다.
- **수집 없음**: 텔레메트리나 외부에서 불러오는 광고는 없습니다.

## 자막과 요약 흐름

1. 유튜브 페이지에서 제목·업로드 날짜와 자막 트랙을 가져옵니다.
2. 타겟 언어의 수동 자막과 자동 자막을 먼저 확인합니다. 사용할 수 있는 자막이 있으면 번역을 생략합니다.
3. 타겟 언어 자막이 없거나 불완전하면 기본 자막·자동 자막·나머지 트랙에서 대체 자막을 찾아 번역합니다. 긴 입력은 나누어 번역한 뒤 전체 번역문을 모읍니다.
4. 동일 언어 자막 원문 또는 전체 번역문에 장르별 요약 프롬프트를 한 번 적용합니다.
5. 정상적으로 완료된 결과만 노트로 저장합니다.

`ko`와 `ko-KR`처럼 지역만 다른 언어는 동일하게 취급하되, 중국어 간체·번체는 구분합니다. 직접 붙여넣은 자막은 언어 정보가 없으므로 번역 단계를 거칩니다.

번역·요약 프롬프트는 `src/prompts/`에 있으며 `main.js`에 함께 묶입니다. 장르를 판별하고 공부 노트 작성 지침에 따라 `===GENRE===` 등 6개 섹션을 만들며, 플러그인이 이를 파싱해 노트로 만듭니다. 한국어가 아닌 언어의 요약은 같은 구조를 유지하면서 출력 언어 지침을 추가합니다.

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
npm run lint  # Obsidian 플러그인 가이드라인 검사 (eslint-plugin-obsidianmd)
npm test      # 자막·요약·인증·노트·피드 테스트
npm run build # 타입 검사 + 배포 번들
```

`manifest.json`의 `version`과 같은 이름의 태그(예: `1.0.0`)를 푸시하면 GitHub Actions가 린트·테스트·빌드와 빌드 출처 증명 생성 후 `main.js`, `manifest.json`, `styles.css`를 릴리스 초안에 첨부합니다.

핵심 구현은 `YouTubeCaptionClient.ts`(자막), `AiModelClient.ts`(인증·모델 호출), `SummaryEngine.ts`(번역·요약 형식), `SummarizerService.ts`(노트 저장까지의 전체 흐름)에 있습니다.

## 라이선스

[MIT](LICENSE)
