import { expect, test } from "bun:test";
import type { DbClient } from "../../db/connection.pglite";
import { records as recordRows } from "../../db/schemas.pg";
import { compactOrderedTombstones } from "./compact-tombstones";
import { createOperationRetentionFixture } from "./operation-retention.fixture";
import { purgeOrderedTombstones } from "./purge-tombstones";
import { readProjectedRecords } from "./record-queries";

test("a root point read cannot fabricate absence when a concurrent restore replaces cold authority", async () => {
  const f = await createOperationRetentionFixture();
  try {
    await f.records.commit({ operationId: "seed-read-race", edits: [{ recordId: "card", replace: "old value" }] });
    await f.records.commit({ operationId: "delete-read-race", edits: [{ recordId: "card", deleted: true }] });
    await compactOrderedTombstones(f.db, f.owner);
    await purgeOrderedTombstones(f.db, f.owner, new Date(Date.now() + 31 * 86_400_000));
    let released = false;
    const reader = {
      transaction: f.db.transaction.bind(f.db),
      select: new Proxy(f.db.select, {
        apply(target, _self, args) {
          const select = Reflect.apply(target, f.db, args);
          const from = select.from.bind(select);
          select.from = (table: unknown) => {
            const source = from(table);
            const where = source.where.bind(source);
            source.where = async (condition: unknown) => {
              const result = await where(condition);
              if (!released) {
                released = true;
                await f.records.commit({
                  operationId: "concurrent-restore",
                  edits: [{ recordId: "card", deleted: false }],
                });
              }
              return result;
            };
            return source;
          };
          return select;
        },
      }) as DbClient["select"],
    };
    const [record] = await readProjectedRecords(reader, f.owner, ["card"]);
    expect(released).toBe(true);
    expect(record!.exists).toBe(true);
    expect(record!.value).toBe("old value");
  } finally {
    await f.close();
  }
});

test("transaction reads and restores share one queue while cold authority changes", async () => {
  const f = await createOperationRetentionFixture();
  try {
    await f.records.commit({ operationId: "seed-tx-read", edits: [{ recordId: "card", replace: "old value" }] });
    await f.records.commit({ operationId: "delete-tx-read", edits: [{ recordId: "card", deleted: true }] });
    await compactOrderedTombstones(f.db, f.owner);
    await purgeOrderedTombstones(f.db, f.owner, new Date(Date.now() + 31 * 86_400_000));
    await f.records.transaction(async (records, tx) => {
      let restoring: ReturnType<typeof records.commit> | undefined;
      const select = tx.select;
      tx.select = new Proxy(select, {
        apply(target, _self, args) {
          const selection = Reflect.apply(target, tx, args);
          const from = selection.from.bind(selection);
          selection.from = (table: unknown) => {
            const query = from(table);
            if (table === recordRows) {
              const execute = query.execute.bind(query);
              query.execute = async () => {
                const result = await execute();
                if (!restoring) {
                  restoring = records.commit({
                    operationId: "restore-tx-read",
                    edits: [{ recordId: "card", deleted: false }],
                  });
                  // Stall this completed SELECT to expose a competing save between SQL and cold reads.
                  await Bun.sleep(100);
                }
                return result;
              };
            }
            return query;
          };
          return selection;
        },
      }) as typeof tx.select;
      const deleted = await records.read("card");
      expect(restoring).toBeDefined();
      expect(deleted.exists).toBe(true);
      expect(deleted.deleted).toBe(true);
      await restoring;
      expect((await records.read("card")).value).toBe("old value");
    });
  } finally {
    await f.close();
  }
});
