import { afterEach, expect, test } from "bun:test";
import { Virtualizer } from "@tanstack/react-virtual";
import { observeLaidOutOffset } from "./observe-laid-out-offset";

const previousResizeObserver = globalThis.ResizeObserver;

afterEach(() => {
  globalThis.ResizeObserver = previousResizeObserver;
});

// A scroll element without a DOM: hiding removes its layout and reads its offset as 0, and its
// window runs timers only when the test advances them.
const createScrollElement = () => {
  const timers = new Map<number, () => void>();
  let nextTimer = 0;
  const layoutObservers = new Set<() => void>();
  const scrollListeners = new Set<() => void>();
  let laidOut = true;
  let offset = 0;
  const view = {
    setTimeout: (callback: () => void) => {
      timers.set(++nextTimer, callback);
      return nextTimer;
    },
    clearTimeout: (id: number) => timers.delete(id),
    requestAnimationFrame: () => 0,
    cancelAnimationFrame: () => {},
    ResizeObserver: class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  };
  globalThis.ResizeObserver = class {
    notify: () => void;
    constructor(notify: () => void) {
      this.notify = notify;
    }
    observe() {
      layoutObservers.add(this.notify);
    }
    unobserve() {}
    disconnect() {
      layoutObservers.delete(this.notify);
    }
  } as unknown as typeof ResizeObserver;
  const element = {
    ownerDocument: { defaultView: view },
    get scrollTop() {
      return laidOut ? offset : 0;
    },
    scrollLeft: 0,
    getClientRects: () => ({ length: laidOut ? 1 : 0 }),
    addEventListener: (type: string, listener: () => void) => {
      if (type === "scroll") scrollListeners.add(listener);
    },
    removeEventListener: (_type: string, listener: () => void) => scrollListeners.delete(listener),
    scrollTo: () => {},
  } as unknown as HTMLDivElement;
  const setLayout = (next: boolean) => {
    laidOut = next;
    for (const notify of layoutObservers) notify();
  };
  return {
    element,
    scroll: (top: number) => {
      offset = top;
      for (const listener of scrollListeners) listener();
    },
    deliverQueuedScroll: () => {
      for (const listener of scrollListeners) listener();
    },
    hide: () => setLayout(false),
    show: () => setLayout(true),
    runTimers: () => {
      for (const [id, callback] of [...timers]) {
        timers.delete(id);
        callback();
      }
    },
  };
};

test("a list shown after a scroll arrived while hidden keeps the reader's offset and range", () => {
  const scroller = createScrollElement();
  const virtualizer = new Virtualizer<HTMLDivElement, HTMLDivElement>({
    count: 100,
    estimateSize: () => 50,
    overscan: 0,
    getScrollElement: () => scroller.element,
    observeElementRect: (_instance, onRect) => onRect({ width: 300, height: 400 }),
    observeElementOffset: observeLaidOutOffset,
    scrollToFn: () => {},
  });
  const cleanup = virtualizer._didMount();
  virtualizer._willUpdate();

  scroller.scroll(2000);
  scroller.hide();
  // The browser delivers the scroll queued before hiding; the hidden element reads offset 0.
  scroller.deliverQueuedScroll();
  scroller.show();
  // The library's delayed scroll end then reports the offset stored by that hidden event.
  scroller.runTimers();

  expect(virtualizer.scrollOffset).toBe(2000);
  expect(virtualizer.isScrolling).toBe(false);
  expect(virtualizer.getVirtualItems()[0]?.index).toBe(40);
  cleanup();
});
