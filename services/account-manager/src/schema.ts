import { sql } from "drizzle-orm";
import {
  foreignKey,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import type { Json } from "pstdio-sync-contracts";

export const accounts = pgTable("manager_accounts", {
  id: text().primaryKey(),
  ownerIssuer: text(),
  ownerSubject: text(),
  state: text({ enum: ["active", "disabled"] }).notNull(),
});
export const teams = pgTable("manager_teams", {
  accountId: text()
    .primaryKey()
    .references(() => accounts.id),
  name: text().notNull(),
});
// Personal account IDs identify people. Team accounts have no Google identity of their own.
export const teamMembers = pgTable(
  "manager_team_members",
  {
    accountId: text()
      .notNull()
      .references(() => teams.accountId),
    userId: text()
      .notNull()
      .references(() => accounts.id),
    role: text({ enum: ["owner", "member"] }).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.accountId, table.userId] }),
    uniqueIndex("manager_one_team_owner").on(table.accountId).where(sql`${table.role} = 'owner'`),
    index("manager_teams_by_user").on(table.userId, table.accountId),
  ],
);
export const accountFeatures = pgTable(
  "manager_account_features",
  {
    accountId: text()
      .notNull()
      .references(() => accounts.id),
    feature: text({ enum: ["relay"] }).notNull(),
    grantedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.accountId, table.feature] })],
);
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
export const projectMembers = pgTable(
  "manager_project_members",
  {
    accountId: text().notNull(),
    workbenchId: text().notNull(),
    userId: text().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.accountId, table.workbenchId, table.userId] }),
    foreignKey({
      columns: [table.accountId, table.workbenchId],
      foreignColumns: [workbenches.accountId, workbenches.id],
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.accountId, table.userId],
      foreignColumns: [teamMembers.accountId, teamMembers.userId],
    }).onDelete("cascade"),
    index("manager_project_grants_by_user").on(table.accountId, table.userId, table.workbenchId),
  ],
);
export const projectDeletions = pgTable(
  "manager_project_deletions",
  {
    accountId: text()
      .notNull()
      .references(() => accounts.id),
    workbenchId: text().notNull(),
    operationId: text().notNull(),
    delivery: integer().notNull().default(1),
    startedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    state: text({ enum: ["deleting", "needs-attention", "completed"] }).notNull(),
    completedAt: timestamp({ withTimezone: true }),
  },
  (table) => [
    primaryKey({ columns: [table.accountId, table.workbenchId] }),
    index("manager_project_deletions_pending")
      .on(table.startedAt, table.operationId)
      .where(sql`${table.state} = 'deleting'`),
  ],
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
    // An empty owner preserves the stored address of personal-account keys and identifies shared keys.
    ownerId: text().notNull().default(""),
    generation: integer().notNull(),
    secret: text().notNull(),
  },
  (table) => [
    uniqueIndex("manager_space_key_generation").on(
      table.accountId,
      table.workbenchId,
      table.space,
      table.ownerId,
      table.generation,
    ),
    index("manager_space_keys_by_user").on(table.ownerId, table.accountId),
  ],
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
    signingKey: text(),
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
