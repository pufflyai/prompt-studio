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
      queryCommandId: "lab.queryHealth",
      columns: [{ id: "name", label: "Service" }],
      selectionMode: "multiple",
      selectionActions: [{ id: "restart-selected", label: "Restart selected", commandId: "lab.restartSelected" }],
      rowActions: [{ id: "restart", label: "Restart", commandId: "lab.restart" }],
    } satisfies WorkbenchExtensionDataTableRendererRecord;
    const panel = {
      id: "lab.healthView",
      extensionId: "pstdio.lab",
      title: "Health",
      closable: false,
      region: "main",
      dataTableRendererId: "lab.health",
    } satisfies ViewRecord;

    registerWorkbenchExtensionDataTableRenderers(
      {
        projectId: "project-1",
        workbench,
        executeCommand: async (commandId, body) => {
          calls.push({ commandId, body });
          if (commandId === "lab.queryHealth") {
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
      commandId: "lab.queryHealth",
      body: {
        projectId: "project-1",
        params: { rendererId: "lab.health", projectId: "project-1", modeId: "project" },
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
  });
});
