// ============================================================
// obsidian 모듈 모킹
// 테스트 환경에서 obsidian 패키지를 대체하기 위한 모킹 모듈
// ============================================================

export function requestUrl(_options: unknown): Promise<{ text: string; status: number; json: unknown }> {
  return Promise.resolve({ text: "", status: 200, json: {} });
}

/**
 * addIcon 모킹 - 커스텀 아이콘 등록
 */
export function addIcon(_iconId: string, _svgContent: string): void {}

/**
 * TFile 모킹 - 옵시디언 파일 객체
 */
export class TFile {
  path: string;
  name: string;
  basename: string;
  extension: string;

  constructor(path = "") {
    this.path = path;
    this.name = path.split("/").pop() ?? "";
    this.basename = this.name.replace(/\.[^.]+$/, "");
    this.extension = "md";
  }
}

/**
 * TFolder 모킹 - 옵시디언 폴더 객체
 */
export class TFolder {
  path: string;
  name: string;

  constructor(path = "") {
    this.path = path;
    this.name = path.split("/").pop() ?? "";
  }
}

/**
 * TAbstractFile 모킹 - 옵시디언 추상 파일 객체
 */
export class TAbstractFile {
  path: string;
  name: string;

  constructor(path = "") {
    this.path = path;
    this.name = path.split("/").pop() ?? "";
  }
}

/**
 * Vault 모킹 - 옵시디언 볼트 API
 */
export class Vault {
  async create(_path: string, _data: string): Promise<TFile> {
    return new TFile(_path);
  }

  async createFolder(_path: string): Promise<void> {
    return;
  }

  getAbstractFileByPath(_path: string): TAbstractFile | null {
    return null;
  }
}

/**
 * App 모킹 - 옵시디언 앱 객체
 */
export class App {
  vault: Vault;
  workspace: Workspace;

  constructor() {
    this.vault = new Vault();
    this.workspace = new Workspace();
  }
}

/**
 * WorkspaceLeaf 모킹 - 옵시디언 워크스페이스 리프
 */
export class WorkspaceLeaf {
  async setViewState(_state: any): Promise<void> {}
  async openFile(_file: TFile): Promise<void> {}
}

/**
 * ItemView 모킹 - 옵시디언 아이템 뷰 기본 클래스
 */
export class ItemView {
  leaf: WorkspaceLeaf;
  containerEl: HTMLElement;
  contentEl: HTMLElement;

  constructor(leaf: WorkspaceLeaf) {
    this.leaf = leaf;
    // 테스트 환경에서 DOM 요소 생성
    if (typeof document !== "undefined") {
      this.containerEl = document.createElement("div");
      this.contentEl = document.createElement("div");
      this.containerEl.appendChild(this.contentEl);
    } else {
      this.containerEl = {} as HTMLElement;
      this.contentEl = {} as HTMLElement;
    }
  }

  getViewType(): string {
    return "";
  }
  getDisplayText(): string {
    return "";
  }
  async onOpen(): Promise<void> {}
  async onClose(): Promise<void> {}
}

/**
 * Modal 모킹 - 옵시디언 모달 다이얼로그 기본 클래스
 */
export class Modal {
  app: App;
  contentEl: HTMLElement;
  modalEl: HTMLElement;

  constructor(app: App) {
    this.app = app;
    if (typeof document !== "undefined") {
      this.modalEl = document.createElement("div");
      this.contentEl = document.createElement("div");
      this.modalEl.appendChild(this.contentEl);
      // 옵시디언 DOM 헬퍼 패치
      (this.contentEl as any).empty = function () { this.innerHTML = ""; };
      (this.contentEl as any).addClass = function (cls: string) { this.classList.add(cls); };
      (this.contentEl as any).createEl = function (tag: string, opts?: any) {
        const el = document.createElement(tag);
        if (opts?.text) el.textContent = opts.text;
        if (opts?.cls) el.classList.add(opts.cls);
        (el as any).empty = function () { this.innerHTML = ""; };
        (el as any).addClass = function (cls: string) { this.classList.add(cls); };
        (el as any).createEl = (this.contentEl as any)?.createEl?.bind(el) ?? function () { return document.createElement("div"); };
        (el as any).createDiv = function (o?: any) {
          const d = document.createElement("div");
          if (o?.cls) d.classList.add(o.cls);
          (d as any).createEl = (el as any).createEl;
          (d as any).createDiv = (d as any).createDiv;
          this.appendChild(d);
          return d;
        };
        this.appendChild(el);
        return el;
      };
      (this.contentEl as any).createDiv = function (opts?: any) {
        const div = document.createElement("div");
        if (opts?.cls) div.classList.add(opts.cls);
        (div as any).createEl = (this as any).createEl?.bind(div);
        (div as any).createDiv = (this as any).createDiv?.bind(div);
        this.appendChild(div);
        return div;
      };
    } else {
      this.modalEl = {} as HTMLElement;
      this.contentEl = {} as HTMLElement;
    }
  }

  open(): void {}
  close(): void {}
  onOpen(): void {}
  onClose(): void {}
}

/**
 * Notice 모킹 - 옵시디언 알림 표시
 */
export class Notice {
  message: string;
  constructor(message: string, _timeout?: number) {
    this.message = message;
  }
}

/**
 * Workspace 모킹 - 옵시디언 워크스페이스
 */
export class Workspace {
  getLeavesOfType(_type: string): WorkspaceLeaf[] {
    return [];
  }
  getRightLeaf(_split: boolean): WorkspaceLeaf | null {
    return new WorkspaceLeaf();
  }
  revealLeaf(_leaf: WorkspaceLeaf): void {}
  getLeaf(_newLeaf?: boolean): WorkspaceLeaf {
    return new WorkspaceLeaf();
  }
}

/**
 * Plugin 모킹 - 옵시디언 플러그인 기본 클래스
 */
export class Plugin {
  app: App;
  manifest: any;
  private _registeredViews: Map<string, any> = new Map();
  private _ribbonIcons: any[] = [];
  private _settingTabs: any[] = [];

  constructor(app?: App, manifest?: any) {
    this.app = app ?? new App();
    this.manifest = manifest ?? {};
  }
  async loadData(): Promise<any> {
    return null;
  }
  async saveData(_data: any): Promise<void> {}
  registerView(type: string, viewCreator: (leaf: WorkspaceLeaf) => any): void {
    this._registeredViews.set(type, viewCreator);
  }
  addRibbonIcon(_icon: string, _title: string, _callback: () => void): HTMLElement {
    const el = typeof document !== "undefined" ? document.createElement("div") : {} as HTMLElement;
    this._ribbonIcons.push({ icon: _icon, title: _title, callback: _callback });
    return el;
  }
  addSettingTab(_tab: any): void {
    this._settingTabs.push(_tab);
  }
}

/**
 * PluginSettingTab 모킹 - 옵시디언 설정 탭 기본 클래스
 */
export class PluginSettingTab {
  app: App;
  containerEl: HTMLElement;

  constructor(app: App, _plugin: any) {
    this.app = app;
    if (typeof document !== "undefined") {
      this.containerEl = document.createElement("div");
      // 옵시디언의 empty() 메서드 모킹
      (this.containerEl as any).empty = function () {
        this.innerHTML = "";
      };
    } else {
      this.containerEl = {} as HTMLElement;
    }
  }

  display(): void {}
}

/**
 * Setting 모킹 - 옵시디언 설정 UI 빌더
 * 체이닝 패턴을 지원하는 설정 항목 생성기
 */
export class Setting {
  private settingEl: HTMLElement;

  constructor(containerEl: HTMLElement) {
    if (typeof document !== "undefined") {
      this.settingEl = document.createElement("div");
      containerEl.appendChild(this.settingEl);
    } else {
      this.settingEl = {} as HTMLElement;
    }
  }

  setName(_name: string): this {
    return this;
  }
  setDesc(_desc: string): this {
    return this;
  }
  addText(cb: (text: any) => any): this {
    const text = {
      setPlaceholder: () => text,
      setValue: () => text,
      onChange: () => text,
      inputEl:
        typeof document !== "undefined"
          ? document.createElement("input")
          : {},
    };
    cb(text);
    return this;
  }
  addTextArea(cb: (textArea: any) => any): this {
    const textArea = {
      setPlaceholder: () => textArea,
      setValue: () => textArea,
      onChange: () => textArea,
      inputEl:
        typeof document !== "undefined"
          ? document.createElement("textarea")
          : {},
    };
    cb(textArea);
    return this;
  }
  addDropdown(cb: (dropdown: any) => any): this {
    const dropdown = {
      addOption: () => dropdown,
      setValue: () => dropdown,
      onChange: () => dropdown,
    };
    cb(dropdown);
    return this;
  }
  addButton(cb: (button: any) => any): this {
    const button = {
      setButtonText: () => button,
      setCta: () => button,
      onClick: (fn: () => void) => {
        button._onClick = fn;
        return button;
      },
      _onClick: null as (() => void) | null,
    };
    cb(button);
    return this;
  }
}

