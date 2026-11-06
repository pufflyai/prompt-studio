import { and, desc, lt } from "drizzle-orm";
import type { StorageOwner } from "pstdio-sync";
import { decodeRecordFrame } from "pstdio-sync/relay";
import * as Y from "yjs";
import { storage_record_outbox as outbox } from "../../db/schemas.pg";
import { legacyPendingPaths } from "./ordered-legacy-paths";
import { type OrderedTransaction, orderedOwnerWhere } from "./ordered-sql";
import { loadResourceDocuments, resourceDocumentId } from "./resource-document-persistence";

export interface LegacyRecordPlan {
  lifecycle: ReturnType<typeof legacyPendingPaths>["lifecycle"];
  dirty: string[][];
  effective: { path: string[]; holes: string[][] }[];
}
class CoveredPaths {
  private covered = false;
  private children = new Map<string, CoveredPaths>();
  includes(path: string[]) {
    let node: CoveredPaths = this;
    for (const key of path) {
      if (node.covered) return true;
      const next = node.children.get(key);
      if (!next) return false;
      node = next;
    }
    return node.covered;
  }
  below(path: string[]) {
    let node: CoveredPaths = this;
    for (const key of path) {
      const next = node.children.get(key);
      if (!next) return [];
      node = next;
    }
    const pending = [{ node, path: [] as string[] }];
    const result: string[][] = [];
    while (pending.length) {
      const current = pending.pop()!;
      if (current.node.covered) result.push(current.path);
      else
        for (const [key, child] of current.node.children) pending.push({ node: child, path: [...current.path, key] });
    }
    return result;
  }
  add(path: string[]) {
    let node: CoveredPaths = this;
    for (const key of path) {
      if (node.covered) return;
      const next = node.children.get(key) ?? new CoveredPaths();
      node.children.set(key, next);
      node = next;
    }
    node.covered = true;
    node.children.clear();
  }
}
export class LegacyPendingMask {
  private covered = new Map<string, CoveredPaths>();
  select(recordId: string, touched: ReturnType<typeof legacyPendingPaths>): LegacyRecordPlan {
    const later = this.covered.get(recordId) ?? new CoveredPaths();
    const effective = touched.paths
      .filter((path) => !later.includes(path))
      .map((path) => ({ path, holes: later.below(path) }));
    for (const path of touched.paths) later.add(path);
    this.covered.set(recordId, later);
    return { lifecycle: touched.lifecycle, dirty: touched.paths, effective };
  }
}
export const decodeLegacyPendingFrame = (bytes: Uint8Array) => {
  const frame = decodeRecordFrame(bytes);
  if (frame.format || frame.blob) throw new Error("Unexpected legacy pending frame format");
  if (new Set(frame.records.map((entry) => entry.recordId)).size !== frame.records.length)
    throw new Error("A legacy pending frame repeats a record");
  return frame;
};

const planFrame = async (
  tx: OrderedTransaction,
  owner: StorageOwner,
  bytes: Uint8Array,
  covered: LegacyPendingMask,
) => {
  const frame = decodeLegacyPendingFrame(bytes);
  const { sources } = await loadResourceDocuments(
    tx,
    owner,
    frame.records.map((entry) => resourceDocumentId(entry.recordId)),
  );
  const records = new Map<string, LegacyRecordPlan>();
  for (const entry of frame.records) {
    const source = sources.get(resourceDocumentId(entry.recordId));
    if (!source) throw new Error("Pending legacy record is missing its conversion source");
    const document = new Y.Doc();
    try {
      for (const state of source.states) Y.applyUpdate(document, state);
      const touched = legacyPendingPaths(document, entry.recordId, entry.bytes);
      records.set(entry.recordId, covered.select(entry.recordId, touched));
    } finally {
      document.destroy();
    }
  }
  return records;
};

/** Reverse metadata planning removes superseded old writes without inventing collected historical values. */
export const planLegacyPending = async (tx: OrderedTransaction, owner: StorageOwner) => {
  const covered = new LegacyPendingMask();
  const plan = new Map<number, Map<string, LegacyRecordPlan>>();
  let before: number | undefined;
  while (true) {
    const page = await tx
      .select()
      .from(outbox)
      .where(and(orderedOwnerWhere(outbox, owner), before === undefined ? undefined : lt(outbox.sequence, before)))
      .orderBy(desc(outbox.sequence))
      .limit(32);
    if (!page.length) return plan;
    for (const row of page) plan.set(row.sequence, await planFrame(tx, owner, row.frame, covered));
    before = page.at(-1)!.sequence;
  }
};
