import { expect, test } from "bun:test";
import { createWebviewClient, viewDataEvents } from "@pstdio/sdk/extensions";
import { ChakraProvider, psTheme } from "@pstdio/ui";
import { HomeApp } from "home/testing";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { createRetainedExtensionQueryFixture } from "./retained-extension-query.fixture";

test("Home snapshot updates do not query agent quotas", async () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, "IS_REACT_ACT_ENVIRONMENT");
  const originalDocument = Object.getOwnPropertyDescriptor(globalThis, "document"),
    originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const originalObserver = Object.getOwnPropertyDescriptor(globalThis, "IntersectionObserver");
  const originalFrame = Object.getOwnPropertyDescriptor(globalThis, "requestAnimationFrame");
  const originalCancelFrame = Object.getOwnPropertyDescriptor(globalThis, "cancelAnimationFrame");
  const frames = new Map<number, ReturnType<typeof setTimeout>>();
  let quotas = 0,
    home = 0;
  const transport = createRetainedExtensionQueryFixture({
    extensionId: "pstdio.pstdio-home",
    execute: async (command) => {
      if (command.commandId.endsWith(".quotas")) {
        quotas++;
        return [];
      }
      if (command.commandId.endsWith(".read")) {
        home++;
        return { project: { name: `Home ${home}` }, setupError: null };
      }
      return [];
    },
  });
  const frame = transport.frame();
  let tree: ReactTestRenderer | undefined;
  try {
    Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", { configurable: true, value: true });
    Object.defineProperty(globalThis, "document", {
      configurable: true,
      value: Object.assign(new EventTarget(), {
        hidden: false,
        nodeType: 9,
        defaultView: globalThis,
        getElementById: () => null,
      }),
    });
    Object.defineProperty(globalThis, "window", { configurable: true, value: globalThis });
    Object.defineProperty(globalThis, "requestAnimationFrame", {
      configurable: true,
      value: (callback: FrameRequestCallback) => {
        const timer = setTimeout(() => {
          frames.delete(Number(timer));
          callback(performance.now());
        }, 0);
        frames.set(Number(timer), timer);
        return Number(timer);
      },
    });
    Object.defineProperty(globalThis, "cancelAnimationFrame", {
      configurable: true,
      value: (id: number) => {
        clearTimeout(frames.get(id));
        frames.delete(id);
      },
    });
    Object.defineProperty(globalThis, "IntersectionObserver", {
      configurable: true,
      value: class {
        observe() {}
        disconnect() {}
      },
    });
    const context = { host: frame.host, propsStore: frame.host.propsStore } as never;
    await act(async () => {
      tree = create(
        <ChakraProvider value={psTheme}>
          <HomeApp context={context} />
        </ChakraProvider>,
      );
    });
    expect(home).toBe(1);
    expect(quotas).toBe(0);
    await act(async () => {
      transport.emit(viewDataEvents.projectsChanged.id);
    });
    expect(home).toBe(2);
    expect(quotas).toBe(0);
  } finally {
    await act(async () => {
      tree?.unmount();
    });
    createWebviewClient(frame.host).queries.dispose();
    transport.dispose();
    for (const timer of frames.values()) clearTimeout(timer);
    if (originalFrame) Object.defineProperty(globalThis, "requestAnimationFrame", originalFrame);
    else Reflect.deleteProperty(globalThis, "requestAnimationFrame");
    if (originalCancelFrame) Object.defineProperty(globalThis, "cancelAnimationFrame", originalCancelFrame);
    else Reflect.deleteProperty(globalThis, "cancelAnimationFrame");
    if (originalDocument) Object.defineProperty(globalThis, "document", originalDocument);
    else Reflect.deleteProperty(globalThis, "document");
    if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow);
    else Reflect.deleteProperty(globalThis, "window");
    if (originalObserver) Object.defineProperty(globalThis, "IntersectionObserver", originalObserver);
    else Reflect.deleteProperty(globalThis, "IntersectionObserver");
    if (original) Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", original);
    else Reflect.deleteProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT");
  }
});
