import {
  canonicalJson,
  checkpointSchema,
  mutationSchema,
  type RelayOperation,
  type Scope,
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
    if (operation === "snapshot") return relayResponse(await owner.snapshot(signal));
    if (operation === "replay") {
      const after = checkpointSchema.safeParse(body);
      if (!after.success) return relayResponse({ error: "Invalid request" }, 400);
      return relayResponse(await owner.replay(after.data, signal));
    }
    const mutation = mutationSchema.safeParse(body);
    if (!mutation.success) return relayResponse({ error: "Invalid request" }, 400);
    if (canonicalJson(mutation.data.scope) !== canonicalJson(scope) || mutation.data.environmentId !== environmentId)
      return relayResponse({ error: "Forbidden identity" }, 403);
    return relayResponse(await owner.submit(mutation.data, signal));
  } catch {
    return relayResponse({ error: "Relay operation failed" }, 409);
  }
};
