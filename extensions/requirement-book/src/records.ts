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
  evidence: string[];
  reviewedDigest: string | null;
  appliedRevision: string | null;
  application?: { beforeDigest: string; afterDigest: string };
  createdAt: string;
  updatedAt: string;
}
export interface Observation {
  id: string;
  workspaceId: string;
  title: string;
  claim: string;
  kind: "source" | "assertion" | "measurement";
  revision: string;
  conditions: string;
  limits: string;
  requirements: string[];
  sources: { path: string; hash: string | null }[];
  updatedAt: string;
}
export interface Finding {
  id: string;
  workspaceId: string;
  kind: "violation" | "potential-conflict" | "missing-evidence" | "stale-evidence";
  title: string;
  explanation: string;
  requirements: string[];
  observations: string[];
  evidence: string[];
  resolved: boolean;
  managedBy?: "focused-check";
  updatedAt: string;
}
export interface ReadRecord {
  id: string;
  digest: string;
}
export interface Draft {
  id: string;
  workspaceId: string;
  chapter: number;
  values: Record<string, unknown>;
}
export const digest = (value: unknown) => new Bun.CryptoHasher("sha256").update(contentJson(value)).digest("hex");
export const suggestionDigest = (suggestion: Suggestion) =>
  digest({
    title: suggestion.title,
    reason: suggestion.reason,
    operations: suggestion.operations,
    evidence: suggestion.evidence,
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
) => {
  const recordId = storage.records.id(`${kind}/${value.id}`);
  const current = await storage.records.read(recordId);
  if (expectedRevision !== undefined && expectedRevision !== current.revision)
    throw new Error("The record changed. Reload before saving.");
  const outcome = await storage.records.commit({
    operationId: storage.ids.create(),
    edits: [
      {
        recordId,
        expectedRevision: expectedRevision ?? current.revision,
        deleted: false,
        replace: JSON.parse(JSON.stringify({ kind, value })),
      },
    ],
  });
  if (outcome.state === "needs-attention") throw new Error("The record changed. Reload before saving.");
  return value;
};
export const listRecords = async <T>(storage: ExtensionStorageApi, kind: string) => {
  return (await storage.records.list())
    .filter((record) => !record.deleted && (record.value as unknown as { kind?: string })?.kind === kind)
    .map((record) => (record.value as unknown as { kind: string; value: T }).value);
};
export const deleteRecord = async (storage: ExtensionStorageApi, kind: string, id: string) => {
  const { record } = await readRecord(storage, kind, id);
  const outcome = await storage.records.commit({
    operationId: storage.ids.create(),
    edits: [{ recordId: record.recordId, expectedRevision: record.revision, deleted: true }],
  });
  if (outcome.state === "needs-attention") throw new Error("The record changed. Reload before removing it.");
};
