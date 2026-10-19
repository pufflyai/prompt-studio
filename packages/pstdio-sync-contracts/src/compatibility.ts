import { z } from "zod";

export const peerSchema = z.strictObject({
  release: z.string().min(1),
  protocolVersions: z.array(z.number().int().positive()).min(1),
  supportedFeatures: z.array(z.string().min(1)),
  requiredFeatures: z.array(z.string().min(1)),
});
export type Peer = z.infer<typeof peerSchema>;
export const protocolPeer: Peer = {
  release: "contracts-v2",
  protocolVersions: [2],
  supportedFeatures: [
    "atomic-groups",
    "retained-recovery",
    "revisioned-resolution",
    "covered-snapshots",
    "fenced-generations",
  ],
  requiredFeatures: [
    "atomic-groups",
    "retained-recovery",
    "revisioned-resolution",
    "covered-snapshots",
    "fenced-generations",
  ],
};

export function negotiate(client: Peer, relay: Peer) {
  const common = client.protocolVersions.includes(2) && relay.protocolVersions.includes(2);
  const features =
    client.requiredFeatures.every((feature) => relay.supportedFeatures.includes(feature)) &&
    relay.requiredFeatures.every((feature) => client.supportedFeatures.includes(feature));
  if (common && features) return { status: "compatible" as const, protocolVersion: 2 as const };
  return {
    status: "unsupported-protocol" as const,
    recoverable: true as const,
    action:
      "Update the local runtime or relay to a common protocol and required feature set. Local work remains saved; retry after updating.",
  };
}
