import { createHmac, timingSafeEqual } from "node:crypto";
import { canonicalJson, type Mutation, type Receipt, type Snapshot } from "pstdio-sync-contracts";

export const createRecoveryProofs = (key: Uint8Array) => {
  if (key.byteLength !== 32) throw new Error("Relay recovery requires a 256-bit key");
  const proof = (mutation: Mutation) =>
    createHmac("sha256", key)
      .update(
        canonicalJson({
          purpose: "pstdio-relay-operation-recovery",
          version: 1,
          scope: mutation.scope,
          operationId: mutation.operationId,
          environmentId: mutation.environmentId,
          fingerprint: mutation.fingerprint,
        }),
      )
      .digest("hex");
  const receipt = (receipt: Receipt) => ({ ...receipt, recoveryProof: proof(receipt.mutation) });
  return {
    receipt,
    snapshot: (snapshot: Snapshot) => ({
      ...snapshot,
      receipts: Object.fromEntries(Object.entries(snapshot.receipts).map(([id, value]) => [id, receipt(value)])),
    }),
    verify(mutation: Mutation, supplied: string) {
      if (!/^[0-9a-f]{64}$/.test(supplied)) return false;
      return timingSafeEqual(Buffer.from(proof(mutation), "hex"), Buffer.from(supplied, "hex"));
    },
  };
};
