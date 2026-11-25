import type { ReportFailure } from "pstdio-service-telemetry";
import {
  liveProtocolHeader,
  liveProtocolVersion,
  type SyncError,
  type SyncRoute,
  syncProtocolHeader,
  syncProtocolVersion,
  syncRoute,
} from "pstdio-sync-contracts";
import { projectKey, type SyncCaller, SyncRejection } from "../storage/accounts";
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
  if (route.kind === "state" || route.kind === "live" || route.kind === "capabilities") return "GET";
  return "POST";
};

const isWrite = (route: SyncRoute) =>
  route.kind === "part" || ((route.kind === "blob" || route.kind === "document") && route.operation !== "read");

const failures: Record<SyncRoute["kind"], Parameters<ReportFailure>[0]> = {
  document: "sync_document_failed",
  state: "sync_document_failed",
  blob: "asset_operation_failed",
  part: "asset_operation_failed",
  live: "sync_subscription_failed",
  capabilities: "sync_document_failed",
};

const upgradeLive = (
  owners: RelayOwners,
  upgrade: RelayUpgrade,
  request: Request,
  identity: Parameters<RelayOwners["live"]["connect"]>[0],
) => {
  if (request.headers.get(liveProtocolHeader) !== String(liveProtocolVersion))
    return relayResponse(
      {
        error: "protocol-unsupported",
        supported: [liveProtocolVersion],
        message: "Update Prompt Studio or the relay to use the live channel.",
      },
      426,
      { [liveProtocolHeader]: String(liveProtocolVersion) },
    );
  const socket = owners.live.connect(identity);
  if (upgrade(request, socket)) return;
  socket.close();
  return relayResponse({ error: "invalid-request" }, 426, { upgrade: "websocket" });
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
  // Previously issued personal-account tokens use the account ID as their private-space owner.
  const userId = identity.userId ?? identity.accountId;
  if (
    route.kind !== "live" &&
    route.kind !== "capabilities" &&
    route.spaceOwner !== null &&
    route.spaceOwner !== userId
  )
    return syncFailure(403, "forbidden");
  if (!owners.allow(identity.environmentId)) return syncFailure(429, "rate-limited", { "retry-after": "1" });
  const key = projectKey(identity.accountId, route.projectId);
  const caller: SyncCaller = { accountId: identity.accountId, deviceId: identity.environmentId };
  try {
    if (route.kind === "live") {
      await owners.sync.projectNotices.ready();
      return await owners.sync.projectAccess.response(key, request.signal, async () =>
        upgradeLive(owners, upgrade, request, { ...caller, userId, projectKey: key, expiresAt: identity.expiresAt }),
      );
    }
    const handle = () => handleSyncOperation(owners, route, caller, request);
    if (isWrite(route)) return await handle();
    return await owners.sync.projectAccess.response(key, request.signal, handle);
  } catch (error) {
    if (error instanceof SyncRejection) return relayResponse(error.body, error.status);
    if (!request.signal.aborted) report(failures[route.kind], error);
    return syncFailure(503, "unavailable");
  }
};
