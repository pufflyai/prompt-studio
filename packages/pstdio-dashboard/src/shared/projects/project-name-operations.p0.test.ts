import { expect, test } from "bun:test";
import { getWorkbenchOperations } from "@pstdio/workbench";
import { getDashboardScopedQueries } from "@/lib/scoped-queries";
import { createRuntimeCollections } from "@/lib/sync/collections";
import { getProjectNameOperations } from "./project-name-operations";

test("project headers share a pending rename and read its exact name after a lost response", async () => {
  const entered = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  let canonical = "Original";
  let updates = 0;
  let reads = 0;
  const server = Bun.serve({
    port: 0,
    async fetch(request) {
      if (new URL(request.url).pathname !== "/v1/projects/project") return new Response(null, { status: 404 });
      if (request.method === "PATCH") {
        updates++;
        expect(await request.json()).toEqual({ name: "Requested" });
        entered.resolve();
        await release.promise;
        return Response.json({ error: "Response lost" }, { status: 503 });
      }
      reads++;
      return Response.json({ id: "project", name: canonical });
    },
  });
  const owner = createRuntimeCollections({ baseUrl: server.url.origin, token: "test-token" });
  const names = getProjectNameOperations(owner);
  const authority = names.authority();
  const row = { id: "project", name: canonical };
  const operations = getWorkbenchOperations(getDashboardScopedQueries(owner));
  try {
    owner.getWriter("projects")!.upsert(row);
    const result = names.rename(row.id, " Requested ", authority);
    await entered.promise;
    expect(names.name(row.id, row.name)).toBe("Requested");
    expect(getProjectNameOperations(owner).project(row)).toEqual({ ...row, name: "Requested" });
    expect(names.project({ id: "other", name: "Other project" }).name).toBe("Other project");
    expect(owner.getCollection("projects").get(row.id)?.name).toBe("Original");
    await expect(names.rename(row.id, "Another", authority)).rejects.toThrow("unfinished change");
    release.resolve();
    await expect(result).rejects.toThrow("Response lost");
    const recovery = operations.getSnapshot().recovery[0]!;
    expect(recovery).toMatchObject({ status: "unknown", draft: { name: "Requested" }, canCheck: true });
    await operations.check(recovery.id);
    expect(names.pending(row.id)?.status).toBe("unknown");
    canonical = "Requested";
    await operations.check(recovery.id);
    expect(names.pending(row.id)).toBeUndefined();
    expect(owner.getCollection("projects").get(row.id)?.name).toBe("Requested");
    expect(updates).toBe(1);
    expect(reads).toBe(2);
  } finally {
    release.resolve();
    await owner.dispose();
    await server.stop(true);
  }
});

test("a project name read-back preserves an unrelated live row update", async () => {
  const entered = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  const server = Bun.serve({
    port: 0,
    async fetch(request) {
      if (new URL(request.url).pathname !== "/v1/projects/project") return new Response(null, { status: 404 });
      if (request.method === "GET") {
        entered.resolve();
        await release.promise;
      }
      return Response.json({ id: "project", name: "Renamed" });
    },
  });
  const owner = createRuntimeCollections({ baseUrl: server.url.origin, token: "test-token" });
  const names = getProjectNameOperations(owner);
  const row = { id: "project", name: "Original", description: "Original description" };
  try {
    const writer = owner.getWriter("projects")!;
    writer.upsert(row);
    const renaming = names.rename(row.id, "Renamed", names.authority());
    await entered.promise;
    writer.upsert({ ...row, description: "Changed elsewhere" });
    release.resolve();
    await renaming;
    expect(owner.getCollection("projects").get(row.id)).toMatchObject({
      name: "Renamed",
      description: "Changed elsewhere",
    });
  } finally {
    release.resolve();
    await owner.dispose();
    await server.stop(true);
  }
});
