import { expect, test } from "bun:test";
import { getWorkbenchOperations } from "@pstdio/workbench";
import { getDashboardScopedQueries } from "@/lib/scoped-queries";
import { createRuntimeCollections } from "@/lib/sync/collections";
import { getResourceLinkOperations } from "./resource-link-operations";

test("both ends see a held link change and its ordered successor before the requests complete", async () => {
  const firstRequest = Promise.withResolvers<void>();
  const releaseWrite = Promise.withResolvers<void>();
  const refreshing = Promise.withResolvers<void>();
  const releaseRead = Promise.withResolvers<void>();
  const writes: string[] = [];
  const server = Bun.serve({
    port: 0,
    async fetch(request) {
      const route = new URL(request.url).pathname;
      if (!route.includes("/resource-anchors/")) return Response.json({}, { status: 404 });
      writes.push(route.split("/").at(-1)!);
      if (writes.length === 1) {
        firstRequest.resolve();
        await releaseWrite.promise;
      }
      return Response.json({ ok: true });
    },
  });
  const runtime = createRuntimeCollections({ baseUrl: server.url.origin, token: "" });
  const resource = (id: string) => ({ type: "workspace", id, extensionId: "pstdio", projectId: "project" });
  const source = resource("source");
  const target = resource("target");
  const links = getResourceLinkOperations(runtime);
  const outgoing = links(source);
  const incoming = links(target);
  const third = links(resource("third"));
  const unobserve = incoming.changes!.observe(async () => {
    refreshing.resolve();
    await releaseRead.promise;
  });
  try {
    const removal = outgoing.remove(source, [target]);
    expect(outgoing.changes!.getSnapshot().map(({ change }) => change.kind)).toEqual(["remove"]);
    expect(incoming.changes!.getSnapshot()).toEqual(outgoing.changes!.getSnapshot());
    expect(third.changes!.getSnapshot()).toEqual([]);
    await firstRequest.promise;
    const addition = incoming.add(source, [{ ...target, role: "source" }]);
    expect(incoming.changes!.getSnapshot().map(({ status }) => status)).toEqual(["writing", "queued"]);
    releaseWrite.resolve();
    await refreshing.promise;
    expect(writes).toEqual(["remove"]);
    expect(incoming.changes!.getSnapshot().map(({ status }) => status)).toEqual(["reconciling", "queued"]);
    releaseRead.resolve();
    await Promise.all([removal, addition]);
    expect(writes).toEqual(["remove", "add"]);
    expect(outgoing.changes!.getSnapshot()).toEqual([]);
  } finally {
    releaseWrite.resolve();
    releaseRead.resolve();
    unobserve();
    await runtime.dispose();
    await server.stop(true);
  }
});

test("a rejected link change drops its preview and an ambiguous write keeps the submitted relationship", async () => {
  const responses = [403, 503];
  const read = { items: [] as unknown[], nextCursor: "later" };
  const server = Bun.serve({
    port: 0,
    fetch(request) {
      const route = new URL(request.url).pathname;
      if (route.endsWith("/query-page")) return Response.json(read);
      const status = route.includes("/resource-anchors/") ? responses.shift()! : 404;
      return Response.json({ error: "Unavailable relationship" }, { status });
    },
  });
  const runtime = createRuntimeCollections({ baseUrl: server.url.origin, token: "" });
  const source = { type: "workspace", id: "source", extensionId: "pstdio", projectId: "project" };
  const target = { ...source, id: "target", role: "context" as const };
  const links = getResourceLinkOperations(runtime)(source);
  try {
    await expect(links.add(source, [target])).rejects.toThrow();
    expect(links.changes!.getSnapshot()).toEqual([]);
    await expect(links.remove(source, [target])).rejects.toThrow();
    expect(links.changes!.getSnapshot()).toMatchObject([{ status: "unknown" }]);
    const operation = getWorkbenchOperations(getDashboardScopedQueries(runtime));
    const recovery = operation.getSnapshot().recovery.at(-1)!;
    expect(recovery).toMatchObject({
      status: "unknown",
      canCheck: true,
      draft: { kind: "remove", source, targets: [target] },
    });
    await expect(links.add(source, [target])).rejects.toThrow("unconfirmed");
    await operation.check(recovery.id);
    expect(links.changes!.getSnapshot()).toMatchObject([{ status: "unknown" }]);
    read.nextCursor = "";
    await operation.check(recovery.id);
    expect(links.changes!.getSnapshot()).toEqual([]);
    expect(responses).toEqual([]);
  } finally {
    await runtime.dispose();
    await server.stop(true);
  }
});

test("a retained link control cannot write after account authority changes and returns", async () => {
  let writes = 0;
  const server = Bun.serve({
    port: 0,
    fetch(request) {
      if (!new URL(request.url).pathname.endsWith("/remove")) return Response.json({}, { status: 404 });
      writes++;
      return Response.json({ ok: true });
    },
  });
  const runtime = createRuntimeCollections({ baseUrl: server.url.origin, token: "" });
  const source = { type: "workspace", id: "source", extensionId: "pstdio", projectId: "project" };
  const target = { ...source, id: "target" };
  const root = getDashboardScopedQueries(runtime);
  const createLinks = getResourceLinkOperations(runtime);
  try {
    root.setAuthority({ accountId: "a" });
    const old = createLinks(source);
    root.setAuthority({ accountId: "b" });
    await expect(old.remove(source, [target])).rejects.toThrow("closed project or account");
    root.setAuthority({ accountId: "a" });
    await expect(old.remove(source, [target])).rejects.toThrow("closed project or account");
    await createLinks(source).remove(source, [target]);
    expect(writes).toBe(1);
  } finally {
    await runtime.dispose();
    await server.stop(true);
  }
});

test("verification accepts a personal pointer with the original directed link and role", async () => {
  const source = { type: "workspace", id: "source", extensionId: "pstdio", projectId: "project" };
  const pointer = { ...source, id: "personal-target", device: { ownerId: "owner", id: "device", name: "Laptop" } };
  const target = { ...pointer, label: "Private title", role: "source" as const };
  let writes = 0;
  let confirmedRole = "context";
  const server = Bun.serve({
    port: 0,
    fetch(request) {
      const route = new URL(request.url).pathname;
      if (route.endsWith("/query-page"))
        return Response.json({ items: [{ source, target: { ...pointer, role: confirmedRole } }], nextCursor: "later" });
      if (route.endsWith("/add")) {
        writes++;
        return Response.json({ error: "Connection lost" }, { status: 503 });
      }
      return Response.json({}, { status: 404 });
    },
  });
  const runtime = createRuntimeCollections({ baseUrl: server.url.origin, token: "" });
  const links = getResourceLinkOperations(runtime)(source);
  try {
    await expect(links.add(source, [target])).rejects.toThrow();
    const operations = getWorkbenchOperations(getDashboardScopedQueries(runtime));
    const pending = operations.getSnapshot().recovery[0]!;
    await operations.check(pending.id);
    expect(links.changes!.getSnapshot()).toMatchObject([{ status: "unknown" }]);
    confirmedRole = "source";
    await operations.check(pending.id);
    expect(links.changes!.getSnapshot()).toEqual([]);
    expect(writes).toBe(1);
  } finally {
    await runtime.dispose();
    await server.stop(true);
  }
});
