import { afterEach, expect, test } from "bun:test";
import { and, eq } from "drizzle-orm";
import { createExtensionStorageFixture } from "../services/extension-storage/extension-storage.fixture";
import {
  storage_documents,
  storage_record_actor_clocks,
  storage_record_fragments,
  storage_record_ownership,
  storage_record_projections,
} from "./schemas.pg";

const cleanup: (() => Promise<unknown>)[] = [];
afterEach(async () => {
  for (const close of cleanup.splice(0).reverse()) await close();
});

test("durable record fragments and actor clocks are owned by one projection and cascade with it", async () => {
  const f = await createExtensionStorageFixture();
  cleanup.push(f.close);
  const owners = [
    { workbench_id: f.projectAId, extension_id: "ext.example" },
    { workbench_id: f.projectAId, extension_id: "ext.other" },
    { workbench_id: f.projectBId, extension_id: "ext.example" },
  ];
  for (const owner of owners) {
    await f.db.insert(storage_documents).values({ ...owner, document_id: "records", state: new Uint8Array([0, 0]) });
    await f.db.insert(storage_record_projections).values({ ...owner, revision: 7 });
    await f.db
      .insert(storage_record_fragments)
      .values({ ...owner, record_id: "same-id", state: new Uint8Array([0, 128, 255]) });
    await f.db.insert(storage_record_actor_clocks).values({ ...owner, client: 4_294_967_295, clock: 4_294_967_296 });
    await f.db.insert(storage_record_ownership).values([
      { ...owner, client: 101, start_clock: 0, end_clock: 10, record_id: "first" },
      { ...owner, client: 101, start_clock: 10, end_clock: 20, record_id: "second" },
    ]);
  }
  expect(await f.db.select().from(storage_record_fragments)).toEqual(
    owners.map((owner) => ({
      ...owner,
      record_id: "same-id",
      state: new Uint8Array([0, 128, 255]),
    })),
  );
  expect(await f.db.select().from(storage_record_actor_clocks)).toEqual(
    owners.map((owner) => ({
      ...owner,
      client: 4_294_967_295,
      clock: 4_294_967_296,
    })),
  );
  await f.db
    .delete(storage_record_projections)
    .where(
      and(
        eq(storage_record_projections.workbench_id, owners[0].workbench_id),
        eq(storage_record_projections.extension_id, owners[0].extension_id),
      ),
    );
  expect(await f.db.select().from(storage_record_fragments)).toHaveLength(2);
  expect(await f.db.select().from(storage_record_actor_clocks)).toHaveLength(2);
  expect(await f.db.select().from(storage_record_ownership)).toHaveLength(4);
  await expect(
    f.db
      .insert(storage_record_fragments)
      .values({
        ...owners[0],
        record_id: "orphan",
        state: new Uint8Array([0, 0]),
      })
      .execute(),
  ).rejects.toThrow();
  await expect(
    f.db
      .insert(storage_record_actor_clocks)
      .values({
        ...owners[0],
        client: 1,
        clock: 1,
      })
      .execute(),
  ).rejects.toThrow();
});
