import { bigint, index, pgTable, primaryKey, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

// Every column is routing or storage metadata (PRD 0014 R9), except each latest state's small encrypted
// summary. Update, latest-state and blob bytes live in object storage.

export const syncProjects = pgTable(
  "relay_sync_projects",
  {
    // A hash of the account and project IDs. Project IDs are unique only within one account.
    projectKey: text().primaryKey(),
    // The account whose storage quota this project uses.
    accountId: text().notNull(),
    createdAt: timestamp({ withTimezone: true, mode: "date" }).notNull(),
  },
  (table) => [index("relay_sync_projects_account").on(table.accountId)],
);

export const syncDocuments = pgTable(
  "relay_sync_documents",
  {
    projectKey: text()
      .notNull()
      .references(() => syncProjects.projectKey, { onDelete: "cascade" }),
    documentId: text().notNull(),
    // Null for the project's shared documents.
    spaceOwner: text(),
    lastSequence: bigint({ mode: "number" }).notNull(),
    stateId: text(),
  },
  (table) => [primaryKey({ columns: [table.projectKey, table.documentId] })],
);

export const syncUpdates = pgTable(
  "relay_sync_updates",
  {
    projectKey: text().notNull(),
    documentId: text().notNull(),
    sequence: bigint({ mode: "number" }).notNull(),
    updateId: text().notNull(),
    deviceId: text().notNull(),
    byteLength: bigint({ mode: "number" }).notNull(),
    objectKey: text().notNull(),
    blobIds: text().array().notNull(),
    createdAt: timestamp({ withTimezone: true, mode: "date" }).notNull(),
    // Set when a latest state includes this update. Removed after the grace period.
    coveredAt: timestamp({ withTimezone: true, mode: "date" }),
  },
  (table) => [
    primaryKey({ columns: [table.projectKey, table.documentId, table.sequence] }),
    uniqueIndex("relay_sync_updates_identity").on(table.projectKey, table.documentId, table.updateId),
    uniqueIndex("relay_sync_updates_object").on(table.objectKey),
    index("relay_sync_updates_covered").on(table.coveredAt),
    index("relay_sync_updates_blobs").using("gin", table.blobIds),
  ],
);

export const syncStates = pgTable(
  "relay_sync_states",
  {
    projectKey: text().notNull(),
    documentId: text().notNull(),
    stateId: text().notNull(),
    baseStateId: text(),
    through: bigint({ mode: "number" }).notNull(),
    byteLength: bigint({ mode: "number" }).notNull(),
    // Small encrypted list of the edits the state contains. Clients compare it without downloading the state.
    summary: text().notNull(),
    objectKey: text().notNull(),
    blobIds: text().array().notNull(),
    deviceId: text().notNull(),
    createdAt: timestamp({ withTimezone: true, mode: "date" }).notNull(),
    // Set when a newer latest state replaces this one. Removed after the grace period or when the next state arrives.
    replacedAt: timestamp({ withTimezone: true, mode: "date" }),
  },
  (table) => [
    primaryKey({ columns: [table.projectKey, table.documentId, table.stateId] }),
    uniqueIndex("relay_sync_states_object").on(table.objectKey),
    index("relay_sync_states_replaced").on(table.replacedAt),
    index("relay_sync_states_blobs").using("gin", table.blobIds),
  ],
);

export const syncBlobs = pgTable(
  "relay_sync_blobs",
  {
    projectKey: text()
      .notNull()
      .references(() => syncProjects.projectKey, { onDelete: "cascade" }),
    blobId: text().notNull(),
    spaceOwner: text(),
    sha256: text().notNull(),
    byteLength: bigint({ mode: "number" }).notNull(),
    status: text({ enum: ["open", "completed", "deleting"] }).notNull(),
    createdAt: timestamp({ withTimezone: true, mode: "date" }).notNull(),
    completedAt: timestamp({ withTimezone: true, mode: "date" }),
    // Set when a stored update or latest state that listed this blob is removed.
    lastUsedAt: timestamp({ withTimezone: true, mode: "date" }),
  },
  (table) => [primaryKey({ columns: [table.projectKey, table.blobId] })],
);

// Payload objects that may have lost their row. Cleanup deletes those no row points at.
export const syncObjectDeletions = pgTable("relay_sync_object_deletions", {
  objectKey: text().primaryKey(),
});
