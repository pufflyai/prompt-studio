import { expect } from "bun:test";
import type { WorkbenchExtensionMetadata } from "pstdio-api-contracts";

export const expectExamplePages = (metadata: WorkbenchExtensionMetadata) => {
  expect(metadata.modes.find((mode) => mode.localId === "boombox")).toMatchObject({ canFullscreen: false });
  expect(metadata.pages).toContainEqual(
    expect.objectContaining({
      localId: "scribble-draft",
      parent: { extensionId: "pstdio.extension-lab", kind: "page", id: "scribble" },
      resource: { kinds: [expect.objectContaining({ id: "scribble.draft" })] },
      main: expect.objectContaining({ kind: "panels", landing: expect.any(Object) }),
    }),
  );
  for (const [mode, view] of [
    ["boombox", "boombox-player"],
    ["kiln", "kiln-timeline"],
  ]) {
    expect(metadata.placements).toContainEqual(
      expect.objectContaining({
        mode: { extensionId: "pstdio.extension-lab", kind: "mode", id: mode },
        item: {
          kind: "view",
          view: { extensionId: "pstdio.extension-lab", kind: "view", id: view },
          presence: "fixed",
        },
      }),
    );
  }
  for (const name of ["scribble", "boombox", "zipline", "pigeon", "kiln"]) {
    expect(metadata.modes).toContainEqual(
      expect.objectContaining({
        localId: name,
        defaultTheme: { extensionId: "pstdio.extension-lab", kind: "theme", id: name },
      }),
    );
    expect(metadata.themes).toContainEqual(expect.objectContaining({ localId: name }));
    expect(metadata.pages).toContainEqual(
      expect.objectContaining({
        extensionId: "pstdio.extension-lab",
        localId: name,
        main:
          name === "scribble"
            ? { kind: "panels" }
            : expect.objectContaining({ kind: "view", view: expect.any(Object), cardinality: "one" }),
      }),
    );
    if (name === "scribble" || name === "zipline")
      expect(metadata.pages).toContainEqual(
        expect.objectContaining({
          extensionId: "pstdio.extension-lab",
          localId: `${name}-resource`,
          parent: { extensionId: "pstdio.extension-lab", kind: "page", id: name },
          resource: { kinds: [expect.any(Object)] },
          main:
            name === "scribble"
              ? expect.objectContaining({ kind: "panels", landing: expect.any(Object) })
              : expect.objectContaining({ kind: "view", view: expect.any(Object), cardinality: "one" }),
        }),
      );
  }
  for (const name of ["boombox", "pigeon", "kiln"]) {
    expect(metadata.pages.find((page) => page.localId === name)?.main).toMatchObject({ presentation: "page" });
  }
  expect(metadata.views).toContainEqual(
    expect.objectContaining({
      localId: "pigeon-reader",
      body: expect.objectContaining({
        kind: "webview",
        webview: expect.objectContaining({ capabilities: expect.arrayContaining(["placement.close"]) }),
      }),
    }),
  );
};
