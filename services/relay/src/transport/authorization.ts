import type { RelayOwners } from "./owners";
import { relayResponse } from "./responses";

/** Returns the verified access of a bearer token for this workbench, or null. */
export const verifyBearer = async (
  owners: Pick<RelayOwners, "verifyAccess">,
  request: Request,
  workbenchId: string,
) => {
  const token = /^Bearer[ \t]+(\S+)[ \t]*$/i.exec(request.headers.get("authorization") ?? "")?.[1];
  if (!token) return null;
  try {
    const identity = await owners.verifyAccess(token);
    return identity.workbenchId === workbenchId ? identity : null;
  } catch {
    return null;
  }
};

export const authorizeRelayRequest = async (owners: RelayOwners, request: Request, workbenchId: string) => {
  const identity = await verifyBearer(owners, request, workbenchId);
  if (!identity) return relayResponse({ error: "Unauthorized" }, 401, { "www-authenticate": 'Bearer realm="relay"' });
  return { identity };
};
