import { expect, test } from "bun:test";
import { createWebviewClient, viewDataEvents } from "@pstdio/sdk/extensions";
import { ChakraProvider, psTheme } from "@pstdio/ui";
import { HomeApp } from "pstdio-home/testing";
import { createElement } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { createRetainedExtensionQueryFixture } from "./retained-extension-query.fixture";

test("Home snapshot updates preserve the quota owner while its actual command is held", async () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, "IS_REACT_ACT_ENVIRONMENT");
  const originalDocument = Object.getOwnPropertyDescriptor(globalThis, "document"),
    originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const held = Promise.withResolvers<unknown[]>();
  let quotas = 0,
    home = 0;
  const transport = createRetainedExtensionQueryFixture({
    extensionId: "pstdio.pstdio-home",
    execute: async (command) => {
      if (command.commandId.endsWith(".quotas")) {
        quotas++;
        return held.promise;
      }
      if (command.commandId.endsWith(".read")) {
        home++;
        return { project: { name: "Home " + home }, setupError: null };
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
    const context = { host: frame.host, propsStore: frame.host.propsStore } as never;
    await act(async () => {
      tree = create(
        createElement(ChakraProvider, { value: psTheme }, createElement(HomeApp, { context, projectId: "selected" })),
      );
    });
    expect(home).toBe(1);
    expect(quotas).toBe(1);
    await act(async () => {
      transport.emit(viewDataEvents.projectsChanged.id);
    });
    expect(home).toBe(2);
    expect(quotas).toBe(1);
    held.resolve([]);
    await act(async () => {
      await held.promise;
    });
    expect(quotas).toBe(1);
  } finally {
    held.resolve([]);
    await act(async () => {
      tree?.unmount();
    });
    createWebviewClient(frame.host).queries.dispose();
    transport.dispose();
    if (originalDocument) Object.defineProperty(globalThis, "document", originalDocument);
    else Reflect.deleteProperty(globalThis, "document");
    if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow);
    else Reflect.deleteProperty(globalThis, "window");
    if (original) Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", original);
    else Reflect.deleteProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT");
  }
});
