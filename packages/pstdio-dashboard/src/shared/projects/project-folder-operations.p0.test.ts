import { expect, test } from "bun:test";
import { getWorkbenchOperations } from "@pstdio/workbench";
import { getDashboardScopedQueries } from "@/lib/scoped-queries";
import { createRuntimeCollections } from "@/lib/sync/collections";
import { getProjectFolderAssignments } from "./project-folder-operations";

test("folder attachment and folder selection share admission and check the exact path", async () => {
  const writes: string[] = [];
  const entered = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  let confirmed = "/projects/other";
  const selected = "/projects/studio";
  const server = Bun.serve({
    port: 0,
    async fetch(request) {
      const path = new URL(request.url).pathname;
      if (path === "/v1/projects/project/initial-workspace") {
        const body = await request.json();
        writes.push(body.params.path);
        entered.resolve();
        await release.promise;
        return Response.json({ error: "Response lost" }, { status: 503 });
      }
      if (path === "/v1/projects/project/folder" && request.method === "GET")
        return Response.json({ path: confirmed, gitRemote: null });
      return Response.json({ error: "Unexpected route" }, { status: 404 });
    },
  });
  const owner = createRuntimeCollections({ baseUrl: server.url.origin, token: "test-token" });
  const assignments = getProjectFolderAssignments(owner);
  const operations = getWorkbenchOperations(getDashboardScopedQueries(owner));
  const authority = assignments.authority();
  const choose = () => assignments.assign("project", { mode: "choose", path: selected, clone: false }, authority);
  try {
    const attached = assignments.assign("project", { mode: "attach", path: selected }, authority);
    await entered.promise;
    expect(assignments.pending("project")).toMatchObject({ busy: true, working: true });
    await expect(choose()).rejects.toThrow("unfinished folder change");
    release.resolve();
    await expect(attached).rejects.toThrow("Response lost");
    const recovery = operations.getSnapshot().recovery[0]!;
    expect(recovery).toMatchObject({ draft: { path: selected }, status: "unknown", canCheck: true });
    await operations.check(recovery.id);
    expect(assignments.pending("project")).toMatchObject({ busy: true, working: false });
    confirmed = selected;
    await operations.check(recovery.id);
    expect(assignments.pending("project").busy).toBe(false);
    expect(writes).toEqual([selected]);
  } finally {
    release.resolve();
    await owner.dispose();
    await server.stop(true);
  }
});
