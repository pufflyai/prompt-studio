import { describe, expect, test } from "bun:test";
import type { AttributeDescriptor } from "@pstdio/ui/kanban-renderer";
import { createWorkbench } from "@pstdio/workbench";
import type { ResolvedWorkbenchExtensionMetadata } from "@/shared/extensions/extension-localization";
import { createDashboardKanbanAdapter } from "./extension-kanban-adapter";
import { metadata, response } from "./module-test-fixtures";

describe("dashboard Kanban adapter", () => {
  test("uploads creation attachments through the owning extension instance", async () => {
    const uploads: { path: string; body: string; filename: string | null }[] = [];
    const commands: unknown[] = [];
    const server = Bun.serve({
      port: 0,
      fetch: async (request) => {
        uploads.push({
          path: new URL(request.url).pathname,
          body: await request.text(),
          filename: request.headers.get("x-file-name"),
        });
        return Response.json({ id: "attachment-1", name: "draft.txt" });
      },
    });
    const runtime = globalThis as typeof globalThis & { __PSTDIO_CONFIG__?: { apiBaseUrl?: string } };
    runtime.__PSTDIO_CONFIG__ = { apiBaseUrl: server.url.toString() };
    try {
      const ctx = createWorkbench();
      const adapter = createDashboardKanbanAdapter({
        ctx,
        executeCommand: async (...args) => {
          commands.push(args);
          return response;
        },
        metadata: {
          ...metadata,
          extensions: [{ ...metadata.extensions[0], extensionInstanceId: "installed-lab" }],
        } as ResolvedWorkbenchExtensionMetadata,
        projectId: "project-1",
      });
      await adapter.onAfterCreate?.({
        record: {
          id: "pstdio.extension-lab.view.board",
          extensionId: "pstdio.extension-lab",
          title: "Board",
          queryHandlerId: "query",
          createRow: {
            commandId: "create",
            title: "New",
            submitLabel: "Create",
            attachments: { commandId: "attach", resourceParam: "ticketId", fileParam: "ref" },
          },
        },
        created: { id: "ticket-1" },
        submission: {
          columnId: "backlog",
          values: {},
          attributeValues: {},
          files: [new File(["Retained file"], "draft.txt")],
          openCreatedRow: false,
        },
      });
      expect(uploads).toEqual([
        { path: "/v1/projects/project-1/extensions/installed-lab/files", body: "Retained file", filename: "draft.txt" },
      ]);
      expect(commands).toEqual([
        ["project-1", "attach", { params: { ticketId: "ticket-1", ref: { id: "attachment-1", name: "draft.txt" } } }],
      ]);
    } finally {
      delete runtime.__PSTDIO_CONFIG__;
      server.stop(true);
    }
  });

  test("keeps non-workspace badge lists on the generic renderer", () => {
    const genericRender = () => "generic badge";
    const adapter = createDashboardKanbanAdapter({
      ctx: createWorkbench(),
      executeCommand: async () => response,
      metadata: metadata as ResolvedWorkbenchExtensionMetadata,
      projectId: "project-1",
    });
    const attribute = {
      id: "contributors",
      label: "Contributors",
      type: { kind: "string" },
      display: { kind: "badge-list", itemsAttributeId: "contributorItems" },
      render: genericRender,
    } satisfies AttributeDescriptor;

    const decorated = adapter.decorateAttribute?.({} as never, attribute);
    const rendered = decorated?.render?.("ada", {
      id: "recipe-1",
      title: "Soup",
      attributes: {
        contributorItems: [{ id: "ada", label: "Ada", resource: { type: "person", id: "ada" } }],
      },
    });

    expect(rendered).toBe("generic badge");
  });

  test("keeps mixed resource badge lists on the generic renderer", () => {
    const genericRender = () => "mixed badges";
    const adapter = createDashboardKanbanAdapter({
      ctx: createWorkbench(),
      executeCommand: async () => response,
      metadata: metadata as ResolvedWorkbenchExtensionMetadata,
      projectId: "project-1",
    });
    const attribute = {
      id: "participants",
      label: "Participants",
      type: { kind: "string" },
      display: { kind: "badge-list", itemsAttributeId: "participantItems" },
      render: genericRender,
    } satisfies AttributeDescriptor;

    const decorated = adapter.decorateAttribute?.({} as never, attribute);
    const rendered = decorated?.render?.("ada", {
      id: "recipe-1",
      title: "Soup",
      attributes: {
        participantItems: [
          { id: "ada", label: "Ada", resource: { type: "person", id: "ada" } },
          { id: "workspace-1", label: "Workspace", resource: { type: "workspace", id: "workspace-1" } },
        ],
      },
    });

    expect(rendered).toBe("mixed badges");
  });
});
