import type { ExtensionStorageApi, ExtensionStorageMigration } from "@pstdio/sdk/extensions";
import { changeTicketRecord, ticketRecords } from "./ticket-records";
import { queueTicketWrite } from "./ticket-write-queue";
import type { StoredTicket } from "./types";

export const migrateTicketOrder = async (storage: ExtensionStorageApi, migration: ExtensionStorageMigration) => {
  const records = ticketRecords(storage);
  const rows = (await records.list()).sort(
    (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || (a.id < b.id ? -1 : Number(a.id > b.id)),
  );
  // Keep legacy ranks until every position exists, so an interrupted pass can resume the same import.
  for (const [rank, listed] of rows.entries()) {
    await queueTicketWrite(listed.id, () =>
      changeTicketRecord(storage, listed.id, (current) =>
        current.position ? current : { ...current, position: migration.position(rank, current.id) },
      ),
    );
  }
  for (const listed of rows) {
    await queueTicketWrite(listed.id, () =>
      changeTicketRecord(storage, listed.id, (current) => {
        if (!current.position || !("sortOrder" in current)) return current;
        const { sortOrder: _legacy, ...ticket } = current;
        return ticket;
      }),
    );
  }
};

// A device can receive a legacy card after another device has advanced the shared version.
// Import those cards once per stable ID, after the current order, without moving existing cards.
export const migrateArrivingTicketOrder = async (storage: ExtensionStorageApi, rows: StoredTicket[]) => {
  const missing = rows
    .filter((row) => !row.position)
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || (a.id < b.id ? -1 : Number(a.id > b.id)));
  if (!missing.length) return rows;
  if (!(await storage.canMigrate())) return rows;
  const result = new Map(rows.map((row) => [row.id, row]));
  let last: string | undefined;
  for (const row of rows) if (row.position && (!last || last < row.position)) last = row.position;
  for (const row of missing) {
    const saved = await queueTicketWrite(row.id, () =>
      changeTicketRecord(storage, row.id, (current) => {
        if (current.position) return current;
        const { sortOrder: _legacy, ...ticket } = current;
        return { ...ticket, position: storage.positions.between(last) };
      }),
    );
    const position = saved?.position;
    if (saved) result.set(row.id, saved);
    else result.delete(row.id);
    if (position && (!last || last < position)) last = position;
  }
  return [...result.values()];
};
