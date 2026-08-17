import { describe, expect, test } from "bun:test";
import type { CommandExecuteResponse } from "@pstdio/sdk/api";
import { createWorkbenchCore } from "@pstdio/workbench";
import { publishExtensionCommandEvent } from "@/shared/extensions/extension-webview-broadcast";
import {
  type DashboardExtensionMetadata,
  emptyDashboardExtensionMetadata,
} from "@/shared/extensions/workbench-extension-contributions";
import { disposeExtensionContributions, registerExtensionContributions } from "./extension-contribution-registration";

const stubWebview = (name: string) => ({
  entry: {
    kind: "package-asset" as const,
    path: `./src/views/${name}.tsx`,
    baseUrl: "file:///extensions/test/extension.ts",
  },
  runtimeUrl: `/runtime/${name}.html`,
  moduleUrl: `/modules/${name}.js`,
});

const metadata = {
  ...emptyDashboardExtensionMetadata,
  extensions: [
    { id: "pstdio.extension-lab", name: "extension-lab", displayName: "Extension Lab", sourcePath: "" },
    { id: "pstdio.pstdio-planner", name: "pstdio-planner", displayName: "Planner", sourcePath: "" },
  ],
  panels: [
    {
      id: "extension-lab.stale-sidebar",
      extensionId: "pstdio.extension-lab",
      region: "sidenav",
      closable: false,
      title: "Stale Lab sidebar",
      webview: stubWebview("stale-lab-sidebar"),
      panelMenus: [
        {
          id: "extension-lab.stale-sidebar-menu",
          extensionId: "pstdio.extension-lab",
          ownerPanelId: "extension-lab.stale-sidebar",
          title: "Invalid Sidenav menu",
          side: "left",
          webview: stubWebview("stale-lab-sidebar-menu"),
        },
      ],
    },
  ],
  settingsPanels: [
    {
      id: "pstdio-planner.ticketStatuses",
      extensionId: "pstdio.pstdio-planner",
      slotId: "project.settingsPanels",
      target: "workbench.settings",
      scope: "project",
      title: "Ticket statuses",
      icon: "list-checks",
      webview: stubWebview("ticket-statuses"),
    },
  ],
} satisfies DashboardExtensionMetadata;

const dataTableMetadata = {
  ...emptyDashboardExtensionMetadata,
  extensions: [
    { id: "pstdio.data-table-demo", name: "data-table-demo", displayName: "DataTable Demo", sourcePath: "" },
  ],
  dataTableRenderers: [
    {
      id: "data-table-demo.services",
      extensionId: "pstdio.data-table-demo",
      title: "Services",
      queryHandlerId: "data-table-demo.services.query",
      selectionMode: "multiple",
      selectionActions: [
        {
          id: "restart",
          label: "Restart selected",
          commandId: "data-table-demo.services.restart",
        },
      ],
    },
  ],
  panels: [
    {
      id: "data-table-demo.services",
      extensionId: "pstdio.data-table-demo",
      title: "Services",
      region: "main",
      closable: false,
      renderer: { kind: "dataTable", id: "data-table-demo.services" },
    },
  ],
} satisfies DashboardExtensionMetadata;

describe("registerExtensionContributions", () => {
  test("keeps one invalid extension from removing another extension's settings", () => {
    const workbench = createWorkbenchCore();
    const errors: Array<{ error: unknown; extensionId: string }> = [];

    workbench.registerModule({
      id: "test.extension-isolation",
      activate: (ctx) => {
        ctx.settings.registerSection({ id: "project", title: "Project" });
        ctx.settings.registerSection({ id: "workbench", title: "Workbench" });
        return registerExtensionContributions({
          ctx,
          executeCommand: async () => {
            throw new Error("not used");
          },
          metadata,
          projectId: "project-1",
          onRegistrationError: (error, extensionId) => errors.push({ error, extensionId }),
        });
      },
    });

    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({
      extensionId: "pstdio.extension-lab",
      error: expect.any(Error),
    });
    expect(workbench.settings.getPanel("pstdio-planner.ticketStatuses")?.title).toBe("Ticket statuses");
  });

  test("refreshes only data tables whose declared event was delivered", () => {
    const workbench = createWorkbenchCore();
    const refreshes: string[] = [];
    const artifactDataTableMetadata = {
      ...emptyDashboardExtensionMetadata,
      dataTableRenderers: [
        {
          id: "extension-lab.artifacts",
          extensionId: "pstdio.extension-lab",
          title: "Artifacts",
          queryHandlerId: "extension-lab.artifacts.query",
          refreshEventIds: ["extension-lab.artifacts.changed"],
        },
      ],
    } satisfies DashboardExtensionMetadata;

    workbench.renderers.onDidRefreshDataTableRenderer((event) => refreshes.push(event.dataTableRendererId));
    const disposable = registerExtensionContributions({
      ctx: workbench,
      executeCommand: async () => ({
        commandId: "extension-lab.artifacts.query",
        extensionId: "pstdio.extension-lab",
        outcome: { ok: true, status: "success", value: { rows: [] } },
      }),
      metadata: artifactDataTableMetadata,
      projectId: "project-1",
    });

    try {
      publishExtensionCommandEvent({
        commandId: "extension-lab.artifacts.create",
        extensionId: "pstdio.extension-lab",
        eventIds: ["unrelated.changed"],
        outcome: { ok: true, status: "success" },
      });
      publishExtensionCommandEvent({
        commandId: "extension-lab.artifacts.create",
        extensionId: "pstdio.extension-lab",
        eventIds: ["extension-lab.artifacts.changed"],
        outcome: { ok: true, status: "success" },
      });

      expect(refreshes).toEqual(["extension-lab.artifacts"]);
    } finally {
      disposeExtensionContributions(disposable);
    }
  });

  test("registers extension DataTable renderers and their panels", () => {
    const workbench = createWorkbenchCore();

    workbench.registerModule({
      id: "test.data-table-extension",
      activate: (ctx) =>
        registerExtensionContributions({
          ctx,
          executeCommand: async () => {
            throw new Error("not used");
          },
          metadata: dataTableMetadata,
          projectId: "project-1",
        }),
    });

    expect(workbench.renderers.getDataTableRenderer("data-table-demo.services")).toMatchObject({
      selectionMode: "multiple",
      selectionActions: [expect.objectContaining({ id: "restart" })],
    });
    expect(workbench.layout.getPanel("data-table-demo.services")).toMatchObject({
      rendererId: "data-table-demo.services",
      region: "main",
    });
  });

  test("surfaces extension command notices from DataTable selection actions", async () => {
    const workbench = createWorkbenchCore();
    const response: CommandExecuteResponse = {
      commandId: "data-table-demo.services.restart",
      extensionId: "pstdio.data-table-demo",
      outcome: {
        ok: true,
        status: "success",
        value: { restartedRowIds: ["gateway", "worker"] },
        notices: [
          {
            type: "success",
            title: "Services restarted",
            message: "Restarted 2 services: gateway, worker",
          },
        ],
      },
    };

    workbench.registerModule({
      id: "test.data-table-extension-notices",
      activate: (ctx) =>
        registerExtensionContributions({
          ctx,
          executeCommand: async () => response,
          metadata: dataTableMetadata,
          projectId: "project-1",
        }),
    });

    await workbench.renderers.getDataTableRenderer("data-table-demo.services")?.selectionActions?.[0]?.run([
      { id: "gateway", values: { service: "Gateway" } },
      { id: "worker", values: { service: "Worker" } },
    ]);

    expect(workbench.notifications.listNotifications()).toMatchObject([
      {
        level: "success",
        title: "Services restarted",
        message: "Restarted 2 services: gateway, worker",
      },
    ]);
  });
});
