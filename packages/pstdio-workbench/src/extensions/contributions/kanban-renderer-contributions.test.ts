import { describe, expect, test } from "bun:test";
import type { WorkbenchExtensionKanbanRendererRecord } from "@pstdio/sdk/api";
import { createWorkbenchCore, type KanbanRendererQueryState } from "../../core";
import { registerWorkbenchExtensionKanbanRenderers } from "./kanban-renderer-contributions";

const createDeferred = () => {
  let resolve!: () => void;
  const promise = new Promise<void>((next) => {
    resolve = next;
  });
  return { promise, resolve };
};

const queryState: KanbanRendererQueryState = {
  settings: {
    viewMode: "board",
    columnGrouping: "status",
    rowGrouping: "none",
    ordering: { attributeId: "manual", direction: "asc" },
    displayProperties: [],
  },
  filters: {},
};

describe("registerWorkbenchExtensionKanbanRenderers", () => {
  test("registers extension-declared default saved views", () => {
    const workbench = createWorkbenchCore();
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
          filters: {},
          isDefault: true,
        },
      ],
      defaultActiveViewId: "all",
    } as WorkbenchExtensionKanbanRendererRecord;

    registerWorkbenchExtensionKanbanRenderers({ projectId: "project-1", workbench, executeCommand: async () => [] }, [
      record,
    ]);

    const renderer = workbench.renderers.getKanbanRenderer("tickets");

    expect(renderer?.defaultViews).toEqual([
      {
        id: "all",
        title: "All tickets",
        settings: queryState.settings,
        filters: {},
        isDefault: true,
      },
    ]);
    expect(renderer?.defaultActiveViewId).toBe("all");
  });

  test("maps extension board column action icons into column actions", async () => {
    const workbench = createWorkbenchCore();
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

    const renderer = workbench.renderers.getKanbanRenderer("tickets");
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

    const actions = workbench.renderers.getKanbanRenderer("tickets")?.getRowContextMenuActions?.({
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

    workbench.renderers
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
      queryHandlerId: "pstdio-planner.tickets.query",
      attributeChangeHandlerId: "pstdio-planner.tickets.onAttributeChange",
      reorderHandlerId: "pstdio-planner.tickets.onReorder",
    } satisfies WorkbenchExtensionKanbanRendererRecord;

    workbench.renderers.onDidRefreshKanbanRenderer((event) => {
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
      { onAfterMutation: (mutatedRecord) => workbench.renderers.refreshKanbanRenderer(mutatedRecord.id) },
    );

    const renderer = workbench.renderers.getKanbanRenderer("tickets");
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
    const workbench = createWorkbenchCore();
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

    const rows = await workbench.renderers.getKanbanRenderer("tickets")?.executeQuery(queryState);
    await workbench.renderers.getKanbanRenderer("tickets")?.onRowActivate?.(rows![0]!);

    expect(calls.at(-1)).toEqual({
      commandId: "pstdio-planner.tickets.onRowActivate",
      resourceType: "ticket",
      rowId: "ticket-1",
    });
    expect(workbench.renderers.getKanbanRenderer("inertTickets")?.onRowActivate).toBeUndefined();
  });
});

describe("registerWorkbenchExtensionKanbanRenderers create forms", () => {
  test("runs renderer-owned create forms with declarative fields, editable attributes, and attachments", async () => {
    const workbench = createWorkbenchCore();
    const calls: Array<{ commandId: string; params: Record<string, unknown> }> = [];
    const afterCreate: unknown[] = [];
    const record = {
      id: "tickets",
      extensionId: "pstdio.pstdio-planner",
      title: "Tickets",
      queryHandlerId: "pstdio-planner.tickets.query",
      createRow: {
        commandId: "pstdio-planner.create-ticket",
        title: "New ticket",
        submitLabel: "Create ticket",
        columnParam: "statusId",
        attributesParam: "attributes",
        params: {
          content: { type: "markdown", label: "Description", required: true },
          files: { type: "files", label: "Attach files", multiple: true },
        },
        attachments: {
          commandId: "pstdio-planner.attach-file",
          resourceParam: "ticketId",
          fileParam: "ref",
        },
      },
    } as WorkbenchExtensionKanbanRendererRecord;
    const attachment = new File(["evidence"], "evidence.txt", { type: "text/plain" });

    registerWorkbenchExtensionKanbanRenderers(
      {
        projectId: "project-1",
        workbench,
        executeCommand: async (commandId, request) => {
          const params = request && typeof request === "object" && "params" in request ? request.params : {};
          calls.push({ commandId, params: params as Record<string, unknown> });
          return { id: "ticket-1", title: "Created ticket" };
        },
      },
      [record],
      {
        onAfterCreate: (input) => {
          afterCreate.push(input);
        },
      },
    );

    const renderer = workbench.renderers.getKanbanRenderer("tickets");

    expect(renderer?.createRow).toMatchObject({
      title: "New ticket",
      submitLabel: "Create ticket",
      fields: [
        { id: "content", type: "markdown", label: "Description", required: true },
        { id: "files", type: "files", label: "Attach files", multiple: true },
      ],
      labels: { cancel: "Cancel", properties: "Properties", removeFile: "Remove file" },
    });

    await renderer?.onCreateRow?.({
      columnId: "ready",
      columnAttributeId: "status",
      values: { content: "Fix ticket navigation" },
      attributeValues: {
        status: "ready",
        type: "default-type-bug",
        priority: ["default-priority-high"],
      },
      files: [attachment],
    });

    // Attributes travel as one structured param keyed by attribute id, so the
    // command can tell status from tags instead of receiving a flattened bag.
    expect(calls).toEqual([
      {
        commandId: "pstdio-planner.create-ticket",
        params: {
          renderer: {
            rendererId: "tickets",
            projectId: "project-1",
            invocation: { placement: "visible" },
          },
          content: "Fix ticket navigation",
          statusId: "ready",
          attributes: {
            status: "ready",
            type: "default-type-bug",
            priority: ["default-priority-high"],
          },
        },
      },
    ]);
    expect(afterCreate).toEqual([
      expect.objectContaining({
        created: { id: "ticket-1", title: "Created ticket" },
        submission: expect.objectContaining({ files: [attachment] }),
      }),
    ]);
  });
});
