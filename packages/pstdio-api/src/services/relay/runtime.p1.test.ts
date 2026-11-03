import { expect, test } from "bun:test";
import { documentPeer } from "../../features/extensions/publication/document-peer.fixture";
import { createTestApp } from "../../test-utils/create-test-app";
import { startRelayRuntime } from "./runtime";

const unreachable = "http://127.0.0.1:9";

test("committed writes in a synced project announce storage changes for that project", async () => {
  const app = await createTestApp();
  const relay = await startRelayRuntime({ deps: app.deps });
  const announced: unknown[] = [];
  const stop = app.deps.eventBus.subscribe((event) => {
    if (event.table === "extension_events") announced.push(event.data);
  });
  try {
    const project = await app.deps.projectService.create({ name: "Synced" });
    await relay.update([
      {
        accountId: "account",
        workbenchId: project.id,
        environmentId: "device",
        relayOrigin: unreachable,
        managerOrigin: unreachable,
        renewalGrant: "grant",
      },
    ]);
    const { records } = await app.deps.extensionStorageService.open({
      owner: { workbenchId: project.id, extensionId: "example.notes" },
    });
    announced.length = 0;
    const writes = 10;
    await Promise.all(
      Array.from({ length: writes }, (_, index) =>
        records.commit({ operationId: `save-${index}`, edits: [{ recordId: `note-${index}`, replace: index }] }),
      ),
    );
    // Database commits can span several quiet windows on a busy runner.
    await Bun.sleep(300);
    expect(announced.length).toBeGreaterThan(0);
    for (const event of announced)
      expect(event).toEqual({
        id: expect.any(String),
        projectId: project.id,
        eventId: "pstdio.event.storage-changed",
      });
  } finally {
    stop();
    await relay.close();
    await app.close();
  }
});

test("turning Cloud back on starts fresh owners after workspace events during shutdown", async () => {
  const app = await createTestApp();
  const project = await app.deps.projectService.create({ name: "Cloud lifecycle" });
  const peer = documentPeer();
  const originalFetch = globalThis.fetch;
  const initialKeys = Promise.withResolvers<void>();
  const freshKeys = Promise.withResolvers<void>();
  const releases = new Set<() => void>();
  let keyRequests = 0;
  let removing = false;
  let emitting = false;
  let refreshes = 0;
  let reenabled = false;
  app.deps.accountService.devices = async () => [];
  globalThis.fetch = (async (request: Parameters<typeof fetch>[0], init?: RequestInit) => {
    const url = request instanceof Request ? request.url : String(request);
    if (url.startsWith(peer.origin) && url.endsWith("/keys")) {
      keyRequests++;
      if (keyRequests >= 4) initialKeys.resolve();
      if (reenabled && keyRequests >= 8) freshKeys.resolve();
      await new Promise<void>((resolve, reject) => {
        const signal = init?.signal;
        const release = () => {
          signal?.removeEventListener("abort", abort);
          releases.delete(release);
          resolve();
        };
        const abort = () => {
          releases.delete(release);
          reject(signal?.reason);
        };
        releases.add(release);
        if (signal?.aborted) abort();
        else signal?.addEventListener("abort", abort, { once: true });
      });
    }
    return originalFetch(request, init);
  }) as typeof fetch;
  const relay = await startRelayRuntime({
    deps: app.deps,
    statusChanged: () => {
      if (!removing || emitting || refreshes >= 2) return;
      refreshes++;
      emitting = true;
      app.deps.eventBus.emit("workspaces", "set", { id: "changed-during-shutdown", project_id: project.id });
      emitting = false;
    },
  });
  const config = {
    accountId: "account",
    workbenchId: project.id,
    environmentId: "device",
    relayOrigin: peer.origin,
    managerOrigin: peer.origin,
    renewalGrant: "grant",
  };
  try {
    await relay.update([config]);
    await initialKeys.promise;
    removing = true;
    await relay.update([]);
    removing = false;
    keyRequests = 4;
    reenabled = true;
    await relay.update([config]);
    expect(await Promise.race([freshKeys.promise.then(() => true), Bun.sleep(500).then(() => false)])).toBe(true);
  } finally {
    removing = false;
    await relay.close();
    for (const release of releases) release();
    globalThis.fetch = originalFetch;
    await peer.close();
    await app.close();
  }
});

test.each(["version", "quota"])("a refused live channel reaches the account error display: %s", async (refusal) => {
  const app = await createTestApp();
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch(request, server) {
      if (new URL(request.url).pathname === "/v1/environment-access")
        return Response.json({ token: "access", expiresAt: new Date(Date.now() + 60_000).toISOString() });
      if (server.upgrade(request)) return;
      return new Response(null, { status: 404 });
    },
    websocket: {
      open(socket) {
        socket.send(JSON.stringify({ type: "ready", protocolVersion: refusal === "version" ? 1 : 2 }));
      },
      message(socket, data) {
        const message = JSON.parse(String(data));
        if (message.requestId)
          socket.send(JSON.stringify({ type: "control-result", requestId: message.requestId, retryAfterMs: null }));
      },
    },
  });
  const relay = await startRelayRuntime({ deps: app.deps });
  try {
    const project = await app.deps.projectService.create({ name: "Needs update" });
    await relay.update([
      {
        accountId: "owner",
        workbenchId: project.id,
        environmentId: "device",
        managerOrigin: server.url.origin,
        relayOrigin: server.url.origin,
        renewalGrant: "grant",
      },
    ]);
    let error: unknown;
    const end = Date.now() + 1000;
    while (!error && Date.now() < end) {
      error = await relay.status(project.id).then(
        () => undefined,
        (error) => error,
      );
      if (!error) await Bun.sleep(1);
    }
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toContain(
      refusal === "version" ? "Update Prompt Studio or the relay" : "rate limits prevent Cloud subscriptions",
    );
  } finally {
    await relay.close();
    await server.stop(true);
    await app.close();
  }
});
