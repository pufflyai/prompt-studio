import { coverageAckSchema } from "../checkpoint";
import { canonicalJson } from "../fingerprint";
import type { Scope } from "../wire";
import { type CoveredState, type CoveredTransaction, documentGeneration, snapshotHash } from "./covered-state";
import { put } from "./dictionary";

const requireBranches = (state: CoveredState, branches: string[]) => {
  for (const branch of branches)
    if (!Object.hasOwn(state.receipts, branch)) throw new Error("unaccounted recovery branch");
};
export async function acknowledgeCovered(
  transaction: CoveredTransaction,
  scope: Scope,
  authenticated: string,
  input: unknown,
) {
  const ack = coverageAckSchema.parse(input);
  return transaction(scope, async (state) => {
    if (
      authenticated !== ack.environmentId ||
      !Object.hasOwn(state.writers, authenticated) ||
      canonicalJson(ack.scope) !== canonicalJson(scope)
    )
      throw new Error("authorization");
    if (
      ack.epoch !== state.epoch ||
      ack.generation !== state.generation ||
      ack.cut !== state.cut ||
      ack.snapshotHash !== (await snapshotHash(state))
    )
      throw new Error("coverage does not match installed snapshot");
    requireBranches(state, ack.branches);
    for (const recovery of ack.recovery) {
      if (recovery.generation !== documentGeneration(state, recovery.recordId) || recovery.baseCut > ack.cut)
        throw new Error("invalid recovery coverage");
      requireBranches(state, recovery.branches);
    }
    put(state.acknowledgements, authenticated, ack);
  });
}
