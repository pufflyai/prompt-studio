import { describe, expect, test } from "bun:test";
import { createScopedQueryClient } from "@pstdio/sdk/extensions";
import type { WorkbenchExtensionKanbanRendererRecord } from "pstdio-api-contracts";
import { createWorkbench, getWorkbenchRenderers } from "../../core";
import { getWorkbenchOperations } from "../../core/registries/mutations/operations";
import { registerWorkbenchExtensionKanbanRenderers } from "./kanban-renderer-contributions";

describe("registerWorkbenchExtensionKanbanRenderers create forms", () => {
  test("opens the saved ticket while the board and attachments are still updating", async () => {
    const queries = createScopedQueryClient({ runtimeId: "desktop", extensionId: "pstdio" });
    const workbench = createWorkbench({ queries });
    const operations = getWorkbenchOperations(queries);
    const write = Promise.withResolvers<{ id: string; title: string }>();
    const refreshStarted = Promise.withResolvers<void>();
    const refresh = Promise.withResolvers<void>();
    const attachment = Promise.withResolvers<void>();
    const calls: string[] = [];
    const record = {
      id: "tickets",
      extensionId: "planner",
      title: "Tickets",
      queryHandlerId: "query",
      rowActivationHandlerId: "activate",
      createRow: { commandId: "create" },
    } satisfies WorkbenchExtensionKanbanRendererRecord;
    registerWorkbenchExtensionKanbanRenderers(
      {
        projectId: "project",
        workbench,
        metadata: { commands: [{ id: "create", extensionId: "planner", title: "Create ticket", mutating: true }] },
        operations,
        createCommandIds: new Set(["create"]),
        executeCommand: async (id) => {
          calls.push(id);
          if (id === "create") return write.promise;
        },
      },
      [record],
      {
        onAfterCreate: () => attachment.promise,
      },
    );
    const creation = getWorkbenchRenderers(workbench).getKanbanRenderer("tickets")!.onCreateRow!({
      columnId: "backlog",
      values: {},
      attributeValues: {},
      files: [new File(["evidence"], "evidence.txt")],
      originatingRead: {
        key: "board",
        refresh() {
          refreshStarted.resolve();
          return refresh.promise;
        },
      },
    });
    try {
      expect(calls).not.toContain("activate");
      write.resolve({ id: "saved", title: "New ticket" });
      await refreshStarted.promise;
      expect(calls).toEqual(["create", "activate"]);
    } finally {
      refresh.resolve();
      attachment.resolve();
      await creation;
      await workbench.dispose();
      queries.dispose();
    }
    expect(calls).toEqual(["create", "activate"]);
  });

  test("creates and finishes attachments without activating when opening is declined", async () => {
    const workbench = createWorkbench();
    const calls: string[] = [];
    const record = {
      id: "tickets",
      extensionId: "planner",
      title: "Tickets",
      queryHandlerId: "query",
      rowActivationHandlerId: "activate",
      createRow: { commandId: "create" },
    } satisfies WorkbenchExtensionKanbanRendererRecord;
    registerWorkbenchExtensionKanbanRenderers(
      {
        projectId: "project",
        workbench,
        executeCommand: async (commandId) => {
          calls.push(commandId);
          return { id: "new", title: "New ticket" };
        },
      },
      [record],
      {
        onAfterCreate: () => {
          calls.push("attach");
        },
      },
    );
    await getWorkbenchRenderers(workbench).getKanbanRenderer("tickets")?.onCreateRow?.({
      columnId: "backlog",
      values: {},
      attributeValues: {},
      files: [],
      openCreatedRow: false,
    });
    expect(calls).toEqual(["create", "attach"]);
  });

  test("activates the created row through the declared row target", async () => {
    const workbench = createWorkbench();
    const calls: Array<{ commandId: string; rowId?: unknown }> = [];
    const record = {
      id: "tickets",
      extensionId: "pstdio.planner",
      title: "Tickets",
      queryHandlerId: "pstdio-planner.tickets.query",
      rowActivationHandlerId: "pstdio-planner.tickets.onRowActivate",
      createRow: {
        commandId: "pstdio-planner.create-ticket",
      },
    } satisfies WorkbenchExtensionKanbanRendererRecord;

    registerWorkbenchExtensionKanbanRenderers(
      {
        projectId: "project-1",
        workbench,
        executeCommand: async (commandId, request) => {
          const row = request.params?.row as { id?: unknown } | undefined;
          calls.push({ commandId, rowId: row?.id });
          if (commandId === "pstdio-planner.create-ticket") {
            return {
              id: "ticket-1",
              title: "Created ticket",
              resource: { type: "ticket", id: "ticket-1" },
            };
          }
          return undefined;
        },
      },
      [record],
    );

    await getWorkbenchRenderers(workbench).getKanbanRenderer("tickets")?.onCreateRow?.({
      columnId: "ready",
      values: {},
      attributeValues: {},
      files: [],
    });

    expect(calls).toEqual([
      { commandId: "pstdio-planner.create-ticket", rowId: undefined },
      { commandId: "pstdio-planner.tickets.onRowActivate", rowId: "ticket-1" },
    ]);
  });

  test("runs renderer-owned create forms with declarative fields, editable attributes, and attachments", async () => {
    const workbench = createWorkbench();
    const calls: Array<{ commandId: string; params: Record<string, unknown> }> = [];
    const afterCreate: unknown[] = [];
    const record = {
      id: "tickets",
      extensionId: "pstdio.planner",
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

    const renderer = getWorkbenchRenderers(workbench).getKanbanRenderer("tickets");

    expect(renderer?.createRow).toMatchObject({
      title: "New ticket",
      submitLabel: "Create ticket",
      fields: [
        { id: "content", type: "markdown", label: "Description", required: true },
        { id: "files", type: "files", label: "Attach files", multiple: true },
      ],
      labels: { cancel: "Cancel", properties: "Properties", removeFile: "Remove file" },
    });
    expect(renderer?.createCommandId).toBe("pstdio-planner.create-ticket");

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
