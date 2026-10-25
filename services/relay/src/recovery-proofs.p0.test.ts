import { expect, test } from "bun:test";
import { randomBytes } from "node:crypto";
import { fingerprint, sealMutation } from "pstdio-sync-contracts";
import { createRecoveryProofs } from "./recovery-proofs";

test("recovery evidence authenticates the exact operation scope, environment, identity and full content", async () => {
  const recovery = createRecoveryProofs(randomBytes(32));
  const mutation = await sealMutation({
    protocolVersion: 1,
    scope: { accountId: "account", workbenchId: "workbench", extensionId: "notes" },
    environmentId: "writer",
    operationId: "original",
    parents: [],
    changes: [
      {
        recordId: "note",
        expectedRevision: 0,
        baseDeleted: false,
        value: { expected: await fingerprint(null), next: "original" },
      },
    ],
  });
  const receipt = recovery.receipt({
    order: 1,
    operationId: mutation.operationId,
    fingerprint: mutation.fingerprint,
    mutation,
    status: "pending",
    checkpoint: null,
    reason: "missing ancestor",
  });
  expect(recovery.verify(mutation, receipt.recoveryProof)).toBe(true);
  expect(createRecoveryProofs(randomBytes(32)).verify(mutation, receipt.recoveryProof)).toBe(false);
  for (const field of ["accountId", "workbenchId", "extensionId"] as const)
    expect(
      recovery.verify({ ...mutation, scope: { ...mutation.scope, [field]: "forged" } }, receipt.recoveryProof),
    ).toBe(false);
  for (const field of ["environmentId", "operationId", "fingerprint"] as const)
    expect(recovery.verify({ ...mutation, [field]: "forged" }, receipt.recoveryProof)).toBe(false);
  expect(() => createRecoveryProofs(new Uint8Array(1))).toThrow();
});
