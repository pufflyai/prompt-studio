import { eq } from "drizzle-orm";
import {
  type Checkpoint,
  canonicalJson,
  fingerprint,
  identitySchema,
  type Mutation,
  type Scope,
  type Snapshot,
  scopeSchema,
  snapshotSchema,
  validateMutation,
} from "pstdio-sync-contracts";
import { connectRelay, type RelayTransaction } from "./database";
import { publishGroup, type RelayAssets } from "./publication";
import { restoreSnapshot } from "./restore";
import { relayScopes } from "./schema";
import { readReplay, readSnapshot } from "./snapshots";

export { migrateRelayStorage } from "./database";
export type { RelayAssets } from "./publication";

export const createRelayStorage = (databaseUrl: string, assets: RelayAssets) => {
  const connection = connectRelay(databaseUrl);
  const owner = (input: Scope) => {
    const scope = scopeSchema.parse(input);
    const key = fingerprint(scope);
    const write = async <T>(
      action: (transaction: RelayTransaction, row: typeof relayScopes.$inferSelect) => Promise<T>,
    ) =>
      connection.db.transaction(async (transaction) => {
        const row = (
          await transaction
            .select()
            .from(relayScopes)
            .where(eq(relayScopes.id, await key))
            .for("update")
        )[0];
        if (!row) throw new Error("Relay scope has not been initialized");
        return action(transaction, row);
      });
    return {
      async submit(input: Mutation) {
        const mutation = await validateMutation(input);
        if (canonicalJson(mutation.scope) !== canonicalJson(scope))
          throw new Error("Mutation belongs to another relay scope");
        return write((transaction, row) => publishGroup(transaction, row, mutation, assets));
      },
      async snapshot() {
        return connection.db.transaction(async (transaction) => readSnapshot(transaction, await key), {
          isolationLevel: "repeatable read",
          accessMode: "read only",
        });
      },
      async replay(after: Checkpoint) {
        return connection.db.transaction(async (transaction) => readReplay(transaction, await key, after), {
          isolationLevel: "repeatable read",
          accessMode: "read only",
        });
      },
      async publishRevision(expected: string, revision: string) {
        identitySchema.parse(revision);
        return write(async (transaction, row) => {
          if (row.publishedRevision !== expected) throw new Error("Published revision changed");
          await transaction.update(relayScopes).set({ publishedRevision: revision }).where(eq(relayScopes.id, row.id));
        });
      },
      async restore(input: Snapshot) {
        const saved = snapshotSchema.parse(input);
        if (canonicalJson(saved.scope) !== canonicalJson(scope))
          throw new Error("Snapshot belongs to another relay scope");
        for (const receipt of Object.values(saved.receipts)) {
          await validateMutation(receipt.mutation);
          if (canonicalJson(receipt.mutation.scope) !== canonicalJson(scope))
            throw new Error("Snapshot receipt belongs to another relay scope");
        }
        const references = new Map(
          [
            ...Object.values(saved.records).flatMap((record) => (record.asset ? [record.asset] : [])),
            ...Object.values(saved.receipts)
              .filter((receipt) => receipt.status !== "pending")
              .flatMap((receipt) =>
                receipt.mutation.changes.flatMap((change) => (change.asset?.next ? [change.asset.next] : [])),
              ),
          ].map((asset) => [canonicalJson(asset), asset]),
        );
        for (const asset of references.values())
          if (!(await assets.complete(scope, asset))) throw new Error("Restored history references incomplete assets");
        return write((transaction, row) => restoreSnapshot(transaction, row.id, saved));
      },
    };
  };
  return {
    owner,
    async initialize(input: Scope, publishedRevision: string) {
      const scope = scopeSchema.parse(input);
      if (!publishedRevision) throw new Error("Relay scope initialization requires its published revision");
      await connection.db
        .insert(relayScopes)
        .values({
          id: await fingerprint(scope),
          scope,
          epoch: crypto.randomUUID(),
          acceptedSequence: 0,
          journalSequence: 0,
          replayFrom: 0,
          publishedRevision,
        })
        .onConflictDoNothing();
      return owner(scope);
    },
    close: connection.close,
  };
};
