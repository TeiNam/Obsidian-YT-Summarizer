// Obsidian이 전역과 HTMLElement에 추가하는 DOM 헬퍼(createEl·createDiv·createSpan)를
// jsdom 테스트 환경에 흉내 낸다. 테스트가 직접 붙인 헬퍼가 있으면 그쪽이 우선한다.
interface ElementOptions {
  cls?: string | string[];
  text?: string;
  type?: string;
  placeholder?: string;
}

function makeEl(tag: string, options?: ElementOptions | string): HTMLElement {
  const el = document.createElement(tag);
  const info = typeof options === "string" ? { cls: options } : options;
  if (info?.cls) el.className = [info.cls].flat().join(" ");
  if (info?.text) el.textContent = info.text;
  if (info?.type) (el as HTMLInputElement).type = info.type;
  if (info?.placeholder) (el as HTMLInputElement).placeholder = info.placeholder;
  return el;
}

if (typeof HTMLElement !== "undefined") {
  const proto = HTMLElement.prototype as unknown as Record<string, unknown>;
  proto.createEl ??= function (this: HTMLElement, tag: string, options?: ElementOptions | string) {
    return this.appendChild(makeEl(tag, options));
  };
  proto.empty ??= function (this: HTMLElement) {
    this.replaceChildren();
  };
  proto.addClass ??= function (this: HTMLElement, ...classes: string[]) {
    this.classList.add(...classes);
  };
  for (const [name, tag] of [["createDiv", "div"], ["createSpan", "span"]] as const) {
    proto[name] ??= function (this: HTMLElement & { createEl: typeof makeEl }, options?: ElementOptions | string) {
      return this.createEl(tag, options);
    };
  }
  Object.assign(globalThis, {
    createEl: makeEl,
    createDiv: (options?: ElementOptions | string) => makeEl("div", options),
    createSpan: (options?: ElementOptions | string) => makeEl("span", options),
  });
}
