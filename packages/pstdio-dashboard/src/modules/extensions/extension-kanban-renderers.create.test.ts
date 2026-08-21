import { describe, expect, test } from "bun:test";
import type { CommandExecuteResponse } from "@pstdio/sdk/api";
import { createWorkbenchCore } from "@pstdio/workbench";
import {
  type DashboardExtensionMetadata,
  emptyDashboardExtensionMetadata,
} from "@/shared/extensions/workbench-extension-contributions";
import { registerExtensionKanbanRenderers } from "./extension-kanban-renderers";

const ticketsRecord = {
  id: "pstdio-planner.tickets",
  extensionId: "pstdio.pstdio-planner",
  extensionInstanceId: "planner-instance",
  title: "Tickets",
  resourceKind: "ticket",
  queryHandlerId: "pstdio-planner.tickets.query",
  createRow: {
    commandId: "pstdio-planner.create-ticket",
    columnParam: "statusId",
    attributesParam: "attributes",
    params: {
      content: { type: "markdown" as const, label: "Description", required: true },
      files: { type: "files" as const, label: "Attach files", multiple: true },
    },
    attachments: {
      commandId: "pstdio-planner.attach-file",
      resourceParam: "ticketId",
      fileParam: "ref",
    },
  },
};

const metadata: DashboardExtensionMetadata = {
  ...emptyDashboardExtensionMetadata,
  kanbanRenderers: [ticketsRecord],
};

const response = (commandId: string, value: unknown): CommandExecuteResponse => ({
  commandId,
  extensionId: "pstdio.pstdio-planner",
  outcome: { ok: true, status: "success", value },
});

describe("registerExtensionKanbanRenderers create form", () => {
  test("creates, uploads attachments, attaches them, and opens the created resource", async () => {
    const workbench = createWorkbenchCore();
    const commandCalls: Array<{ commandId: string; body: unknown }> = [];
    const uploadCalls: Array<{ file: File; resourceId: string }> = [];
    const openedResources: Array<{ id?: string; kind: string; label?: string }> = [];
    const attachment = new File(["evidence"], "evidence.txt", { type: "text/plain" });

    workbench.registerModule({
      id: "test.extensions",
      activate: (ctx) => [
        ...registerExtensionKanbanRenderers(ctx, {
          metadata,
          projectId: "proj-1",
          executeCommand: async (_projectId, commandId, body) => {
            commandCalls.push({ commandId, body });
            return response(
              commandId,
              commandId === "pstdio-planner.create-ticket"
                ? {
                    id: "ticket-1",
                    shorthand: "PS-1",
                    title: "Created ticket",
                    resource: {
                      type: "ticket",
                      id: "ticket-1",
                      label: "PS-1 Created ticket",
                      metadata: {
                        shorthand: "PS-1",
                        resourceParent: {
                          type: "extension-view",
                          id: "pstdio-planner.tickets",
                          label: "Tickets",
                        },
                      },
                    },
                  }
                : {},
            );
          },
          uploadFile: async ({ file, resourceId }) => {
            uploadCalls.push({ file, resourceId });
            return { id: "file-1", name: file.name };
          },
        }),
        ctx.layout.registerPanel({
          id: "test.ticket",
          title: "Ticket",
          region: "main",
          rendererId: "test",
        }),
        ctx.resources.registerPresenter({
          id: "test.ticket-presenter",
          canOpen: (resource) => resource.kind === "ticket",
          open: (resource) => {
            openedResources.push(resource);
            return ctx.layout.openPanel("test.ticket", { resource });
          },
        }),
      ],
    });

    await workbench.renderers.getKanbanRenderer(ticketsRecord.id)?.onCreateRow?.({
      columnId: "ready",
      columnAttributeId: "status",
      values: { content: "Created ticket" },
      attributeValues: { status: "ready", type: "default-type-bug" },
      files: [attachment],
    });
    await Promise.resolve();

    expect(commandCalls).toEqual([
      {
        commandId: "pstdio-planner.create-ticket",
        body: expect.objectContaining({
          params: expect.objectContaining({
            renderer: {
              rendererId: "pstdio-planner.tickets",
              projectId: "proj-1",
              invocation: { placement: "visible" },
            },
            content: "Created ticket",
            statusId: "ready",
            attributes: { status: "ready", type: "default-type-bug" },
          }),
        }),
      },
      {
        commandId: "pstdio-planner.attach-file",
        body: {
          params: {
            ticketId: "ticket-1",
            ref: { id: "file-1", name: "evidence.txt" },
          },
        },
      },
    ]);
    expect(uploadCalls).toEqual([{ file: attachment, resourceId: "ticket-1" }]);
    expect(openedResources).toEqual([
      expect.objectContaining({
        kind: "ticket",
        id: "ticket-1",
        label: "PS-1 Created ticket",
        metadata: {
          projectId: "proj-1",
          shorthand: "PS-1",
          resourceParent: {
            type: "extension-view",
            id: "pstdio-planner.tickets",
            label: "Tickets",
          },
        },
      }),
    ]);
  });
});
