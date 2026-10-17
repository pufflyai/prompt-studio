import { afterEach, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { projects } from "../../db/schemas.pg";
import { createGroupedStorageDBService } from "./grouped-storage";
import { openGroupedTestStorage, groupedStorageOwner as owner } from "./grouped-storage-test-fixture";

const cleanup: (() => Promise<unknown>)[] = [];

afterEach(async () => {
  for (const close of cleanup.splice(0).reverse()) await close();
});

const open = (path?: string, seed?: boolean) => openGroupedTestStorage(cleanup, path, seed);

test("guarded groups retain a stale caller's complete alternative without erasing a newer save", async () => {
  const { records } = await open();
  const firstBase = await records.read("note");
  const secondBase = await records.read("note");
  const first = {
    operationId: "first-save",
    edits: [{ recordId: "note", expectedRevision: firstBase.revision, replace: { title: "First" } }],
  };
  expect(await records.commit(first)).toMatchObject({ status: "saved-locally", operationId: "first-save" });
  expect(
    await records.commit({
      operationId: "stale-save",
      edits: [
        { recordId: "note", expectedRevision: secondBase.revision, replace: { title: "Second" } },
        { recordId: "companion", expectedRevision: (await records.read("companion")).revision, replace: "together" },
      ],
    }),
  ).toMatchObject({ status: "conflict", operationId: "stale-save" });
  expect((await records.read("note")).value).toEqual({ title: "First" });
  expect((await records.read("companion")).value).toBeNull();
  const [summary] = await records.conflicts();
  const conflict = await records.inspect(summary.conflictId);
  expect(conflict.alternatives).toContainEqual(
    expect.objectContaining({
      operationId: "stale-save",
      records: expect.arrayContaining([
        expect.objectContaining({ recordId: "note", value: { title: "Second" } }),
        expect.objectContaining({ recordId: "companion", value: "together" }),
      ]),
    }),
  );
  expect(await records.commit(first)).toMatchObject({ status: "saved-locally", operationId: "first-save" });
  const current = await records.read("note");
  expect(
    await records.commit({
      operationId: "fresh-save",
      edits: [{ recordId: "note", expectedRevision: current.revision, replace: { title: "Fresh" } }],
    }),
  ).toMatchObject({ status: "saved-locally" });
  expect((await records.read("note")).value).toEqual({ title: "Fresh" });
  expect(await records.conflicts()).toHaveLength(1);
});

test("a complete locally saved group and its operation identity survive reopening the real database", async () => {
  const root = await mkdtemp(join(tmpdir(), "grouped-storage-"));
  cleanup.push(() => rm(root, { recursive: true, force: true }));
  const initial = await open(join(root, "database"));
  const input = {
    operationId: "durable-save",
    edits: [
      { recordId: "one", expectedRevision: (await initial.records.read("one")).revision, replace: { count: 1 } },
      { recordId: "two", expectedRevision: (await initial.records.read("two")).revision, replace: ["same group"] },
    ],
  };
  await initial.records.commit(input);
  await initial.close();
  const reopened = await open(join(root, "database"), false);
  expect((await reopened.records.read("one")).value).toEqual({ count: 1 });
  expect((await reopened.records.read("two")).value).toEqual(["same group"]);
  expect(await reopened.records.commit(input)).toMatchObject({ status: "saved-locally", operationId: "durable-save" });
});

test("concurrent callers retain both proposals and publish only one guarded replacement", async () => {
  const { records } = await open();
  const base = await records.read("note");
  const outcomes = await Promise.all(
    ["One", "Two"].map((title) =>
      records.commit({
        operationId: title,
        edits: [{ recordId: "note", expectedRevision: base.revision, replace: title }],
      }),
    ),
  );
  expect(outcomes.filter((outcome) => outcome.status === "saved-locally")).toHaveLength(1);
  expect(outcomes.filter((outcome) => outcome.status === "conflict")).toHaveLength(1);
  const [summary] = await records.conflicts();
  const conflict = await records.inspect(summary.conflictId);
  const saved = (await records.read("note")).value;
  expect(saved === "One" || saved === "Two").toBe(true);
  expect(conflict.alternatives[0].records[0].value).not.toBe(saved);
});

test("captured revisions cannot be reused across workbench owners with overlapping operation IDs", async () => {
  const { db, records: first } = await open();
  const timestamp = new Date().toISOString();
  const secondOwner = { ...owner, workbenchId: "workbench-b" };
  await db.insert(projects).values({
    id: secondOwner.workbenchId,
    name: "Other notes",
    shorthand: "O",
    created_at: timestamp,
    updated_at: timestamp,
  });
  const second = createGroupedStorageDBService(db).open({ owner: secondOwner, environmentId: "environment-b" }).records;
  for (const [records, value] of [
    [first, "First owner"],
    [second, "Second owner"],
  ] as const) {
    await records.commit({
      operationId: "same-operation",
      edits: [{ recordId: "note", expectedRevision: (await records.read("note")).revision, replace: value }],
    });
  }
  const foreign = await first.read("note");
  let error: unknown;
  try {
    await second.commit({
      operationId: "wrong-owner-base",
      edits: [{ recordId: "note", expectedRevision: foreign.revision, replace: "Foreign proposal" }],
    });
  } catch (caught) {
    error = caught;
  }
  expect(error).toBeInstanceOf(Error);
  expect((await first.read("note")).value).toBe("First owner");
  expect((await second.read("note")).value).toBe("Second owner");
});

test("shared text, observed list deletes, and independent map keys reconcile from two captured revisions", async () => {
  const { records } = await open();
  await records.commit({
    operationId: "seed-shared",
    edits: [
      {
        recordId: "text",
        expectedRevision: (await records.read("text")).revision,
        shared: [{ kind: "text.insert", index: 0, text: "base" }],
      },
      {
        recordId: "list",
        expectedRevision: (await records.read("list")).revision,
        shared: [{ kind: "list.insert", index: 0, values: ["a", "b"] }],
      },
      {
        recordId: "map",
        expectedRevision: (await records.read("map")).revision,
        shared: [{ kind: "map.set", key: "seed", value: 0 }],
      },
    ],
  });
  const text = await records.read("text");
  const list = await records.read("list");
  const map = await records.read("map");
  await Promise.all([
    records.commit({
      operationId: "shared-left",
      edits: [
        {
          recordId: "text",
          expectedRevision: text.revision,
          shared: [{ kind: "text.insert", index: 4, text: " alpha" }],
        },
        {
          recordId: "list",
          expectedRevision: list.revision,
          shared: [{ kind: "list.insert", index: 1, values: ["new"] }],
        },
        { recordId: "map", expectedRevision: map.revision, shared: [{ kind: "map.set", key: "left", value: 1 }] },
      ],
    }),
    records.commit({
      operationId: "shared-right",
      edits: [
        {
          recordId: "text",
          expectedRevision: text.revision,
          shared: [{ kind: "text.insert", index: 4, text: " beta" }],
        },
        { recordId: "list", expectedRevision: list.revision, shared: [{ kind: "list.delete", index: 1, count: 1 }] },
        { recordId: "map", expectedRevision: map.revision, shared: [{ kind: "map.set", key: "right", value: 2 }] },
      ],
    }),
  ]);
  expect(await records.conflicts()).toEqual([]);
  const result = await records.read("text");
  expect(result.shared?.kind).toBe("text");
  if (result.shared?.kind === "text") {
    expect(result.shared.value).toContain("alpha");
    expect(result.shared.value).toContain("beta");
  }
  expect((await records.read("list")).shared).toEqual({ kind: "list", value: ["a", "new"] });
  expect((await records.read("map")).shared).toEqual({ kind: "map", value: { seed: 0, left: 1, right: 2 } });
});

test("incomplete asset bytes reject every group member and the same request succeeds after verified publication", async () => {
  const { records, assets } = await open();
  const bytes = new TextEncoder().encode("a complete immutable image");
  const asset = {
    sha256: new Bun.CryptoHasher("sha256").update(bytes).digest("hex"),
    byteLength: bytes.byteLength,
    mediaType: "image/png",
  };
  await assets.append(owner, "upload", 0, new Blob([bytes.slice(0, 5)]).stream());
  const group = {
    operationId: "save-image-and-caption",
    edits: [
      { recordId: "image", expectedRevision: (await records.read("image")).revision, asset },
      {
        recordId: "caption",
        expectedRevision: (await records.read("caption")).revision,
        replace: "One complete group",
      },
    ],
  };
  let error: unknown;
  try {
    await records.commit(group);
  } catch (caught) {
    error = caught;
  }
  expect(error).toBeInstanceOf(Error);
  expect((await records.read("image")).asset).toBeNull();
  expect((await records.read("caption")).value).toBeNull();
  expect(await assets.progress(owner, "upload")).toBe(5);
  await assets.append(owner, "upload", 5, new Blob([bytes.slice(5)]).stream());
  await assets.publish(owner, "upload", asset);
  expect(await records.commit(group)).toMatchObject({ status: "saved-locally" });
  expect((await records.read("image")).asset).toEqual(asset);
  expect((await records.read("caption")).value).toBe("One complete group");
});

test("competing asset replacements retain the complete alternative and do not publish its other records", async () => {
  const { records, assets } = await open();
  const publish = async (content: string) => {
    const bytes = new TextEncoder().encode(content);
    const asset = {
      sha256: new Bun.CryptoHasher("sha256").update(bytes).digest("hex"),
      byteLength: bytes.byteLength,
      mediaType: "image/png",
    };
    await assets.append(owner, content, 0, new Blob([bytes]).stream());
    return assets.publish(owner, content, asset);
  };
  const original = await publish("original image");
  const first = await publish("first replacement");
  const second = await publish("second replacement");
  await records.commit({
    operationId: "original",
    edits: [{ recordId: "image", expectedRevision: (await records.read("image")).revision, asset: original }],
  });
  const base = await records.read("image");
  await records.commit({
    operationId: "first-image",
    edits: [{ recordId: "image", expectedRevision: base.revision, asset: first }],
  });
  expect(
    await records.commit({
      operationId: "second-image",
      edits: [
        { recordId: "image", expectedRevision: base.revision, asset: second },
        {
          recordId: "comment",
          expectedRevision: (await records.read("comment")).revision,
          replace: "Keep with second image",
        },
      ],
    }),
  ).toMatchObject({ status: "conflict" });
  expect((await records.read("image")).asset).toEqual(first);
  expect((await records.read("comment")).value).toBeNull();
  const [summary] = await records.conflicts();
  const conflict = await records.inspect(summary.conflictId);
  expect(
    conflict.alternatives[0].records.map((record) => ({
      recordId: record.recordId,
      asset: record.asset,
      value: record.value,
    })),
  ).toEqual([
    { recordId: "image", asset: second, value: null },
    { recordId: "comment", asset: null, value: "Keep with second image" },
  ]);
  await assets.verify(owner, original);
  await assets.verify(owner, second);
});
