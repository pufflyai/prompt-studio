import { fingerprint, type Snapshot, sealMutation } from "pstdio-sync-contracts";
import { applyRecordChange, blankRecord } from "./records";
import type { GroupedState } from "./types";

export const conflictedState = async () => {
  const scope = { accountId: "account", workbenchId: "workbench", extensionId: "notes" };
  const owner = { workbenchId: scope.workbenchId, extensionId: scope.extensionId };
  const mutation = async (operationId: string, value: string) =>
    sealMutation({
      protocolVersion: 1,
      scope,
      operationId,
      environmentId: operationId === "winner" ? "writer" : "other",
      parents: [],
      changes: [
        {
          recordId: "note",
          expectedRevision: 0,
          baseDeleted: false,
          value: { expected: await fingerprint(null), next: value },
          ...(operationId === "branch" && {
            asset: { base: null, next: { sha256: "0".repeat(64), byteLength: 1, mediaType: "image/png" } },
          }),
        },
      ],
    });
  const winner = await mutation("winner", "accepted");
  const branch = await mutation("branch", "retained");
  const checkpoint = { epoch: "relay", sequence: 1 };
  const before: Snapshot = {
    protocolVersion: 1,
    scope,
    checkpoint,
    journalSequence: 1,
    publishedRevision: "published",
    records: { note: applyRecordChange(blankRecord("note"), winner.changes[0]) },
    receipts: {
      winner: {
        order: 1,
        operationId: winner.operationId,
        fingerprint: winner.fingerprint,
        mutation: winner,
        status: "accepted",
        checkpoint,
      },
    },
    conflicts: {},
  };
  const latest: Snapshot = {
    ...structuredClone(before),
    journalSequence: 2,
    receipts: {
      ...before.receipts,
      branch: {
        order: 2,
        operationId: branch.operationId,
        fingerprint: branch.fingerprint,
        mutation: branch,
        status: "conflict",
        checkpoint: null,
        conflictId: "branch",
      },
    },
    conflicts: {
      branch: { conflictId: "branch", revision: 1, recordIds: ["note"], alternativeOperationIds: ["branch"] },
    },
  };
  const state: GroupedState = {
    owner,
    accepted: structuredClone(latest),
    journal: [winner, branch].map((mutation) => ({
      inputFingerprint: mutation.fingerprint,
      mutation,
      acceptance:
        mutation.operationId === "winner" ? { fingerprint: mutation.fingerprint, order: 1, checkpoint } : null,
    })),
  };
  return { state, before, latest };
};
