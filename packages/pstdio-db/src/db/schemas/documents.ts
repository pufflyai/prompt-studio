import { sql } from "drizzle-orm";
import {
  bigint,
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  unique,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import type { NativeTextTarget } from "pstdio-api-contracts";
import { owners } from "./owners";

export const documents = pgTable(
  "documents",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedByDefaultAsIdentity(),
    owner_id: integer("owner_id")
      .notNull()
      .references(() => owners.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    kind: text("kind").$type<"shared" | "room" | "local">().notNull(),
    revision: bigint("revision", { mode: "number" }).notNull().default(0),
    folded_revision: bigint("folded_revision", { mode: "number" }).notNull().default(0),
    // This immutable descriptor reaches the folded snapshot and its bounded update tail.
    state_sha256: text("state_sha256").notNull(),
    state_bytes: bigint("state_bytes", { mode: "number" }).notNull(),
    target: jsonb("target").$type<NativeTextTarget>(),
    room_of: bigint("room_of", { mode: "number" }),
  },
  (table) => [
    uniqueIndex("documents_owner_key").on(table.owner_id, table.key),
    unique("documents_owner_id").on(table.owner_id, table.id),
    index("documents_room_of").on(table.owner_id, table.room_of),
    foreignKey({ columns: [table.owner_id, table.room_of], foreignColumns: [table.owner_id, table.id] }).onDelete(
      "cascade",
    ),
    index("documents_rooms").on(table.owner_id, table.id).where(sql`${table.kind}='room'`),
    check("documents_kind", sql`${table.kind} IN ('shared','room','local')`),
    check("documents_room_source", sql`(${table.kind}='room') = (${table.room_of} IS NOT NULL)`),
  ],
);
