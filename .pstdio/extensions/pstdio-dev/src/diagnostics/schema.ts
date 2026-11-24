import { readdir } from "node:fs/promises";
import { join } from "node:path";

export interface SchemaColumn {
  name: string;
  type: string;
  nullable: boolean;
  primaryKey: boolean;
  default: string | null;
  values: string[];
}

export interface SchemaForeignKey {
  name: string;
  columns: string[];
  target: string;
  targetColumns: string[];
  onDelete: string;
  onUpdate: string;
}

export interface SchemaTable {
  id: string;
  schema: string;
  name: string;
  columns: SchemaColumn[];
  indexes: { name: string; columns: string[]; unique: boolean; method: string }[];
  foreignKeys: SchemaForeignKey[];
}

export interface DatabaseSchema {
  source: string;
  tables: SchemaTable[];
}

interface SnapshotTable {
  name: string;
  schema: string;
  columns: Record<
    string,
    { name: string; type: string; typeSchema?: string; notNull: boolean; primaryKey: boolean; default?: unknown }
  >;
  compositePrimaryKeys: Record<string, { columns: string[] }>;
  uniqueConstraints: Record<string, { name: string; columns: string[] }>;
  indexes: Record<string, { name: string; columns: { expression: string }[]; isUnique: boolean; method: string }>;
  foreignKeys: Record<
    string,
    {
      name: string;
      columnsFrom: string[];
      tableTo: string;
      schemaTo?: string;
      columnsTo: string[];
      onDelete: string;
      onUpdate: string;
    }
  >;
}

interface Snapshot {
  dialect: string;
  tables: Record<string, SnapshotTable>;
  enums: Record<string, { values: string[] }>;
}

// Use the repository's declared schema. Opening the runtime's PGlite directory
// would compete with its exclusive lock, and file sizes cannot establish columns or keys.
export const readDatabaseSchema = async (projectRoot: string | null) => {
  if (!projectRoot) throw new Error("The schema browser needs a project workspace.");
  const folder = "packages/pstdio-db/drizzle/meta";
  const snapshots = (await readdir(join(projectRoot, folder)))
    .filter((name) => /^\d+_snapshot\.json$/.test(name))
    .sort((a, b) => Number.parseInt(a, 10) - Number.parseInt(b, 10));
  const latest = snapshots.at(-1);
  if (!latest) throw new Error(`No database schema snapshots found in ${folder}.`);
  const source = `${folder}/${latest}`;
  const snapshot = (await Bun.file(join(projectRoot, source)).json()) as Snapshot;
  if (snapshot.dialect !== "postgresql" || !snapshot.tables) throw new Error("Expected a PostgreSQL schema snapshot.");
  const tables = Object.entries(snapshot.tables).map(([id, table]) => {
    const schema = table.schema || "public";
    const primary = new Set(Object.values(table.compositePrimaryKeys).flatMap((key) => key.columns));
    return {
      id,
      schema,
      name: table.name,
      columns: Object.values(table.columns).map((column) => ({
        name: column.name,
        type: column.type,
        nullable: !column.notNull,
        primaryKey: column.primaryKey || primary.has(column.name),
        default: column.default === undefined ? null : String(column.default),
        values: snapshot.enums[`${column.typeSchema || schema}.${column.type}`]?.values ?? [],
      })),
      indexes: [
        ...Object.values(table.indexes).map((index) => ({
          name: index.name,
          columns: index.columns.map((column) => column.expression),
          unique: index.isUnique,
          method: index.method,
        })),
        ...Object.values(table.uniqueConstraints).map((key) => ({
          name: key.name,
          columns: key.columns,
          unique: true,
          method: "unique constraint",
        })),
      ],
      foreignKeys: Object.values(table.foreignKeys).map((key) => ({
        name: key.name,
        columns: key.columnsFrom,
        target: `${key.schemaTo || schema}.${key.tableTo}`,
        targetColumns: key.columnsTo,
        onDelete: key.onDelete,
        onUpdate: key.onUpdate,
      })),
    };
  });
  return { source, tables: tables.sort((a, b) => a.id.localeCompare(b.id)) } satisfies DatabaseSchema;
};
