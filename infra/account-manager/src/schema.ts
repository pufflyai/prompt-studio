import { foreignKey, index, jsonb, pgTable, primaryKey, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
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
export const credentials = pgTable(
  "manager_credentials",
  {
    id: text().primaryKey(),
    accountId: text().notNull(),
    workbenchId: text().notNull(),
    environmentId: text().notNull(),
    digest: text().notNull(),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    revokedAt: timestamp({ withTimezone: true }),
  },
  (table) => [
    uniqueIndex("manager_credentials_digest").on(table.digest),
    index("manager_credentials_account_environment").on(table.accountId, table.environmentId),
    foreignKey({
      columns: [table.accountId, table.workbenchId],
      foreignColumns: [workbenches.accountId, workbenches.id],
    }),
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
