import { describe, expect, test } from "bun:test";
import type { WorkbenchExtensionMetadata } from "@pstdio/sdk/api";
import type { WorkbenchExtensionDataTableRendererRecord } from "pstdio-api-contracts";
import { createWorkbenchCore } from "../../core";
import { registerWorkbenchExtensionDataTableRenderers } from "./data-table-renderer-contributions";

type ViewRecord = WorkbenchExtensionMetadata["panels"][number];

describe("registerWorkbenchExtensionDataTableRenderers panel placement", () => {
  test("registers panels in declaration order and honors panel-menu placement", () => {
    const workbench = createWorkbenchCore();
    const record = {
      id: "lab.table",
      extensionId: "pstdio.lab",
      title: "Table",
      queryHandlerId: "lab.health.query",
    } satisfies WorkbenchExtensionDataTableRendererRecord;
    const panels = [
      {
        id: "lab.first",
        extensionId: "pstdio.lab",
        title: "First",
        show: { region: "main" },
        renderer: { kind: "dataTable", id: "lab.table" },
      },
      {
        id: "lab.default",
        extensionId: "pstdio.lab",
        title: "Default",
        show: { region: "main" },
        renderer: { kind: "dataTable", id: "lab.table" },
      },
      {
        id: "lab.last",
        extensionId: "pstdio.lab",
        title: "Last",
        show: { region: "main" },
        renderer: { kind: "dataTable", id: "lab.table" },
        panelMenus: [
          {
            id: "lab.owner.menu-last",
            extensionId: "pstdio.lab",
            ownerPanelId: "lab.last",
            title: "Menu Last",
            side: "right",
            placement: "last",
            renderer: { kind: "dataTable", id: "lab.table" },
          },
          {
            id: "lab.owner.menu-default",
            extensionId: "pstdio.lab",
            ownerPanelId: "lab.last",
            title: "Menu Default",
            side: "right",
            renderer: { kind: "dataTable", id: "lab.table" },
          },
          {
            id: "lab.owner.menu-first",
            extensionId: "pstdio.lab",
            ownerPanelId: "lab.last",
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

    const registeredIds = workbench.layout.listPanels().map((panel) => panel.id);
    expect(registeredIds.filter((id) => !id.includes("menu"))).toEqual(["lab.first", "lab.default", "lab.last"]);
    expect(registeredIds.filter((id) => id.includes("menu"))).toEqual([
      "lab.owner.menu-first",
      "lab.owner.menu-default",
      "lab.owner.menu-last",
    ]);

    workbench.layout.openPanel("lab.first", { strategy: { kind: "persistent" } });
    workbench.layout.openPanel("lab.default", { strategy: { kind: "persistent" } });
    workbench.layout.openPanel("lab.last", { strategy: { kind: "persistent" } });

    expect(workbench.layout.listPanelInstances("main").map((panel) => panel.panelId)).toEqual([
      "lab.first",
      "lab.default",
      "lab.last",
    ]);
    expect(workbench.layout.listPanelInstances("main-right-menu").map((panel) => panel.panelId)).toEqual([
      "lab.owner.menu-first",
      "lab.owner.menu-default",
      "lab.owner.menu-last",
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
        show: { region: "main" },
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
        show: { region: "main" },
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
