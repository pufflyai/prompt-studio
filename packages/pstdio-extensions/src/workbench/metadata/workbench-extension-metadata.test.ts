import { describe, expect, test } from "bun:test";
import {
  defineExtension,
  defineMode,
  defineNavigationItem,
  definePlacement,
  defineView,
  packageAsset,
  workbenchSlots,
} from "@pstdio/sdk/extensions";
import type { LoadedExtensionSource } from "../../runtime/loader";
import { normalizeExtensionSources } from "../../runtime/normalize";
import { createWorkbenchExtensionMetadata } from "./workbench-extension-metadata";

const source = (definition: LoadedExtensionSource["definition"]): LoadedExtensionSource => ({
  packagePath: "/fake/lab",
  sourcePath: "/fake/lab/extension.ts",
  sourceKind: "local_path",
  manifest: {
    id: "pstdio.lab",
    name: "lab",
    version: "1.0.0",
    publisher: "pstdio",
    main: "./extension.ts",
    enginesPstdio: "1.0.0-alpha.4",
  },
  definition,
});

describe("createWorkbenchExtensionMetadata", () => {
  test("publishes alpha.4 view, placement, and navigation arrays without renderer records", () => {
    const mode = defineMode({ id: "review", label: "Review" });
    const view = defineView({
      id: "tickets",
      title: "Tickets",
      path: "tickets",
      body: { kind: "webview", entry: packageAsset("./views/tickets.tsx", "file:///fake/lab/") },
    });
    const runtime = normalizeExtensionSources([
      source(
        defineExtension({
          modes: [mode],
          views: [view],
          placements: [
            definePlacement({
              id: "tickets.review",
              mode: mode.ref,
              item: { kind: "view", view: view.ref },
              region: "main",
              defaultOpen: true,
            }),
          ],
          navigationItems: [
            defineNavigationItem({
              id: "tickets",
              slot: workbenchSlots.projectNavigation,
              label: "Tickets",
              action: { kind: "view", view: view.ref },
            }),
          ],
        }),
      ),
    ]);

    const metadata = createWorkbenchExtensionMetadata({
      runtime,
      resolveWebview: ({ webview }) => ({
        ...webview,
        runtimeUrl: "/extension-assets/runtime.js",
        moduleUrl: "/extension-assets/tickets.js",
      }),
    });

    expect(metadata.views[0]).toMatchObject({
      id: "pstdio.lab.view.tickets",
      localId: "tickets",
      extensionId: "pstdio.lab",
      body: { kind: "webview" },
    });
    expect(metadata.placements[0]).toMatchObject({
      id: "pstdio.lab.placement.tickets.review",
      mode: { extensionId: "pstdio.lab", kind: "mode", id: "review" },
      item: { kind: "view", view: { extensionId: "pstdio.lab", kind: "view", id: "tickets" } },
    });
    expect(metadata.navigationItems[0]?.action).toEqual({
      kind: "view",
      view: { extensionId: "pstdio.lab", kind: "view", id: "tickets" },
    });
    expect(metadata).not.toHaveProperty("panels");
    expect(metadata).not.toHaveProperty("kanbanRenderers");
  });
});
