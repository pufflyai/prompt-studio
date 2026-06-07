import { getWriter, type SyncedRow, type SyncedTable } from "./collections";

export const seedCollection = (table: SyncedTable, rows: SyncedRow[]) => {
  const writer = getWriter(table);
  if (writer) writer.truncateAndWrite(rows);
};
