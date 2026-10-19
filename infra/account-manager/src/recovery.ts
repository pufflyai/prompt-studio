import { asc, eq, sql } from "drizzle-orm";
import { canonicalJson, fingerprint, identitySchema } from "pstdio-sync-contracts";
import { z } from "zod";
import { session, verification } from "./auth-schema";
import { ownerSchema } from "./contracts";
import type { ManagerDatabase } from "./database";
import { accounts, devices, requests, restoreRequests, workbenches } from "./schema";

const snapshotSchema = z
  .strictObject({
    version: z.literal(1),
    accounts: z.array(
      z.strictObject({
        id: identitySchema,
        ownerIssuer: ownerSchema.shape.issuer,
        ownerSubject: ownerSchema.shape.subject,
        state: z.enum(["active", "disabled"]),
      }),
    ),
    workbenches: z.array(z.strictObject({ accountId: identitySchema, id: identitySchema })),
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
      return snapshotSchema.parse({
        version: 1,
        accounts: accountRows,
        workbenches: workbenchRows,
        requests: requestRows,
      });
    },
    { isolationLevel: "repeatable read", accessMode: "read only" },
  );

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
    const knownRequests = new Map(
      (await transaction.select().from(requests)).map((row) => [canonicalJson([row.accountId, row.id]), row]),
    );
    for (const row of snapshot.requests) {
      const known = knownRequests.get(canonicalJson([row.accountId, row.id]));
      if (known && (known.fingerprint !== row.fingerprint || canonicalJson(known.result) !== canonicalJson(row.result)))
        throw new Error("Manager snapshot conflicts with a known request outcome");
    }
    await transaction.delete(verification);
    await transaction.delete(session);
    // Restored devices log in again, so no device credential survives a restore.
    await transaction.delete(devices);
    await transaction.update(accounts).set({ state: "disabled" });
    // Bound each SQL statement while keeping the full restore in this transaction.
    const batchSize = 1_000;
    for (let offset = 0; offset < snapshot.accounts.length; offset += batchSize)
      await transaction
        .insert(accounts)
        .values(
          snapshot.accounts
            .slice(offset, offset + batchSize)
            .map((account) => ({ ...account, state: "disabled" as const })),
        )
        .onConflictDoNothing();
    for (let offset = 0; offset < snapshot.workbenches.length; offset += batchSize)
      await transaction
        .insert(workbenches)
        .values(snapshot.workbenches.slice(offset, offset + batchSize))
        .onConflictDoNothing();
    for (let offset = 0; offset < snapshot.requests.length; offset += batchSize)
      await transaction
        .insert(requests)
        .values(snapshot.requests.slice(offset, offset + batchSize))
        .onConflictDoNothing();
    await transaction.insert(restoreRequests).values({ id, fingerprint: digest });
  });
};
