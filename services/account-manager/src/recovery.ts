import { asc, eq, sql } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";
import { canonicalJson, fingerprint, identitySchema, spaceKeySchema } from "pstdio-sync-contracts";
import { z } from "zod";
import { session, verification } from "./auth-schema";
import { ownerSchema } from "./contracts";
import type { ManagerDatabase, ManagerTransaction } from "./database";
import { accounts, devices, requests, restoreRequests, spaceKeys, workbenches } from "./schema";

const spaceKeyIdentity = (row: { accountId: string; workbenchId: string; space: string; generation: number }) =>
  canonicalJson([row.accountId, row.workbenchId, row.space, row.generation]);

const snapshotSchema = z
  .strictObject({
    // Version 3 adds encryption keys, so losing the key store never makes relay data unreadable.
    version: z.literal(3),
    accounts: z.array(
      z.strictObject({
        id: identitySchema,
        ownerIssuer: ownerSchema.shape.issuer,
        ownerSubject: ownerSchema.shape.subject,
        state: z.enum(["active", "disabled"]),
      }),
    ),
    workbenches: z.array(z.strictObject({ accountId: identitySchema, id: identitySchema })),
    keys: z.array(
      spaceKeySchema.extend({
        accountId: identitySchema,
        workbenchId: identitySchema,
        space: z.enum(["project", "personal"]),
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
  })
  .superRefine((snapshot, context) => {
    const accountIds = new Set(snapshot.accounts.map((account) => account.id));
    const memberships = new Set(snapshot.workbenches.map((row) => canonicalJson([row.accountId, row.id])));
    const requestIds = new Set<string>();
    const invalid = (path: (string | number)[], message: string) => context.addIssue({ code: "custom", path, message });
    if (accountIds.size !== snapshot.accounts.length) invalid(["accounts"], "Duplicate account identity");
    if (memberships.size !== snapshot.workbenches.length) invalid(["workbenches"], "Duplicate workbench identity");
    for (const [index, row] of snapshot.workbenches.entries()) {
      if (!accountIds.has(row.accountId)) invalid(["workbenches", index], "Unknown workbench account");
    }
    const keyIds = new Set<string>();
    for (const [index, row] of snapshot.keys.entries()) {
      const key = spaceKeyIdentity(row);
      if (keyIds.has(key)) invalid(["keys", index], "Duplicate key identity");
      keyIds.add(key);
      if (!accountIds.has(row.accountId)) invalid(["keys", index], "Unknown key account");
    }
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
        .orderBy(asc(spaceKeys.accountId), asc(spaceKeys.workbenchId), asc(spaceKeys.space), asc(spaceKeys.generation));
      return snapshotSchema.parse({
        version: 3,
        accounts: accountRows,
        workbenches: workbenchRows,
        keys: keyRows,
        requests: requestRows,
      });
    },
    { isolationLevel: "repeatable read", accessMode: "read only" },
  );

type Snapshot = z.infer<typeof snapshotSchema>;

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
    await transaction.delete(verification);
    await transaction.delete(session);
    // Restored devices log in again, so no device credential survives a restore.
    await transaction.delete(devices);
    await transaction.update(accounts).set({ state: "disabled" });
    await insertBatches(
      transaction,
      accounts,
      snapshot.accounts.map((account) => ({ ...account, state: "disabled" as const })),
    );
    await insertBatches(transaction, workbenches, snapshot.workbenches);
    await insertBatches(transaction, spaceKeys, snapshot.keys);
    await insertBatches(transaction, requests, snapshot.requests);
    await transaction.insert(restoreRequests).values({ id, fingerprint: digest });
  });
};
