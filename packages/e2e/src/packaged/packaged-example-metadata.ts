import { expect } from "bun:test";
import type { WorkbenchExtensionMetadata } from "pstdio-api-contracts";

export const expectExamplePages = (metadata: WorkbenchExtensionMetadata) => {
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
        main: { kind: "view", view: expect.any(Object), cardinality: "one" },
        slots: [],
      }),
    );
    expect(metadata.pages).toContainEqual(
      expect.objectContaining({
        extensionId: "pstdio.extension-lab",
        localId: `${name}-resource`,
        parent: { extensionId: "pstdio.extension-lab", kind: "page", id: name },
        resource: { kinds: [expect.any(Object)] },
        main: { kind: "view", view: expect.any(Object), cardinality: "one" },
      }),
    );
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
