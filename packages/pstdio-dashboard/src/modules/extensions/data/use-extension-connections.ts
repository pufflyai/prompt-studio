import type { SavedExtensionSignIn, WorkbenchExtensionMetadata } from "@pstdio/sdk/api";
import { classifyApiWrite, getWorkbenchOperations, operationSubject } from "@pstdio/workbench";
import { useQuery } from "@tanstack/react-query";
import { useSyncExternalStore } from "react";
import { getRuntimeApiClient } from "@/lib/api";
import { getDashboardQueryClient } from "@/lib/query-client";
import { getDashboardScopedQueries } from "@/lib/scoped-queries";
import { createRuntimeState } from "@/lib/sync/runtime-state";
import { dashboardCommandIds } from "@/shared/app/commands";

export type ConnectionDefinition = NonNullable<WorkbenchExtensionMetadata["connections"]>[number];
type ConnectionTarget = Pick<ConnectionDefinition, "extensionId" | "localId" | "scope">;
type ConnectionChange =
  | { action: "configure"; baseUrl: string; secret?: string }
  | { action: "revoke"; baseUrl: string }
  | { action: "disconnect" | "check" };

const connectionsKey = (authority: string) => ["extension-connections", authority] as const;
const connectionSubject = (projectId: string, target: ConnectionTarget) =>
  operationSubject(
    "extension-connection",
    target.scope === "global" ? undefined : projectId,
    target.extensionId,
    target.localId,
  );
const titles = {
  configure: "Configure extension connection",
  disconnect: "Disconnect project connection",
  revoke: "Revoke saved extension sign-in",
  check: "Check extension connection",
};
const endpoint = (value: string) => (URL.canParse(value) ? new URL(value).origin : undefined);
const signInScope = (scope: ConnectionTarget["scope"]): SavedExtensionSignIn["signInScope"] =>
  scope === "global" ? "global" : "shared";
export const findSavedExtensionSignIn = (
  signIns: SavedExtensionSignIn[] | undefined,
  target: ConnectionTarget,
  baseUrl: string | undefined,
) => {
  const origin = baseUrl ? endpoint(baseUrl) : undefined;
  return signIns?.find(
    (item) =>
      item.extensionId === target.extensionId &&
      item.connectionId === target.localId &&
      item.origin === origin &&
      item.signInScope === signInScope(target.scope),
  );
};
const connectionRemoval = (
  action: ConnectionChange["action"],
  scope: ConnectionTarget["scope"],
  origin: string | undefined,
) => {
  if (action === "disconnect") return { credentialScope: "project" as const };
  if (action !== "revoke") return undefined;
  if (!origin) throw new Error("The saved sign-in has no valid server origin.");
  return {
    credentialScope: "all-projects" as const,
    origin,
    signInScope: signInScope(scope),
  };
};

export const getExtensionConnectionOperations = createRuntimeState((owner) => {
  const queries = getDashboardScopedQueries(owner);
  const operations = getWorkbenchOperations(queries);
  const client = getDashboardQueryClient(owner);
  const api = getRuntimeApiClient(owner).extensions;
  const authority = () => {
    const { runtimeId, accountId, accountOrigin } = queries.getScope();
    return JSON.stringify([runtimeId, accountOrigin, accountId]);
  };
  const active = (projectId: string, target: ConnectionTarget) =>
    operations.getSnapshot().pending.find((item) => item.subjects.includes(connectionSubject(projectId, target)));
  return {
    authority,
    active,
    read: api.listConnections,
    subscribe: operations.subscribe,
    snapshot: operations.getSnapshot,
    async change(projectId: string, target: ConnectionTarget, requested: ConnectionChange, expected: string) {
      if (authority() !== expected) throw new Error("This connection belongs to a closed account.");
      if (active(projectId, target)) throw new Error("This connection has a pending change. Check System activity.");
      const { extensionId, localId, scope } = target;
      const { action } = requested;
      const address = [projectId, extensionId, localId] as const;
      let configuration =
        requested.action === "configure" ? { baseUrl: requested.baseUrl, secret: requested.secret } : undefined;
      const origin = "baseUrl" in requested ? endpoint(requested.baseUrl) : undefined;
      const removal = connectionRemoval(action, scope, origin);
      const verifyRemoval = async (signal: AbortSignal) => {
        signal.throwIfAborted();
        const { connections, savedSignIns } = await api.listConnections(projectId);
        const confirmed =
          removal?.credentialScope === "all-projects"
            ? Array.isArray(savedSignIns) && !findSavedExtensionSignIn(savedSignIns, target, removal.origin)
            : !connections.some((item) => item.extensionId === extensionId && item.connectionId === localId);
        return confirmed ? { status: "confirmed" as const, result: undefined } : { status: "unknown" as const };
      };
      return operations.submit<void>({
        domain: "extension.connection",
        projectId: scope === "global" ? undefined : projectId,
        subjects: [connectionSubject(projectId, target)],
        title: titles[action],
        sourceCommand: { id: dashboardCommandIds.openExtensions },
        intent: action,
        draft: { extensionId, connectionId: localId, origin },
        classify: classifyApiWrite,
        async write(signal) {
          signal.throwIfAborted();
          const input = configuration;
          configuration = undefined;
          if (input) await api.configureConnection(...address, input);
          else if (removal) await api.deleteConnection(...address, removal);
          else await api.checkConnection(...address);
        },
        async reconcile(_result, signal) {
          signal.throwIfAborted();
          await client.invalidateQueries({ queryKey: connectionsKey(expected) });
        },
        check: removal ? verifyRemoval : undefined,
      }).result;
    },
  };
});

export const useExtensionConnectionActions = (projectId: string, target: ConnectionTarget) => {
  const service = getExtensionConnectionOperations();
  useSyncExternalStore(service.subscribe, service.snapshot, service.snapshot);
  const expected = service.authority();
  const active = service.active(projectId, target);
  return {
    busy: Boolean(active),
    phase:
      active?.status === "queued" || active?.status === "writing" || active?.status === "reconciling"
        ? active.intent
        : undefined,
    run: (change: ConnectionChange) => service.change(projectId, target, change, expected),
  };
};

export const useExtensionConnections = (projectId: string) => {
  const service = getExtensionConnectionOperations();
  useSyncExternalStore(service.subscribe, service.snapshot, service.snapshot);
  const authority = service.authority();
  const query = useQuery({
    queryKey: [...connectionsKey(authority), projectId],
    queryFn: () => service.read(projectId),
  });
  return { ...query, authority };
};
