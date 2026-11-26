import { sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import type { Json } from "pstdio-sync-contracts";

export const accounts = pgTable("manager_accounts", {
  id: text().primaryKey(),
  ownerIssuer: text(),
  ownerSubject: text(),
  state: text({ enum: ["active", "disabled"] }).notNull(),
});
// Kept apart from the cached Better Auth user profile. Only verified Google sign-in updates this row.
export const googleIdentityClaims = pgTable("manager_google_identity_claims", {
  subject: text().primaryKey(),
  issuedAt: integer().notNull(),
  verifiedEmail: text(),
});
export const microsoftIdentityClaims = pgTable(
  "manager_microsoft_identity_claims",
  {
    issuer: text().notNull(),
    subject: text().notNull(),
    tenantId: text().notNull(),
    objectId: text().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.issuer, table.subject] }),
    index("manager_microsoft_identity_by_directory_object").on(table.tenantId, table.objectId),
  ],
);
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
// Prevent an older link addressed to a former email from re-admitting a removed stable user.
export const teamMemberRevocations = pgTable(
  "manager_team_member_revocations",
  {
    accountId: text()
      .notNull()
      .references(() => teams.accountId),
    userId: text()
      .notNull()
      .references(() => accounts.id),
    revokedAt: timestamp({ withTimezone: true }).notNull(),
  },
  (table) => [primaryKey({ columns: [table.accountId, table.userId] })],
);
export const teamInvitations = pgTable(
  "manager_team_invitations",
  {
    id: text().primaryKey(),
    accountId: text()
      .notNull()
      .references(() => teams.accountId),
    email: text(),
    microsoftTenantId: text(),
    microsoftObjectId: text(),
    digest: text().notNull().unique(),
    issuedAt: timestamp({ withTimezone: true }).notNull().default(sql`clock_timestamp()`),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    state: text({ enum: ["pending", "accepted", "canceled"] }).notNull(),
    acceptedBy: text().references(() => accounts.id),
  },
  (table) => [
    index("manager_team_invitations_by_team").on(table.accountId, table.email),
    index("manager_team_invitations_by_microsoft_recipient").on(
      table.accountId,
      table.microsoftTenantId,
      table.microsoftObjectId,
    ),
    check(
      "manager_team_invitation_recipient",
      sql`(${table.email} is not null and ${table.microsoftTenantId} is null and ${table.microsoftObjectId} is null)
        or (${table.email} is null and ${table.microsoftTenantId} is not null and ${table.microsoftObjectId} is not null)
        or (${table.email} is null and ${table.microsoftTenantId} is null and ${table.microsoftObjectId} is null)`,
    ),
  ],
);
export const teamOwnershipOffers = pgTable("manager_team_ownership_offers", {
  accountId: text()
    .primaryKey()
    .references(() => teams.accountId),
  id: text().notNull(),
  ownerUserId: text()
    .notNull()
    .references(() => accounts.id),
  recipientUserId: text()
    .notNull()
    .references(() => accounts.id),
  state: text({ enum: ["pending", "accepted", "declined", "canceled"] }).notNull(),
});
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
    grantId: uuid().notNull().defaultRandom(),
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
