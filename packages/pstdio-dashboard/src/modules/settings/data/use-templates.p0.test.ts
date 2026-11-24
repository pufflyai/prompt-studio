import { expect, test } from "bun:test";
import { getWorkbenchOperations } from "@pstdio/workbench";
import { getDashboardQueryClient } from "@/lib/query-client";
import { getDashboardScopedQueries } from "@/lib/scoped-queries";
import { createRuntimeCollections } from "@/lib/sync/collections";
import type { ProjectTemplateAsset } from "./template-provider-api";
import { getTemplateOperations } from "./use-templates";

const template: ProjectTemplateAsset = {
  id: "planner.prompt:review",
  projectId: "project",
  localType: "prompt",
  templateType: "planner.prompt",
  name: "review",
  title: "Review",
  groupLabel: "Prompts",
  groupOrder: 0,
  commands: { list: "list", read: "read", save: "save", delete: "delete" },
};

test("a lost template save keeps the same text across views and checks the exact template without saving again", async () => {
  let stored = "Old text";
  let writes = 0;
  const entered = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  const server = Bun.serve({
    port: 0,
    async fetch(request) {
      const path = new URL(request.url).pathname;
      if (request.method === "POST") await request.json();
      if (path.endsWith("/save/execute")) {
        writes++;
        entered.resolve();
        await release.promise;
        return Response.json({ error: "Response lost" }, { status: 503 });
      }
      if (path.endsWith("/read/execute"))
        return Response.json({
          outcome: {
            ok: true,
            status: "success",
            value: { name: "review", title: "Review", type: "prompt", content: stored },
          },
        });
      return Response.json({ error: "Unexpected request" }, { status: 404 });
    },
  });
  const owner = createRuntimeCollections({ baseUrl: server.url.origin, token: "test-token" });
  const saves = getTemplateOperations(owner);
  const scope = saves.scopeKey();
  const operations = getWorkbenchOperations(getDashboardScopedQueries(owner));
  const client = getDashboardQueryClient(owner);
  try {
    const sending = saves.save(template, "New text", scope);
    await entered.promise;
    expect(getTemplateOperations(owner).active(template)?.intent).toBe("New text");
    release.resolve();
    await expect(sending).rejects.toThrow("Response lost");
    await expect(getTemplateOperations(owner).save(template, "Another version", scope)).rejects.toThrow(
      "unfinished change",
    );
    const recovery = operations.getSnapshot().recovery[0]!;
    expect(recovery).toMatchObject({ status: "unknown", draft: "New text", canCheck: true });
    await operations.check(recovery.id);
    expect(saves.active(template)?.status).toBe("unknown");
    stored = "New text";
    await operations.check(recovery.id);
    expect(saves.active(template)).toBeUndefined();
    expect(client.getQueryData(["project-template", scope, template.projectId, template.id])).toMatchObject({
      content: stored,
    });
    expect(writes).toBe(1);
  } finally {
    release.resolve();
    await owner.dispose();
    await server.stop(true);
  }
});

test.each([
  200, 503,
])("template deletion keeps one write and separates a receipt from a lost response (%i)", async (status) => {
  const entered = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  const stored = { name: "review", title: "Review", type: "prompt", content: "Original" };
  let current: typeof stored | null = stored;
  let deletes = 0;
  let reads = 0;
  const server = Bun.serve({
    port: 0,
    async fetch(request) {
      const path = new URL(request.url).pathname;
      if (path.endsWith("/delete/execute")) {
        deletes++;
        expect((await request.json()).params).toEqual({ name: "review" });
        entered.resolve();
        await release.promise;
        const response =
          status === 200
            ? { outcome: { ok: true, status: "success", value: { deleted: true } } }
            : { error: "Response lost" };
        return Response.json(response, { status });
      }
      if (path.endsWith("/read/execute")) {
        reads++;
        expect((await request.json()).params).toEqual({ name: "review" });
        return Response.json({ outcome: { ok: true, status: "success", value: current } });
      }
      return Response.json({ error: "Unexpected request" }, { status: 404 });
    },
  });
  const owner = createRuntimeCollections({ baseUrl: server.url.origin, token: "test-token" });
  const templates = getTemplateOperations(owner);
  const scope = templates.scopeKey();
  const operations = getWorkbenchOperations(getDashboardScopedQueries(owner));
  const client = getDashboardQueryClient(owner);
  const queryKey = ["project-template", scope, template.projectId, template.id];
  try {
    client.setQueryData(queryKey, stored);
    const draft = status === 200 ? "Unsaved edit" : undefined;
    const removing = templates.remove(template, draft, scope);
    await entered.promise;
    expect(getTemplateOperations(owner).active(template)?.title).toBe("Delete Review");
    await expect(templates.save(template, "New text", scope)).rejects.toThrow("unfinished change");
    release.resolve();
    await expect(removing).rejects.toThrow(status === 200 ? "still available" : "Response lost");
    const recovery = operations.getSnapshot().recovery[0]!;
    expect(recovery).toMatchObject({
      status: status === 200 ? "unconfirmed" : "unknown",
      canCheck: status === 200,
      draft: draft ?? { name: "review", type: "prompt" },
    });
    expect(client.getQueryData(queryKey)).toEqual(stored);
    current = null;
    if (status === 200) {
      await operations.check(recovery.id);
      expect(client.getQueryData(queryKey)).toEqual({ deleted: true });
      expect(templates.active(template)).toBeUndefined();
      expect(reads).toBe(2);
    } else {
      expect(templates.active(template)?.status).toBe("unknown");
      expect(reads).toBe(0);
      operations.discard(recovery.id);
      expect(templates.active(template)).toBeUndefined();
    }
    expect(deletes).toBe(1);
  } finally {
    release.resolve();
    await owner.dispose();
    await server.stop(true);
  }
});
