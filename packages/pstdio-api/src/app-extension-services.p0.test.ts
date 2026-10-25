import { expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { wireAppExtensionServices } from "./app-extension-services";
import { createMemoryConnectionSecretStore } from "./features/extensions/connection-secret-store";
import { EventBus } from "./features/sync/event-bus";

test("extension startup failure still drains another branch before disposal completes", async () => {
  const root = mkdtempSync(join(tmpdir(), "review-startup-shutdown-"));
  const previous = process.env.PSTDIO_HOME;
  process.env.PSTDIO_HOME = root;
  const entered = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  let lists = 0;
  let disposed = false;
  let readsAfterDisposal = 0;
  const services = wireAppExtensionServices({
    config: { buildWebviews: false, release: null },
    db: {} as never,
    eventBus: new EventBus(),
    dependencies: {
      createHarnessRegistry: () => ({ invalidate() {}, dispose: async () => {} }),
      connectionSecretStore: {
        ...createMemoryConnectionSecretStore(),
        listRefs: async () => {
          throw new Error("Cannot scan secrets");
        },
      },
    } as never,
    extensionInstancesDBService: {} as never,
    extensionStorageDBService: {} as never,
    extensionConnectionsDBService: { listAll: async () => [] } as never,
    installedExtensionSourcesDBService: { list: async () => [] } as never,
    projectService: {
      list: async () => {
        if (++lists !== 2) return [];
        entered.resolve();
        await release.promise;
        return [{ id: "project-1" }];
      },
    } as never,
    workspaceService: {
      getDefault: async () => {
        if (disposed) readsAfterDisposal += 1;
        return null;
      },
    } as never,
    provisionWorkspacesUsingSource: async () => {},
    storageRoot: root,
  });
  const ready = services.extensionRuntime.ready.catch(() => {});
  let cleanup: Promise<void> | undefined;
  try {
    await entered.promise;
    cleanup = services.extensionStartup
      .then(() => services.extensionRuntime.dispose())
      .then(() => {
        disposed = true;
      });
    await Bun.sleep(0);
    release.resolve();
    await Promise.all([ready, services.extensionStartup, cleanup]);
    expect(readsAfterDisposal).toBe(0);
  } finally {
    release.resolve();
    await ready;
    await cleanup;
    services.unsubscribeExtensionEvents();
    if (previous === undefined) delete process.env.PSTDIO_HOME;
    else process.env.PSTDIO_HOME = previous;
    rmSync(root, { recursive: true, force: true });
  }
});
