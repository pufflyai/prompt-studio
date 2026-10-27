import { bigint, foreignKey, jsonb, pgTable, primaryKey, text } from "drizzle-orm/pg-core";
import type { NativeDocumentTarget } from "pstdio-api-contracts";
import { projects } from "./projects";
import { bytea } from "./types";

// Host projection targets are local metadata. Shared documents contain only the source CRDT.
export const native_document_sources = pgTable(
  "native_document_sources",
  {
    workbench_id: text("workbench_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    extension_id: text("extension_id").notNull(),
    document_key: text("document_key").notNull(),
    target: jsonb("target").$type<NativeDocumentTarget>().notNull(),
  },
  (table) => [primaryKey({ columns: [table.workbench_id, table.extension_id, table.document_key] })],
);

// The last projected anchors and any unfinished save belong to this host, never to presence.
export const native_document_file_projections = pgTable(
  "native_document_file_projections",
  {
    workbench_id: text("workbench_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    extension_id: text("extension_id").notNull(),
    document_key: text("document_key").notNull(),
    projection_key: text("projection_key").notNull().default("handler"),
    baseline: bytea("baseline"),
    pending: bytea("pending"),
  },
  (table) => [
    primaryKey({
      name: "native_document_file_projections_pk",
      columns: [table.workbench_id, table.extension_id, table.document_key, table.projection_key],
    }),
  ],
);

// A room retains the history in which its browser authored edits, including after adoption.
// It contains no participant handles, labels, selections or other live presence.
export const native_document_rooms = pgTable(
  "native_document_rooms",
  {
    id: text("id").primaryKey(),
    workbench_id: text("workbench_id").notNull(),
    extension_id: text("extension_id").notNull(),
    document_key: text("document_key").notNull(),
    state: bytea("state").notNull(),
    revision: bigint("revision", { mode: "number" }).notNull().default(0),
    folded_revision: bigint("folded_revision", { mode: "number" }).notNull().default(0),
  },
  (table) => [
    foreignKey({
      columns: [table.workbench_id, table.extension_id, table.document_key],
      foreignColumns: [
        native_document_sources.workbench_id,
        native_document_sources.extension_id,
        native_document_sources.document_key,
      ],
    }).onDelete("cascade"),
  ],
);

export const native_document_room_updates = pgTable(
  "native_document_room_updates",
  {
    room_id: text("room_id")
      .notNull()
      .references(() => native_document_rooms.id, { onDelete: "cascade" }),
    revision: bigint("revision", { mode: "number" }).notNull(),
    update: bytea("update").notNull(),
  },
  (table) => [primaryKey({ columns: [table.room_id, table.revision] })],
);
