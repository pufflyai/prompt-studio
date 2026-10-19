import type { ReportFailure } from "pstdio-service-telemetry";
import { relayRoute } from "pstdio-sync-contracts";
import { handleRelayAsset } from "./asset-http";
import { authorizeRelayRequest } from "./authorization";
import { handleRelayData } from "./data-http";
import type { RelayOwners } from "./owners";
import { relayResponse } from "./responses";
import { createRelaySubscription, type RelaySubscription } from "./subscriptions";

type RelayUpgrade = (request: Request, subscription: RelaySubscription) => boolean;

const upgradeSubscription = async (
  owners: RelayOwners,
  request: Request,
  scope: Parameters<typeof createRelaySubscription>[1],
  expiresAt: string,
  upgrade: RelayUpgrade,
  report: ReportFailure,
) => {
  try {
    const subscription = await createRelaySubscription(owners, scope, expiresAt, request.signal, report);
    if (upgrade(request, subscription)) return;
    subscription.close();
    return relayResponse({ error: "WebSocket upgrade required" }, 426, { upgrade: "websocket" });
  } catch {
    if (!request.signal.aborted) report("sync_subscription_failed");
    return relayResponse({ error: "Subscription unavailable" }, 503);
  }
};
const handleRelayRequest = async (
  owners: RelayOwners,
  upgrade: RelayUpgrade,
  request: Request,
  report: ReportFailure,
) => {
  const url = new URL(request.url);
  if (request.method === "GET" && url.pathname === "/health") return relayResponse({ status: "ok" });
  const route = relayRoute(url.pathname);
  if (!route) return relayResponse({ error: "Not found" }, 404);
  if (url.search) return relayResponse({ error: "Invalid request" }, 400);
  const { workbenchId, extensionId, operation } = route;
  let method = "POST";
  if (operation === "assets/part") method = "PUT";
  if (operation === "snapshot" || operation === "changes") method = "GET";
  if (request.method !== method) return relayResponse({ error: "Method not allowed" }, 405, { allow: method });
  const authorization = await authorizeRelayRequest(owners, request, workbenchId);
  if (authorization instanceof Response) return authorization;
  const { identity } = authorization;
  const scope = { accountId: identity.accountId, workbenchId, extensionId };
  if (operation === "changes") return upgradeSubscription(owners, request, scope, identity.expiresAt, upgrade, report);
  let body: unknown;
  if (method === "POST") {
    try {
      body = await request.json();
    } catch {
      return relayResponse({ error: "Invalid request" }, 400);
    }
  }
  if (operation.startsWith("assets/")) return handleRelayAsset(owners, scope, operation, request, body, report);
  return handleRelayData(owners, scope, identity.environmentId, operation, body, request.signal, report);
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
