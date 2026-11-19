import type { ExtensionStorageApi, StorageGroup } from "@pstdio/sdk/extensions";
import type { StoredPlan } from "../contracts";
import { type PlanPlacement, placementRecordId } from "./placement-records";

export type PlacementSnapshot = PlanPlacement & { recordId: string; revision: string };

// Preserve the longest increasing subsequence, so moving one stored ticket does
// not rewrite its neighbours. Position comparison follows the byte-lexical contract.
const stableAnchors = (order: StoredPlan["order"], previous: Map<string, PlacementSnapshot>) => {
  const tails: { index: number; position: string }[] = [];
  const links = new Map<number, number>();
  for (let index = 0; index < order.length; index++) {
    const current = previous.get(order[index].ticketId);
    if (!current) continue;
    let lower = 0;
    let upper = tails.length;
    while (lower < upper) {
      const middle = (lower + upper) >>> 1;
      if (tails[middle].position < current.position) lower = middle + 1;
      else upper = middle;
    }
    if (lower) links.set(index, tails[lower - 1].index);
    tails[lower] = { index, position: current.position };
  }
  const anchors = new Set<number>();
  let index = tails.at(-1)?.index;
  while (index !== undefined) {
    anchors.add(index);
    index = links.get(index);
  }
  return anchors;
};

export const planPositionEdits = async (
  storage: ExtensionStorageApi,
  order: StoredPlan["order"],
  snapshots: PlacementSnapshot[],
) => {
  const previous = new Map(snapshots.map((entry) => [entry.ticketId, entry]));
  const anchors = stableAnchors(order, previous);
  const anchorIndices = [...anchors].sort((a, b) => a - b);
  let anchorIndex = 0;
  let lower: string | undefined;
  const next: PlanPlacement[] = [];
  for (let index = 0; index < order.length; index++) {
    const entry = order[index];
    let position: string;
    if (anchors.has(index)) {
      position = previous.get(entry.ticketId)!.position;
      anchorIndex++;
    } else {
      const upcoming = order[anchorIndices[anchorIndex]];
      const upper = upcoming ? previous.get(upcoming.ticketId)?.position : undefined;
      position = storage.positions.between(lower, upper);
    }
    next.push({ ...entry, position });
    lower = position;
  }
  const newIds = next.filter(({ ticketId }) => !previous.has(ticketId)).map(({ ticketId }) => ticketId);
  const revisions = new Map(snapshots.map(({ ticketId, revision }) => [ticketId, revision]));
  for (let offset = 0; offset < newIds.length; offset += 100) {
    const ids = newIds.slice(offset, offset + 100);
    const records = await storage.records.readMany(ids.map((id) => placementRecordId(storage, id)));
    records.forEach((record, index) => {
      if (record.exists && !record.deleted) throw new Error("Plan membership changed before publication");
      revisions.set(ids[index], record.revision);
    });
  }
  const edits: StorageGroup["edits"] = next.flatMap((entry) => {
    const before = previous.get(entry.ticketId);
    if (before?.position === entry.position && before.deadlineId === entry.deadlineId) return [];
    return [
      {
        recordId: placementRecordId(storage, entry.ticketId),
        expectedRevision: revisions.get(entry.ticketId),
        deleted: false,
        replace: { ...entry },
      },
    ];
  });
  const selected = new Set(order.map(({ ticketId }) => ticketId));
  for (const before of snapshots)
    if (!selected.has(before.ticketId))
      edits.push({ recordId: before.recordId, expectedRevision: before.revision, deleted: true });
  return edits;
};
