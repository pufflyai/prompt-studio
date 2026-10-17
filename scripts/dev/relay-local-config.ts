export interface LocalRelayConnection {
  accountId: string;
  workbenchId: string;
  environmentId: string;
  managerOrigin: string;
  relayOrigin: string;
  renewalGrant: string;
}

export const sameRelayOwner = (
  left: LocalRelayConnection,
  right: Omit<LocalRelayConnection, "managerOrigin" | "relayOrigin" | "renewalGrant">,
) =>
  left.accountId === right.accountId &&
  left.workbenchId === right.workbenchId &&
  left.environmentId === right.environmentId;

export const upsertLocalRelayConnection = (connections: LocalRelayConnection[], replacement: LocalRelayConnection) => {
  if (!connections.some((entry) => sameRelayOwner(entry, replacement))) return [...connections, replacement];
  return connections.map((entry) => (sameRelayOwner(entry, replacement) ? replacement : entry));
};

export const localGrantNeedsEnrollment = (status: number) => {
  if (status === 200) return false;
  if (status === 401) return true;
  throw new Error(`Local authority renewal unavailable (${status})`);
};
