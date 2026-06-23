import { describe, expect, test } from "bun:test";
import type { WorkbenchExtensionDataRendererRecord } from "@pstdio/sdk/api";
import { createWorkbenchCore, type DataRendererQueryState } from "../../core";
import { registerWorkbenchExtensionDataRenderers } from "./data-renderer-contributions";

const createDeferred = () => {
  let resolve!: () => void;
  const promise = new Promise<void>((next) => {
    resolve = next;
  });
  return { promise, resolve };
};

const queryState: DataRendererQueryState = {
  settings: {
    viewMode: "board",
    columnGrouping: "status",
    rowGrouping: "none",
    ordering: { attributeId: "manual", direction: "asc" },
    displayProperties: [],
  },
  filters: {},
};

describe("registerWorkbenchExtensionDataRenderers", () => {
  test("maps extension board column action icons into column actions", async () => {
    const workbench = createWorkbenchCore();
    const record = {
      id: "tickets",
      extensionId: "pstdio.pstdio-planner",
      title: "Tickets",
      queryCommandId: "pstdio-planner.query-tickets",
    } satisfies WorkbenchExtensionDataRendererRecord;

    registerWorkbenchExtensionDataRenderers(
      {
        projectId: "project-1",
        workbench,
        executeCommand: async () => ({
          rows: [],
          boardColumnConfigs: {
            todo: {
              actions: [{ id: "archive_all", label: "Archive all", icon: "archive" }],
            },
          },
        }),
      },
      [record],
    );

    const renderer = workbench.renderers.getDataRenderer("tickets");
    await renderer?.executeQuery(queryState);

    const action = renderer?.getBoardColumnConfig?.("todo").actions?.[0];

    expect(action).toMatchObject({ id: "archive_all", label: "Archive all" });
    expect(action?.icon).toBeDefined();
    expect(typeof action?.icon).not.toBe("string");
  });

  test("maps extension row action icons into context menu actions", () => {
    const workbench = createWorkbenchCore();
    const record = {
      id: "tickets",
      extensionId: "pstdio.pstdio-planner",
      title: "Tickets",
      queryCommandId: "pstdio-planner.query-tickets",
      rowActions: [
        {
          id: "run-attempt",
          label: "Run attempt",
          icon: "play",
          commandId: "pstdio-planner.run-attempt",
        },
      ],
    } satisfies WorkbenchExtensionDataRendererRecord;

    registerWorkbenchExtensionDataRenderers({ projectId: "project-1", workbench, executeCommand: async () => [] }, [
      record,
    ]);

    const actions = workbench.renderers.getDataRenderer("tickets")?.getRowContextMenuActions?.({
      id: "ticket-1",
      title: "Ticket 1",
      attributes: {},
    });

    expect(actions?.[0]).toMatchObject({ key: "run-attempt", label: "Run attempt" });
    expect(actions?.[0]?.icon).toBeDefined();
  });

  test("requests params before running row actions with command params", () => {
    const workbench = createWorkbenchCore();
    const calls: Array<{ commandId: string; request: unknown }> = [];
    const record = {
      id: "tickets",
      extensionId: "pstdio.pstdio-planner",
      title: "Tickets",
      resourceKind: "ticket",
      queryCommandId: "pstdio-planner.query-tickets",
      rowActions: [
        {
          id: "refine-ticket",
          label: "Refine ticket",
          icon: "sparkles",
          commandId: "pstdio-planner.refine-ticket",
        },
      ],
    } satisfies WorkbenchExtensionDataRendererRecord;

    workbench.commands.registerCommand(
      {
        id: "pstdio-planner.refine-ticket",
        label: "Refine ticket",
        params: {
          context: { type: "longtext", label: "Additional context" },
        },
      },
      { execute: () => undefined },
    );
    registerWorkbenchExtensionDataRenderers(
      {
        projectId: "project-1",
        workbench,
        executeCommand: async (commandId, request) => {
          calls.push({ commandId, request });
          return { commandId, extensionId: "pstdio.pstdio-planner", outcome: { ok: true, status: "success" } };
        },
      },
      [record],
    );

    workbench.renderers
      .getDataRenderer("tickets")
      ?.getRowContextMenuActions?.({
        id: "ticket-1",
        title: "Ticket 1",
        resource: { type: "ticket", id: "ticket-1", label: "T-1" },
        attributes: {},
      })?.[0]
      ?.onClick();

    const request = workbench.commandPalette.getParamsRequest();

    expect(calls).toEqual([]);
    expect(request?.label).toBe("Refine ticket");
    expect(request?.record.command.id).toBe("workbench.extension.dataRenderer.tickets.rowAction.refine-ticket");
    expect(request?.record.command.params).toEqual({
      context: { type: "longtext", label: "Additional context" },
    });
    expect(request?.args).toEqual({ rowId: "ticket-1" });
    expect(request?.context?.resource).toMatchObject({ kind: "ticket", id: "ticket-1" });
  });

  test("awaits mutation commands and refreshes after board move mutations", async () => {
    const workbench = createWorkbenchCore();
    const updateDeferred = createDeferred();
    const reorderDeferred = createDeferred();
    const calls: string[] = [];
    const refreshes: string[] = [];
    const record = {
      id: "tickets",
      extensionId: "pstdio.pstdio-planner",
      title: "Tickets",
      queryCommandId: "pstdio-planner.query-tickets",
      updateAttributeCommandId: "pstdio-planner.update-ticket-attribute",
      reorderCommandId: "pstdio-planner.reorder-ticket",
    } satisfies WorkbenchExtensionDataRendererRecord;

    workbench.renderers.onDidRefreshDataRenderer((event) => {
      refreshes.push(event.dataRendererId);
    });
    registerWorkbenchExtensionDataRenderers(
      {
        projectId: "project-1",
        workbench,
        executeCommand: async (commandId) => {
          calls.push(commandId);
          if (commandId === record.updateAttributeCommandId) await updateDeferred.promise;
          if (commandId === record.reorderCommandId) await reorderDeferred.promise;
          return undefined;
        },
      },
      [record],
      { onAfterMutation: (mutatedRecord) => workbench.renderers.refreshDataRenderer(mutatedRecord.id) },
    );

    const renderer = workbench.renderers.getDataRenderer("tickets");
    const attributeChange = renderer?.onAttributeChange?.("ticket-1", "status", "done");

    await Promise.resolve();

    expect(attributeChange).toBeInstanceOf(Promise);
    expect(calls).toEqual([record.updateAttributeCommandId]);
    expect(refreshes).toEqual([]);

    updateDeferred.resolve();
    await attributeChange;

    expect(refreshes).toEqual(["tickets"]);

    const reorder = renderer?.onReorder?.("ticket-1", "ticket-2");

    await Promise.resolve();

    expect(reorder).toBeInstanceOf(Promise);
    expect(calls).toEqual([record.updateAttributeCommandId, record.reorderCommandId]);
    expect(refreshes).toEqual(["tickets"]);

    reorderDeferred.resolve();
    await reorder;

    expect(refreshes).toEqual(["tickets", "tickets"]);
  });
});
