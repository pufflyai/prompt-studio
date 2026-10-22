import { strict as assert } from "node:assert";
import type { ExtensionStorageApi } from "@pstdio/sdk/extensions";
import { createMemoryStorage, makeCommandContext } from "@pstdio/sdk/testing";
import { ticketsCollection } from "../data/collections";
import { runTicketsQuery } from "../data/query";
import { seedDefaultStatuses, seedDefaultTags } from "../data/seed";
import type { StoredTicket } from "../data/types";
import { reorderTicket } from "./reorder-ticket";

// Diagnostic only: no timing budget. Real browser/database measurements live in e2e/src/perf.
for (const count of [50, 500, 1_000]) {
  const storage = createMemoryStorage();
  await Promise.all([seedDefaultStatuses(storage), seedDefaultTags(storage)]);
  const collection = ticketsCollection(storage);
  const now = new Date().toISOString();
  for (let index = 0; index < count; index += 1) {
    const ticket: StoredTicket = {
      id: `ticket-${index}`,
      shorthand: `ST-${index + 1}`,
      title: `Stress ticket ${index + 1}`,
      content: "Synthetic ticket instructions.\n".repeat(128),
      statusId: "backlog",
      tagIds: ["default-type-bug", "default-priority-high"],
      archived: false,
      sortOrder: index,
      createdAt: now,
      updatedAt: now,
    };
    await collection.put(ticket.id, ticket);
  }
  let writes = 0;
  let unchangedWrites = 0;
  let bytes = 0;
  const observed: ExtensionStorageApi = {
    ...storage,
    collection<T>(name: string) {
      const original = storage.collection<T>(name);
      return {
        ...original,
        async put(id: string, value: T) {
          if (name === "tickets") {
            writes += 1;
            bytes += Buffer.byteLength(JSON.stringify(value));
            const previous = await original.get(id);
            if (JSON.stringify(previous) === JSON.stringify(value)) unchangedWrites += 1;
          }
          await original.put(id, value);
        },
      };
    },
  };
  const ctx = makeCommandContext({ storage, params: {} });
  const start = performance.now();
  await reorderTicket(
    { ...ctx, storage: observed },
    {
      rowId: "ticket-1",
      beforeRowId: "ticket-0",
    },
  );
  const reorderMs = performance.now() - start;
  const ordered = (await collection.list()).sort((a, b) => a.sortOrder - b.sortOrder);
  assert.deepEqual(
    ordered.slice(0, 3).map(({ id }) => id),
    ["ticket-1", "ticket-0", "ticket-2"],
  );
  assert.equal(new Set(ordered.map(({ sortOrder }) => sortOrder)).size, count);
  const queryStart = performance.now();
  const query = await runTicketsQuery({ storage, projectId: "stress-project" });
  assert.equal(query.rows.length, count);
  console.info(
    JSON.stringify({ count, writes, unchangedWrites, bytes, reorderMs, queryMs: performance.now() - queryStart }),
  );
}
