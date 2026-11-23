import { expect, test } from "bun:test";
import { getWorkbenchOperations } from "@pstdio/workbench";
import { getDashboardQueryClient } from "@/lib/query-client";
import { getDashboardScopedQueries } from "@/lib/scoped-queries";
import { createRuntimeCollections } from "@/lib/sync/collections";
import type { ProjectTemplateAsset } from "./template-provider-api";
import { getTemplateSaves } from "./use-templates";

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
  const saves = getTemplateSaves(owner);
  const scope = saves.scopeKey();
  const operations = getWorkbenchOperations(getDashboardScopedQueries(owner));
  const client = getDashboardQueryClient(owner);
  try {
    const sending = saves.save(template, "New text", scope);
    await entered.promise;
    expect(getTemplateSaves(owner).active(template)?.intent).toBe("New text");
    release.resolve();
    await expect(sending).rejects.toThrow("Response lost");
    await expect(getTemplateSaves(owner).save(template, "Another version", scope)).rejects.toThrow("unfinished save");
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
