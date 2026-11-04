import { expect, test } from "bun:test";
import { createBenchEnvironment } from "./testbench-environment";

test("bench file updates retain identity and expose the new bytes and metadata", async () => {
  const { storage } = createBenchEnvironment();
  const first = await storage.files.put({ name: "before.md", data: new TextEncoder().encode("Before") });
  const changed = await storage.files.update(first.id, {
    name: "after.md",
    data: new TextEncoder().encode("After edit"),
    mimeType: "text/markdown",
  });
  expect(changed).toMatchObject({ id: first.id, name: "after.md", size: 10, mimeType: "text/markdown" });
  expect(await storage.files.get(first.id)).toEqual(changed);
  expect(await storage.files.list()).toEqual([changed]);
  expect(new TextDecoder().decode(await storage.files.getBytes(first.id))).toBe("After edit");
});

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

test("testbench storage shares seeded records and accepts stale revisions through deprecated storage calls", async () => {
  const { storage } = createBenchEnvironment({
    kv: { note: "seed" },
    collections: { notes: { a: { title: "Seeded" } } },
  });
  const observed = await storage.records.read(storage.records.id("note"));
  expect(observed.value).toBe("seed");
  await storage.set("note", "newer");
  expect(
    (
      await storage.records.commit({
        operationId: "open",
        edits: [{ recordId: observed.recordId, expectedRevision: observed.revision, replace: "retained" }],
      })
    ).status,
  ).toBe("saved-locally");
  expect(await storage.get<string>("note")).toBe("retained");
  expect(await storage.collection("notes").get("a")).toEqual({ title: "Seeded" });
});

test("testbench commands stage and read isolated immutable assets", async () => {
  const { storage } = createBenchEnvironment();
  const asset = await storage.assets.stage({ operationId: "preview", source: new Blob(["bench asset"]) });
  await storage.assets.verifyComplete([asset]);
  expect(await new Response(await storage.assets.read(asset)).text()).toBe("bench asset");
  expect(await storage.assets.getTransfer("preview")).toMatchObject({ status: "complete", asset });
  expect(await createBenchEnvironment().storage.assets.getTransfer("preview")).toBeUndefined();
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
