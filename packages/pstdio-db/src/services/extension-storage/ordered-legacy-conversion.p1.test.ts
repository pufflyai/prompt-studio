import { expect, test } from "bun:test";
import { coreOwnerId } from "pstdio-sync/records";
import { projects, storage_ordered_owners, storage_record_outbox, storage_record_sync } from "../../db/schemas.pg";
import { createDocumentStorageDBService } from "./document-storage";
import { resolveNativeRecordAddress } from "./native-source-address";
import { ensureOrderedOwner } from "./ordered-conversion";
import { readConversion } from "./ordered-conversion-state";
import { peers } from "./ordered-legacy-pending.fixture";
import { readOrderedPending } from "./ordered-stream-pending";
import { createProjectionStatistics } from "./projection-statistics";
import { installRecordIndexes } from "./record-index-installation";
import { createResourceRecords } from "./resource-records";

test("catalog index installation leaves legacy conversion outside its transaction", async () => {
  const { first } = await peers();
  await first.legacy.commit({ operationId: "seed", edits: [{ recordId: "card", replace: { title: "saved" } }] });
  await installRecordIndexes(first.db, [{ owner: first.owner, definitions: [] }], () => {});
  expect(await first.db.select().from(storage_ordered_owners)).toHaveLength(0);
});

test("legacy conversion yields before completing a cold owner read", async () => {
  const { first } = await peers();
  await first.legacy.commit({
    operationId: "seed",
    edits: Array.from({ length: 300 }, (_, index) => ({ recordId: `card-${index}`, replace: { title: "saved" } })),
  });
  let timerFired = false;
  const timer = setTimeout(() => {
    timerFired = true;
  }, 0);
  try {
    let complete = false;
    const conversion = first
      .upgrade()
      .records.read("card-0")
      .then((record) => {
        complete = true;
        return record;
      });
    const service = createDocumentStorageDBService(first.db);
    await service.open({ owner: { ...first.owner, extensionId: "example.other" } }).records.read("missing");
    expect(complete).toBe(false);
    expect(await first.db.select().from(projects)).toHaveLength(1);
    expect((await conversion).value).toEqual({ title: "saved" });
    expect(timerFired).toBe(true);
  } finally {
    clearTimeout(timer);
  }
});

test("startup cancellation stops a conversion first admitted by a request", async () => {
  const { first } = await peers();
  await first.legacy.commit({ operationId: "seed", edits: [{ recordId: "card", replace: true }] });
  const request = ensureOrderedOwner(first.db, first.owner);
  const controller = new AbortController();
  const startup = ensureOrderedOwner(first.db, first.owner, controller.signal);
  controller.abort(new Error("shutdown"));
  await expect(request).rejects.toThrow("shutdown");
  await expect(startup).rejects.toThrow("shutdown");
  expect(await readConversion(first.db, first.owner)).toBeDefined();
  expect((await first.upgrade().records.read("card")).value).toBe(true);
});

test("native address admission waits for the owner's converted lifetime", async () => {
  const { first } = await peers();
  await first.legacy.commit({
    operationId: "seed",
    edits: Array.from({ length: 300 }, (_, i) => ({ recordId: `card-${i}`, replace: { body: "saved" } })),
  });
  const documentKey = "a".repeat(64);
  await first.legacy.bindText({ recordId: "card-299", field: "/body", documentKey });
  const converting = ensureOrderedOwner(first.db, first.owner);
  const address = await resolveNativeRecordAddress(first.db, first.owner, { recordId: "card-299", documentKey });
  await converting;
  expect(address.documentKey).toBe(documentKey);
  expect(address.lifetime).toBe("initial");
});

test("a hot record's legacy lifecycles commit projection progress between queue pages", async () => {
  const { first } = await peers();
  await first.db
    .insert(storage_record_sync)
    .values({ workbench_id: first.owner.workbenchId, extension_id: first.owner.extensionId, joined: true });
  await first.legacy.commit({ operationId: "create", edits: [{ recordId: "card", replace: "saved" }] });
  const [frame] = await first.db.select().from(storage_record_outbox);
  await first.db.insert(storage_record_outbox).values(
    Array.from({ length: 256 }, () => ({
      workbench_id: first.owner.workbenchId,
      extension_id: first.owner.extensionId,
      frame: frame!.frame,
    })),
  );
  const controller = new AbortController();
  const converting = ensureOrderedOwner(first.db, first.owner, controller.signal);
  const stopped = converting.catch((error) => error);
  let checkpoint = false;
  const timer = setInterval(async () => {
    const cursor = await readConversion(first.db, first.owner);
    if (cursor?.phase === "project" && cursor.sequence !== undefined) {
      checkpoint = true;
      controller.abort(new Error("interrupted projection"));
    }
  }, 0);
  try {
    await stopped;
  } finally {
    clearInterval(timer);
  }
  expect(checkpoint).toBe(true);
  expect((await readConversion(first.db, first.owner))?.sequence).toBeGreaterThan(0);
  expect(await readOrderedPending(first.db, first.owner)).toBeUndefined();
  expect((await first.upgrade().records.read("card")).value).toBe("saved");
  expect(await readOrderedPending(first.db, first.owner)).toBe(true);
});

test("legacy core conversion preserves repaired number claims and their aliases", async () => {
  const { first } = await peers();
  const owner = { ...first.owner, extensionId: coreOwnerId };
  const statistics = createProjectionStatistics(first.db);
  const legacy = createResourceRecords(first.db, owner, { statistics, changed: () => {} });
  await first.db
    .insert(storage_record_sync)
    .values({ workbench_id: owner.workbenchId, extension_id: owner.extensionId, joined: true });
  try {
    await legacy.commit({
      operationId: "numbers",
      edits: ["a", "z"].map((id) => ({
        recordId: id,
        replace: { id, extensionId: "example.tickets", kind: "ticket", prefix: "PS", value: 1, aliases: [] },
      })),
    });
    const before = (await legacy.readMany(["a", "z"])).map((record) => record.value);
    expect(before[1]).toMatchObject({ value: 2, aliases: expect.arrayContaining(["PS-1"]) });
    const records = createDocumentStorageDBService(first.db).open({ owner }).records;
    expect((await records.readMany(["a", "z"])).map((record) => record.value)).toEqual(before);
  } finally {
    await statistics.flush();
  }
});
