import { describe, expect, test } from "bun:test";
import type { WorkbenchExtensionMetadata } from "@pstdio/sdk/api";
import { createWorkbenchCore } from "../../core";
import {
  refreshOpenWorkbenchExtensionWebviews,
  refreshWorkbenchExtensionContributions,
  shouldRefreshWorkbenchExtensionTrees,
} from "./workbench-extension-refresh";

const webview = {
  entry: { kind: "package-asset" as const, baseUrl: "file:///extension.ts", path: "./view.tsx" },
  moduleUrl: "/view.js",
  runtimeUrl: "/runtime.html",
};

const metadata = {
  commands: [],
  dataRenderers: [],
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
      bodyCommandId: "ticket-files.tree.body",
      childrenCommandId: "ticket-files.tree.children",
      extensionId: "pstdio.pstdio-planner",
      footerCommandId: "ticket-files.tree.footer",
      id: "ticket-files",
      title: "Files",
    },
  ],
  views: [
    {
      id: "extension-lab.labSidebar",
      extensionId: "pstdio.extension-lab",
      slotId: "workbench.left",
      title: "Lab sidebar",
      webview,
    },
  ],
} satisfies WorkbenchExtensionMetadata;

const dataRendererMetadata = {
  ...metadata,
  treeRenderers: [],
  dataRenderers: [
    {
      id: "planner.tickets",
      extensionId: "pstdio.pstdio-planner",
      title: "Tickets",
      resourceKind: "ticket",
      attributes: [],
      queryCommandId: "planner.query-tickets",
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
  test("refreshes only already-open webview routes and views while preserving the active widget", () => {
    const workbench = createWorkbenchCore();
    workbench.layout.registerWidget({
      id: "extension-lab.labPage",
      title: "Old route",
      region: "main",
      rendererId: "webview:bridge",
    });
    workbench.layout.registerWidget({
      id: "extension-lab.faultyPage",
      title: "Faulty",
      region: "main",
      rendererId: "webview:bridge",
    });
    workbench.layout.registerWidget({
      id: "extension-lab.labSidebar",
      title: "Old sidebar",
      region: "sidebar",
      rendererId: "webview:bridge",
    });

    workbench.layout.openWidget("extension-lab.labPage", { title: "Old route" });
    workbench.layout.openWidget("extension-lab.labSidebar", { title: "Old sidebar" });
    workbench.layout.activateWidget("extension-lab.labPage");

    refreshOpenWorkbenchExtensionWebviews(workbench, metadata);

    const layout = workbench.layout.getLayout();
    expect(layout.activeWidgetId).toBe("extension-lab.labPage");
    expect(layout.regions.main.widgets).toHaveLength(1);
    expect(layout.regions.main.widgets[0]).toMatchObject({ contributionId: "extension-lab.labPage", title: "Lab" });
    expect(layout.regions.sidebar.widgets[0]).toMatchObject({
      contributionId: "extension-lab.labSidebar",
      title: "Lab sidebar",
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

  test("refreshes data renderers after extension mutation commands", () => {
    const workbench = createWorkbenchCore();
    const refreshed: string[] = [];
    workbench.renderers.registerDataRenderer({
      id: "planner.tickets",
      title: "Tickets",
      attributes: [],
      executeQuery: () => [],
    });
    workbench.renderers.onDidRefreshDataRenderer((event) => refreshed.push(event.dataRendererId));

    refreshWorkbenchExtensionContributions(workbench, dataRendererMetadata, "planner.create-ticket");

    expect(refreshed).toEqual(["planner.tickets"]);
  });

  test("skips data renderer refresh after data query commands", () => {
    const workbench = createWorkbenchCore();
    const refreshed: string[] = [];
    workbench.renderers.registerDataRenderer({
      id: "planner.tickets",
      title: "Tickets",
      attributes: [],
      executeQuery: () => [],
    });
    workbench.renderers.onDidRefreshDataRenderer((event) => refreshed.push(event.dataRendererId));

    refreshWorkbenchExtensionContributions(workbench, dataRendererMetadata, "planner.query-tickets");

    expect(refreshed).toEqual([]);
  });
});
