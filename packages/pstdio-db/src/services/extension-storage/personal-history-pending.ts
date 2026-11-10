import { and, eq, inArray } from "drizzle-orm";
import type { StorageOwner } from "pstdio-sync";
import { storage_log_entries as entries, storage_personal_history_positions as positions } from "../../db/schemas.pg";
import type { PersonalIndexAccepted, PersonalIndexDelta } from "./personal-history-index";
import {
  applyPersonalIndexRows,
  type PersonalIndexTransaction,
  personalIndexAddress,
} from "./personal-history-index-rows";
import { acceptPersonalSource } from "./personal-history-source";

/** A publish can acknowledge the durable append before its optimistic projection runs. */
export const applyPendingPersonalIndex = async (
  tx: PersonalIndexTransaction,
  owner: StorageOwner,
  sourceId: string,
  changes: { delta: PersonalIndexDelta; pendingId: string }[],
) => {
  await tx.insert(positions).values(personalIndexAddress(owner)).onConflictDoNothing();
  await tx
    .select()
    .from(positions)
    .where(and(eq(positions.workbench_id, owner.workbenchId), eq(positions.extension_id, owner.extensionId)))
    .for("update");
  const changed: Awaited<ReturnType<typeof applyPersonalIndexRows>> = [];
  for (let offset = 0; offset < changes.length; offset += 100) {
    const page = changes.slice(offset, offset + 100);
    const metadata = await tx
      .select({ id: entries.entry_id, sequence: entries.relay_sequence, index: entries.relay_index })
      .from(entries)
      .where(
        and(
          eq(entries.workbench_id, owner.workbenchId),
          eq(entries.extension_id, owner.extensionId),
          eq(entries.log_name, "index"),
          eq(entries.scope, "project"),
          eq(entries.stream, sourceId),
          eq(entries.local, true),
          inArray(
            entries.entry_id,
            page.map(({ pendingId }) => pendingId),
          ),
        ),
      );
    const known = new Map(metadata.map((entry) => [entry.id, entry]));
    const pending: typeof page = [];
    const accepted: PersonalIndexAccepted[] = [];
    for (const change of page) {
      const entry = known.get(change.pendingId);
      if (!entry) throw new Error("A private index projection requires its durable local log entry");
      if (entry.sequence === null) pending.push(change);
      else {
        if (entry.index === null) throw new Error("An accepted private index entry requires its relay index");
        accepted.push({ entryId: entry.id, sequence: entry.sequence, index: entry.index, delta: change.delta });
      }
    }
    changed.push(...(await applyPersonalIndexRows(tx, owner, pending, sourceId)));
    // Reapply through the canonical precedence rule, without advancing a partially processed cursor.
    if (accepted.length) changed.push(...(await acceptPersonalSource(tx, owner, sourceId, null, accepted)));
  }
  return changed;
};
