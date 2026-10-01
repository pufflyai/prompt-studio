import { expect, test } from "bun:test";
import type { HarnessContext } from "pstdio-api-contracts/extension-kernel";
import { createHarnessRegistry } from "pstdio-api-runtime-host";
import type { RuntimeInvalidationInput } from "../extensions/project-extension-runtime-snapshot";
import { createHarnessRegistryLifecycle } from "./harness-registry-lifecycle";
import { createHarnessRegistryService } from "./harness-registry-service";
import { createTestHarnessRecord } from "./test-harness-registry";

test("project disablement releases its workers without a follow-up and preserves another project", async () => {
  const released: Array<string | undefined> = [];
  let finishRelease: () => void = () => {};
  const release = new Promise<void>((resolve) => {
    finishRelease = resolve;
  });
  const worker = createTestHarnessRecord("worker", {
    provider: {
      dispose: (ctx) => {
        released.push(ctx.projectId);
        finishRelease();
      },
    },
  });
  let disabled = false;
  let notify: (input: RuntimeInvalidationInput) => void = () => {};
  let unsubscribed = false;
  const registry = createHarnessRegistryService({
    installedExtensionSourcesService: { list: async () => [] } as never,
    installDefaultExtensions: async () => [],
    extensionRuntimeCatalog: {
      get: async (projectId) =>
        ({
          generation: disabled ? 2 : 1,
          project: { id: projectId },
          runtime: { harnesses: disabled && projectId === "p1" ? [] : [worker] },
        }) as never,
      subscribeInvalidation: (listener) => {
        notify = listener;
        return () => {
          unsubscribed = true;
        };
      },
    },
  });
  try {
    const first = (await registry.get(worker.id, { projectId: "p1" }))!;
    const second = (await registry.get(worker.id, { projectId: "p2" }))!;
    await first.capabilities({ projectId: "p1" });
    await second.capabilities({ projectId: "p2" });
    disabled = true;
    notify({ projectId: "p1", reason: "enablement_changed" });
    await release;
    expect(released).toEqual(["p1"]);
    expect(await registry.get(worker.id, { projectId: "p1" })).toBeNull();
    await second.capabilities({ projectId: "p2" });
    expect(released).toEqual(["p1"]);
    await expect(first.capabilities({ projectId: "p1" })).rejects.toThrow("disposed");
  } finally {
    await registry.dispose();
  }
  expect(released.sort()).toEqual(["p1", "p2"]);
  expect(unsubscribed).toBe(true);
});

test("a failed host cleanup still waits for project cleanup before shutdown rejects", async () => {
  let releaseProject: () => void = () => {};
  const projectCleanup = new Promise<void>((resolve) => {
    releaseProject = resolve;
  });
  const worker = createTestHarnessRecord("worker", {
    provider: {
      dispose: async (ctx) => {
        if (!ctx.projectId) throw new Error("host cleanup failed");
        await projectCleanup;
      },
    },
  });
  const registry = createHarnessRegistryService({
    installedExtensionSourcesService: { list: async () => [] } as never,
    installDefaultExtensions: async () => [],
    buildRegistry: async () => createHarnessRegistry([worker], () => ({}) as HarnessContext),
    extensionRuntimeCatalog: {
      get: async () => ({ runtime: { harnesses: [worker] } }) as never,
      subscribeInvalidation: () => () => {},
    },
  });
  await (await registry.get(worker.id))!.capabilities();
  await (await registry.get(worker.id, { projectId: "p1" }))!.capabilities({ projectId: "p1" });
  let settled = false;
  const closing = registry.dispose().finally(() => {
    settled = true;
  });
  closing.catch(() => {});
  await Bun.sleep(10);
  try {
    expect(settled).toBe(false);
  } finally {
    releaseProject();
    await expect(closing).rejects.toThrow("cleanup");
  }
});

test("concurrent host reads cannot publish a handle retired by an older source load", async () => {
  const entered = Promise.withResolvers<void>();
  const released = Promise.withResolvers<void>();
  const oldWorker = createTestHarnessRecord("worker");
  const newWorker = createTestHarnessRecord("worker");
  const lifecycle = createHarnessRegistryLifecycle((records) =>
    createHarnessRegistry(records, () => ({}) as HarnessContext),
  );
  let builds = 0;
  let notify: (input: RuntimeInvalidationInput) => void = () => {};
  const registry = createHarnessRegistryService({
    installedExtensionSourcesService: { list: async () => [] } as never,
    installDefaultExtensions: async () => [],
    buildRegistry: async () => {
      builds += 1;
      if (builds === 1) {
        entered.resolve();
        await released.promise;
        return lifecycle.get([oldWorker]);
      }
      return lifecycle.get([newWorker]);
    },
    extensionRuntimeCatalog: {
      get: async () => ({ runtime: { harnesses: [] } }) as never,
      subscribeInvalidation: (listener) => {
        notify = listener;
        return () => {};
      },
    },
  });
  try {
    const first = registry.get(oldWorker.id);
    await entered.promise;
    notify({ reason: "source_changed", sourcePath: "/test/pstdio-worker" });
    const second = registry.get(newWorker.id);
    await Bun.sleep(0);
    released.resolve();
    const handles = await Promise.all([first, second]);
    await Promise.all(handles.map((handle) => handle!.capabilities()));
  } finally {
    released.resolve();
    await registry.dispose();
    await lifecycle.dispose();
  }
});
