import {
  canonicalJson,
  checkpointSchema,
  identitySchema,
  mutationSchema,
  type RelayOperation,
  relayInitializeSchema,
  relayRecoverySchema,
  type Scope,
  validateMutation,
} from "pstdio-sync-contracts";
import type { RelayOwners } from "./owners";
import { relayResponse } from "./responses";

const recoverRelayGroup = async (owners: RelayOwners, scope: Scope, body: unknown, signal: AbortSignal) => {
  const recovery = relayRecoverySchema.safeParse(body);
  if (!recovery.success) return relayResponse({ error: "Invalid recovery request" }, 400);
  const mutation = await validateMutation(recovery.data.mutation);
  if (canonicalJson(mutation.scope) !== canonicalJson(scope) || !owners.recovery.verify(mutation, recovery.data.proof))
    return relayResponse({ error: "Forbidden recovery" }, 403);
  return relayResponse(owners.recovery.receipt(await owners.storage.owner(scope).submit(mutation, signal)));
};

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
    if (operation === "initialize") {
      const registration = relayInitializeSchema.safeParse(body);
      if (!registration.success) return relayResponse({ error: "Invalid request" }, 400);
      const registered = await owners.storage.initialize(scope, registration.data.publishedRevision, signal);
      return relayResponse(owners.recovery.snapshot(await registered.enroll(environmentId, signal)));
    }
    if (operation === "snapshot")
      return relayResponse(owners.recovery.snapshot(await owner.enroll(environmentId, signal)));
    if (operation === "acknowledge") return relayResponse(await owner.acknowledge(body, environmentId, signal));
    if (operation === "capture") return relayResponse(await owner.capture(signal));
    if (operation === "captures/release") {
      const id = identitySchema.parse((body as { id: unknown })?.id);
      await owner.releaseCapture(id, signal);
      return relayResponse({});
    }
    if (operation === "replay") {
      const after = checkpointSchema.safeParse(body);
      if (!after.success) return relayResponse({ error: "Invalid request" }, 400);
      const replay = await owner.replay(after.data, signal);
      if (replay.status === "replay") {
        replay.batch.groups = replay.batch.groups.map(owners.recovery.receipt);
        replay.batch.outstanding = Object.fromEntries(
          Object.entries(replay.batch.outstanding).map(([id, receipt]) => [id, owners.recovery.receipt(receipt)]),
        );
      }
      return relayResponse(replay);
    }
    if (operation === "recover") return await recoverRelayGroup(owners, scope, body, signal);
    const mutation = mutationSchema.safeParse(body);
    if (!mutation.success)
      return relayResponse({ error: "Resynchronization required: protocol 2 group expected" }, 409);
    if (canonicalJson(mutation.data.scope) !== canonicalJson(scope) || mutation.data.environmentId !== environmentId)
      return relayResponse({ error: "Forbidden identity" }, 403);
    return relayResponse(owners.recovery.receipt(await owner.submit(mutation.data, signal)));
  } catch {
    return relayResponse({ error: "Relay operation failed" }, 409);
  }
};
