import { describe, expect, test } from "bun:test";
import {
  defineExtension,
  defineNavigationItem,
  definePage,
  defineResourceKind,
  defineView,
  packageAsset,
  workbenchModes,
  workbenchPages,
  workbenchSlots,
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
    enginesPstdio: EXTENSION_API_VERSION,
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
  surface: "primary",
  slots: [{ id: "primary", cardinality: "one", access: "owner" }],
});

const diagnosticsFor = (definition: LoadedExtensionSource["definition"]) =>
  normalizeExtensionSources([source(definition)]).diagnostics;

describe("page target validation", () => {
  test("validates page and panel targets against their exact destination", () => {
    const page = definePage({
      id: "tickets",
      title: "Tickets",
      path: "tickets",
      mode: workbenchModes.project,
      slots: [
        { id: "ticket", role: "primary", region: "main", binding: { kind: ticketKind.ref, view: resourceView.ref } },
        { id: "files", role: "auxiliary", region: "side", view: pageView.ref },
      ],
    });
    const navigationItems = [
      defineNavigationItem({
        id: "bad-page-kind",
        slot: workbenchSlots.projectNavigation,
        label: "Bad page",
        action: { kind: "page", page: page.ref, resource: { type: "run", id: "run-1" } },
      }),
      defineNavigationItem({
        id: "bad-panel-resource",
        slot: workbenchSlots.projectNavigation,
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
        slot: workbenchSlots.projectNavigation,
        label: "Workspace",
        action: { kind: "page", page: workbenchPages.workspaces, resource: { type: "workspace", id: "ws-1" } },
      }),
      defineNavigationItem({
        id: "bad-workspace",
        slot: workbenchSlots.projectNavigation,
        label: "Bad workspace",
        action: { kind: "page", page: workbenchPages.workspaces, resource: { type: "ticket", id: "PS-1" } },
      }),
    ];

    const diagnostics = diagnosticsFor(defineExtension({ navigationItems }));

    expect(diagnostics.filter((diagnostic) => diagnostic.code === "extension_page_target_invalid")).toHaveLength(1);
  });

  test("requires a compound page target to come before its panel targets", () => {
    const page = definePage({
      id: "tickets",
      title: "Tickets",
      path: "tickets",
      mode: workbenchModes.project,
      slots: [
        { id: "ticket", role: "primary", region: "main", view: pageView.ref },
        { id: "files", role: "auxiliary", region: "side", view: pageView.ref },
      ],
    });
    const navigationItem = defineNavigationItem({
      id: "bad-order",
      slot: workbenchSlots.projectNavigation,
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
      1,
    );
  });
});
