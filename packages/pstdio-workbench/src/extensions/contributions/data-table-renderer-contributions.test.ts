import { describe, expect, test } from "bun:test";
import type { CommandExecuteRequest, WorkbenchExtensionMetadata } from "@pstdio/sdk/api";
import type { WorkbenchExtensionDataTableRendererRecord } from "pstdio-api-contracts";
import { createWorkbenchCore } from "../../core";
import { registerWorkbenchExtensionDataTableRenderers } from "./data-table-renderer-contributions";

type ViewRecord = WorkbenchExtensionMetadata["views"][number];

describe("registerWorkbenchExtensionDataTableRenderers", () => {
  test("adapts query rows and columns, places the view, and executes row actions", async () => {
    const workbench = createWorkbenchCore();
    const calls: Array<{ commandId: string; body: CommandExecuteRequest }> = [];
    const record = {
      id: "lab.health",
      extensionId: "pstdio.lab",
      title: "Health",
      queryCommandId: "lab.queryHealth",
      columns: [{ id: "name", label: "Service" }],
      rowActions: [{ id: "restart", label: "Restart", commandId: "lab.restart" }],
    } satisfies WorkbenchExtensionDataTableRendererRecord;
    const view = {
      id: "lab.healthView",
      extensionId: "pstdio.lab",
      slotId: "health",
      title: "Health",
      target: "workbench.main",
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
              ],
              columns: [{ id: "score", label: "Score" }],
            };
          }
        },
      },
      [record],
      [view],
    );

    expect(workbench.layout.getWidget("lab.healthView")).toMatchObject({
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
  });
});
