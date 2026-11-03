import type { ReportFailure } from "pstdio-service-telemetry";
import type { RelayOwners } from "./owners";
import { relayResponse } from "./responses";
import type { RelaySocket } from "./sockets";
import { handleSyncRequest } from "./sync-http";

type RelayUpgrade = (request: Request, socket: RelaySocket) => boolean;

const handleRelayRequest = async (
  owners: RelayOwners,
  upgrade: RelayUpgrade,
  request: Request,
  report: ReportFailure,
) => {
  const url = new URL(request.url);
  if (request.method === "GET" && url.pathname === "/health") return relayResponse({ status: "ok" });
  if (url.pathname.startsWith("/sync/")) return handleSyncRequest(owners, upgrade, request, report);
  return relayResponse({ error: "Not found" }, 404);
};
export const createRelayHandler =
  (owners: RelayOwners, upgrade: RelayUpgrade, report: ReportFailure) => async (request: Request) => {
    try {
      return await handleRelayRequest(owners, upgrade, request, report);
    } catch {
      if (!request.signal.aborted) report("request_exception");
      return relayResponse({ error: "Relay unavailable" }, 503);
    } finally {
      if (request.body && !request.body.locked) await request.body.cancel().catch(() => {});
    }
  };
