import { sql } from "drizzle-orm";
import { foreignKey, index, jsonb, pgTable, primaryKey, text, timestamp, unique } from "drizzle-orm/pg-core";
import type { ManagedPackageDescriptor } from "pstdio-sync-contracts";
import { teams } from "./schema";

// Only metadata, encryption keys and object references live here; package bytes stay in object storage.
export const teamManagedPackages = pgTable(
  "manager_team_managed_packages",
  {
    id: text().primaryKey(),
    accountId: text()
      .notNull()
      .references(() => teams.accountId),
    descriptor: jsonb().$type<ManagedPackageDescriptor>().notNull(),
    uploadId: text(),
    state: text({ enum: ["uploading", "ready"] }).notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().default(sql`clock_timestamp()`),
  },
  (table) => [
    index("manager_team_package_cleanup").on(table.createdAt, table.id),
    unique("manager_team_package_owner").on(table.id, table.accountId),
  ],
);

// An unselected decision is retained so stale encrypted project edits cannot revive an old policy epoch.
export const teamExtensionPolicies = pgTable(
  "manager_team_extension_policies",
  {
    accountId: text()
      .notNull()
      .references(() => teams.accountId),
    extensionId: text().notNull(),
    selectionId: text().notNull(),
    packageId: text(),
  },
  (table) => [
    primaryKey({ columns: [table.accountId, table.extensionId] }),
    foreignKey({
      name: "manager_team_policy_package_owner_fk",
      columns: [table.packageId, table.accountId],
      foreignColumns: [teamManagedPackages.id, teamManagedPackages.accountId],
    }),
  ],
);
