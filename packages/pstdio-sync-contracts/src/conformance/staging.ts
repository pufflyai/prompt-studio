import { fingerprint } from "../fingerprint";
import type { Snapshot, StoredRecord } from "../state";
import type { Change, Mutation } from "../wire";
import { own, put } from "./dictionary";
import { applyChange, blank, cellFingerprint, equal } from "./documents";
import { resolutionProblem } from "./resolution-validation";

async function changeProblem(current: StoredRecord, change: Change) {
  if (current.deleted !== change.baseDeleted) return "delete versus edit";
  if (change.deleted !== undefined && current.revision !== change.expectedRevision) return "delete versus edit";
  if (change.expectedRevision > current.revision) return "unknown base revision";
  if (change.shared && current.primitive && change.shared.kind !== current.primitive)
    return "incompatible shared primitive";
  if (change.asset && !equal(current.asset, change.asset.base) && !equal(current.asset, change.asset.next))
    return "competing asset replacements";
  if (change.value && (await fingerprint(current.value)) !== change.value.expected)
    return "unsupported JSON replacement";
  if (change.shared?.kind === "map") {
    for (const entry of change.shared.entries) {
      if ((await cellFingerprint(current.map, entry.key)) !== entry.expected) return "competing map key edits";
    }
  }
}

// Pure reference staging, never a production service.
export async function stage(snapshot: Snapshot, mutation: Mutation, parentAccepted?: (id: string) => boolean) {
  const conflict = (reason: string) => ({ status: "conflict" as const, records: snapshot.records, reason });
  const problem = resolutionProblem(snapshot, mutation, parentAccepted);
  if (problem) return conflict(problem);
  const candidate = structuredClone(snapshot.records);
  for (const change of mutation.changes) {
    const current = own(candidate, change.recordId) ?? blank(change.recordId);
    if (change.shared && current.primitive && change.shared.kind !== current.primitive)
      return conflict("incompatible shared primitive");
    if (!mutation.resolution) {
      const reason = await changeProblem(current, change);
      if (reason) return conflict(reason);
    }
    put(candidate, change.recordId, applyChange(current, change));
  }
  return { status: "accepted" as const, records: candidate, reason: undefined };
}
