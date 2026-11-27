import { asc, eq, sql } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";
import { canonicalJson, fingerprint, identitySchema, spaceKeySchema } from "pstdio-sync-contracts";
import { z } from "zod";
import { session, verification } from "./auth-schema";
import { ownerSchema } from "./contracts";
import type { ManagerDatabase, ManagerTransaction } from "./database";
import {
  captureProjectDeletionReceipts,
  deletionReceiptSchema,
  projectScope,
  restoreProjectDeletionReceipts,
  validateDeletionReceipts,
} from "./project-deletion-recovery";
import {
  accounts,
  devices,
  projectMembers,
  requests,
  restoreRequests,
  spaceKeys,
  teamInvitations,
  teamMembers,
  teamOwnershipOffers,
  teams,
  workbenches,
} from "./schema";
import {
  assertManagedSnapshotFits,
  captureManagedPackages,
  managedSnapshotShape,
  restoreManagedPackages,
  validateManagedSnapshot,
} from "./team-managed-recovery";
import { assertTeamUsersMatch } from "./team-recovery-users";
import { teamNameSchema } from "./teams";

const spaceKeyIdentity = (row: {
  accountId: string;
  workbenchId: string;
  space: string;
  ownerId?: string;
  generation: number;
}) => canonicalJson([row.accountId, row.workbenchId, row.space, row.ownerId ?? "", row.generation]);

const snapshotShape = z.strictObject({
  ...managedSnapshotShape,
  // Version 3 adds encryption keys, so losing the key store never makes relay data unreadable.
  version: z.literal(3),
  accounts: z.array(
    z.strictObject({
      id: identitySchema,
      ownerIssuer: ownerSchema.shape.issuer.nullable(),
      ownerSubject: ownerSchema.shape.subject.nullable(),
      state: z.enum(["active", "disabled"]),
    }),
  ),
  teams: z.array(z.strictObject({ accountId: identitySchema, name: teamNameSchema })).optional(),
  teamMembers: z
    .array(
      z.strictObject({
        accountId: identitySchema,
        userId: identitySchema,
        role: z.enum(["owner", "member"]),
      }),
    )
    .optional(),
  projectMembers: z
    .array(
      z.strictObject({
        accountId: identitySchema,
        workbenchId: identitySchema,
        userId: identitySchema,
      }),
    )
    .optional(),
  deletions: z.array(deletionReceiptSchema).optional(),
  workbenches: z.array(z.strictObject({ accountId: identitySchema, id: identitySchema })),
  keys: z.array(
    spaceKeySchema.extend({
      accountId: identitySchema,
      workbenchId: identitySchema,
      space: z.enum(["project", "personal"]),
      ownerId: identitySchema.optional(),
    }),
  ),
  requests: z.array(
    z.strictObject({
      accountId: identitySchema,
      id: identitySchema,
      fingerprint: z.string().regex(/^[0-9a-f]{64}$/),
      result: z.union([z.strictObject({ accountId: identitySchema }), z.strictObject({})]),
    }),
  ),
});

type InvalidSnapshot = (path: (string | number)[], message: string) => void;
export type Snapshot = z.infer<typeof snapshotShape>;

const validateTeamAccounts = (snapshot: Snapshot, accountIds: Set<string>, invalid: InvalidSnapshot) => {
  const teamIds = new Set((snapshot.teams ?? []).map((team) => team.accountId));
  const users = new Set(
    snapshot.accounts.filter((account) => account.ownerIssuer !== null).map((account) => account.id),
  );
  for (const [index, row] of snapshot.accounts.entries()) {
    const ownsPersonalAccount = row.ownerIssuer !== null && row.ownerSubject !== null;
    if ((row.ownerIssuer === null) !== (row.ownerSubject === null) || ownsPersonalAccount === teamIds.has(row.id))
      invalid(["accounts", index], "Invalid personal or team account identity");
  }
  if (teamIds.size !== (snapshot.teams ?? []).length) invalid(["teams"], "Duplicate team account");
  for (const teamId of teamIds) if (!accountIds.has(teamId)) invalid(["teams"], "Unknown team account");
  return { teamIds, users };
};

const validateTeamGrants = (snapshot: Snapshot, teamIds: Set<string>, users: Set<string>, invalid: InvalidSnapshot) => {
  const teamGrants = new Set<string>();
  const owners = new Set<string>();
  for (const [index, row] of (snapshot.teamMembers ?? []).entries()) {
    const key = canonicalJson([row.accountId, row.userId]);
    if (!teamIds.has(row.accountId) || !users.has(row.userId) || teamGrants.has(key))
      invalid(["teamMembers", index], "Invalid team membership");
    teamGrants.add(key);
    if (row.role !== "owner") continue;
    if (owners.has(row.accountId)) invalid(["teamMembers", index], "Multiple team owners");
    owners.add(row.accountId);
  }
  if (owners.size !== teamIds.size) invalid(["teamMembers"], "Missing team owner");
  return teamGrants;
};

const validateProjectGrants = (
  snapshot: Snapshot,
  memberships: Set<string>,
  teamGrants: Set<string>,
  invalid: InvalidSnapshot,
) => {
  const projectGrants = new Set<string>();
  for (const [index, row] of (snapshot.projectMembers ?? []).entries()) {
    const key = canonicalJson([row.accountId, row.workbenchId, row.userId]);
    if (
      !memberships.has(canonicalJson([row.accountId, row.workbenchId])) ||
      !teamGrants.has(canonicalJson([row.accountId, row.userId])) ||
      projectGrants.has(key)
    )
      invalid(["projectMembers", index], "Invalid project membership");
    projectGrants.add(key);
  }
};

const validateKeys = (
  snapshot: Snapshot,
  teamIds: Set<string>,
  users: Set<string>,
  accountIds: Set<string>,
  invalid: InvalidSnapshot,
) => {
  const keyIds = new Set<string>();
  for (const [index, row] of snapshot.keys.entries()) {
    const key = spaceKeyIdentity(row);
    if (keyIds.has(key)) invalid(["keys", index], "Duplicate key identity");
    keyIds.add(key);
    if (!accountIds.has(row.accountId)) invalid(["keys", index], "Unknown key account");
    const userScoped = row.space === "personal" && teamIds.has(row.accountId);
    if (userScoped ? row.ownerId === undefined || !users.has(row.ownerId) : row.ownerId !== undefined)
      invalid(["keys", index], "Invalid space key owner");
  }
};

const snapshotSchema = snapshotShape.superRefine((snapshot, context) => {
  const accountIds = new Set(snapshot.accounts.map((account) => account.id));
  const memberships = new Set(snapshot.workbenches.map((row) => canonicalJson([row.accountId, row.id])));
  const requestIds = new Set<string>();
  const invalid = (path: (string | number)[], message: string) => context.addIssue({ code: "custom", path, message });
  if (accountIds.size !== snapshot.accounts.length) invalid(["accounts"], "Duplicate account identity");
  if (memberships.size !== snapshot.workbenches.length) invalid(["workbenches"], "Duplicate workbench identity");
  const { teamIds, users } = validateTeamAccounts(snapshot, accountIds, invalid);
  validateManagedSnapshot(snapshot, teamIds, invalid);
  const teamGrants = validateTeamGrants(snapshot, teamIds, users, invalid);
  validateProjectGrants(snapshot, memberships, teamGrants, invalid);
  validateDeletionReceipts(snapshot.deletions ?? [], accountIds, invalid);
  for (const [index, row] of snapshot.workbenches.entries()) {
    if (!accountIds.has(row.accountId)) invalid(["workbenches", index], "Unknown workbench account");
  }
  validateKeys(snapshot, teamIds, users, accountIds, invalid);
  for (const [index, row] of snapshot.requests.entries()) {
    const key = canonicalJson([row.accountId, row.id]);
    if (requestIds.has(key)) invalid(["requests", index], "Duplicate request identity");
    requestIds.add(key);
    if (!accountIds.has(row.accountId)) invalid(["requests", index], "Unknown request account");
    if ("accountId" in row.result && row.result.accountId !== row.accountId)
      invalid(["requests", index, "result"], "Request result belongs to another account");
  }
});

export const captureManager = (db: ManagerDatabase) =>
  db.transaction(
    async (transaction) => {
      const accountRows = await transaction.select().from(accounts).orderBy(asc(accounts.id));
      const workbenchRows = await transaction
        .select()
        .from(workbenches)
        .orderBy(asc(workbenches.accountId), asc(workbenches.id));
      const requestRows = await transaction.select().from(requests).orderBy(asc(requests.accountId), asc(requests.id));
      const keyRows = await transaction
        .select()
        .from(spaceKeys)
        .orderBy(
          asc(spaceKeys.accountId),
          asc(spaceKeys.workbenchId),
          asc(spaceKeys.space),
          asc(spaceKeys.ownerId),
          asc(spaceKeys.generation),
        );
      const deletions = await captureProjectDeletionReceipts(transaction);
      const teamRows = await transaction.select().from(teams).orderBy(asc(teams.accountId));
      const teamGrants = await transaction
        .select()
        .from(teamMembers)
        .orderBy(asc(teamMembers.accountId), asc(teamMembers.userId));
      const projectGrants = await transaction
        .select({
          accountId: projectMembers.accountId,
          workbenchId: projectMembers.workbenchId,
          userId: projectMembers.userId,
        })
        .from(projectMembers)
        .orderBy(asc(projectMembers.accountId), asc(projectMembers.workbenchId), asc(projectMembers.userId));
      return snapshotSchema.parse({
        ...(await captureManagedPackages(transaction)),
        version: 3,
        accounts: accountRows,
        ...(deletions.length ? { deletions } : {}),
        workbenches: workbenchRows,
        keys: keyRows.map(({ ownerId, ...row }) => ({ ...row, ...(ownerId && { ownerId }) })),
        ...(teamRows.length && { teams: teamRows, teamMembers: teamGrants, projectMembers: projectGrants }),
        requests: requestRows,
      });
    },
    { isolationLevel: "repeatable read", accessMode: "read only" },
  );

// A restore may add missing rows but never change a stored outcome or key.
const assertSnapshotFits = async (transaction: ManagerTransaction, snapshot: Snapshot) => {
  const knownRequests = new Map(
    (await transaction.select().from(requests)).map((row) => [canonicalJson([row.accountId, row.id]), row]),
  );
  for (const row of snapshot.requests) {
    const known = knownRequests.get(canonicalJson([row.accountId, row.id]));
    if (known && (known.fingerprint !== row.fingerprint || canonicalJson(known.result) !== canonicalJson(row.result)))
      throw new Error("Manager snapshot conflicts with a known request outcome");
  }
  // Replacing an existing key would make the data sealed with it unreadable.
  const knownKeys = new Map((await transaction.select().from(spaceKeys)).map((row) => [spaceKeyIdentity(row), row]));
  for (const row of snapshot.keys) {
    const known = knownKeys.get(spaceKeyIdentity(row));
    if (known && known.secret !== row.secret) throw new Error("Manager snapshot conflicts with a stored key");
  }
};

// Bound each SQL statement while keeping the full restore in one transaction.
const insertBatches = async <T extends PgTable>(
  transaction: ManagerTransaction,
  table: T,
  rows: T["$inferInsert"][],
) => {
  const batchSize = 1_000;
  for (let offset = 0; offset < rows.length; offset += batchSize)
    await transaction
      .insert(table)
      .values(rows.slice(offset, offset + batchSize))
      .onConflictDoNothing();
};

export const restoreManager = async (db: ManagerDatabase, requestId: string, input: unknown) => {
  const id = identitySchema.parse(requestId);
  const snapshot = snapshotSchema.parse(input);
  const digest = await fingerprint(snapshot);
  await db.transaction(async (transaction) => {
    await transaction.execute(sql`SELECT pg_advisory_xact_lock(0, 0)`);
    const saved = (await transaction.select().from(restoreRequests).where(eq(restoreRequests.id, id)))[0];
    if (saved) {
      if (saved.fingerprint !== digest) throw new Error("Manager restore identity reused with changed intent");
      return;
    }
    await assertSnapshotFits(transaction, snapshot);
    await assertManagedSnapshotFits(transaction, snapshot);
    await assertTeamUsersMatch(transaction, snapshot);
    await transaction.delete(verification);
    await transaction.delete(session);
    // Restored devices log in again, so no device credential survives a restore.
    await transaction.delete(devices);
    // Pending invitation secrets are deliberately excluded from snapshots. Restore also invalidates outstanding links.
    await transaction.update(teamInvitations).set({ state: "canceled" }).where(eq(teamInvitations.state, "pending"));
    // Offers depend on current membership and explicit consent. Snapshots do not carry them.
    await transaction
      .update(teamOwnershipOffers)
      .set({ state: "canceled" })
      .where(eq(teamOwnershipOffers.state, "pending"));
    await transaction.update(accounts).set({ state: "disabled" });
    // Existing teams retain their current authority. Historical snapshots can restore missing teams only.
    const existingAccounts = new Set(
      (await transaction.select({ id: accounts.id }).from(accounts)).map(({ id }) => id),
    );
    const newTeams = (snapshot.teams ?? []).filter(({ accountId }) => !existingAccounts.has(accountId));
    const newTeamIds = new Set(newTeams.map(({ accountId }) => accountId));
    const snapshotTeamIds = new Set((snapshot.teams ?? []).map(({ accountId }) => accountId));
    await insertBatches(
      transaction,
      accounts,
      snapshot.accounts.map((account) => ({ ...account, state: "disabled" as const })),
    );
    await insertBatches(transaction, teams, newTeams);
    await restoreManagedPackages(transaction, snapshot, newTeamIds);
    await insertBatches(
      transaction,
      teamMembers,
      (snapshot.teamMembers ?? []).filter(({ accountId }) => newTeamIds.has(accountId)),
    );
    const retired = await restoreProjectDeletionReceipts(transaction, snapshot.deletions ?? []);
    await insertBatches(
      transaction,
      workbenches,
      snapshot.workbenches.filter(
        (row) =>
          (!snapshotTeamIds.has(row.accountId) || newTeamIds.has(row.accountId)) &&
          !retired.has(projectScope(row.accountId, row.id)),
      ),
    );
    await insertBatches(
      transaction,
      projectMembers,
      (snapshot.projectMembers ?? []).filter(
        (row) => newTeamIds.has(row.accountId) && !retired.has(projectScope(row.accountId, row.workbenchId)),
      ),
    );
    await insertBatches(
      transaction,
      spaceKeys,
      snapshot.keys.filter((row) => retired.get(projectScope(row.accountId, row.workbenchId))?.state !== "completed"),
    );
    await insertBatches(transaction, requests, snapshot.requests);
    await transaction.insert(restoreRequests).values({ id, fingerprint: digest });
  });
};
