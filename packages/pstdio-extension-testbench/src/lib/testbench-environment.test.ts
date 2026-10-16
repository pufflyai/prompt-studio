import { expect, test } from "bun:test";
import { createBenchEnvironment } from "./testbench-environment";

test("bench commands migrate once per storage scope and retry failed imports", async () => {
  const { storage } = createBenchEnvironment({ kv: { title: "Seed" } });
  await expect(
    storage.migrate(1, async () => {
      throw new Error("Retry");
    }),
  ).rejects.toThrow("Retry");
  const versions: number[] = [];
  await storage.migrate(1, async (previous) => {
    versions.push(previous);
  });
  await storage.migrate(1, async () => {
    throw new Error("Already imported");
  });
  const scoped = storage.scope({ type: "custom", id: "other" });
  await scoped.migrate(1, async (previous) => {
    versions.push(previous);
  });
  await scoped.set("title", "Other");
  expect(versions).toEqual([0, 0]);
  expect(await scoped.scope({ type: "project" }).get<string>("title")).toBe("Seed");
  expect(await scoped.get<string>("title")).toBe("Other");
  expect(await scoped.readLegacy("missing")).toBeUndefined();
});

test("queued requests explain their host runtime requirement in the testbench", async () => {
  const { sessions } = createBenchEnvironment();
  await expect(sessions.getQueuedFollowUps("session")).rejects.toThrow("host runtime");
  await expect(sessions.updateQueuedFollowUp("session", 1, { prompt: "Update request" })).rejects.toThrow(
    "host runtime",
  );
  await expect(
    sessions.combineQueuedFollowUps("session", 1, {
      sourcePosition: 2,
      sourceRevision: "source-revision",
      targetRevision: "target-revision",
    }),
  ).rejects.toThrow("host runtime");
  await expect(
    sessions.steerQueuedFollowUp("session", 1, {
      expectedRevision: "revision",
      expectedRunStartedAt: "run-start",
    }),
  ).rejects.toThrow("host runtime");
});
