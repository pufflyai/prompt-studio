import { describe, expect, test } from "bun:test";
import type { WorkbenchExtensionMetadata } from "@pstdio/sdk/api";
import { createWorkbenchCore } from "../../core";
import {
  refreshOpenWorkbenchExtensionWebviews,
  refreshWorkbenchExtensionContributions,
  shouldRefreshWorkbenchExtensionTrees,
} from "./workbench-extension-refresh";

const webview = {
  entry: { kind: "package-asset" as const, baseUrl: "file:///extension.ts", path: "./panel.tsx" },
  moduleUrl: "/panel.js",
  runtimeUrl: "/runtime.html",
};

const metadata = {
  commands: [],
  kanbanRenderers: [],
  diagnostics: [],
  extensions: [],
  menuContributions: [],
  modes: [],
  navigation: [],
  routes: [
    {
      id: "extension-lab.labPage",
      extensionId: "pstdio.extension-lab",
      label: "Lab",
      path: "lab",
      webview,
    },
    {
      id: "extension-lab.faultyPage",
      extensionId: "pstdio.extension-lab",
      label: "Lab (faulty)",
      path: "lab-faulty",
      webview,
    },
  ],
  settingsDefinitions: [],
  settingsPanels: [],
  treeItems: [],
  treeRenderers: [
    {
      bodyHandlerId: "ticket-files.tree.body",
      childrenHandlerId: "ticket-files.tree.children",
      extensionId: "pstdio.pstdio-planner",
      footerHandlerId: "ticket-files.tree.footer",
      id: "ticket-files",
      title: "Files",
    },
  ],
  panels: [
    {
      id: "extension-lab.labSidenav",
      extensionId: "pstdio.extension-lab",
      title: "Lab sidenav",
      region: "sidenav",
      closable: false,
      webview,
    },
  ],
} satisfies WorkbenchExtensionMetadata;

const kanbanRendererMetadata = {
  ...metadata,
  treeRenderers: [],
  kanbanRenderers: [
    {
      id: "planner.tickets",
      extensionId: "pstdio.pstdio-planner",
      title: "Tickets",
      resourceKind: "ticket",
      attributes: [],
      queryHandlerId: "planner.tickets.query",
    },
  ],
} satisfies WorkbenchExtensionMetadata;

describe("shouldRefreshWorkbenchExtensionTrees", () => {
  test("does not refresh tree renderers after tree query commands", () => {
    expect(shouldRefreshWorkbenchExtensionTrees(metadata, "ticket-files.tree.body")).toBe(false);
    expect(shouldRefreshWorkbenchExtensionTrees(metadata, "ticket-files.tree.children")).toBe(false);
    expect(shouldRefreshWorkbenchExtensionTrees(metadata, "ticket-files.tree.footer")).toBe(false);
  });

  test("refreshes tree renderers after extension mutation commands", () => {
    expect(shouldRefreshWorkbenchExtensionTrees(metadata, "tickets.file.rename")).toBe(true);
  });
});

describe("refreshOpenWorkbenchExtensionWebviews", () => {
  test("refreshes only already-open webview routes and panels while preserving the active widget", () => {
    const workbench = createWorkbenchCore();
    workbench.layout.registerPanel({
      closable: false,
      id: "extension-lab.labPage",
      title: "Old route",
      region: "main",
      rendererId: "webview:bridge",
    });
    workbench.layout.registerPanel({
      closable: false,
      id: "extension-lab.faultyPage",
      title: "Faulty",
      region: "main",
      rendererId: "webview:bridge",
    });
    workbench.layout.registerPanel({
      closable: false,
      id: "extension-lab.labSidenav",
      title: "Old sidenav",
      region: "sidenav",
      rendererId: "webview:bridge",
    });

    workbench.layout.openPanel("extension-lab.labPage", { title: "Old route" });
    workbench.layout.openPanel("extension-lab.labSidenav", { title: "Old sidenav" });
    workbench.layout.activatePanel("extension-lab.labPage");

    refreshOpenWorkbenchExtensionWebviews(workbench, metadata);

    const layout = workbench.layout.getLayout();
    expect(layout.activeWidgetId).toBe("extension-lab.labPage");
    expect(layout.regions.main.widgets).toHaveLength(1);
    expect(workbench.layout.listPanelInstances("main")[0]).toMatchObject({
      panelId: "extension-lab.labPage",
      title: "Lab",
    });
    expect(workbench.layout.listPanelInstances("sidenav")[0]).toMatchObject({
      panelId: "extension-lab.labSidenav",
      title: "Lab sidenav",
    });
  });
});

describe("refreshWorkbenchExtensionContributions", () => {
  test("refreshes tree renderers after non-query extension commands", () => {
    const workbench = createWorkbenchCore();
    const refreshed: string[] = [];
    workbench.renderers.registerTreeRenderer({
      id: "ticket-files",
      title: "Files",
      getBody: () => [],
      getChildren: () => [],
    });
    workbench.renderers.onDidRefresh((event) => refreshed.push(event.treeId));

    refreshWorkbenchExtensionContributions(workbench, metadata, "tickets.file.rename");

    expect(refreshed).toEqual(["ticket-files"]);
  });

  test("skips tree renderer refresh after tree query commands", () => {
    const workbench = createWorkbenchCore();
    const refreshed: string[] = [];
    workbench.renderers.registerTreeRenderer({
      id: "ticket-files",
      title: "Files",
      getBody: () => [],
      getChildren: () => [],
    });
    workbench.renderers.onDidRefresh((event) => refreshed.push(event.treeId));

    refreshWorkbenchExtensionContributions(workbench, metadata, "ticket-files.tree.body");

    expect(refreshed).toEqual([]);
  });

  test("refreshes kanban renderers after extension mutation commands", () => {
    const workbench = createWorkbenchCore();
    const refreshed: string[] = [];
    workbench.renderers.registerKanbanRenderer({
      id: "planner.tickets",
      title: "Tickets",
      attributes: [],
      executeQuery: () => [],
    });
    workbench.renderers.onDidRefreshKanbanRenderer((event) => refreshed.push(event.kanbanRendererId));

    refreshWorkbenchExtensionContributions(workbench, kanbanRendererMetadata, "planner.create-ticket");

    expect(refreshed).toEqual(["planner.tickets"]);
  });

  test("skips kanban renderer refresh after data query commands", () => {
    const workbench = createWorkbenchCore();
    const refreshed: string[] = [];
    workbench.renderers.registerKanbanRenderer({
      id: "planner.tickets",
      title: "Tickets",
      attributes: [],
      executeQuery: () => [],
    });
    workbench.renderers.onDidRefreshKanbanRenderer((event) => refreshed.push(event.kanbanRendererId));

    refreshWorkbenchExtensionContributions(workbench, kanbanRendererMetadata, "planner.tickets.query");

    expect(refreshed).toEqual([]);
  });
});
