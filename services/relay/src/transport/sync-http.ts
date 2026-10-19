import type { ReportFailure } from "pstdio-service-telemetry";
import {
  type SyncError,
  type SyncRoute,
  syncProtocolHeader,
  syncProtocolVersion,
  syncRoute,
} from "pstdio-sync-contracts/protocol";
import { projectKey, SyncRejection } from "../storage/accounts";
import { verifyBearer } from "./authorization";
import type { RelayOwners } from "./owners";
import { relayResponse } from "./responses";
import type { RelaySocket } from "./sockets";
import { handleSyncOperation } from "./sync-operations";

type RelayUpgrade = (request: Request, socket: RelaySocket) => boolean;

export const syncFailure = (
  status: number,
  error: Extract<SyncError, { error: string }>["error"],
  headers?: Record<string, string>,
) => relayResponse({ error }, status, headers);

const methodFor = (route: SyncRoute) => {
  if (route.kind === "part") return "PUT";
  if (route.kind === "state" || route.kind === "live") return "GET";
  return "POST";
};

const failures: Record<SyncRoute["kind"], Parameters<ReportFailure>[0]> = {
  document: "sync_document_failed",
  state: "sync_document_failed",
  blob: "asset_operation_failed",
  part: "asset_operation_failed",
  live: "sync_subscription_failed",
};

/** The blind sync protocol (PRD 0014). Every request names its protocol version and is checked from metadata alone. */
export const handleSyncRequest = async (
  owners: RelayOwners,
  upgrade: RelayUpgrade,
  request: Request,
  report: ReportFailure,
) => {
  const url = new URL(request.url);
  const route = syncRoute(url.pathname);
  if (!route) return syncFailure(404, "not-found");
  if (url.search) return syncFailure(400, "invalid-request");
  if (request.headers.get(syncProtocolHeader) !== String(syncProtocolVersion))
    return relayResponse(
      {
        error: "protocol-unsupported",
        supported: [syncProtocolVersion],
        message: "This Prompt Studio version cannot sync with this relay. Update Prompt Studio or the relay.",
      },
      426,
      { [syncProtocolHeader]: String(syncProtocolVersion) },
    );
  const method = methodFor(route);
  if (request.method !== method) return syncFailure(405, "method-not-allowed", { allow: method });
  const identity = await verifyBearer(owners, request, route.projectId);
  if (!identity) return syncFailure(401, "unauthorized", { "www-authenticate": 'Bearer realm="relay"' });
  // Phase 1 has one user per account. Team accounts (phase 3) add a user claim for personal spaces.
  if (route.kind !== "live" && route.spaceOwner !== null && route.spaceOwner !== identity.accountId)
    return syncFailure(403, "forbidden");
  if (!owners.allow(identity.environmentId)) return syncFailure(429, "rate-limited", { "retry-after": "1" });
  if (route.kind === "live") {
    const socket = owners.live.connect({
      projectKey: projectKey(identity.accountId, route.projectId),
      accountId: identity.accountId,
      deviceId: identity.environmentId,
      expiresAt: identity.expiresAt,
    });
    if (upgrade(request, socket)) return;
    socket.close();
    return relayResponse({ error: "invalid-request" }, 426, { upgrade: "websocket" });
  }
  try {
    return await handleSyncOperation(
      owners,
      route,
      { accountId: identity.accountId, deviceId: identity.environmentId },
      request,
    );
  } catch (error) {
    if (error instanceof SyncRejection) return relayResponse(error.body, error.status);
    if (!request.signal.aborted) report(failures[route.kind]);
    return syncFailure(503, "unavailable");
  }
};
