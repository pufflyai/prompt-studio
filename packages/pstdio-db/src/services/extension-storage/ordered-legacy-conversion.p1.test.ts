import { expect, test } from "bun:test";
import { coreOwnerId } from "pstdio-sync/records";
import { convertLegacyOwner as ensureOrderedOwner } from "../../db/legacy-record-conversion";
import { readConversion } from "../../db/legacy-records/ordered-conversion-state";
import { createResourceRecords } from "../../db/legacy-records/resource-records";
import { storage_record_outbox, storage_record_sync } from "../../db/legacy-records-schema";
import { createDocumentStorageDBService } from "./document-storage";
import { resolveNativeRecordAddress } from "./native-source-address";
import { peers } from "./ordered-legacy-pending.fixture";
import { readOrderedPending } from "./ordered-stream-pending";
import { createProjectionStatistics } from "./projection-statistics";
import { installRecordIndexes } from "./record-index-installation";

test("pre-admission catalog installation preserves records for conversion", async () => {
  const { first } = await peers();
  await first.legacy.commit({ operationId: "seed", edits: [{ recordId: "card", replace: { title: "saved" } }] });
  await installRecordIndexes(first.db, [{ owner: first.owner, definitions: [] }], () => {});
  expect((await first.legacy.read("card")).value).toEqual({ title: "saved" });
  expect((await (await first.upgrade()).records.read("card")).value).toEqual({ title: "saved" });
});

test("startup conversion yields between committed record pages", async () => {
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
    await ensureOrderedOwner(first.db, first.owner);
    expect(timerFired).toBe(true);
    expect((await (await first.upgrade()).records.read("card-0")).value).toEqual({ title: "saved" });
  } finally {
    clearTimeout(timer);
  }
});

test("startup cancellation retains its last committed cursor and resumes before native address access", async () => {
  const { first } = await peers();
  await first.legacy.commit({ operationId: "seed", edits: [{ recordId: "card", replace: { body: "saved" } }] });
  const documentKey = "a".repeat(64);
  await first.legacy.bindText({ recordId: "card", field: "/body", documentKey });
  const controller = new AbortController();
  const startup = ensureOrderedOwner(first.db, first.owner, controller.signal);
  const timer = setTimeout(() => controller.abort(new Error("shutdown")), 0);
  try {
    await expect(startup).rejects.toThrow("shutdown");
    expect(await readConversion(first.db, first.owner)).toBeDefined();
    await first.upgrade();
    const address = await resolveNativeRecordAddress(first.db, first.owner, { recordId: "card", documentKey });
    expect(address.documentKey).toBe(documentKey);
    expect(address.lifetime).toBe("initial");
  } finally {
    clearTimeout(timer);
  }
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
  expect((await (await first.upgrade()).records.read("card")).value).toBe("saved");
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
    await ensureOrderedOwner(first.db, owner);
    const records = createDocumentStorageDBService(first.db).open({ owner }).records;
    expect((await records.readMany(["a", "z"])).map((record) => record.value)).toEqual(before);
  } finally {
    await statistics.flush();
  }
});
