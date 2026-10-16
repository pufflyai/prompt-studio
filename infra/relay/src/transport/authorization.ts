import type { RelayOwners } from "./owners";
import { relayResponse } from "./responses";

export const authorizeRelayRequest = async (owners: RelayOwners, request: Request, workbenchId: string) => {
  const denied = () => relayResponse({ error: "Unauthorized" }, 401, { "www-authenticate": 'Bearer realm="relay"' });
  const token = /^Bearer[ \t]+(\S+)[ \t]*$/i.exec(request.headers.get("authorization") ?? "")?.[1];
  if (!token) return denied();
  try {
    const identity = await owners.verifyAccess(token);
    if (identity.workbenchId !== workbenchId) return denied();
    return { identity };
  } catch {
    return denied();
  }
};
