import { describe, expect, test } from "bun:test";
import type { CommandExecuteRequest, WorkbenchExtensionMetadata } from "@pstdio/sdk/api";
import type { WorkbenchExtensionDataTableRendererRecord } from "pstdio-api-contracts";
import { createWorkbenchCore } from "../../core";
import { registerWorkbenchExtensionDataTableRenderers } from "./data-table-renderer-contributions";

type ViewRecord = WorkbenchExtensionMetadata["panels"][number];

describe("registerWorkbenchExtensionDataTableRenderers", () => {
  test("adapts query rows and columns, places the panel, and executes row and selection actions", async () => {
    const workbench = createWorkbenchCore();
    const calls: Array<{ commandId: string; body: CommandExecuteRequest }> = [];
    const record = {
      id: "lab.health",
      extensionId: "pstdio.lab",
      title: "Health",
      queryHandlerId: "lab.health.query",
      columns: [{ id: "name", label: "Service" }],
      selectionMode: "multiple",
      selectionActions: [{ id: "restart-selected", label: "Restart selected", commandId: "lab.restartSelected" }],
      rowActions: [{ id: "restart", label: "Restart", commandId: "lab.restart" }],
    } satisfies WorkbenchExtensionDataTableRendererRecord;
    const panel = {
      id: "lab.healthView",
      extensionId: "pstdio.lab",
      title: "Health",
      supportedRegions: ["main"],
      renderer: { kind: "dataTable", id: "lab.health" },
    } satisfies ViewRecord;
    const refreshes: string[] = [];
    workbench.renderers.onDidRefreshDataTableRenderer((event) => refreshes.push(event.dataTableRendererId));

    registerWorkbenchExtensionDataTableRenderers(
      {
        projectId: "project-1",
        workbench,
        executeCommand: async (commandId, body) => {
          calls.push({ commandId, body });
          if (commandId === "lab.health.query") {
            return {
              rows: [
                {
                  id: "api",
                  values: { name: "API", score: 92 },
                  resource: { type: "service", id: "api", label: "API" },
                },
                {
                  id: "worker",
                  values: { name: "Worker", score: 87 },
                  resource: { type: "service", id: "worker", label: "Worker" },
                },
              ],
              columns: [{ id: "score", label: "Score" }],
            };
          }
        },
      },
      [record],
      [panel],
    );

    expect(workbench.layout.getPanel("lab.healthView")).toMatchObject({
      region: "main",
      rendererId: "lab.health",
    });
    const renderer = workbench.renderers.getDataTableRenderer("lab.health");
    const result = await renderer?.executeQuery({ modeId: "project" });
    expect(result?.columns?.[0]).toMatchObject({ id: "score", label: "Score" });
    expect(result?.rows[0]).toMatchObject({
      id: "api",
      values: { name: "API", score: 92 },
      resource: { kind: "service", id: "api" },
    });

    await renderer?.rowActions?.[0]?.run(result!.rows[0]!);
    await renderer?.selectionActions?.[0]?.run(result!.rows);
    expect(calls[0]).toMatchObject({
      commandId: "lab.health.query",
      body: {
        projectId: "project-1",
        params: {
          renderer: {
            rendererId: "lab.health",
            projectId: "project-1",
            modeId: "project",
            invocation: { placement: "visible" },
          },
        },
        slot: { kind: "dataTableRenderer", id: "lab.health" },
      },
    });
    expect(calls[1]).toMatchObject({
      commandId: "lab.restart",
      body: { params: { rowId: "api" }, resource: { type: "service", id: "api" } },
    });
    expect(calls[2]).toMatchObject({
      commandId: "lab.restartSelected",
      body: { params: { rowIds: ["api", "worker"] } },
    });
    expect(refreshes).toEqual(["lab.health"]);
  });

  test("runs row activation callbacks and dispatches returned navigation targets", async () => {
    const workbench = createWorkbenchCore();
    const opened: unknown[] = [];
    workbench.resources.registerKind({ kind: "ticket", label: "Ticket" });
    workbench.resources.registerPresenter({
      id: "ticket.presenter",
      canOpen: (resource) => resource.kind === "ticket",
      open: (resource, input) => {
        opened.push({ resource, input });
        return workbench.layout.openPanel("ticket.panel", { resource });
      },
    });
    workbench.layout.registerPanel({
      id: "ticket.panel",
      title: "Ticket",
      region: "main",
      closable: false,
      rendererId: "test",
    });
    const calls: Array<{ commandId: string; resourceType: unknown; rowId: unknown }> = [];
    const record = {
      id: "lab.health",
      extensionId: "pstdio.lab",
      title: "Health",
      queryHandlerId: "lab.health.query",
      rowActivationHandlerId: "lab.health.onRowActivate",
    } satisfies WorkbenchExtensionDataTableRendererRecord;

    registerWorkbenchExtensionDataTableRenderers(
      {
        projectId: "project-1",
        workbench,
        executeCommand: async (commandId, body) => {
          const row = body.params?.row as { id?: unknown; resource?: { type?: unknown } } | undefined;
          calls.push({ commandId, resourceType: row?.resource?.type, rowId: row?.id });
          if (commandId === "lab.health.query") {
            return { rows: [{ id: "api", values: {}, resource: { type: "ticket", id: "PS-1", label: "PS-1" } }] };
          }
          return {
            kind: "resource",
            resource: { type: "ticket", id: "PS-1", label: "PS-1" },
            input: { strategy: "replace-active" },
          };
        },
      },
      [record],
      [],
    );

    const result = await workbench.renderers.getDataTableRenderer("lab.health")?.executeQuery({});
    await workbench.renderers.getDataTableRenderer("lab.health")?.onRowActivate?.(result!.rows[0]!);

    expect(calls.at(-1)).toEqual({
      commandId: "lab.health.onRowActivate",
      resourceType: "ticket",
      rowId: "api",
    });
    expect(opened).toEqual([
      expect.objectContaining({ resource: expect.objectContaining({ kind: "ticket", id: "PS-1" }) }),
    ]);
  });
});
