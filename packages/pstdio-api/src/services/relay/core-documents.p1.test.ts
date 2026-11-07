import { expect, test } from "bun:test";
import { coreOwnerId, projectInfoDocumentId } from "pstdio-sync/records";
import { createLiveConnection } from "pstdio-sync/relay";
import { createTestApp } from "../../test-utils/create-test-app";
import { startCoreDocumentSync } from "./core-documents";

test("removing core document sync closes while access renewal is still pending", async () => {
  const app = await createTestApp();
  const entered = Promise.withResolvers<void>();
  const renewal = Promise.withResolvers<{ token: string; expiresAt: string }>();
  const controller = new AbortController();
  const access = () => {
    entered.resolve();
    return renewal.promise;
  };
  const connection = startCoreDocumentSync({
    deps: app.deps,
    config: {
      accountId: "account",
      workbenchId: "project",
      environmentId: "device",
      relayOrigin: "http://127.0.0.1:9",
      managerOrigin: "http://127.0.0.1:9",
      renewalGrant: "grant",
    },
    signal: controller.signal,
    access,
    live: createLiveConnection({
      origin: "http://127.0.0.1:9",
      projectId: "project",
      access,
      signal: controller.signal,
    }),
  });
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await entered.promise;
    connection.close();
    const outcome = await Promise.race([
      connection.done.then(() => "closed"),
      new Promise<string>((resolve) => {
        timer = setTimeout(() => resolve("waiting"), 100);
      }),
    ]);
    expect(outcome).toBe("closed");
  } finally {
    clearTimeout(timer);
    renewal.resolve({ token: "unused", expiresAt: new Date().toISOString() });
    controller.abort();
    await connection.done;
    await app.close();
  }
});

test("remote project info changes refresh project composition metadata", async () => {
  const app = await createTestApp();
  const controller = new AbortController();
  const renewal = Promise.withResolvers<{ token: string; expiresAt: string }>();
  const entered = Promise.withResolvers<void>();
  const access = () => {
    entered.resolve();
    return renewal.promise;
  };
  let notify: Parameters<typeof app.deps.projectInfoService.watchChanges>[0] | undefined;
  const invalidations: unknown[] = [];
  const stop = app.deps.extensionRuntimeCatalog.subscribeInvalidation((event) => invalidations.push(event));
  const connection = startCoreDocumentSync({
    deps: {
      ...app.deps,
      projectInfoService: {
        ...app.deps.projectInfoService,
        watchChanges(listener) {
          notify = listener;
          return () => {
            notify = undefined;
          };
        },
      },
    },
    config: {
      accountId: "account",
      workbenchId: "project",
      environmentId: "device",
      relayOrigin: "http://127.0.0.1:9",
      managerOrigin: "http://127.0.0.1:9",
      renewalGrant: "grant",
    },
    signal: controller.signal,
    access,
    live: createLiveConnection({
      origin: "http://127.0.0.1:9",
      projectId: "project",
      access,
      signal: controller.signal,
    }),
  });
  try {
    await entered.promise;
    const change = { workbenchId: "project", extensionId: coreOwnerId, documentId: projectInfoDocumentId };
    notify!(change, "relay");
    notify!({ ...change, documentId: "another-document" }, "relay");
    notify!({ ...change, workbenchId: "another-project" }, "relay");
    notify!(change);
    expect(invalidations).toEqual([{ projectId: "project", reason: "runtime_refresh" }]);
    expect(app.deps.eventBus.getSince(0).filter((event) => event.table === "extension_events")).toEqual([
      expect.objectContaining({
        data: expect.objectContaining({ projectId: "project", eventId: "pstdio.event.project-composition-changed" }),
      }),
    ]);
  } finally {
    connection.close();
    renewal.resolve({ token: "unused", expiresAt: new Date().toISOString() });
    controller.abort();
    await connection.done;
    stop();
    await app.close();
  }
});
