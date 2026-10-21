import { integer, jsonb, pgTable, primaryKey, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import type { Json } from "pstdio-sync-contracts";

export const accounts = pgTable("manager_accounts", {
  id: text().primaryKey(),
  ownerIssuer: text().notNull(),
  ownerSubject: text().notNull(),
  state: text({ enum: ["active", "disabled"] }).notNull(),
});
export const restoreRequests = pgTable("manager_restore_requests", {
  id: text().primaryKey(),
  fingerprint: text().notNull(),
});
export const workbenches = pgTable(
  "manager_workbenches",
  {
    accountId: text()
      .notNull()
      .references(() => accounts.id),
    id: text().notNull(),
  },
  (table) => [primaryKey({ columns: [table.accountId, table.id] })],
);
// Encryption keys for a cloud project's shared space and the owner's personal space. A new generation
// is added whenever a device leaves; older generations stay so older data stays readable.
export const spaceKeys = pgTable(
  "manager_space_keys",
  {
    accountId: text()
      .notNull()
      .references(() => accounts.id),
    workbenchId: text().notNull(),
    space: text({ enum: ["project", "personal"] }).notNull(),
    generation: integer().notNull(),
    secret: text().notNull(),
  },
  (table) => [primaryKey({ columns: [table.accountId, table.workbenchId, table.space, table.generation] })],
);
// A device is one client runtime; its environment ID is the device ID. Each login replaces the credential digest.
export const devices = pgTable(
  "manager_devices",
  {
    accountId: text()
      .notNull()
      .references(() => accounts.id),
    id: text().notNull(),
    name: text().notNull(),
    platform: text().notNull(),
    digest: text().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    removedAt: timestamp({ withTimezone: true }),
  },
  (table) => [
    primaryKey({ columns: [table.accountId, table.id] }),
    uniqueIndex("manager_devices_digest").on(table.digest),
  ],
);
export const requests = pgTable(
  "manager_requests",
  {
    accountId: text()
      .notNull()
      .references(() => accounts.id),
    id: text().notNull(),
    fingerprint: text().notNull(),
    result: jsonb().$type<Record<string, Json>>().notNull(),
  },
  (table) => [primaryKey({ columns: [table.accountId, table.id] })],
);
