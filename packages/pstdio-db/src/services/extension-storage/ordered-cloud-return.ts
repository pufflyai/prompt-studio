import { and, eq, inArray, like, or, sql } from "drizzle-orm";
import type { StorageOwner } from "pstdio-sync";
import type { DbClient } from "../../db/connection.pglite";
import {
  storage_documents as documents,
  storage_ordered_resource_numbers as numbers,
  storage_ordered_owners as owners,
  owners as storageOwners,
} from "../../db/schemas.pg";
import { ensureOrderedOwner } from "./ordered-conversion";
import { readConversion } from "./ordered-conversion-state";
import { createOrderedJournal, withOrderedOwner } from "./ordered-journal";
import { pendingOrderedOperations } from "./ordered-pending";
import { rebaseOrderedProjection } from "./ordered-rebase";
import {
  foldOrderedRecords,
  orderedFoldPage,
  readOrderedReturnMarker,
  readOrderedReturnState,
  setOrderedReturnState,
  unfoldedOrderedRecords,
} from "./ordered-return";
import {
  discardOrderedReturn,
  type OrderedReplacedNotice,
  orderedReplacedPrefix,
  orderedReturnSummary,
} from "./ordered-return-review";
import { decodeOrderedJson } from "./ordered-sql";

/** The account whose project list last included this owner; private to this device. */
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
    .select({ workbenchId: storageOwners.project_id, extensionId: storageOwners.extension_id })
    .from(owners)
    .innerJoin(storageOwners, eq(owners.owner_id, storageOwners.id))
    .where(
      and(
        projectIds ? inArray(storageOwners.project_id, projectIds) : undefined,
        or(
          owners.joined,
          sql`${owners.epoch} IS NOT NULL AND ${owners.epoch} <> '' AND ${owners.epoch} NOT LIKE 'local:%'`,
          sql`EXISTS (SELECT 1 FROM storage_record_sync l WHERE l.workbench_id = ${storageOwners.project_id}
            AND l.extension_id = ${storageOwners.extension_id} AND l.joined)`,
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
export const createOrderedCloudReturn = (
  db: DbClient,
  deps: {
    changed: (owner: StorageOwner) => void;
    withProjectWork?: (id: string, task: () => Promise<void>) => Promise<void>;
  },
) => {
  const run = <T>(owner: StorageOwner, action: Parameters<typeof withOrderedOwner<T>>[2]) =>
    withOrderedOwner(db, owner, action);
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
  /**
   * This device stops syncing the owner but keeps its join, cursor and receipts, so syncing it again
   * sends only its own changes with their bases. Later saves fold from here on; the existing backlog
   * folds a page per transaction, so a large queue never holds the database long. The marker says
   * folding is unfinished until the last page commits, so a crash resumes on the next refresh and a
   * finished owner costs one read per refresh.
   */
  const leave = async (owner: StorageOwner) => {
    const marker = await readOrderedReturnMarker(db, owner);
    if (marker?.state === "held" || (marker?.state === "signed-out" && !marker.folding)) return false;
    const ids = await run(owner, async (_journal, tx) => {
      if ((await readOrderedReturnState(tx, owner)) === "held") return [];
      await setOrderedReturnState(tx, owner, "signed-out", { folding: true });
      return unfoldedOrderedRecords(tx, owner);
    });
    const done = new Set<string>();
    for (let offset = 0; offset < ids.length; offset += orderedFoldPage) {
      await run(owner, async (journal, tx) => {
        const changed = await foldOrderedRecords(journal, tx, owner, ids.slice(offset, offset + orderedFoldPage), done);
        if (changed.length) await rebaseOrderedProjection(journal, tx, owner, changed);
      });
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    await run(owner, async (_journal, tx) => {
      if ((await readOrderedReturnState(tx, owner)) === "signed-out")
        await setOrderedReturnState(tx, owner, "signed-out");
    });
    return true;
  };
  return {
    async signOut() {
      await each(await joinedOwners(db), leave);
    },
    /**
     * Once a signed-in account's project list loads, projects it syncs that were signed out return on
     * their next connection. Every other joined project stays on this device as if signed out, whether
     * this account stopped syncing it or another account signed in: edits stay visible and fold,
     * nothing uploads, and the join, cursor and receipts stay. Syncing it again therefore never
     * resubmits whole records over changes this device did not make; a lost stream is refounded
     * from this device's copy like any relay loss.
     */
    async release(keepProjectIds: string[]) {
      for (const row of await withStates(db, await joinedOwners(db, keepProjectIds)))
        if (row.state === "signed-out") await run(row, (_journal, tx) => setOrderedReturnState(tx, row, "returning"));
      const kept = new Set(keepProjectIds);
      await each(
        (await joinedOwners(db)).filter((row) => !kept.has(row.workbenchId)),
        leave,
      );
    },
    async removalState(projectId: string): Promise<"verified" | "pending" | "unknown"> {
      return db.transaction(async (tx) => {
        const rows = await withStates(tx, await joinedOwners(tx, [projectId]));
        let state: "verified" | "unknown" = "verified";
        for (const row of rows) {
          if (await readConversion(tx, row)) {
            state = "unknown";
            continue;
          }
          if (!row.state) continue;
          for await (const entry of pendingOrderedOperations(createOrderedJournal(tx, row))) {
            if (entry.operation.edits.length) return "pending";
          }
        }
        return state;
      });
    },
    async status(projectId: string): Promise<CloudReturnStatus> {
      const rows = (await withStates(db, await joinedOwners(db, [projectId]))).filter((row) => row.state);
      const changed: CloudReturnStatus["changed"] = { total: 0, deletions: 0, records: [] };
      for (const row of rows) {
        const owner = { workbenchId: row.workbenchId, extensionId: row.extensionId };
        // Status reads never take the owner's write lock that synchronization holds, but wait for conversion.
        const convert = () => ensureOrderedOwner(db, owner);
        await (deps.withProjectWork?.(projectId, convert) ?? convert());
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
