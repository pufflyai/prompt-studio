import { expect, test } from "bun:test";
import type { ExtensionSettingValueRecord } from "@pstdio/sdk/api";
import { getWorkbenchOperations } from "@pstdio/workbench";
import { getDashboardScopedQueries } from "@/lib/scoped-queries";
import { createRuntimeCollections } from "@/lib/sync/collections";
import { getExtensionSettingOperations } from "./extension-setting-operations";
import { createDashboardWebviewSettingsAdapter } from "./webview-service-adapters";

const initial = {
  key: "mode",
  extensionId: "example.fixture",
  scope: "device",
  type: "string",
  default: "Initial",
  source: "default",
  value: "Initial",
} satisfies ExtensionSettingValueRecord;
const viewA = { projectId: "a", instanceId: "source", installedExtensionId: "shared-install" };
const viewB = { projectId: "b", instanceId: "peer", installedExtensionId: "shared-install" };

test("a device setting shows the pending choice across project forms and dashboard webviews", async () => {
  const enter = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  const reads: string[] = [];
  let writes = 0;
  let stored: ExtensionSettingValueRecord = initial;
  const server = Bun.serve({
    port: 0,
    async fetch(request) {
      const path = new URL(request.url).pathname;
      if (!path.endsWith("/settings/mode")) return new Response(null, { status: 404 });
      if (request.method === "PUT") {
        writes++;
        expect(await request.json()).toEqual({ value: "Requested text" });
        enter.resolve();
        await release.promise;
        return Response.json({ error: "Response lost" }, { status: 503 });
      }
      reads.push(path);
      return Response.json(stored);
    },
  });
  const owner = createRuntimeCollections({ baseUrl: server.url.origin, token: "test-token" });
  const settings = getExtensionSettingOperations(owner);
  const operations = getWorkbenchOperations(getDashboardScopedQueries(owner));
  let peerRecord: ExtensionSettingValueRecord = initial;
  const stop = settings.observe({
    target: viewB,
    current: () => peerRecord,
    accept: (record) => {
      peerRecord = record;
    },
  });
  const webview = createDashboardWebviewSettingsAdapter(
    owner,
    { projectId: viewB.projectId, extensionInstanceId: viewB.instanceId, extensionId: initial.extensionId },
    viewB.installedExtensionId,
    () => {},
  )!;
  try {
    const write = settings.update(viewA, initial, "Requested text", () => {});
    await enter.promise;
    expect(settings.project(viewB, initial).value).toBe("Requested text");
    expect(settings.project(viewB, { ...initial, extensionId: "another.owner" }).value).toBe("Initial");
    expect(await webview.get("mode")).toBe("Requested text");
    release.resolve();
    await expect(write).rejects.toThrow("Response lost");
    const recovery = operations.getSnapshot().recovery[0]!;
    expect(recovery).toMatchObject({ status: "unknown", draft: { key: "mode", extensionId: initial.extensionId } });
    expect(JSON.stringify(recovery.draft)).not.toContain("Requested text");
    await expect(webview.set("mode", "Next")).rejects.toThrow("unfinished change");
    await operations.check(recovery.id);
    expect(operations.getSnapshot().recovery[0]?.status).toBe("unknown");
    stored = { ...initial, source: "stored", value: "Requested text" };
    await operations.check(recovery.id);
    expect(peerRecord).toEqual(stored);
    expect(writes).toBe(1);
    expect(reads.filter((path) => path.includes("/projects/a/"))).toHaveLength(2);
  } finally {
    stop();
    release.resolve();
    await owner.dispose();
    await server.stop(true);
  }
});

test("a later observer value survives the record read used to finish a setting change", async () => {
  const entered = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  const accepted = { ...initial, source: "stored", value: "Requested text" } satisfies ExtensionSettingValueRecord;
  const server = Bun.serve({
    port: 0,
    async fetch(request) {
      if (!new URL(request.url).pathname.endsWith("/settings/mode")) return new Response(null, { status: 404 });
      if (request.method === "GET") {
        entered.resolve();
        await release.promise;
      }
      return Response.json(accepted);
    },
  });
  const owner = createRuntimeCollections({ baseUrl: server.url.origin, token: "test-token" });
  const settings = getExtensionSettingOperations(owner);
  let current: ExtensionSettingValueRecord = initial;
  const stop = settings.observe({
    target: viewB,
    current: () => current,
    accept: (record) => {
      current = record;
    },
  });
  try {
    const result = settings.update(viewA, initial, accepted.value, () => {});
    await entered.promise;
    current = { ...accepted, value: "Newer value" };
    release.resolve();
    await result;
    expect(current.value).toBe("Newer value");
    expect(settings.project(viewB, current).value).toBe("Newer value");
  } finally {
    stop();
    release.resolve();
    await owner.dispose();
    await server.stop(true);
  }
});

test("resetting a shared device setting preserves the peer version's declaration", async () => {
  const stored = { ...initial, source: "stored", value: "Setting override" } as const;
  const peerDefault = { ...initial, title: "Peer title", default: "Peer default", value: "Peer default" };
  const viewC = { ...viewB, installedExtensionId: "different-version" };
  const release = Promise.withResolvers<void>();
  const server = Bun.serve({
    port: 0,
    async fetch(request) {
      if (request.method === "DELETE") {
        await release.promise;
        return new Response(null, { status: 204 });
      }
      return Response.json(initial);
    },
  });
  const owner = createRuntimeCollections({ baseUrl: server.url.origin, token: "test-token" });
  const settings = getExtensionSettingOperations(owner);
  let peer: ExtensionSettingValueRecord = { ...peerDefault, source: stored.source, value: stored.value };
  const stop = settings.observe({
    target: viewC,
    current: () => peer,
    accept: (record) => {
      peer = record;
    },
  });
  try {
    const reset = settings.update(viewA, stored, undefined, () => {});
    expect(settings.project(viewC, peer)).toEqual(peerDefault);
    release.resolve();
    await reset;
    expect(peer).toEqual(peerDefault);
  } finally {
    stop();
    release.resolve();
    await owner.dispose();
    await server.stop(true);
  }
});

test("a live authorized instance can verify a device write after its source project disappears", async () => {
  const accepted = { ...initial, source: "stored", value: "Stored before disconnect" } as const;
  const readPaths: string[] = [];
  const server = Bun.serve({
    port: 0,
    fetch(request) {
      const path = new URL(request.url).pathname;
      if (!path.endsWith("/settings/mode")) return new Response(null, { status: 404 });
      if (request.method === "PUT") return Response.json({ error: "Response lost" }, { status: 503 });
      readPaths.push(path);
      return path.includes("/projects/b/")
        ? Response.json(accepted)
        : Response.json({ error: "Project missing" }, { status: 404 });
    },
  });
  const owner = createRuntimeCollections({ baseUrl: server.url.origin, token: "test-token" });
  const settings = getExtensionSettingOperations(owner);
  const operations = getWorkbenchOperations(getDashboardScopedQueries(owner));
  let peer: ExtensionSettingValueRecord = initial;
  const stop = settings.observe({
    target: viewB,
    current: () => peer,
    accept: (record) => {
      peer = record;
    },
  });
  try {
    await expect(settings.update(viewA, initial, accepted.value, () => {})).rejects.toThrow("Response lost");
    const recovery = operations.getSnapshot().recovery[0]!;
    await operations.check(recovery.id);
    expect(readPaths).toEqual([expect.stringContaining("/projects/a/"), expect.stringContaining("/projects/b/")]);
    expect(peer).toEqual(accepted);
    expect(operations.getSnapshot().recovery).toEqual([]);
  } finally {
    stop();
    await owner.dispose();
    await server.stop(true);
  }
});
