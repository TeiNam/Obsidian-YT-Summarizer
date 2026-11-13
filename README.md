# YouTube LLM Summarizer

![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue.svg)
![Obsidian](https://img.shields.io/badge/Obsidian-1.5%2B-7C3AED.svg)
![AWS Bedrock](https://img.shields.io/badge/AWS-Bedrock-FF9900.svg)
![Vitest](https://img.shields.io/badge/Vitest-1.6-6E9F18.svg)
![GitHub Actions](https://img.shields.io/badge/GitHub%20Actions-CI/CD-2088FF.svg)
![License](https://img.shields.io/badge/License-MIT-green.svg)

[![Buy Me A Coffee](https://img.shields.io/badge/Buy%20Me%20A%20Coffee-FFDD00?style=for-the-badge&logo=buy-me-a-coffee&logoColor=black)](https://buymeacoffee.com/teinam)

[English](README.md) | [한국어](README-KR.md)

## Overview

Fetch YouTube captions inside Obsidian, translate and summarize them with the AI model of your choice, and save the result as a study note.
It works without a separate summary server, Python, yt-dlp, audio downloads, or speech-to-text.

**Local processing** here means the plugin itself collects the captions and runs the summary flow. If you pick a cloud model, the captions are sent to that AI provider and usage fees may apply. Point an OpenAI-compatible server such as Ollama or LM Studio at a local address to run the model on your own machine as well.

## Features

- Automatic and manual caption collection, or paste a transcript yourself
- Amazon Bedrock with AWS profile authentication first (IAM Roles Anywhere, SSO), falling back to a Bearer token
- OpenAI and OpenAI-compatible servers, Anthropic Claude, Google Gemini
- Captions already in the target language are summarized directly; other languages are translated first, then summarized as a genre-aware study note
- One-line summary, details, key insights, keywords, and topics for further exploration
- Chunked translation for long captions, with input limits and truncation checks
- Sequential bulk summaries that keep failed links for retry
- Subscription feed with channel groups, per-channel save folders, and a "summarized" marker
- English and Korean UI, with a separate summary language setting
- Open the note right after a summary, per-stage progress in the feed, and a stop button for bulk runs
- Sidebar status panel: current AI provider and model, feed status, group and channel counts, and the channel list
- Connection test in settings to verify authentication and the model (Bedrock reports which authentication was actually used)
- `YY-MM-DD Video title.md` file names, upload date, embedded video, and YAML frontmatter

## Installation

```bash
git clone https://github.com/TeiNam/obsidian-youtube-llm-summarizer.git
cd obsidian-youtube-llm-summarizer

# Install dependencies
npm ci

# Test and build for production
npm test
npm run build
```

Copy `main.js`, `manifest.json`, and `styles.css` into `.obsidian/plugins/youtube-llm-summarizer/` in your vault, then enable the plugin. If you installed it under the previous ID (`obsidian-youtube-summarizer`), move that folder's `data.json` into the new folder to keep your settings. The AWS SDK and the summary prompts are bundled into `main.js`.

API key authentication works on desktop and mobile. **AWS profile and SSO authentication require the Obsidian desktop runtime with Node.js 20 or later.** If your runtime is older, update Obsidian with the latest installer.

## Usage

Click the YouTube icon in the left ribbon to open the sidebar. You can also switch tabs with Enter, Space, and the left and right arrow keys.

### URL summary tab

- **Single summary**: Paste a YouTube link and press Enter or click **Summarize**. The view shows each stage (extracting captions → translating → summarizing → creating the note), and when it finishes, the **Open note** link opens the new note.
- **Script / transcript**: Paste a transcript to summarize it directly. This section opens automatically when the captions cannot be fetched from YouTube.
- **Bulk summarize (multiple links)**: Enter one link per line and they are summarized in order. While it runs you can **Stop after current video**, and when it ends you see the reason for each failed link. Failed or unprocessed links and lines that are not YouTube links stay in the input.
- **Status panel**: Below the tab you see the AI provider and model used for summaries, the subscription feed status (Ready / YouTube Data API key required / No channels added), the number of groups, the number of channels, and the channel list. If the current settings cannot run a summary, the reason is shown here too. The panel refreshes whenever settings are saved.

### Subscription feed tab

Add a YouTube Data API key and channels in settings to see each channel's latest videos, organized by group. Click a video title to open it on YouTube, or click **Summarize** to summarize it with the progress stage shown on the item. Summarized videos are marked as complete, and you can click the marker to open a note created in the current session. If the channels cannot be loaded, the reason (such as an invalid API key) is shown.

## Model settings

Choose the AI provider and model ID under Settings → YouTube LLM Summarizer. Credentials and model IDs are stored separately for each provider. The API key of the old summary server cannot be used as an AI provider key.

| Provider | Required settings | How it is called |
|------|------|------|
| Amazon Bedrock | AWS region, model or inference profile ID/ARN, and at least one of an AWS profile name or a Bedrock API key | AWS SDK credentials + SigV4 when a profile is set; Converse + Bearer authentication when there is no profile or its credentials cannot be loaded |
| OpenAI / OpenAI-compatible | Base URL, model ID, API key | Chat Completions |
| Anthropic Claude | Model ID, Anthropic API key | Messages |
| Google Gemini | Model ID, Gemini API key | generateContent |

You can type a model ID directly. The default Bedrock example is `us-east-1` / `us.anthropic.claude-sonnet-4-6`; set a region and a model or inference profile that your account can access.

**Load models** fetches the list for the current provider. For Bedrock it keeps only the latest version of each Claude family (haiku, opus, sonnet) and saves the list in settings. The saved list is used until you load it again, and is shown as a dropdown. Use **Enter manually...** in the dropdown for a model or inference profile ARN that is not in the list. Listing requires permission to list either inference profiles or foundation models.

**Connection test** sends a short request with the current settings to check authentication and the model. For Bedrock it tells you whether the AWS profile, the Bearer token, or the Bearer token after a profile failure was used. It consumes a few tokens.

### Bedrock authentication order

1. On desktop, if **AWS profile** is set, the plugin calls Bedrock with that profile first.
2. If the profile is empty, the app is running on mobile, or the profile's credentials cannot be loaded, it calls Bedrock with the **Bedrock Bearer token**.
3. If credentials were obtained but the call fails with a permission or model error, it does not fall back to the Bearer token and shows the error.

When the plugin falls back to the Bearer token it shows a notice, and it does not retry the profile again within the same summary.

### Bedrock Bearer token

Enter the API key issued in the Bedrock console in **Bedrock Bearer token**. The `Bearer` prefix is optional. This field is not for an IAM access key ID or an SSO login token.

### AWS profile (IAM Roles Anywhere, SSO)

For IAM Roles Anywhere, create a profile in `~/.aws/config` that sets `credential_process` to `aws_signing_helper`, and enter its name. The helper and certificate paths must be absolute paths on this computer.

For SSO, configure a profile with the AWS CLI and sign in.

```bash
# Skip the configure step if the profile already exists
aws configure sso --profile my-bedrock
aws sso login --profile my-bedrock
```

Enter `my-bedrock` in the plugin's **AWS profile** field. The SDK reads credentials from `~/.aws/config` and the SSO cache. Existing shared AWS profiles also work. When the session expires, renew it with the same login command.

Calls made with a profile are pinned to SigV4, so an `AWS_BEARER_TOKEN_BEDROCK` environment variable left in your environment cannot take the place of the profile you entered.

### OpenAI-compatible servers and local models

Enter the base URL including `/v1`.

| Server | Example base URL | Model ID / API key |
|------|------|------|
| OpenAI | `https://api.openai.com/v1` | An available model ID / OpenAI API key |
| Ollama | `http://localhost:11434/v1` | The name of an installed model / key optional |
| LM Studio | `http://localhost:1234/v1` | A model ID served by the server / key optional |
| Other compatible servers | The provider's HTTPS base URL | That provider's model ID / API key |

HTTP is allowed only for `localhost`, `127.0.0.1`, and `[::1]`. Any other address requires HTTPS and an API key. Changing the base URL sends the current OpenAI-compatible key to the new address, so check the address and the key together.

### Key storage

API keys are stored in plain text in `.obsidian/plugins/youtube-llm-summarizer/data.json` in your vault. The eye icon only hides the value on screen. Vault sync and backups may include this file. If you use only an AWS profile, the plugin settings store just the profile name, and AWS credentials are read from the existing AWS cache.

## Network use and access outside the vault

- **Network**: The plugin sends requests to YouTube to fetch captions and to the AI provider you select (Amazon Bedrock, OpenAI or the compatible server you configure, Anthropic, Google Gemini) to translate and summarize. The subscription feed also calls the YouTube Data API. The caption text is sent to the selected AI provider.
- **Accounts and fees**: You need an account and an API key (or AWS credentials) for the AI provider, and the provider may charge for usage. The plugin itself is free.
- **Files outside the vault**: Only when an AWS profile is set for Bedrock (desktop), the AWS SDK reads `~/.aws/config`, `~/.aws/credentials`, and the SSO cache, and runs the profile's `credential_process` command (for example `aws_signing_helper`) if it has one. With the profile left empty, the plugin does not access files outside the vault.
- **Sponsor link**: The bottom of the settings screen has a Buy Me a Coffee link. It loads no remote image and opens in your browser only when you click it.
- **No tracking**: There is no telemetry and no ads loaded from the internet.

## Captions and summary flow

1. The plugin reads the title, upload date, and caption tracks from the YouTube page.
2. It checks manual and automatic captions in the target language first. If usable captions exist, translation is skipped.
3. If target-language captions are missing or incomplete, it looks for a substitute among the default, automatic, and remaining tracks and translates it. Long input is translated in chunks and then joined.
4. The genre-aware summary prompt is applied once to the same-language captions or to the full translation.
5. Only results that complete normally are saved as notes.

Languages that differ only by region, such as `ko` and `ko-KR`, are treated as the same, while Simplified and Traditional Chinese are kept distinct. A pasted transcript has no language information, so it goes through the translation step.

The translation and summary prompts live in `src/prompts/` and are bundled into `main.js`. They detect the genre, follow study-note instructions, and produce six sections such as `===GENRE===` that the plugin parses into the note. Summaries in languages other than Korean keep the same structure with an added output-language instruction.

When automatic captions appear varies by video, and there is no guarantee they are generated within a day. If captions are missing or incomplete, the plugin does not fall back to speech recognition; it tells you to retry or paste a transcript. You can also use **Script / transcript** when YouTube throttles requests or requires login or age verification. If the video information cannot be fetched in that case, the video ID is used as the title.

Caption collection depends on YouTube's public player response, so it can be affected by changes on YouTube's side or by request limits.

## Other settings

| Setting | Description |
|------|------|
| Maximum input characters | Default 200,000. If the captions or translation exceed it, the run stops; text is never silently cut |
| Maximum output tokens per call | Default 65,536. Adjust within the output limit your model supports |
| Summary language | Default Korean. Set independently of the UI language |
| YouTube Data API key | For adding channels and the latest-video feed. Not needed to summarize a URL directly |
| Save folder / Subscription save folder | Where regular and feed summaries are saved |
| Channel save folder / Group | Per-channel save location and feed group |
| Videos per channel | The latest 1–10 videos |

The input character count is not a token count, so set it to fit your model's context window. If a translation or summary response is cut off by the output limit, no note is saved. Each model request waits up to 3 minutes; Obsidian's `requestUrl` has no network cancellation API, so the provider may still finish processing after a timeout.

## Migrating from earlier versions

Existing channels, folders, groups, and summarized-video records are kept. The old server key is also preserved in case you go back to an earlier version, but it is never sent on the new summary path. After updating, set the AI provider's credentials and model.

## Development

```bash
npm run dev   # Watch build
npm test      # Caption, summary, authentication, note, and feed tests
npm run build # Type check + release bundle
```

Pushing a tag with the same name as `version` in `manifest.json` (for example `1.0.0`) makes GitHub Actions run the tests, build, and attach `main.js`, `manifest.json`, and `styles.css` to a draft release.

The core implementation lives in `YouTubeCaptionClient.ts` (captions), `AiModelClient.ts` (authentication and model calls), `SummaryEngine.ts` (translation and summary format), and `SummarizerService.ts` (the whole flow through saving the note).

## License

[MIT](LICENSE)
