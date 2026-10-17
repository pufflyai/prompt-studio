import { sql } from "drizzle-orm";
import { bigint, index, jsonb, pgTable, primaryKey, text, uniqueIndex } from "drizzle-orm/pg-core";
import type { Mutation, Scope, StoredRecord } from "pstdio-sync-contracts";

export const relayScopes = pgTable("relay_scopes", {
  id: text().primaryKey(),
  scope: jsonb().$type<Scope>().notNull(),
  epoch: text().notNull(),
  acceptedSequence: bigint({ mode: "number" }).notNull(),
  journalSequence: bigint({ mode: "number" }).notNull(),
  replayFrom: bigint({ mode: "number" }).notNull(),
  publishedRevision: text().notNull(),
});

export const relayRecords = pgTable(
  "relay_records",
  {
    ownerId: text()
      .notNull()
      .references(() => relayScopes.id, { onDelete: "cascade" }),
    id: text().notNull(),
    record: jsonb().$type<StoredRecord>().notNull(),
  },
  (table) => [primaryKey({ columns: [table.ownerId, table.id] })],
);

export const relayOperations = pgTable(
  "relay_operations",
  {
    ownerId: text()
      .notNull()
      .references(() => relayScopes.id, { onDelete: "cascade" }),
    id: text().notNull(),
    mutation: jsonb().$type<Mutation>().notNull(),
    order: bigint({ mode: "number" }).notNull(),
    status: text({ enum: ["accepted", "conflict", "pending"] }).notNull(),
    checkpointEpoch: text(),
    acceptedSequence: bigint({ mode: "number" }),
    conflictId: text(),
    reason: text(),
  },
  (table) => [
    primaryKey({ columns: [table.ownerId, table.id] }),
    uniqueIndex("relay_operations_order").on(table.ownerId, table.order),
    uniqueIndex("relay_operations_accepted_sequence").on(table.ownerId, table.acceptedSequence),
    index("relay_operations_captures")
      .using("gin", sql`(${table.mutation}->'resolution'->'capturedOperationIds')`)
      .where(sql`${table.status} = 'accepted'`),
  ],
);

export const relayConflicts = pgTable(
  "relay_conflicts",
  {
    ownerId: text()
      .notNull()
      .references(() => relayScopes.id, { onDelete: "cascade" }),
    id: text().notNull(),
    revision: bigint({ mode: "number" }).notNull(),
    recordIds: text().array().notNull(),
    alternativeOperationIds: text().array().notNull(),
    resolvedBy: text(),
  },
  (table) => [
    primaryKey({ columns: [table.ownerId, table.id] }),
    index("relay_conflicts_records").using("gin", table.recordIds),
  ],
);
