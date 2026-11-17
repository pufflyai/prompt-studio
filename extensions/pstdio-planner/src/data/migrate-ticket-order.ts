import type { ExtensionStorageApi, ExtensionStorageMigration, StoragePredicate } from "@pstdio/sdk/extensions";
import { changeTicketRecord } from "./ticket-records";
import { missingTicketPosition, ticketKeyPages, ticketSelectionPage } from "./ticket-selection";
import { queueTicketWrite } from "./ticket-write-queue";
import type { StoredTicket } from "./types";

const missingPosition = missingTicketPosition;

async function* legacyKeys(storage: ExtensionStorageApi, where: StoragePredicate, ordered = false) {
  for await (const page of ticketKeyPages(
    storage,
    where,
    ordered ? "ticket-legacy-order" : "ticket-records",
    ordered ? "sortOrder" : undefined,
  ))
    yield* page;
}

// Missing legacy ranks mean zero. Merge their ID-ordered stream with explicit zero ranks.
async function* sortedLegacyKeys(storage: ExtensionStorageApi, arriving = false) {
  const where = (predicate: StoragePredicate): StoragePredicate =>
    arriving ? { all: [missingPosition, predicate] } : predicate;
  yield* legacyKeys(storage, where({ field: "sortOrder", op: "lt", value: 0 }), true);
  const zero = legacyKeys(storage, where({ field: "sortOrder", op: "eq", value: 0 }));
  const missing = legacyKeys(storage, where({ field: "sortOrder", op: "empty" }));
  let a = await zero.next();
  let b = await missing.next();
  while (!a.done || !b.done) {
    if (b.done || (!a.done && String(a.value.fields.id) < String(b.value.fields.id))) {
      yield a.value!;
      a = await zero.next();
    } else {
      yield b.value;
      b = await missing.next();
    }
  }
  yield* legacyKeys(storage, where({ field: "sortOrder", op: "gt", value: 0 }), true);
}

export const migrateTicketOrder = async (storage: ExtensionStorageApi, migration: ExtensionStorageMigration) => {
  if (
    (await ticketSelectionPage(storage, { index: "ticket-missing-position", where: missingPosition, limit: 1 })).records
      .length
  ) {
    let rank = 0;
    for await (const key of sortedLegacyKeys(storage)) {
      const position = migration.position(rank++, String(key.fields.id));
      if (key.fields.position) continue;
      await queueTicketWrite(String(key.fields.id), () =>
        changeTicketRecord(storage, String(key.fields.id), (current) =>
          current.position ? current : { ...current, position },
        ),
      );
    }
  }
  // Keep ranks until every position exists, preserving interrupted-import ordering.
  for await (const page of ticketKeyPages(storage, { field: "sortOrder", op: "exists" })) {
    for (const key of page)
      await queueTicketWrite(String(key.fields.id), () =>
        changeTicketRecord(storage, String(key.fields.id), (current) => {
          if (!current.position || !("sortOrder" in current)) return current;
          const { sortOrder: _legacy, ...ticket } = current;
          return ticket;
        }),
      );
  }
};

/** Import late legacy arrivals in bounded pages after the current indexed tail. */
export const migrateArrivingTicketOrder = async (storage: ExtensionStorageApi, rows: StoredTicket[]) => {
  if (!rows.some((row) => !row.position) || !(await storage.canMigrate())) return rows;
  let last = (
    await ticketSelectionPage(storage, {
      index: "ticket-order-desc",
      where: { field: "position", op: "notEmpty" },
      limit: 1,
    })
  ).records[0]?.fields.position;
  const selected = new Map(rows.map((row) => [row.id, row]));
  for await (const key of sortedLegacyKeys(storage, true)) {
    if (key.fields.position) continue;
    const saved = await queueTicketWrite(String(key.fields.id), () =>
      changeTicketRecord(storage, String(key.fields.id), (current) => {
        if (current.position) return current;
        const { sortOrder: _legacy, ...ticket } = current;
        return { ...ticket, position: storage.positions.between(typeof last === "string" ? last : undefined) };
      }),
    );
    if (saved?.position) last = saved.position;
    if (selected.has(String(key.fields.id))) {
      if (saved) selected.set(saved.id, saved);
      else selected.delete(String(key.fields.id));
    }
  }
  return [...selected.values()];
};
