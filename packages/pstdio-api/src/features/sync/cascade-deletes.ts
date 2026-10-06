import { eq, getTableColumns, inArray } from "drizzle-orm";
import { getTableConfig, type PgColumn, type PgTable } from "drizzle-orm/pg-core";
import { boardDefaultSyncRow } from "pstdio-api-contracts";
import type { board_default_views, DbClient } from "pstdio-db";
import { SYNCED_TABLES, tableMap } from "./get-full-state";

type SyncedTable = keyof typeof tableMap;
type RootTable = Exclude<SyncedTable, "board_default_views">;
type Row = Record<string, unknown>;
type CascadeEdge = { parent: SyncedTable; parentKey: string; child: SyncedTable; childColumn: PgColumn };

const syncedTableOf = (table: PgTable) => SYNCED_TABLES.find((name) => tableMap[name] === table);

const propertyKey = (table: PgTable, column: PgColumn) => {
  const entry = Object.entries(getTableColumns(table)).find(([, value]) => value === column);
  if (!entry) throw new Error(`Column ${column.name} has no property on ${getTableConfig(table).name}`);
  return entry[0];
};

// The schema's cascading foreign keys between synced tables decide which rows a delete removes.
const cascadeEdges = SYNCED_TABLES.flatMap((child) =>
  getTableConfig(tableMap[child])
    .foreignKeys.filter((key) => key.onDelete === "cascade")
    .flatMap((key): CascadeEdge[] => {
      const { columns, foreignColumns, foreignTable } = key.reference();
      const parent = syncedTableOf(foreignTable);
      if (!parent || columns.length !== 1) return [];
      return [{ parent, parentKey: propertyKey(foreignTable, foreignColumns[0]), child, childColumn: columns[0] }];
    }),
);

// Post-order walk: every table comes after the tables that cascade from it.
const childrenFirst: SyncedTable[] = [];
const visit = (table: SyncedTable) => {
  if (childrenFirst.includes(table)) return;
  for (const edge of cascadeEdges) if (edge.parent === table) visit(edge.child);
  childrenFirst.push(table);
};
for (const table of SYNCED_TABLES) visit(table);

const syncId = (table: SyncedTable, row: Row) =>
  table === "board_default_views"
    ? boardDefaultSyncRow(row as typeof board_default_views.$inferSelect).id
    : (row.id as string);

/** Lists the synced rows a delete removes, children before their parents and the root last. */
export const collectCascadeDeletes = async (db: DbClient, root: RootTable, id: string) => {
  const rootTable = tableMap[root];
  const rootRows = (await db.select().from(rootTable).where(eq(rootTable.id, id))) as Row[];
  if (rootRows.length === 0) return [];

  const rows = new Map<SyncedTable, Map<string, Row>>([[root, new Map([[id, rootRows[0]]])]]);
  const pending: SyncedTable[] = [root];
  while (pending.length > 0) {
    const parent = pending.shift() as SyncedTable;
    const parentRows = [...(rows.get(parent)?.values() ?? [])];
    for (const edge of cascadeEdges.filter((candidate) => candidate.parent === parent)) {
      const keys = parentRows.map((row) => row[edge.parentKey]);
      const childRows = (await db.select().from(tableMap[edge.child]).where(inArray(edge.childColumn, keys))) as Row[];
      const known = rows.get(edge.child) ?? new Map<string, Row>();
      const added = childRows.filter((row) => !known.has(syncId(edge.child, row)));
      if (added.length === 0) continue;
      for (const row of added) known.set(syncId(edge.child, row), row);
      rows.set(edge.child, known);
      pending.push(edge.child);
    }
  }

  return childrenFirst.flatMap((table) => [...(rows.get(table)?.keys() ?? [])].map((rowId) => ({ table, id: rowId })));
};
