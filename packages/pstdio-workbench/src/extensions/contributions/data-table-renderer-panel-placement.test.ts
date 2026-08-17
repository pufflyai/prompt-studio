import { describe, expect, test } from "bun:test";
import type { WorkbenchExtensionMetadata } from "@pstdio/sdk/api";
import type { WorkbenchExtensionDataTableRendererRecord } from "pstdio-api-contracts";
import { createWorkbenchCore } from "../../core";
import { registerWorkbenchExtensionDataTableRenderers } from "./data-table-renderer-contributions";

type ViewRecord = WorkbenchExtensionMetadata["panels"][number];

describe("registerWorkbenchExtensionDataTableRenderers panel placement", () => {
  test("honors panel and panel-menu placement when registering and opening widgets", () => {
    const workbench = createWorkbenchCore();
    const record = {
      id: "lab.table",
      extensionId: "pstdio.lab",
      title: "Table",
      queryHandlerId: "lab.health.query",
    } satisfies WorkbenchExtensionDataTableRendererRecord;
    const panels = [
      {
        id: "lab.last",
        extensionId: "pstdio.lab",
        title: "Last",
        closable: false,
        region: "main",
        placement: "last",
        renderer: { kind: "dataTable", id: "lab.table" },
      },
      {
        id: "lab.default",
        extensionId: "pstdio.lab",
        title: "Default",
        closable: false,
        region: "main",
        renderer: { kind: "dataTable", id: "lab.table" },
      },
      {
        id: "lab.first",
        extensionId: "pstdio.lab",
        title: "First",
        closable: false,
        region: "main",
        placement: "first",
        renderer: { kind: "dataTable", id: "lab.table" },
        panelMenus: [
          {
            id: "lab.first.menu-last",
            extensionId: "pstdio.lab",
            ownerPanelId: "lab.first",
            title: "Menu Last",
            side: "right",
            placement: "last",
            renderer: { kind: "dataTable", id: "lab.table" },
          },
          {
            id: "lab.first.menu-default",
            extensionId: "pstdio.lab",
            ownerPanelId: "lab.first",
            title: "Menu Default",
            side: "right",
            renderer: { kind: "dataTable", id: "lab.table" },
          },
          {
            id: "lab.first.menu-first",
            extensionId: "pstdio.lab",
            ownerPanelId: "lab.first",
            title: "Menu First",
            side: "right",
            placement: "first",
            renderer: { kind: "dataTable", id: "lab.table" },
          },
        ],
      },
    ] satisfies ViewRecord[];

    registerWorkbenchExtensionDataTableRenderers(
      {
        projectId: "project-1",
        workbench,
        executeCommand: () => ({ rows: [] }),
      },
      [record],
      panels,
    );

    expect(workbench.layout.listPanels().map((panel) => panel.id)).toEqual([
      "lab.first",
      "lab.first.menu-first",
      "lab.default",
      "lab.first.menu-default",
      "lab.last",
      "lab.first.menu-last",
    ]);

    workbench.layout.openPanel("lab.last", { strategy: { kind: "persistent" } });
    workbench.layout.openPanel("lab.default", { strategy: { kind: "persistent" } });
    workbench.layout.openPanel("lab.first", { strategy: { kind: "persistent" } });

    expect(workbench.layout.listPanelInstances("main").map((panel) => panel.panelId)).toEqual([
      "lab.first",
      "lab.default",
      "lab.last",
    ]);
    expect(workbench.layout.listPanelInstances("main-right-menu").map((panel) => panel.panelId)).toEqual([
      "lab.first.menu-first",
      "lab.first.menu-default",
      "lab.first.menu-last",
    ]);
  });

  test("tie-breaks equal-placement panel menus across owner panels by manifest declaration order", () => {
    const workbench = createWorkbenchCore();
    const record = {
      id: "lab.table",
      extensionId: "pstdio.lab",
      title: "Table",
      queryHandlerId: "lab.health.query",
    } satisfies WorkbenchExtensionDataTableRendererRecord;
    const panels = [
      {
        id: "lab.a",
        extensionId: "pstdio.lab",
        title: "Panel A",
        closable: false,
        region: "main",
        renderer: { kind: "dataTable", id: "lab.table" },
        panelMenus: [
          {
            id: "lab.a.menu",
            extensionId: "pstdio.lab",
            ownerPanelId: "lab.a",
            title: "Menu A",
            side: "right",
            renderer: { kind: "dataTable", id: "lab.table" },
          },
        ],
      },
      {
        id: "lab.b",
        extensionId: "pstdio.lab",
        title: "Panel B",
        closable: false,
        region: "main",
        renderer: { kind: "dataTable", id: "lab.table" },
        panelMenus: [
          {
            id: "lab.b.menu",
            extensionId: "pstdio.lab",
            ownerPanelId: "lab.b",
            title: "Menu B",
            side: "right",
            renderer: { kind: "dataTable", id: "lab.table" },
          },
        ],
      },
    ] satisfies ViewRecord[];

    registerWorkbenchExtensionDataTableRenderers(
      {
        projectId: "project-1",
        workbench,
        executeCommand: () => ({ rows: [] }),
      },
      [record],
      panels,
    );

    workbench.layout.openPanel("lab.b", { strategy: { kind: "persistent" } });
    workbench.layout.openPanel("lab.a", { strategy: { kind: "persistent" } });

    expect(workbench.layout.listPanelInstances("main-right-menu").map((panel) => panel.panelId)).toEqual([
      "lab.a.menu",
      "lab.b.menu",
    ]);
  });
});
