import { expect, test } from "bun:test";
import { observeContentHeight } from "./observe-content-height";

test("clipped status popovers can report newly mounted content before resize delivery", () => {
  const originalResize = globalThis.ResizeObserver;
  const originalMutation = globalThis.MutationObserver;
  let onMutation: (() => void) | undefined;
  const mount = { style: {}, getBoundingClientRect: () => ({ height: 153.5 }) } as HTMLElement;
  const reports: number[] = [];
  try {
    globalThis.ResizeObserver = class {
      observe() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;
    globalThis.MutationObserver = class {
      constructor(callback: () => void) {
        onMutation = callback;
      }
      observe() {}
      disconnect() {
        onMutation = undefined;
      }
    } as unknown as typeof MutationObserver;
    const stopSettings = observeContentHeight(mount, (height) => reports.push(height), "content-height");
    expect(onMutation).toBeUndefined();
    stopSettings();
    const stopPopover = observeContentHeight(mount, (height) => reports.push(height), "bounded-height");
    onMutation?.();
    onMutation?.();
    expect(reports).toEqual([154]);
    stopPopover();
    expect(onMutation).toBeUndefined();
  } finally {
    globalThis.ResizeObserver = originalResize;
    globalThis.MutationObserver = originalMutation;
  }
});
