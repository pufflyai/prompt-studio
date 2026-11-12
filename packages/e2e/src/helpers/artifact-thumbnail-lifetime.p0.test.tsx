import { expect, test } from "bun:test";
import { createWebviewClient } from "@pstdio/sdk/extensions";
import { ChakraProvider, psTheme } from "@pstdio/ui";
import { createElement } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { createArtifactQueries } from "../../../../extensions/pstdio-artifacts/src/artifact-queries";
import { ArtifactThumbnail } from "../../../../extensions/pstdio-artifacts/src/components/artifact-thumbnail";
import { ArtifactTranslations } from "../../../../extensions/pstdio-artifacts/src/translations";
import { createRetainedExtensionQueryFixture } from "./retained-extension-query.fixture";

test("hiding an Artifact thumbnail cancels its actual optional HTML read and rejects a late intersection callback", async () => {
  const keys = ["document", "IntersectionObserver", "IS_REACT_ACT_ENVIRONMENT"] as const;
  const original = new Map(keys.map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  const document = Object.assign(new EventTarget(), { hidden: false });
  const callbacks: ((entries: { isIntersecting: boolean }[]) => void)[] = [];
  let reads = 0;
  const entered = Promise.withResolvers<void>(),
    cancelled = Promise.withResolvers<void>();
  const transport = createRetainedExtensionQueryFixture({
    extensionId: "pstdio.pstdio-artifacts",
    execute: async (_command, signal) => {
      reads++;
      entered.resolve();
      await new Promise<void>((resolve) =>
        signal.addEventListener(
          "abort",
          () => {
            cancelled.resolve();
            resolve();
          },
          { once: true },
        ),
      );
      signal.throwIfAborted();
      return { html: "old preview" };
    },
  });
  const frame = transport.frame(),
    client = createWebviewClient(frame.host),
    queries = createArtifactQueries(client as never, "selected");
  let tree: ReactTestRenderer | undefined;
  try {
    Object.defineProperty(globalThis, "document", { configurable: true, value: document });
    Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", { configurable: true, value: true });
    Object.defineProperty(globalThis, "IntersectionObserver", {
      configurable: true,
      value: class {
        constructor(callback: (typeof callbacks)[number]) {
          callbacks.push(callback);
        }
        observe() {}
        disconnect() {}
      },
    });
    await act(async () => {
      tree = create(
        createElement(
          ChakraProvider,
          { value: psTheme },
          createElement(
            ArtifactTranslations.Provider,
            { value: { locale: "en", t: (_key: string, fallback?: string) => fallback ?? "" } },
            createElement(ArtifactThumbnail, {
              item: { artifactId: "a", revisionId: "r", title: "Page" } as never,
              loadPreview: queries.preview,
            }),
          ),
        ),
        { createNodeMock: () => ({}) },
      );
    });
    await act(async () => {
      callbacks[0]!([{ isIntersecting: true }]);
    });
    await entered.promise;
    await act(async () => {
      document.hidden = true;
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await Promise.race([
      cancelled.promise,
      new Promise<void>((_resolve, reject) =>
        setTimeout(() => reject(new Error("Hidden thumbnail kept its actual HTML read")), 100),
      ),
    ]);
    await act(async () => {
      callbacks[0]!([{ isIntersecting: true }]);
    });
    expect(reads).toBe(1);
    await act(async () => {
      document.hidden = false;
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(callbacks).toHaveLength(2);
  } finally {
    await act(async () => {
      tree?.unmount();
    });
    client.queries.dispose();
    transport.dispose();
    for (const key of keys) {
      const value = original.get(key);
      if (value) Object.defineProperty(globalThis, key, value);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
});
