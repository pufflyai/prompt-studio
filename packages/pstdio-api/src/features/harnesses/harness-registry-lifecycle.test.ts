import { expect, test } from "bun:test";
import type { HarnessContext } from "pstdio-api-contracts/extension-kernel";
import { createHarnessRegistry } from "pstdio-api-runtime-host";
import { createHarnessRegistryLifecycle } from "./harness-registry-lifecycle";
import { createTestHarnessRecord } from "./test-harness-registry";

const buildContext = (_record: unknown, options?: { projectId?: string }) =>
  ({ projectId: options?.projectId }) as HarnessContext;

test("source reload stops only that source's workers and waits before replacing them", async () => {
  let releaseCleanup: () => void = () => {};
  const cleanup = new Promise<void>((resolve) => {
    releaseCleanup = resolve;
  });
  const released: Array<string | undefined> = [];
  const worker = createTestHarnessRecord("worker", {
    provider: {
      dispose: async (ctx) => {
        released.push(ctx.projectId);
        await cleanup;
      },
    },
  });
  worker.sourcePath = "/extensions/worker/extension.ts";
  const other = createTestHarnessRecord("other");
  other.sourcePath = "/extensions/other/extension.ts";
  const lifecycle = createHarnessRegistryLifecycle((records) => createHarnessRegistry(records, buildContext));
  const first = await lifecycle.get([worker, other], "p1");
  await first.get(worker.id)!.capabilities({ projectId: "p1" });
  const untouched = first.get(other.id);
  const secondProject = await lifecycle.get([worker], "p2");
  await secondProject.get(worker.id)!.capabilities({ projectId: "p2" });

  lifecycle.invalidate({ sourcePath: "/extensions/worker", projectId: "p1" });
  let replaced = false;
  const replacing = lifecycle.get([worker, other], "p1").then((registry) => {
    replaced = true;
    return registry;
  });
  await Promise.resolve();
  expect(replaced).toBe(false);
  expect(secondProject.get(worker.id)).toBe((await lifecycle.get([worker], "p2")).get(worker.id));
  releaseCleanup();
  const replacement = await replacing;
  expect(released).toEqual(["p1"]);
  expect(replacement.get(worker.id)).not.toBe(first.get(worker.id));
  expect(replacement.get(other.id)).toBe(untouched);
  await lifecycle.dispose();
  expect(released.sort()).toEqual(["p1", "p2"]);
});

test("catalog refresh keeps unchanged providers and disposes removed providers without a new turn", async () => {
  const released: string[] = [];
  const kept = createTestHarnessRecord("kept", { provider: { dispose: () => void released.push("kept") } });
  const removed = createTestHarnessRecord("removed", { provider: { dispose: () => void released.push("removed") } });
  const lifecycle = createHarnessRegistryLifecycle((records) => createHarnessRegistry(records, buildContext));
  const first = await lifecycle.get([kept, removed], "p1");
  await Promise.all(first.list().map((handle) => handle.capabilities({ projectId: "p1" })));
  const next = await lifecycle.get([{ ...kept, provider: { ...kept.provider } }], "p1");
  expect(next.get(kept.id)).toBe(first.get(kept.id));
  expect(released).toEqual(["removed"]);
  await lifecycle.dispose();
  expect(released).toEqual(["removed", "kept"]);
  await expect(lifecycle.get([kept], "p1")).rejects.toThrow("disposed");
});
