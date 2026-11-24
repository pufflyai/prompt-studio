import { describe, expect, test } from "bun:test";
import { createWorkbench, getWorkbenchOperations } from "@pstdio/workbench";
import { getDashboardScopedQueries } from "@/lib/scoped-queries";
import { getRuntimeCollections } from "@/lib/sync/collections";
import type { ResolvedWorkbenchExtensionMetadata } from "@/shared/extensions/extension-localization";
import { createDashboardKanbanAdapter } from "./extension-kanban-adapter";
import { metadata, response } from "./module-test-fixtures";

describe("dashboard Kanban adapter", () => {
  test.each([
    false,
    true,
  ])("tracks creation attachments through the owning extension, interrupted=%s", async (interrupted) => {
    const uploads: { path: string; body: string; filename: string | null }[] = [];
    const commands: unknown[] = [];
    const saved: string[] = [];
    let discarded = false;
    const server = Bun.serve({
      port: 0,
      fetch: async (request) => {
        const path = new URL(request.url).pathname;
        if (!path.endsWith("/files")) return Response.json({});
        uploads.push({
          path,
          body: await request.text(),
          filename: request.headers.get("x-file-name"),
        });
        return Response.json({ id: `attachment-${uploads.length}`, name: uploads.at(-1)?.filename });
      },
    });
    const runtime = globalThis as typeof globalThis & { __PSTDIO_CONFIG__?: { apiBaseUrl?: string } };
    runtime.__PSTDIO_CONFIG__ = { apiBaseUrl: server.url.toString() };
    try {
      const owner = getRuntimeCollections();
      const queries = getDashboardScopedQueries(owner);
      const ctx = createWorkbench({ queries });
      const adapter = createDashboardKanbanAdapter({
        ctx,
        owner,
        executeCommand: async (...args) => {
          commands.push(args);
          if (interrupted && commands.length === 2)
            return { ...response, outcome: { ok: false, status: "error", reason: "Attachment result unavailable" } };
          return response;
        },
        metadata: {
          ...metadata,
          extensions: [{ ...metadata.extensions[0], extensionInstanceId: "installed-lab" }],
        } as ResolvedWorkbenchExtensionMetadata,
        projectId: "project-1",
      });
      const operation = adapter.onAfterCreate?.({
        record: {
          id: "pstdio.extension-lab.view.board",
          extensionId: "pstdio.extension-lab",
          title: "Board",
          resourceKind: "ticket",
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
          files: [
            new File(["First file"], "draft.txt"),
            ...(interrupted ? [new File(["Keep this file"], "pending.txt")] : []),
          ],
          onAttachmentSaved: (file) => saved.push(file.name),
          onDiscard: () => {
            discarded = true;
          },
          openCreatedRow: false,
        },
      });
      if (interrupted) {
        await expect(operation).rejects.toThrow("Some files still need attention");
        const operations = getWorkbenchOperations(queries);
        const recovery = operations.getSnapshot().recovery[0]!;
        expect(recovery).toMatchObject({
          domain: "resource.attachments",
          source: { id: "ticket-1", projectId: "project-1" },
          status: "unknown",
          canCheck: false,
          draft: { resourceId: "ticket-1", filenames: ["pending.txt"] },
        });
        expect(commands).toHaveLength(2);
        expect(saved).toEqual(["draft.txt"]);
        operations.discard(recovery.id);
        expect(discarded).toBe(true);
        expect(commands).toHaveLength(2);
        return;
      }
      await operation;
      expect(saved).toEqual(["draft.txt"]);
      expect(uploads).toEqual([
        { path: "/v1/projects/project-1/extensions/installed-lab/files", body: "First file", filename: "draft.txt" },
      ]);
      expect(commands).toEqual([
        [
          "project-1",
          "attach",
          { params: { ticketId: "ticket-1", ref: { id: "attachment-1", name: "draft.txt" } } },
          expect.any(AbortSignal),
        ],
      ]);
    } finally {
      delete runtime.__PSTDIO_CONFIG__;
      server.stop(true);
    }
  });
});
