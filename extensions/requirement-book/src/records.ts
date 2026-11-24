import type { ExtensionContextBase, ExtensionStorageApi } from "@pstdio/sdk/extensions";
import { contentJson } from "./content";
import type { Operation } from "./model";

export interface Suggestion {
  id: string;
  workspaceId: string;
  title: string;
  reason: string;
  baseRevision: string;
  operations: Operation[];
  reviewedDigest: string | null;
  appliedRevision: string | null;
  application?: { beforeDigest: string; afterDigest: string };
  createdAt: string;
  updatedAt: string;
}
export interface Finding {
  id: string;
  workspaceId: string;
  kind: "violation" | "potential-conflict" | "missing-evidence" | "stale-evidence";
  title: string;
  explanation: string;
  requirements: string[];
  resolved: boolean;
  managedBy?: "focused-check";
  updatedAt: string;
}
export interface ReadRecord {
  id: string;
  digest: string;
}
export interface SubmissionProof {
  kind: "finding" | "suggestion";
  id: string;
}

export interface Draft {
  id: string;
  workspaceId: string;
  chapter: number;
  values: Record<string, unknown>;
  editId?: string;
  submissionId?: string;
  submissionInvocationId?: string;
  submissionStatus?: "writing" | "confirmed" | "unconfirmed";
  submissionProof?: SubmissionProof;
  revision?: string;
}
export const digest = (value: unknown) => new Bun.CryptoHasher("sha256").update(contentJson(value)).digest("hex");
export const suggestionDigest = (suggestion: Suggestion) =>
  digest({
    title: suggestion.title,
    reason: suggestion.reason,
    operations: suggestion.operations,
  });
export const changed = { extensionId: "pstdio.requirement-book", id: "changed", kind: "event" as const };
export const announce = async (ctx: ExtensionContextBase, workspaceId: string) => {
  await ctx.events.emit(changed, { workspaceId });
};

// Keep the caller's observed revision, so replacing a draft cannot silently overwrite another editor.
export const readRecord = async <T>(storage: ExtensionStorageApi, kind: string, id: string) => {
  const record = await storage.records.read(storage.records.id(`${kind}/${id}`));
  return {
    record,
    value: record.exists && !record.deleted ? (record.value as unknown as { kind: string; value: T }).value : undefined,
  };
};
export const saveRecord = async <T extends { id: string }>(
  storage: ExtensionStorageApi,
  kind: string,
  value: T,
  expectedRevision?: string,
  operationId = storage.ids.create(),
) => {
  const recordId = storage.records.id(`${kind}/${value.id}`);
  const current = await storage.records.read(recordId);
  if (expectedRevision !== undefined && expectedRevision !== current.revision)
    throw new Error("The record changed. Reload before saving.");
  const payload = JSON.parse(JSON.stringify({ kind, value }));
  // A draft reservation owns its full text. A replace would compare only changed fields.
  const edit = kind === "draft" && expectedRevision !== undefined ? { set: { "": payload } } : { replace: payload };
  const outcome = await storage.records.commit({
    operationId,
    edits: [{ recordId, expectedRevision: expectedRevision ?? current.revision, deleted: false, ...edit }],
  });
  if (outcome.state === "needs-attention" || outcome.state === "refused")
    throw new Error("The record changed. Reload before saving.");
  return value;
};
export const listRecords = async <T>(storage: ExtensionStorageApi, kind: string) => {
  return (await storage.records.list())
    .filter((record) => !record.deleted && (record.value as unknown as { kind?: string })?.kind === kind)
    .map((record) => (record.value as unknown as { kind: string; value: T }).value);
};
export const deleteRecord = async (
  storage: ExtensionStorageApi,
  kind: string,
  id: string,
  expectedRevision?: string,
) => {
  const recordId = storage.records.id(`${kind}/${id}`);
  const revision = expectedRevision ?? (await storage.records.read(recordId)).revision;
  const outcome = await storage.records.commit({
    operationId: storage.ids.create(),
    edits: [{ recordId, expectedRevision: revision, deleted: true }],
  });
  if (outcome.state === "needs-attention" || outcome.state === "refused")
    throw new Error("The record changed. Reload before removing it.");
};
