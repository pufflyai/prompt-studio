import { describe, expect, test } from "bun:test";
import {
  defineExtension,
  defineNavigationItem,
  definePage,
  definePlacement,
  defineResourceKind,
  defineView,
  packageAsset,
  workbenchModes,
  workbenchPages,
} from "@pstdio/sdk/extensions";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";
import type { LoadedExtensionSource } from "../loader";
import { normalizeExtensionSources } from "./index";

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
    enginesPstdio: `^${EXTENSION_API_VERSION}`,
  },
  definition,
});
const pageView = defineView({
  id: "page",
  title: "Page",
  body: { kind: "webview", entry: packageAsset("./page.tsx", "file:///fake/lab/") },
});
const resourceView = defineView({
  id: "resource",
  title: "Resource",
  body: { kind: "webview", entry: packageAsset("./resource.tsx", "file:///fake/lab/") },
});
const ticketKind = defineResourceKind({
  id: "ticket",
});
const diagnosticsFor = (definition: LoadedExtensionSource["definition"]) =>
  normalizeExtensionSources([source(definition)]).diagnostics;
test.each(["pin", "preview"] as const)("collection resource viewers accept %s page navigation", (open) => {
  const viewer = definePlacement({
    id: "viewer",
    mode: workbenchModes.project,
    region: "main",
    item: { kind: "binding", binding: { kinds: [ticketKind.ref], view: resourceView.ref, cardinality: "many" } },
  });
  const page = definePage({
    id: "resource",
    title: "Resource",
    path: "resource",
    mode: workbenchModes.project,
    parent: workbenchPages.start,
    resource: { kinds: [ticketKind.ref] },
    main: { kind: "panels", landing: viewer.ref },
    slots: [],
  });
  const navigation = defineNavigationItem({
    id: "open",
    owner: workbenchModes.project,
    label: "Open",
    action: { kind: "page", page: page.ref, resource: { type: "ticket", id: "one" }, open },
  });
  expect(
    diagnosticsFor(
      defineExtension({
        views: [resourceView],
        resourceKinds: [ticketKind],
        pages: [page],
        placements: [viewer],
        navigationItems: [navigation],
      }),
    ),
  ).toEqual([]);
});
test("declarative links keep accepting page slots replaced by independent placements", () => {
  const page = definePage({
    id: "library",
    title: "Library",
    path: "library",
    mode: workbenchModes.project,
    main: { kind: "panels" },
    slots: [],
  });
  const legacy = { kind: "page-slot" as const, page: page.ref, id: "list" };
  const placement = definePlacement({
    id: "list",
    mode: workbenchModes.project,
    region: "side",
    replaces: [legacy],
    item: { kind: "view", view: pageView.ref, presence: "closed" },
  });
  const diagnostics = diagnosticsFor(
    defineExtension({
      views: [pageView],
      pages: [page],
      placements: [placement],
      navigationItems: [
        defineNavigationItem({
          id: "direct",
          owner: workbenchModes.project,
          label: "List",
          action: { kind: "panel", panel: legacy },
        }),
        defineNavigationItem({
          id: "compound",
          owner: workbenchModes.project,
          label: "Library",
          action: {
            kind: "compound",
            targets: [
              { kind: "page", page: page.ref },
              { kind: "panel", panel: legacy },
            ],
          },
        }),
      ],
    }),
  );
  expect(diagnostics.filter((diagnostic) => diagnostic.severity === "error")).toEqual([]);
});
describe("page target validation", () => {
  test("validates page and panel targets against their exact destination", () => {
    const page = definePage({
      id: "tickets",
      title: "Tickets",
      path: "tickets",
      mode: workbenchModes.project,
      parent: workbenchPages.start,
      resource: {
        kinds: [ticketKind.ref],
      },
      main: {
        kind: "view",
        view: resourceView.ref,
        cardinality: "one",
      },
      slots: [
        {
          id: "files",
          region: "side",
          item: {
            kind: "view",
            view: pageView.ref,
            presence: "open",
          },
        },
      ],
    });
    const navigationItems = [
      defineNavigationItem({
        id: "bad-page-kind",
        owner: workbenchModes.project,
        slot: "content",
        label: "Bad page",
        action: { kind: "page", page: page.ref, resource: { type: "run", id: "run-1" } },
      }),
      defineNavigationItem({
        id: "bad-panel-resource",
        owner: workbenchModes.project,
        slot: "content",
        label: "Bad panel",
        action: { kind: "panel", panel: page.panels.files, resource: { type: "ticket", id: "PS-1" } },
      }),
    ];
    const diagnostics = diagnosticsFor(
      defineExtension({ views: [pageView, resourceView], resourceKinds: [ticketKind], pages: [page], navigationItems }),
    );
    expect(diagnostics.filter((diagnostic) => diagnostic.code === "extension_page_target_invalid")).toHaveLength(1);
    expect(diagnostics.filter((diagnostic) => diagnostic.code === "extension_panel_target_invalid")).toHaveLength(1);
  });
  test("accepts host pages and rejects a resource their primary slot does not bind", () => {
    const navigationItems = [
      defineNavigationItem({
        id: "workspace",
        owner: workbenchModes.project,
        slot: "content",
        label: "Workspace",
        action: { kind: "page", page: workbenchPages.workspace, resource: { type: "workspace", id: "ws-1" } },
      }),
      defineNavigationItem({
        id: "bad-workspace",
        owner: workbenchModes.project,
        slot: "content",
        label: "Bad workspace",
        action: { kind: "page", page: workbenchPages.workspace, resource: { type: "ticket", id: "PS-1" } },
      }),
    ];
    const diagnostics = diagnosticsFor(defineExtension({ navigationItems }));
    expect(diagnostics.filter((diagnostic) => diagnostic.code === "extension_page_target_invalid")).toHaveLength(1);
  });
  test("accepts compound page and panel targets in declaration order", () => {
    const page = definePage({
      id: "tickets",
      title: "Tickets",
      path: "tickets",
      mode: workbenchModes.project,
      main: {
        kind: "view",
        view: pageView.ref,
        cardinality: "one",
      },
      slots: [
        {
          id: "files",
          region: "side",
          item: {
            kind: "view",
            view: pageView.ref,
            presence: "open",
          },
        },
      ],
    });
    const navigationItem = defineNavigationItem({
      id: "bad-order",
      owner: workbenchModes.project,
      slot: "content",
      label: "Bad order",
      action: {
        kind: "compound",
        targets: [
          { kind: "panel", panel: page.panels.files },
          { kind: "page", page: page.ref },
        ],
      },
    });
    const diagnostics = diagnosticsFor(
      defineExtension({ views: [pageView], pages: [page], navigationItems: [navigationItem] }),
    );
    expect(diagnostics.filter((diagnostic) => diagnostic.code === "extension_navigation_target_invalid")).toHaveLength(
      0,
    );
  });
});

test("a foreign replacement cannot validate another extension's missing page slot", () => {
  const page = definePage({
    id: "library",
    title: "Library",
    path: "library",
    mode: workbenchModes.project,
    main: { kind: "panels" },
    slots: [],
  });
  const legacy = { kind: "page-slot" as const, page: { ...page.ref, extensionId: "pstdio.lab" }, id: "list" };
  const owner = source(
    defineExtension({
      pages: [page],
      navigationItems: [
        defineNavigationItem({
          id: "list",
          owner: workbenchModes.project,
          label: "List",
          action: { kind: "panel", panel: legacy },
        }),
      ],
    }),
  );
  const foreign = source(
    defineExtension({
      views: [pageView],
      placements: [
        definePlacement({
          id: "foreign",
          mode: workbenchModes.project,
          region: "side",
          replaces: [legacy],
          item: { kind: "view", view: pageView.ref, presence: "closed" },
        }),
      ],
    }),
  );
  foreign.manifest = { ...foreign.manifest, id: "pstdio.foreign", name: "foreign" };
  expect(
    normalizeExtensionSources([owner, foreign]).diagnostics.some(
      (entry) => entry.code === "extension_panel_target_invalid",
    ),
  ).toBe(true);
});
