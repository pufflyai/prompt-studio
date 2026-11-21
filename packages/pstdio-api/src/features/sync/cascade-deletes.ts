import { eq, getTableColumns, inArray } from "drizzle-orm";
import { getTableConfig, type PgColumn, type PgTable } from "drizzle-orm/pg-core";
import { boardDefaultSyncRow } from "pstdio-api-contracts";
import { createBoardViewsDBService, type DbClient, sessions } from "pstdio-db";
import { PHYSICAL_SYNCED_TABLES, tableMap } from "./get-full-state";

type SyncedTable = keyof typeof tableMap;
type RootTable = Exclude<SyncedTable, "board_default_views">;
type Row = Record<string, unknown>;
type CascadeEdge = { parent: SyncedTable; parentKey: string; child: SyncedTable; childColumn: PgColumn };

const syncedTableOf = (table: PgTable) => PHYSICAL_SYNCED_TABLES.find((name) => tableMap[name] === table);

const propertyKey = (table: PgTable, column: PgColumn) => {
  const entry = Object.entries(getTableColumns(table)).find(([, value]) => value === column);
  if (!entry) throw new Error(`Column ${column.name} has no property on ${getTableConfig(table).name}`);
  return entry[0];
};

// The schema's cascading foreign keys between synced tables decide which rows a delete removes.
const cascadeEdges = PHYSICAL_SYNCED_TABLES.flatMap((child) =>
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
for (const table of PHYSICAL_SYNCED_TABLES) visit(table);

const syncId = (_table: SyncedTable, row: Row) => row.id as string;

const collectWorkspaceLinkDeletes = async (db: DbClient, removedSessions: Row[], removedWorkspaces: Row[]) => {
  const ids = new Set(
    removedSessions.filter((row) => typeof row.workspace_id === "string").map((row) => row.id as string),
  );
  const workspaces = removedWorkspaces.map((row) => row.id as string);
  for (let offset = 0; offset < workspaces.length; offset += 200) {
    const linked = await db
      .select({ id: sessions.id })
      .from(sessions)
      .where(inArray(sessions.workspace_id, workspaces.slice(offset, offset + 200)));
    for (const row of linked) ids.add(row.id);
  }
  return [...ids].map((id) => ({ table: "workspace_sessions" as const, id }));
};

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

  const defaults =
    root === "projects"
      ? (await createBoardViewsDBService(db).listDefaults(id)).map((row) => ({
          table: "board_default_views" as const,
          id: boardDefaultSyncRow(row).id,
        }))
      : [];
  const links = await collectWorkspaceLinkDeletes(
    db,
    [...(rows.get("sessions")?.values() ?? [])],
    [...(rows.get("workspaces")?.values() ?? [])],
  );
  return [
    ...links,
    ...defaults,
    ...childrenFirst.flatMap((table) => [...(rows.get(table)?.keys() ?? [])].map((rowId) => ({ table, id: rowId }))),
  ];
};
