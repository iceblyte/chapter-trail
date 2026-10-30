/**
 * Minimal obsidian runtime stub for tests that import adapter modules
 * (the npm `obsidian` package ships types only). Aliased to "obsidian"
 * in vitest.config.ts.
 */
export class App {}
export class Notice {}

export class Modal {
  modalEl = document.createElement("div");
  titleEl = document.createElement("div");
  contentEl = document.createElement("div");
  closed = false;
  constructor(_app?: unknown) {
    this.modalEl.append(this.titleEl, this.contentEl);
  }
  open(): void {
    document.body.appendChild(this.modalEl);
    this.onOpen();
  }
  close(): void {
    this.closed = true;
    this.modalEl.remove();
    this.onClose();
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onOpen(): void {}
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onClose(): void {}
}

export class TFolder {}

export function parseYaml(_text: string): unknown {
  return null;
}

export function setIcon(el: HTMLElement, name: string): void {
  el.textContent = name;
}

/** the real API shows a styled tooltip on hover; the harness keeps a no-op */
export function setTooltip(_el: HTMLElement, _tooltip: string, _options?: unknown): void {}
