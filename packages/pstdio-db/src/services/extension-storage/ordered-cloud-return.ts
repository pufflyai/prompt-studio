import { and, eq, inArray, like, notInArray, or, sql } from "drizzle-orm";
import type { StorageOwner } from "pstdio-sync";
import type { DbClient } from "../../db/connection.pglite";
import {
  storage_documents as documents,
  storage_record_sync as legacy,
  storage_ordered_resource_numbers as numbers,
  storage_ordered_owners as owners,
} from "../../db/schemas.pg";
import { createOrderedJournal, withOrderedOwner } from "./ordered-journal";
import { initializeOrderedOwner } from "./ordered-projection";
import { rebaseOrderedProjection } from "./ordered-rebase";
import { foldAllOrderedSaves, readOrderedReturnState, setOrderedReturnState } from "./ordered-return";
import {
  discardOrderedReturn,
  type OrderedReplacedNotice,
  orderedReplacedPrefix,
  orderedReturnSummary,
} from "./ordered-return-review";
import { decodeOrderedJson, orderedOwnerWhere } from "./ordered-sql";

/** How many changed or replaced records a status lists; totals still count all of them. */
const listed = 50;

export interface CloudReturnRecord {
  extensionId: string;
  recordId: string;
  /** Resource number such as `PS-2`, when the record is a numbered resource. */
  label?: string;
  /** JSON Pointers inside the record's value, such as `/assignee`. */
  fields: string[];
  deleted: boolean;
}
export interface CloudReturnStatus {
  /** `held` wins over `signed-out`; `null` means nothing is waiting for this project. */
  state: "signed-out" | "held" | null;
  changed: { total: number; deletions: number; records: (CloudReturnRecord & { created: boolean })[] };
  replaced: { total: number; records: (CloudReturnRecord & { whole: boolean; replacedAt: number })[] };
}

const joinedOwners = (db: Pick<DbClient, "select">, projectIds?: string[]) =>
  db
    .select({ workbenchId: owners.workbench_id, extensionId: owners.extension_id })
    .from(owners)
    .where(
      and(
        projectIds ? inArray(owners.workbench_id, projectIds) : undefined,
        or(
          owners.joined,
          sql`${owners.epoch} IS NOT NULL AND ${owners.epoch} <> '' AND ${owners.epoch} NOT LIKE 'local:%'`,
          sql`EXISTS (SELECT 1 FROM storage_record_sync l WHERE l.workbench_id = ${owners.workbench_id}
            AND l.extension_id = ${owners.extension_id} AND l.joined)`,
        ),
      ),
    );

const withStates = (db: Pick<DbClient, "select">, rows: { workbenchId: string; extensionId: string }[]) =>
  Promise.all(rows.map(async (row) => ({ ...row, state: await readOrderedReturnState(db, row) })));

/** Fields inside the record value; other channels such as files keep their own names. */
const fields = (paths: string[]) => [
  ...new Set(paths.map((path) => (path.startsWith("/value/") ? path.slice("/value".length) : path))),
];

const labels = async (db: Pick<DbClient, "select">, projectId: string, recordIds: string[]) => {
  if (!recordIds.length) return new Map<string, string>();
  const rows = await db
    .select({ id: numbers.resource_id, prefix: numbers.prefix, value: numbers.value })
    .from(numbers)
    .where(
      and(eq(numbers.workbench_id, projectId), eq(numbers.current, true), inArray(numbers.resource_id, recordIds)),
    );
  return new Map(rows.flatMap((row) => (row.value === null ? [] : [[row.id, `${row.prefix}-${row.value}`] as const])));
};

/**
 * Sign-out ends sync on this device. Joined owners fold their unsent saves into one save per record
 * and keep folding every later save, so nothing grows until the device returns. Local data stays.
 */
export const createOrderedCloudReturn = (db: DbClient, deps: { changed: (owner: StorageOwner) => void }) => {
  const run = <T>(owner: StorageOwner, action: Parameters<typeof withOrderedOwner<T>>[2]) =>
    withOrderedOwner(db, owner, async (journal, tx, created) => {
      await initializeOrderedOwner(journal, tx, owner, created);
      return action(journal, tx, created);
    });
  const each = async (
    rows: { workbenchId: string; extensionId: string }[],
    action: (owner: StorageOwner) => Promise<boolean>,
  ) => {
    const failures: unknown[] = [];
    for (const owner of rows) {
      try {
        if (await action(owner)) deps.changed(owner);
      } catch (error) {
        // One owner never keeps the rest of the device signed in.
        failures.push(error);
      }
    }
    if (failures.length) throw new AggregateError(failures, "Some Cloud data could not finish signing out");
  };
  return {
    async signOut() {
      await each(await joinedOwners(db), (owner) =>
        run(owner, async (journal, tx) => {
          if ((await readOrderedReturnState(tx, owner)) !== "held")
            await setOrderedReturnState(tx, owner, "signed-out");
          const changed = await foldAllOrderedSaves(journal, tx, owner);
          if (changed.length) await rebaseOrderedProjection(journal, tx, owner, changed);
          return changed.length > 0;
        }),
      );
    },
    /**
     * A project the signed-in account does not sync stays local: unsent saves settle here, nothing
     * uploads, and syncing it again later joins it like any local project.
     */
    async release(keepProjectIds: string[]) {
      const rows = await db
        .select({ workbenchId: owners.workbench_id, extensionId: owners.extension_id })
        .from(owners)
        .where(keepProjectIds.length ? notInArray(owners.workbench_id, keepProjectIds) : undefined);
      const joined = new Set(
        (await joinedOwners(db, [...new Set(rows.map((row) => row.workbenchId))])).map((row) =>
          JSON.stringify([row.workbenchId, row.extensionId]),
        ),
      );
      await each(
        rows.filter((row) => joined.has(JSON.stringify([row.workbenchId, row.extensionId]))),
        (owner) =>
          run(owner, async (journal, tx) => {
            await tx
              .update(owners)
              .set({
                epoch: `local:${crypto.randomUUID()}`,
                joined: false,
                after: 0,
                state_id: null,
                through: 0,
                pending_bytes: 0,
                state_bytes: 0,
                skipped: false,
                receipt_root: null,
              })
              .where(orderedOwnerWhere(owners, owner));
            await tx.update(legacy).set({ joined: false }).where(orderedOwnerWhere(legacy, owner));
            await setOrderedReturnState(tx, owner, null);
            // Rebasing settles every unsent save locally under the new local order.
            await rebaseOrderedProjection(journal, tx, owner, []);
            return true;
          }),
      );
    },
    async status(projectId: string): Promise<CloudReturnStatus> {
      const rows = (await withStates(db, await joinedOwners(db, [projectId]))).filter((row) => row.state);
      const changed: CloudReturnStatus["changed"] = { total: 0, deletions: 0, records: [] };
      for (const row of rows) {
        const owner = { workbenchId: row.workbenchId, extensionId: row.extensionId };
        // Status reads never take the owner's write lock that synchronization holds.
        const summary = await db.transaction((tx) => orderedReturnSummary(createOrderedJournal(tx, owner)));
        changed.total += summary.records.length;
        changed.deletions += summary.deletions;
        for (const record of summary.records.slice(0, listed - changed.records.length))
          changed.records.push({
            extensionId: row.extensionId,
            recordId: record.recordId,
            fields: fields(record.paths),
            deleted: record.deleted,
            created: record.created,
          });
      }
      const notices = (
        await db
          .select({ extensionId: documents.extension_id, id: documents.document_id, state: documents.state })
          .from(documents)
          .where(and(eq(documents.workbench_id, projectId), like(documents.document_id, `${orderedReplacedPrefix}%`)))
      )
        .map((row) => ({
          extensionId: row.extensionId,
          recordId: (JSON.parse(row.id) as string[])[1]!,
          ...decodeOrderedJson<OrderedReplacedNotice>(row.state),
        }))
        .sort((first, second) => second.replacedAt - first.replacedAt);
      const names = await labels(db, projectId, [
        ...changed.records.map((record) => record.recordId),
        ...notices.map((notice) => notice.recordId),
      ]);
      let state: CloudReturnStatus["state"] = null;
      if (rows.some((row) => row.state === "held")) state = "held";
      else if (changed.total && rows.some((row) => row.state === "signed-out")) state = "signed-out";
      const label = (id: string) => (names.has(id) ? { label: names.get(id)! } : {});
      return {
        state,
        changed: { ...changed, records: changed.records.map((record) => ({ ...record, ...label(record.recordId) })) },
        replaced: {
          total: notices.length,
          records: notices.slice(0, listed).map((notice) => ({
            extensionId: notice.extensionId,
            recordId: notice.recordId,
            ...label(notice.recordId),
            fields: fields(notice.paths),
            deleted: notice.deleted,
            whole: notice.whole,
            replacedAt: notice.replacedAt,
          })),
        },
      };
    },
    /** Upload held changes. The base rule still keeps whatever the in-sync devices changed. */
    async apply(projectId: string) {
      const held = (await withStates(db, await joinedOwners(db, [projectId]))).filter((row) => row.state === "held");
      await each(held, (owner) =>
        run(owner, async (_journal, tx) => {
          await setOrderedReturnState(tx, owner, null);
          return true;
        }),
      );
      return held.length > 0;
    },
    /** Take Cloud's copy: unsent saves of held owners are removed from this device. */
    async discard(projectId: string) {
      const held = (await withStates(db, await joinedOwners(db, [projectId]))).filter((row) => row.state === "held");
      await each(held, (owner) =>
        run(owner, async (journal, tx) => {
          const changed = await discardOrderedReturn(journal, tx, owner);
          await rebaseOrderedProjection(journal, tx, owner, changed);
          return true;
        }),
      );
      return held.length > 0;
    },
    async dismissReplaced(projectId: string) {
      await db
        .delete(documents)
        .where(and(eq(documents.workbench_id, projectId), like(documents.document_id, `${orderedReplacedPrefix}%`)));
    },
  };
};
