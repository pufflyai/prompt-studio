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
