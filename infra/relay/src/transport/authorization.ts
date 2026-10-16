import type { RelayOwners } from "./owners";
import { relayResponse } from "./responses";

export const authorizeRelayRequest = async (owners: RelayOwners, request: Request, workbenchId: string) => {
  const denied = () => relayResponse({ error: "Unauthorized" }, 401, { "www-authenticate": 'Bearer realm="relay"' });
  const token = /^Bearer +(.+)$/i.exec(request.headers.get("authorization") ?? "")?.[1];
  if (!token) return denied();
  try {
    const identity = await owners.authority.authorize(token, workbenchId);
    if (!identity) return denied();
    return { identity, token };
  } catch {
    return relayResponse({ error: "Authority unavailable" }, 503);
  }
};
