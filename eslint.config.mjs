import { defineConfig, globalIgnores } from "eslint/config";
import obsidianmd from "eslint-plugin-obsidianmd";

// Obsidian 커뮤니티 디렉터리 심사 기준(eslint-plugin-obsidianmd)으로 제품 코드를 검사한다.
export default defineConfig([
  globalIgnores([
    "node_modules", "dist", "main.js", "esbuild.config.mjs", "eslint.config.mjs", "vitest.config.ts",
    // 테스트와 목 객체는 배포 번들에 들어가지 않는다.
    "src/**/*.test.ts", "src/__mocks__",
  ]),
  ...obsidianmd.configs.recommended,
  { languageOptions: { parserOptions: { projectService: true } } },
]);
