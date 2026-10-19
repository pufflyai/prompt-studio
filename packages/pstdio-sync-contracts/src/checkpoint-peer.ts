import type { Peer } from "./compatibility";

const features = ["atomic-checkpoints", "covered-snapshots", "fenced-generations", "local-recovery"];
export const checkpointPeer: Peer = {
  release: "checkpoint-contracts-v2",
  protocolVersions: [2],
  supportedFeatures: features,
  requiredFeatures: features,
};
export function negotiateCheckpoint(client: Peer, relay: Peer) {
  const supports = (peer: Peer) =>
    peer.protocolVersions.includes(2) && features.every((feature) => peer.supportedFeatures.includes(feature));
  const required =
    client.requiredFeatures.every((feature) => relay.supportedFeatures.includes(feature)) &&
    relay.requiredFeatures.every((feature) => client.supportedFeatures.includes(feature));
  if (supports(client) && supports(relay) && required)
    return { status: "compatible" as const, protocolVersion: 2 as const };
  return {
    status: "unsupported-protocol" as const,
    recoverable: true as const,
    action:
      "Update the host and relay together to checkpoint protocol 2. Preserve local recovery and retry after updating.",
  };
}
