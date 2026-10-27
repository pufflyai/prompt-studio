import { expect, test } from "bun:test";
import { artifactFilesFixture } from "./artifact-files.fixture";
import { withStorageObservation } from "./storage-observation";

const replace = (recordId: string, text: string) => ({ recordId, replace: { text } });

test("a native record save keeps its load precondition even after reading a newer record", async () => {
  const f = await artifactFilesFixture();
  try {
    await f.storage.records.commit({
      operationId: "seed",
      edits: [replace("document", "base"), replace("other", "keep")],
    });
    const loaded = await withStorageObservation({}, () => f.storage.records.read("document"));
    await f.storage.records.commit({ operationId: "outside", edits: [replace("document", "outside")] });
    await expect(
      withStorageObservation(loaded.versions, () =>
        f.storage.records.transaction(async (records) => {
          const fresh = await records.read("document");
          await records.commit({
            operationId: "stale",
            edits: [
              { ...replace("document", "stale"), expectedRevision: fresh.revision },
              replace("other", "must not commit"),
            ],
          });
        }),
      ),
    ).rejects.toThrow("changed since it was loaded");
    expect((await f.storage.records.read("document")).value).toEqual({ text: "outside" });
    expect((await f.storage.records.read("other")).value).toEqual({ text: "keep" });
  } finally {
    await f.close();
  }
});

test("native record preconditions advance after their own commits and stay scoped to their owner", async () => {
  const f = await artifactFilesFixture();
  try {
    await f.storage.records.commit({ operationId: "seed", edits: [replace("document", "base")] });
    const loaded = await withStorageObservation({}, () => f.storage.records.read("document"));
    const other = await f.deps.extensionStorageService.open({ owner: { ...f.owner, extensionId: "example.other" } });
    await withStorageObservation(loaded.versions, async () => {
      await f.storage.records.commit({ operationId: "first", edits: [replace("document", "first")] });
      await f.storage.records.commit({ operationId: "second", edits: [replace("document", "second")] });
      await other.records.commit({ operationId: "other-owner", edits: [replace("document", "other owner")] });
    });
    expect((await f.storage.records.read("document")).value).toEqual({ text: "second" });
    expect((await other.records.read("document")).value).toEqual({ text: "other owner" });
  } finally {
    await f.close();
  }
});

test("an idempotent receipt retry cannot bless another writer's newer record", async () => {
  const f = await artifactFilesFixture();
  try {
    await f.storage.records.commit({ operationId: "seed", edits: [replace("document", "base")] });
    const loaded = await withStorageObservation({}, () => f.storage.records.read("document"));
    const first = { operationId: "own-first", edits: [replace("document", "own first")] };
    await withStorageObservation(loaded.versions, () => f.storage.records.commit(first));
    await f.storage.records.commit({ operationId: "outside", edits: [replace("document", "outside")] });
    await expect(
      withStorageObservation(loaded.versions, async () => {
        expect((await f.storage.records.commit(first)).state).toBe("saved-locally");
        await f.storage.records.commit({ operationId: "own-later", edits: [replace("document", "stale later")] });
      }),
    ).rejects.toThrow("changed since it was loaded");
    expect((await f.storage.records.read("document")).value).toEqual({ text: "outside" });
  } finally {
    await f.close();
  }
});

test("one native record transaction advances its own guards only when its writes commit", async () => {
  const f = await artifactFilesFixture();
  try {
    await f.storage.records.commit({ operationId: "seed", edits: [replace("document", "base")] });
    const loaded = await withStorageObservation({}, () => f.storage.records.read("document"));
    await withStorageObservation(loaded.versions, () =>
      f.storage.records.transaction(async (records) => {
        await records.commit({ operationId: "own-first", edits: [replace("document", "first")] });
        await records.commit({ operationId: "own-second", edits: [replace("document", "second")] });
      }),
    );
    expect((await f.storage.records.read("document")).value).toEqual({ text: "second" });
    const reloaded = await withStorageObservation({}, () => f.storage.records.read("document"));
    await withStorageObservation(reloaded.versions, async () => {
      await expect(
        f.storage.records.transaction(async (records) => {
          await records.commit({ operationId: "rolled-back", edits: [replace("document", "never committed")] });
          throw new Error("Stop this transaction");
        }),
      ).rejects.toThrow("Stop this transaction");
      await f.storage.records.commit({ operationId: "after-rollback", edits: [replace("document", "after rollback")] });
    });
    expect((await f.storage.records.read("document")).value).toEqual({ text: "after rollback" });
  } finally {
    await f.close();
  }
});
