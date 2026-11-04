import { type StorageObserver, type StorageOwner, StorageRevisionChangedError } from "pstdio-sync";
import { observeOrderedRecord, projectOrderedOperation } from "pstdio-sync/records";
import {
  assertStorageLimits,
  fingerprint,
  type Json,
  type StorageConflict,
  type StorageConflictInspection,
  type StorageGroup,
  type StorageSaveOutcome,
  type StorageTextDeclaration,
} from "pstdio-sync-contracts";
import type { DbClient } from "../../db/connection.pglite";
import { storage_ordered_owners as owners } from "../../db/schemas.pg";
import { createCommitQueue } from "./commit-queue";
import { type OrderedJournal, withOrderedOwner } from "./ordered-journal";
import { rememberOrderedTextGeneration } from "./ordered-native-recovery";
import { bindOrderedNativeSource, type OrderedSourceInput } from "./ordered-native-source";
import { combineNumberEvents } from "./ordered-number-projection";
import { initializeOrderedOwner, orderedProjection } from "./ordered-projection";
import { knownDependencies, rebaseOrderedProjection } from "./ordered-rebase";
import { compileOrderedGroup } from "./ordered-record-compiler";
import { type OrderedTransaction, orderedOwnerWhere } from "./ordered-sql";
import { writeOrderedTextAsset } from "./ordered-text-asset";
import { createRecordQueries, listProjectedRecords, readProjectedRecords } from "./record-queries";
import type { createResourceRecords as createLegacyResourceRecords } from "./resource-records";

const savedOutcome = async (journal: OrderedJournal, operationId: string) => {
  const decision = await journal.outcome(operationId);
  let state: StorageSaveOutcome["state"] = "saved-locally";
  if (decision) state = decision.state === "refused" ? "refused" : "synced";
  return {
    operationId,
    state,
    status: "saved-locally",
  } as StorageSaveOutcome;
};

/** The public record facade owns immutable saves independently of a live connection. */
export const createOrderedResourceRecords = (
  db: DbClient,
  owner: StorageOwner,
  deps: Parameters<typeof createLegacyResourceRecords>[2] & { textFields?: StorageTextDeclaration[] },
) => {
  type LegacyRecords = ReturnType<typeof createLegacyResourceRecords>;
  const queries = createRecordQueries(db, owner, deps.diagnostics);
  let initialized: Promise<void> | undefined;
  const ready = () =>
    (initialized ??= (async () => {
      const [row] = await db.select({ id: owners.workbench_id }).from(owners).where(orderedOwnerWhere(owners, owner));
      if (!row)
        await withOrderedOwner(db, owner, (journal, tx, created) =>
          initializeOrderedOwner(journal, tx, owner, created),
        );
    })().catch((error) => {
      initialized = undefined;
      throw error;
    }));
  const readIn = async (tx: Pick<DbClient, "select">, ids: string[], observer?: StorageObserver) => {
    const records = await readProjectedRecords(tx, owner, ids);
    for (const record of records) {
      if (!record.exists) record.revision = await observeOrderedRecord(undefined);
      observer?.read(owner, record);
    }
    return records;
  };
  const commitIn = async (
    journal: OrderedJournal,
    tx: OrderedTransaction,
    input: StorageGroup,
    ownRevisions?: Map<string, string>,
  ) => {
    // Capture before the first asynchronous boundary; retries bind the entire authored request.
    const group = structuredClone(input);
    const identity = await fingerprint(group as unknown as Json);
    const previous = await journal.localOperation(group.operationId);
    if (previous) {
      if (previous.requestFingerprint !== identity) throw new Error("Operation identity reused with changed payload");
      return { records: [], projected: 0, events: [], outcome: await savedOutcome(journal, group.operationId) };
    }
    const ids = group.edits.map((edit) => edit.recordId);
    const authored = new Set(ids);
    const prepared = await rebaseOrderedProjection(journal, tx, owner, ids);
    const expected = new Map(
      ids.flatMap((id) => {
        const revision = deps.observer?.expected?.(owner, id);
        return revision === undefined ? [] : [[id, ownRevisions?.get(id) ?? revision] as const];
      }),
    );
    for (const record of expected.size ? await readIn(tx, [...expected.keys()]) : []) {
      if (expected.get(record.recordId) !== record.revision) throw new StorageRevisionChangedError();
    }
    const { views } = prepared;
    const operation = await compileOrderedGroup(group, views, deps.textFields);
    const records = await Promise.all(
      projectOrderedOperation(views, operation, await knownDependencies(journal, operation)).map(orderedProjection),
    );
    assertStorageLimits(records);
    const assets = group.edits.flatMap((edit) => (edit.asset ? [edit.asset] : []));
    if (assets.length) {
      if (!deps.assets) throw new Error("Asset verification is unavailable");
      await deps.assets.verifyComplete(assets);
    }
    await rememberOrderedTextGeneration(tx, owner, operation, records.length > 0);
    await journal.queue(operation, identity);
    const saved = await rebaseOrderedProjection(journal, tx, owner, ids);
    return {
      ...saved,
      // Projection maintenance can include other pending groups. Only this
      // command's applied writes may advance its native load observations.
      records: saved.suppressed.has(operation.operationId)
        ? []
        : saved.records.filter((record) => authored.has(record.recordId)),
      events: combineNumberEvents([...prepared.events, ...saved.events]),
      outcome: await savedOutcome(journal, group.operationId),
    };
  };
  const notify = (
    result: Pick<Awaited<ReturnType<typeof commitIn>>, "records" | "projected" | "events" | "outcome">,
  ) => {
    if (result.projected) deps.statistics.record(result.projected);
    deps.numbersChanged?.(result.events);
    deps.changed();
    if (result.records.length) deps.observer?.committed(owner, result.records, result.outcome);
    return result.outcome;
  };
  const commit = async (group: StorageGroup) => {
    const owned = structuredClone(group);
    const result = await withOrderedOwner(db, owner, async (journal, tx, created) => {
      await initializeOrderedOwner(journal, tx, owner, created);
      return commitIn(journal, tx, owned);
    });
    return notify(result);
  };
  return {
    ...queries,
    defineIndexes: async (...input: Parameters<typeof queries.defineIndexes>) => {
      await ready();
      return queries.defineIndexes(...input);
    },
    query: async (...input: Parameters<typeof queries.query>) => {
      await ready();
      return queries.query(...input);
    },
    aggregate: async (...input: Parameters<typeof queries.aggregate>) => {
      await ready();
      return queries.aggregate(...input);
    },
    conflicts: async () => [] as StorageConflict[],
    inspect: (_id: string) =>
      Promise.reject<StorageConflictInspection>(
        new Error("Records resolve in relay order; there are no conflicts to inspect"),
      ),
    resolve: (_proposal: unknown) =>
      Promise.reject<StorageSaveOutcome>(
        new Error("Records resolve in relay order; there are no conflicts to resolve"),
      ),
    commit,
    bindText: async (input: OrderedSourceInput) => {
      const result = await withOrderedOwner(db, owner, async (journal, tx, created) => {
        await initializeOrderedOwner(journal, tx, owner, created);
        return bindOrderedNativeSource(journal, tx, owner, input, deps.observer);
      });
      if (result.projected) deps.statistics.record(result.projected);
      if (result.changed) {
        deps.changed();
        deps.nativeChanged?.([result.documentKey]);
      }
      return { documentKey: result.documentKey, lifetime: result.lifetime, changed: result.changed };
    },
    writeTextAsset: async (input: {
      recordId: string;
      content: string;
      replace: StorageGroup["edits"][number]["replace"];
    }) => {
      const group = { operationId: crypto.randomUUID(), edits: [{ recordId: input.recordId, replace: input.replace }] };
      const saved = await withOrderedOwner(db, owner, async (journal, tx, created) => {
        await initializeOrderedOwner(journal, tx, owner, created);
        return writeOrderedTextAsset({
          ...input,
          tx,
          owner,
          observer: deps.observer,
          commit: () => commitIn(journal, tx, group),
        });
      });
      deps.nativeChanged?.([saved.key]);
      return notify({ ...saved.result, records: saved.records });
    },
    read: async (id: string, _branch?: { operationId: string }) => {
      await ready();
      return (await readIn(db, [id], deps.observer))[0]!;
    },
    readMany: async (ids: string[]) => {
      if (ids.length > 100) throw new Error("A batch can read at most 100 records");
      await ready();
      return readIn(db, ids, deps.observer);
    },
    list: async (prefix = "") => {
      await ready();
      const records = await listProjectedRecords(db, owner, prefix);
      for (const record of records) deps.observer?.read(owner, record);
      return records;
    },
    outcome: (id: string) =>
      withOrderedOwner(db, owner, async (journal, tx, created) => {
        await initializeOrderedOwner(journal, tx, owner, created);
        return (await journal.localOperation(id)) ? savedOutcome(journal, id) : undefined;
      }),
    transaction: async <T>(
      run: (
        records: {
          read: (id: string) => ReturnType<LegacyRecords["read"]>;
          readMany: (ids: string[]) => ReturnType<LegacyRecords["readMany"]>;
          commit: (group: StorageGroup) => Promise<StorageSaveOutcome>;
        },
        tx: OrderedTransaction,
      ) => Promise<T>,
    ) => {
      const results: Awaited<ReturnType<typeof commitIn>>[] = [];
      const ownRevisions = new Map<string, string>();
      const queue = createCommitQueue();
      const value = await withOrderedOwner(db, owner, async (journal, tx, created) => {
        await initializeOrderedOwner(journal, tx, owner, created);
        try {
          return await run(
            {
              read: async (id) => (await readIn(tx, [id], deps.observer))[0]!,
              readMany: (ids) => readIn(tx, ids, deps.observer),
              commit: (group) =>
                queue.run(async () => {
                  const result = await commitIn(journal, tx, group, ownRevisions);
                  for (const record of result.records) ownRevisions.set(record.recordId, record.revision);
                  results.push(result);
                  return result.outcome;
                }),
            },
            tx,
          );
        } finally {
          // Promise.all can reject before another admitted save finishes. Drain before rollback.
          await queue.settled();
        }
      });
      for (const result of results) notify(result);
      return value;
    },
  };
};
