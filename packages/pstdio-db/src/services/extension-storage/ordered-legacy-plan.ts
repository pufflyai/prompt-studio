import { decodeRecordFrame } from "pstdio-sync/relay";
import type * as Y from "yjs";
import { legacyPendingPaths } from "./ordered-legacy-paths";

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
  constructor(paths: Map<string, string[][]> = new Map()) {
    for (const [id, selected] of paths) {
      const root = new CoveredPaths();
      for (const path of selected) root.add(path);
      this.covered.set(id, root);
    }
  }
  paths(recordId: string) {
    return this.covered.get(recordId)?.below([]) ?? [];
  }
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

export const planLegacyFrame = (bytes: Uint8Array, covered: LegacyPendingMask, documents: Map<string, Y.Doc>) => {
  const frame = decodeLegacyPendingFrame(bytes);
  const records = new Map<string, LegacyRecordPlan>();
  for (const entry of frame.records) {
    const document = documents.get(entry.recordId);
    if (!document) throw new Error("Pending legacy record is missing its conversion source");
    const touched = legacyPendingPaths(document, entry.recordId, entry.bytes);
    records.set(entry.recordId, covered.select(entry.recordId, touched));
  }
  return records;
};
