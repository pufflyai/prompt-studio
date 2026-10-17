import {
  canonicalJson,
  checkpointSchema,
  mutationSchema,
  type RelayOperation,
  relayRecoverySchema,
  type Scope,
  validateMutation,
} from "pstdio-sync-contracts";
import type { RelayOwners } from "./owners";
import { relayResponse } from "./responses";

export const handleRelayData = async (
  owners: RelayOwners,
  scope: Scope,
  environmentId: string,
  operation: RelayOperation,
  body: unknown,
  signal: AbortSignal,
) => {
  const owner = owners.storage.owner(scope);
  try {
    if (operation === "snapshot") return relayResponse(owners.recovery.snapshot(await owner.snapshot(signal)));
    if (operation === "replay") {
      const after = checkpointSchema.safeParse(body);
      if (!after.success) return relayResponse({ error: "Invalid request" }, 400);
      const replay = await owner.replay(after.data, signal);
      if (replay.status === "replay") replay.batch.groups = replay.batch.groups.map(owners.recovery.receipt);
      return relayResponse(replay);
    }
    if (operation === "recover") {
      const recovery = relayRecoverySchema.safeParse(body);
      if (!recovery.success) return relayResponse({ error: "Invalid recovery request" }, 400);
      const mutation = await validateMutation(recovery.data.mutation);
      if (
        canonicalJson(mutation.scope) !== canonicalJson(scope) ||
        !owners.recovery.verify(mutation, recovery.data.proof)
      )
        return relayResponse({ error: "Forbidden recovery" }, 403);
      return relayResponse(owners.recovery.receipt(await owner.submit(mutation, signal)));
    }
    const mutation = mutationSchema.safeParse(body);
    if (!mutation.success) return relayResponse({ error: "Invalid request" }, 400);
    if (canonicalJson(mutation.data.scope) !== canonicalJson(scope) || mutation.data.environmentId !== environmentId)
      return relayResponse({ error: "Forbidden identity" }, 403);
    return relayResponse(owners.recovery.receipt(await owner.submit(mutation.data, signal)));
  } catch {
    return relayResponse({ error: "Relay operation failed" }, 409);
  }
};
