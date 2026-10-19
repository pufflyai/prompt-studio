import { expect, test } from "bun:test";
import { createMemoryStorage } from "@pstdio/sdk/testing";
import { withWriteGuard } from "./write-guard";

const context = () => ({ storage: createMemoryStorage(), projectId: crypto.randomUUID(), extensionId: "planner" });

test("an abandoned stored claim cannot block a new write after restarting", async () => {
  const ctx = context();
  await ctx.storage.collection("timeline.write-claims").put("plan", {
    key: "plan",
    token: "crashed-writer",
    startedAt: new Date().toISOString(),
  });
  expect(await withWriteGuard(ctx, "plan", async () => "saved")).toBe("saved");
});

test("a successful write does not depend on storage being available for lock cleanup", async () => {
  const ctx = context();
  const collection = ctx.storage.collection.bind(ctx.storage);
  ctx.storage.collection = ((name: string) => ({
    ...collection(name),
    deleteIfValue: async () => {
      throw new Error("Storage unavailable during cleanup");
    },
  })) as typeof ctx.storage.collection;
  expect(await withWriteGuard(ctx, "plan", async () => "saved")).toBe("saved");
  expect(await withWriteGuard(ctx, "plan", async () => "saved again")).toBe("saved again");
});

test("live writers remain exclusive across callers and extension reloads", async () => {
  const ctx = context();
  const entered = Promise.withResolvers<void>();
  const finish = Promise.withResolvers<void>();
  const running = withWriteGuard(ctx, "plan", async () => {
    entered.resolve();
    await finish.promise;
  });
  await entered.promise;
  try {
    const reloaded = await import(`${import.meta.dir}/write-guard.ts?reload=${crypto.randomUUID()}`);
    await expect(reloaded.withWriteGuard({ ...ctx }, "plan", async () => "overlap")).rejects.toThrow(
      "Another Planner write",
    );
    expect(
      await withWriteGuard(
        ctx,
        "plan",
        async () => "overlap",
        () => "busy",
      ),
    ).toBe("busy");
    expect(await withWriteGuard(context(), "plan", async () => "independent")).toBe("independent");
    expect(await withWriteGuard(ctx, "tracks", async () => "independent")).toBe("independent");
  } finally {
    finish.resolve();
    await running;
  }
  expect(await withWriteGuard(ctx, "plan", async () => "next writer")).toBe("next writer");
});

test("failed or interrupted writes release ownership and preserve the original error", async () => {
  const ctx = context();
  const error = new Error("Write interrupted");
  await expect(
    withWriteGuard(ctx, "plan", async () => {
      throw error;
    }),
  ).rejects.toBe(error);
  expect(await withWriteGuard(ctx, "plan", async () => "recovered")).toBe("recovered");
});
