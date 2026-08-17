import { describe, expect, test } from "bun:test";
import type { WorkbenchExtensionMetadata } from "@pstdio/sdk/api";
import { createWorkbenchCore } from "../../core";
import {
  refreshOpenWorkbenchExtensionWebviews,
  registerWorkbenchExtensionRendererRefreshEvents,
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

describe("registerWorkbenchExtensionRendererRefreshEvents", () => {
  test("refreshes only renderers subscribed to a delivered event and disposes the subscription", () => {
    const workbench = createWorkbenchCore();
    const refreshed: string[] = [];
    workbench.renderers.registerTreeRenderer({
      id: "ticket-files",
      title: "Files",
      getBody: () => [],
      getChildren: () => [],
    });
    workbench.renderers.registerFileRenderer({
      id: "ticket-content",
      title: "Content",
      load: () => ({ content: "" }),
    });
    workbench.renderers.registerControlsRenderer({
      id: "ticket-properties",
      title: "Properties",
      executeQuery: () => ({ groups: [], values: {} }),
    });
    workbench.renderers.registerDataTableRenderer({
      id: "ticket-table",
      title: "Table",
      executeQuery: () => ({ rows: [] }),
    });
    workbench.renderers.registerKanbanRenderer({
      id: "planner.tickets",
      title: "Tickets",
      attributes: [],
      executeQuery: () => [],
    });
    workbench.renderers.onDidRefresh((event) => refreshed.push(`tree:${event.treeId}`));
    workbench.renderers.onDidRefreshFileRenderer((event) => refreshed.push(`file:${event.fileRendererId}`));
    workbench.renderers.onDidRefreshControlsRenderer((event) => refreshed.push(`controls:${event.controlsRendererId}`));
    workbench.renderers.onDidRefreshDataTableRenderer((event) =>
      refreshed.push(`dataTable:${event.dataTableRendererId}`),
    );
    workbench.renderers.onDidRefreshKanbanRenderer((event) => refreshed.push(`kanban:${event.kanbanRendererId}`));
    let listener: ((eventId: string) => void) | undefined;
    const disposable = registerWorkbenchExtensionRendererRefreshEvents({
      workbench,
      metadata: {
        ...metadata,
        treeRenderers: [{ ...metadata.treeRenderers![0]!, refreshEventIds: ["tickets.changed", "tickets.changed"] }],
        fileRenderers: [
          {
            id: "ticket-content",
            extensionId: "pstdio.planner",
            title: "Content",
            loadHandlerId: "ticket-content.load",
            refreshEventIds: ["ticket-content.changed"],
          },
        ],
        controlsRenderers: [
          {
            id: "ticket-properties",
            extensionId: "pstdio.planner",
            title: "Properties",
            queryHandlerId: "ticket-properties.query",
            refreshEventIds: ["tickets.changed"],
          },
        ],
        dataTableRenderers: [
          {
            id: "ticket-table",
            extensionId: "pstdio.planner",
            title: "Table",
            queryHandlerId: "ticket-table.query",
            refreshEventIds: ["tickets.changed"],
          },
        ],
        kanbanRenderers: [
          {
            id: "planner.tickets",
            extensionId: "pstdio.planner",
            title: "Tickets",
            queryHandlerId: "planner.tickets.query",
            refreshEventIds: ["tickets.changed"],
          },
        ],
      },
      subscribe: (nextListener) => {
        listener = nextListener;
        return { dispose: () => (listener = undefined) };
      },
    });

    listener?.("tickets.changed");
    listener?.("unrelated.changed");

    expect(refreshed).toEqual([
      "tree:ticket-files",
      "controls:ticket-properties",
      "dataTable:ticket-table",
      "kanban:planner.tickets",
    ]);

    disposable.dispose();
    listener?.("ticket-content.changed");
    expect(refreshed).toHaveLength(4);
  });
});
