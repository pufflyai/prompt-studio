import { describe, expect, test } from "bun:test";
import type { WorkbenchExtensionKanbanRendererRecord } from "pstdio-api-contracts";
import { createWorkbench, getWorkbenchRenderers } from "../../core";
import { registerWorkbenchExtensionKanbanRenderers } from "./kanban-renderer-contributions";

import { queryState } from "./kanban-renderer-query.fixture";

const createDeferred = () => {
  let resolve!: () => void;
  const promise = new Promise<void>((next) => {
    resolve = next;
  });
  return { promise, resolve };
};

describe("registerWorkbenchExtensionKanbanRenderers", () => {
  test("registers extension-declared default saved views", () => {
    const workbench = createWorkbench();
    const record = {
      id: "tickets",
      extensionId: "pstdio.pstdio-planner",
      title: "Tickets",
      queryHandlerId: "pstdio-planner.tickets.query",
      defaultViews: [
        {
          id: "all",
          title: "All tickets",
          settings: queryState.settings,
          filter: queryState.filter,
          sorts: [{ attributeId: "updated", direction: "desc" }],
        },
      ],
      defaultActiveViewId: "all",
    } satisfies WorkbenchExtensionKanbanRendererRecord;

    registerWorkbenchExtensionKanbanRenderers({ projectId: "project-1", workbench, executeCommand: async () => [] }, [
      record,
    ]);

    const renderer = getWorkbenchRenderers(workbench).getKanbanRenderer("tickets");

    expect(renderer?.defaultViews).toMatchObject([
      {
        id: "all",
        title: "All tickets",
        settings: queryState.settings,
        filter: queryState.filter,
        sorts: [{ attributeId: "updated", direction: "desc" }],
      },
    ]);
    expect(renderer?.defaultActiveViewId).toBe("all");
  });

  test("sends the view to the query, with the deprecated filters and ordering derived from it", async () => {
    const workbench = createWorkbench();
    const params: unknown[] = [];
    registerWorkbenchExtensionKanbanRenderers(
      {
        projectId: "project-1",
        workbench,
        executeCommand: async (_commandId, request) => {
          params.push(request.params);
          return { rows: [] };
        },
      },
      [{ id: "tickets", extensionId: "pstdio.pstdio-planner", title: "Tickets", queryHandlerId: "query" }],
    );
    const filter = {
      conjunction: "and" as const,
      rules: [
        { attributeId: "archived", condition: "is-any-of" as const, value: ["active"] },
        { attributeId: "status", condition: "is-none-of" as const, value: ["done"] },
      ],
    };

    await getWorkbenchRenderers(workbench)
      .getKanbanRenderer("tickets")
      ?.executeQuery(
        { ...queryState, filter, sorts: [{ attributeId: "updated", direction: "desc" }] },
        new AbortController().signal,
      );

    expect(params[0]).toMatchObject({
      filter,
      sorts: [{ attributeId: "updated", direction: "desc" }],
      filters: { archived: ["active"] },
      settings: { columnGrouping: "status", ordering: { attributeId: "updated", direction: "desc" } },
    });
  });

  test("maps extension board column action icons into column actions", async () => {
    const workbench = createWorkbench();
    const record = {
      id: "tickets",
      extensionId: "pstdio.pstdio-planner",
      title: "Tickets",
      queryHandlerId: "pstdio-planner.tickets.query",
    } satisfies WorkbenchExtensionKanbanRendererRecord;

    registerWorkbenchExtensionKanbanRenderers(
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

    const renderer = getWorkbenchRenderers(workbench).getKanbanRenderer("tickets");
    await renderer?.executeQuery(queryState, new AbortController().signal);

    const action = renderer?.getBoardColumnConfig?.("todo").actions?.[0];

    expect(action).toMatchObject({ id: "archive_all", label: "Archive all" });
    expect(action?.icon).toBeDefined();
    expect(typeof action?.icon).not.toBe("string");
  });
});

describe("registerWorkbenchExtensionKanbanRenderers actions", () => {
  test("maps extension row action icons into context menu actions", () => {
    const workbench = createWorkbench();
    const record = {
      id: "tickets",
      extensionId: "pstdio.pstdio-planner",
      title: "Tickets",
      queryHandlerId: "pstdio-planner.tickets.query",
      rowActions: [
        {
          id: "run-attempt",
          label: "Run attempt",
          icon: "play",
          commandId: "pstdio-planner.run-attempt",
        },
      ],
    } satisfies WorkbenchExtensionKanbanRendererRecord;

    registerWorkbenchExtensionKanbanRenderers({ projectId: "project-1", workbench, executeCommand: async () => [] }, [
      record,
    ]);

    const actions = getWorkbenchRenderers(workbench).getKanbanRenderer("tickets")?.getRowContextMenuActions?.({
      id: "ticket-1",
      title: "Ticket 1",
      attributes: {},
    });

    expect(actions?.[0]).toMatchObject({ key: "run-attempt", label: "Run attempt" });
    expect(actions?.[0]?.icon).toBeDefined();
  });

  test("requests params before running row actions with command params", () => {
    const workbench = createWorkbench();
    const calls: Array<{ commandId: string; request: unknown }> = [];
    const record = {
      id: "tickets",
      extensionId: "pstdio.pstdio-planner",
      title: "Tickets",
      resourceKind: "ticket",
      queryHandlerId: "pstdio-planner.tickets.query",
      rowActions: [
        {
          id: "refine-ticket",
          label: "Refine ticket",
          icon: "sparkles",
          commandId: "pstdio-planner.refine-ticket",
        },
      ],
    } satisfies WorkbenchExtensionKanbanRendererRecord;

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
    registerWorkbenchExtensionKanbanRenderers(
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

    getWorkbenchRenderers(workbench)
      .getKanbanRenderer("tickets")
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
    expect(request?.record.command.id).toBe("workbench.extension.kanbanRenderer.tickets.rowAction.refine-ticket");
    expect(request?.record.command.params).toEqual({
      context: { type: "longtext", label: "Additional context" },
    });
    expect(request?.args).toEqual({ rowId: "ticket-1" });
    expect(request?.context?.resource).toMatchObject({ type: "ticket", id: "ticket-1" });
  });

  test("awaits mutation commands and refreshes after board move mutations", async () => {
    const workbench = createWorkbench();
    const updateDeferred = createDeferred();
    const reorderDeferred = createDeferred();
    const calls: string[] = [];
    const refreshes: string[] = [];
    const record = {
      id: "tickets",
      extensionId: "pstdio.pstdio-planner",
      title: "Tickets",
      queryHandlerId: "pstdio-planner.tickets.query",
      attributeChangeHandlerId: "pstdio-planner.tickets.onAttributeChange",
      reorderHandlerId: "pstdio-planner.tickets.onReorder",
    } satisfies WorkbenchExtensionKanbanRendererRecord;

    getWorkbenchRenderers(workbench).onDidRefreshKanbanRenderer((event) => {
      refreshes.push(event.kanbanRendererId);
    });
    registerWorkbenchExtensionKanbanRenderers(
      {
        projectId: "project-1",
        workbench,
        executeCommand: async (commandId) => {
          calls.push(commandId);
          if (commandId === record.attributeChangeHandlerId) await updateDeferred.promise;
          if (commandId === record.reorderHandlerId) await reorderDeferred.promise;
          return undefined;
        },
      },
      [record],
      { onAfterMutation: (mutatedRecord) => getWorkbenchRenderers(workbench).refreshKanbanRenderer(mutatedRecord.id) },
    );

    const renderer = getWorkbenchRenderers(workbench).getKanbanRenderer("tickets");
    const attributeChange = renderer?.onAttributeChange?.("ticket-1", "status", "done");

    await Promise.resolve();

    expect(attributeChange).toBeInstanceOf(Promise);
    expect(calls).toEqual([record.attributeChangeHandlerId]);
    expect(refreshes).toEqual([]);

    updateDeferred.resolve();
    await attributeChange;

    expect(refreshes).toEqual(["tickets"]);

    const reorder = renderer?.onReorder?.("ticket-1", "ticket-2");

    await Promise.resolve();

    expect(reorder).toBeInstanceOf(Promise);
    expect(calls).toEqual([record.attributeChangeHandlerId, record.reorderHandlerId]);
    expect(refreshes).toEqual(["tickets"]);

    reorderDeferred.resolve();
    await reorder;

    expect(refreshes).toEqual(["tickets", "tickets"]);
  });
});

describe("registerWorkbenchExtensionKanbanRenderers row activation", () => {
  test("runs row activation callbacks and leaves resource rows inert without them", async () => {
    const workbench = createWorkbench();
    const calls: Array<{ commandId: string; resourceType: unknown; rowId: unknown }> = [];
    const record = {
      id: "tickets",
      extensionId: "pstdio.pstdio-planner",
      title: "Tickets",
      queryHandlerId: "pstdio-planner.tickets.query",
      rowActivationHandlerId: "pstdio-planner.tickets.onRowActivate",
    } satisfies WorkbenchExtensionKanbanRendererRecord;
    const inertRecord = {
      id: "inertTickets",
      extensionId: "pstdio.pstdio-planner",
      title: "Inert tickets",
      queryHandlerId: "pstdio-planner.inertTickets.query",
    } satisfies WorkbenchExtensionKanbanRendererRecord;

    registerWorkbenchExtensionKanbanRenderers(
      {
        projectId: "project-1",
        workbench,
        executeCommand: async (commandId, request) => {
          const row = request.params?.row as { id?: unknown; resource?: { type?: unknown } } | undefined;
          calls.push({ commandId, resourceType: row?.resource?.type, rowId: row?.id });
          if (commandId === "pstdio-planner.tickets.query") {
            return { rows: [{ id: "ticket-1", title: "Ticket 1", resource: { type: "ticket", id: "ticket-1" } }] };
          }
          return undefined;
        },
      },
      [record, inertRecord],
    );

    const rows = await getWorkbenchRenderers(workbench)
      .getKanbanRenderer("tickets")
      ?.executeQuery(queryState, new AbortController().signal);
    await getWorkbenchRenderers(workbench).getKanbanRenderer("tickets")?.onRowActivate?.(rows![0]!);

    expect(calls.at(-1)).toEqual({
      commandId: "pstdio-planner.tickets.onRowActivate",
      resourceType: "ticket",
      rowId: "ticket-1",
    });
    expect(getWorkbenchRenderers(workbench).getKanbanRenderer("inertTickets")?.onRowActivate).toBeUndefined();
  });
});
