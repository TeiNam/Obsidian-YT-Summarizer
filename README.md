# Obsidian YouTube Summarizer

![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg)
![Obsidian](https://img.shields.io/badge/Obsidian-1.5+-7C3AED.svg)
![AWS Bedrock](https://img.shields.io/badge/AWS-Bedrock-FF9900.svg)
![License](https://img.shields.io/badge/License-MIT-green.svg)

[![Buy Me A Coffee](https://img.shields.io/badge/Buy%20Me%20A%20Coffee-FFDD00?style=for-the-badge&logo=buy-me-a-coffee&logoColor=black)](https://qr.kakaopay.com/Ej74xpc815dc06149)

## 개요

유튜브 영상 URL을 입력하면 AI가 자동으로 요약 노트를 생성하는 옵시디언 플러그인입니다.
구독 채널의 최신 영상을 피드로 확인하고, 원클릭으로 요약 노트를 만들 수 있습니다.

## 주요 기능

- 유튜브 URL 입력 → AI 요약 노트 자동 생성 (YAML 프론트매터, 영상 임베딩 포함)
- 구독 채널 등록 및 최신 영상 피드
- 채널별 저장 폴더 지정
- 채널당 표시 영상 개수 설정 (1~10개)
- 한국어/영어 UI 지원
- 노트 파일명: `YY-MM-DD 영상제목.md` (업로드 날짜 기준)

## 설치

1. 이 저장소를 클론합니다
2. 의존성을 설치합니다

```bash
npm install
```

3. 빌드합니다

```bash
npm run build
```

4. 빌드 산출물(`main.js`, `manifest.json`, `styles.css`)을 옵시디언 Vault의 `.obsidian/plugins/obsidian-youtube-summarizer/` 폴더에 복사합니다

5. 옵시디언 설정 → 커뮤니티 플러그인에서 "YouTube Summarizer"를 활성화합니다

## 설정

| 항목 | 설명 |
|------|------|
| YouTube Summary API Key | 요약 API 인증 키 |
| YouTube Data API Key | 구독 피드용 YouTube Data API v3 키 |
| 저장 폴더 | 요약 노트 저장 경로 |
| 구독 저장 폴더 | 구독 피드 요약 노트 저장 경로 |
| 채널당 영상 수 | 피드에 표시할 최신 영상 개수 (1~10) |
| 언어 | UI 언어 (한국어/English) |

## 개발

```bash
# 개발 모드 (파일 변경 감지)
npm run dev

# 테스트 실행
npm test

# 타입 체크 + 프로덕션 빌드
npm run build
```

## 프로젝트 구조

```
src/
├── main.ts                  # 플러그인 진입점
├── models/types.ts          # 타입 정의
├── i18n/index.ts            # 다국어 지원 (한/영)
├── services/
│   ├── NoteCreator.ts       # 마크다운 노트 생성
│   ├── SummarizerService.ts # 요약 프로세스 오케스트레이션
│   ├── YouTubeSummaryApiClient.ts  # 요약 API 클라이언트
│   ├── YouTubeDataApiClient.ts     # YouTube Data API 클라이언트
│   └── SubscriptionManager.ts      # 구독 채널 관리
├── settings/
│   ├── SettingsTab.ts       # 설정 화면
│   └── FolderSuggest.ts     # 폴더 자동완성
├── utils/
│   └── YouTubeUrlValidator.ts  # URL 유효성 검증
└── views/
    ├── SidebarView.ts       # 사이드바 (URL 입력)
    └── FeedView.ts          # 구독 피드 뷰
```

## 라이선스

MIT
