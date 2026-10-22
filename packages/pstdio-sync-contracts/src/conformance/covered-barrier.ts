import * as Y from "yjs";
import type { Scope } from "../wire";
import { type CoveredTransaction, documentGeneration, safeCoverage, settledCuts, snapshotHash } from "./covered-state";
import { own, put } from "./dictionary";
import { visible } from "./documents";

export function createDocumentBarrier(transaction: CoveredTransaction) {
  const beginBarrier = (scope: Scope, documentId: string) =>
    transaction(scope, async (state) => {
      if (state.barrier && state.barrier.documentId !== documentId)
        throw new Error("Another document barrier is active");
      state.barrier ??= { documentId, joined: [] };
    });
  const joinBarrier = (scope: Scope, authenticated: string) =>
    transaction(scope, async (state) => {
      const ack = own(state.acknowledgements, authenticated);
      if (
        !state.barrier ||
        !Object.hasOwn(state.writers, authenticated) ||
        !ack ||
        ack.snapshotHash !== (await snapshotHash(state)) ||
        ack.branches.length ||
        ack.recovery.some((recovery) => recovery.revision !== recovery.checkpointRevision)
      )
        throw new Error("Uncovered document barrier participant");
      if (!state.barrier.joined.includes(authenticated)) state.barrier.joined.push(authenticated);
    });
  const rotateDocument = (scope: Scope, documentId: string) =>
    transaction(scope, async (state) => {
      const coverage = safeCoverage(state);
      if (
        !state.barrier ||
        state.barrier.documentId !== documentId ||
        Object.keys(state.writers).some((id) => !state.barrier!.joined.includes(id)) ||
        coverage.cut !== state.cut ||
        coverage.blockers.length ||
        Object.keys(state.receipts).some((key) => !settledCuts(state).has(key))
      )
        return { status: "blocked" as const };
      const record = own(state.records, documentId);
      if (!record || record.shared?.kind !== "text") throw new Error("Document is not shared text");
      const previousGeneration = documentGeneration(state, documentId);
      const fresh = new Y.Doc();
      fresh.getText("body").insert(0, visible(record).text);
      const seed = Buffer.from(Y.encodeStateAsUpdate(fresh)).toString("base64");
      fresh.destroy();
      record.shared = { kind: "text", update: seed };
      put(state.documents, documentId, previousGeneration + 1);
      state.barrier = null;
      // The seed and fence become visible in one publication; no writer may seed independently.
      state.cut++;
      return {
        status: "rotated" as const,
        rotation: {
          scope,
          epoch: state.epoch,
          documentId,
          previousGeneration,
          generation: previousGeneration + 1,
          seed,
        },
      };
    });

  return { beginBarrier, joinBarrier, rotateDocument };
}
