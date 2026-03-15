// ============================================================
// FolderSuggest - 볼트 폴더 자동완성 입력 컴포넌트
// AbstractInputSuggest를 상속하여 텍스트 입력 + 폴더 목록 자동완성 제공
// ============================================================

import { App, AbstractInputSuggest, TFolder } from "obsidian";

/**
 * 볼트 내 폴더를 자동완성으로 제안하는 입력 컴포넌트
 * 텍스트 입력도 가능하고, 볼트 폴더 목록에서 선택도 가능
 * onChange 콜백을 받아 선택 시 설정 저장을 트리거
 */
export class FolderSuggest extends AbstractInputSuggest<string> {
  private folders: string[];
  private onChangeCb: ((value: string) => void) | null;
  private inputEl: HTMLInputElement;

  constructor(app: App, inputEl: HTMLInputElement, onChange?: (value: string) => void) {
    super(app, inputEl);
    this.inputEl = inputEl;
    this.onChangeCb = onChange ?? null;
    // 볼트 내 모든 폴더 경로를 가져옴
    this.folders = [];
    try {
      const allFolders = this.app.vault.getAllFolders();
      for (const folder of allFolders) {
        if (folder.path) {
          this.folders.push(folder.path);
        }
      }
    } catch {
      // getAllFolders가 없는 환경에서는 빈 배열 유지
    }
    this.folders.sort();
  }

  /**
   * 입력값에 따라 폴더 목록을 필터링하여 제안
   */
  getSuggestions(inputStr: string): string[] {
    const inputLower = inputStr.toLowerCase();
    return this.folders.filter((folder) =>
      folder.toLowerCase().includes(inputLower)
    );
  }

  /**
   * 제안 항목 렌더링
   */
  renderSuggestion(folder: string, el: HTMLElement): void {
    el.setText(folder);
  }

  /**
   * 제안 항목 선택 시 입력값 업데이트 및 onChange 콜백 호출
   */
  selectSuggestion(folder: string): void {
    this.inputEl.value = folder;
    this.inputEl.trigger("input");
    // 명시적 onChange 콜백 호출 (설정 저장 트리거)
    if (this.onChangeCb) {
      this.onChangeCb(folder);
    }
    this.close();
  }
}
