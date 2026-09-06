import { describe, expect, test } from "bun:test";
import {
  defineCommand,
  defineConnection,
  defineExtension,
  defineMode,
  defineNavigationItem,
  defineNavigationTree,
  definePage,
  definePlacement,
  defineResourceKind,
  defineView,
  packageAsset,
  workbenchModes,
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
    const mode = defineMode({ id: "review", label: "Review", regions: ["main", "side"] });
    const open = defineCommand({ id: "open", title: "Open", run: async () => undefined });
    const runKind = defineResourceKind({ id: "run" });
    const view = defineView({
      id: "tickets",
      title: "Tickets",
      body: { kind: "webview", entry: packageAsset("./views/tickets.tsx", "file:///fake/lab/") },
    });
    const page = definePage({
      id: "tickets",
      title: "Tickets",
      path: "tickets",
      mode: mode.ref,
      main: {
        kind: "view",
        view: view.ref,
        cardinality: "one",
        mountStrategy: "keep-mounted",
        tab: {
          query: async () => ({ label: "Current ticket" }),
          refreshEvents: [{ kind: "event", id: "command.completed:open" }],
        },
      },
      slots: [],
    });
    const runtime = normalizeExtensionSources([
      source(
        defineExtension({
          commands: [open],
          modes: [mode],
          pages: [page],
          views: [view],
          resourceKinds: [runKind],
          placements: [
            definePlacement({
              id: "tickets.review",
              mode: mode.ref,
              item: { kind: "view", view: view.ref, presence: "open" },
              region: "main",
              tab: {
                query: async () => ({ label: "Tickets" }),
                refreshEvents: [{ kind: "event", id: "command.completed:open" }],
              },
            }),
            definePlacement({
              id: "runs.review",
              mode: mode.ref,
              item: {
                kind: "binding",
                binding: {
                  kinds: [runKind.ref],
                  view: view.ref,
                  cardinality: "many",
                  add: { kind: "command", target: { command: open.ref, params: { source: "placement" } } },
                },
              },
              region: "side",
            }),
          ],
          navigationItems: [
            defineNavigationItem({
              id: "tickets",
              owner: workbenchModes.project,
              slot: "content",
              label: "Tickets",
              action: { kind: "page", page: page.ref },
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
      item: {
        kind: "view",
        view: { extensionId: "pstdio.lab", kind: "view", id: "tickets" },
        presence: "open",
      },
      tab: {
        queryHandlerId: "pstdio.lab.placement.tickets.review.tab.query",
        refreshEventIds: ["command.completed:pstdio.lab.command.open"],
      },
    });
    expect(metadata.placements[1]).toMatchObject({
      id: "pstdio.lab.placement.runs.review",
      item: {
        kind: "binding",
        binding: {
          cardinality: "many",
          add: {
            kind: "command",
            target: {
              command: { extensionId: "pstdio.lab", kind: "command", id: "open" },
              params: { source: "placement" },
            },
          },
        },
      },
    });
    expect(metadata.pages[0]?.main).toMatchObject({
      mountStrategy: "keep-mounted",
      tab: {
        queryHandlerId: "pstdio.lab.page.tickets.$main.tab.query",
        refreshEventIds: ["command.completed:pstdio.lab.command.open"],
      },
    });
    expect(metadata.navigationItems[0]?.action).toEqual({
      kind: "page",
      page: { extensionId: "pstdio.lab", kind: "page", id: "tickets" },
    });
    expect(metadata).not.toHaveProperty("panels");
    expect(metadata).not.toHaveProperty("kanbanRenderers");
  });
});
describe("createWorkbenchExtensionMetadata pages", () => {
  test("publishes pages and keeps page and panel targets explicit", () => {
    const view = defineView({
      id: "tickets",
      title: "Tickets",
      body: { kind: "webview", entry: packageAsset("./views/tickets.tsx", "file:///fake/lab/") },
    });
    const page = definePage({
      id: "tickets",
      title: "Tickets",
      path: "tickets",
      mode: workbenchModes.project,
      main: {
        kind: "panels",
        empty: view.ref,
      },
      slots: [
        {
          id: "tools",
          region: "side",
          item: {
            kind: "view",
            view: view.ref,
            presence: "open",
          },
        },
      ],
    });
    const runtime = normalizeExtensionSources([
      source(
        defineExtension({
          views: [view],
          pages: [page],
          navigationItems: [
            defineNavigationItem({
              id: "tickets",
              owner: workbenchModes.project,
              slot: "content",
              label: "Tickets",
              action: {
                kind: "compound",
                targets: [
                  { kind: "page", page: page.ref },
                  { kind: "panel", panel: page.panels.tools },
                ],
              },
            }),
          ],
        }),
      ),
    ]);
    const metadata = createWorkbenchExtensionMetadata({ runtime, resolveWebview: () => null });
    expect(metadata.pages[0]).toMatchObject({
      id: "pstdio.lab.page.tickets",
      mode: { extensionId: "pstdio", kind: "mode", id: "project" },
      main: {
        kind: "panels",
        empty: { extensionId: "pstdio.lab", kind: "view", id: "tickets" },
      },
      slots: [
        {
          id: "tools",
          region: "side",
          item: { kind: "view", presence: "open", view: { extensionId: "pstdio.lab", kind: "view", id: "tickets" } },
        },
      ],
    });
    expect(metadata.navigationItems[0]?.action).toEqual({
      kind: "compound",
      targets: [
        { kind: "page", page: { extensionId: "pstdio.lab", kind: "page", id: "tickets" } },
        {
          kind: "panel",
          panel: {
            kind: "page-slot",
            page: { extensionId: "pstdio.lab", kind: "page", id: "tickets" },
            id: "tools",
          },
        },
      ],
    });
  });
  test("publishes page-owned navigation trees with normalized refs", () => {
    const tree = defineView({
      id: "files",
      title: "Files",
      body: { kind: "tree", body: async () => [] },
    });
    const page = definePage({
      id: "ticket",
      title: "Ticket",
      path: "ticket",
      mode: workbenchModes.project,
      main: {
        kind: "view",
        view: tree.ref,
        cardinality: "one",
      },
      slots: [],
    });
    const runtime = normalizeExtensionSources([
      source(
        defineExtension({
          views: [tree],
          pages: [page],
          navigationTrees: [defineNavigationTree({ id: "files", owner: page.ref, slot: "footer", view: tree.ref })],
        }),
      ),
    ]);
    const metadata = createWorkbenchExtensionMetadata({ runtime, resolveWebview: () => null });
    expect(metadata.navigationTrees).toEqual([
      {
        id: "pstdio.lab.navigation-tree.files",
        extensionId: "pstdio.lab",
        owner: { extensionId: "pstdio.lab", kind: "page", id: "ticket" },
        slot: "footer",
        view: { extensionId: "pstdio.lab", kind: "view", id: "files" },
      },
    ]);
  });
});
