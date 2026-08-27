import { describe, expect, test } from "bun:test";
import {
  defineConnection,
  defineExtension,
  defineMode,
  defineNavigationItem,
  definePlacement,
  defineResourceKind,
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
  test("publishes resource menu slot declarations", () => {
    const resourceKind = defineResourceKind({
      id: "note",
      surface: "primary",
      menuSlots: [
        { id: "headerPrimary", placement: "header-primary", access: "owner", order: 20 },
        { id: "context", placement: "context-menu", access: "public" },
      ],
    });
    const runtime = normalizeExtensionSources([source(defineExtension({ resourceKinds: [resourceKind] }))]);

    const metadata = createWorkbenchExtensionMetadata({ runtime, resolveWebview: () => null });

    expect(metadata.resourceKinds[0]?.menuSlots).toEqual([
      { id: "headerPrimary", placement: "header-primary", access: "owner", order: 20 },
      { id: "context", placement: "context-menu", access: "public" },
    ]);
  });

  test("publishes named connection settings metadata without credentials", () => {
    const connection = defineConnection({
      id: "control-plane",
      label: "Control plane",
      transport: "http",
      auth: { type: "bearer" },
      allowedMethods: ["GET"],
      allowedPathPrefixes: ["/v1/workspaces"],
      check: { method: "GET", path: "/v1/workspaces/health" },
    });
    const runtime = normalizeExtensionSources([source(defineExtension({ connections: [connection] }))]);

    const metadata = createWorkbenchExtensionMetadata({ runtime, resolveWebview: () => null });

    expect(metadata.connections).toEqual([
      {
        id: "pstdio.lab.connection.control-plane",
        localId: "control-plane",
        extensionId: "pstdio.lab",
        label: "Control plane",
        authType: "bearer",
        supportsCheck: true,
      },
    ]);
  });

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
