import type { AccountStatus } from "@pstdio/sdk/client";
import { accountEvents, createScopedQueryClient } from "@pstdio/sdk/extensions";
import { getWorkbenchOperations } from "@pstdio/workbench";
import { canonicalExtensionId } from "pstdio-api-contracts/extension-host";
import {
  publishExtensionEvent,
  subscribeToExtensionEventFeed,
  subscribeToExtensionEventReset,
} from "@/shared/extensions/extension-webview-broadcast";
import { getRuntimeApiClient } from "./api";
import { subscribeExtensionCatalogChanges } from "./extension-catalog-events";
import { getDashboardQueryClient } from "./query-client";
import { getRuntimeCollections } from "./sync/collections";
import { createRuntimeState } from "./sync/runtime-state";

export const dashboardQueryAuthority = (status?: AccountStatus) => ({
  accountId: !status?.signInRequired && status?.login ? status.login.accountId : "local",
  accountOrigin: !status?.signInRequired ? status?.login?.managerOrigin : undefined,
});

/** All services use the existing runtime QueryClient and a single cheap freshness feed. */
const runtimeQueries = createRuntimeState(
  (owner) => {
    const client = getDashboardQueryClient(owner);
    const queries = createScopedQueryClient(
      { runtimeId: String(owner.id), accountId: "local", extensionId: "pstdio" },
      // Ten retained projects include native, catalog and shared-editing sources.
      // The packaged transition workload exceeds the standalone SDK's 128 slots.
      { client, maxInactive: 512 },
    );
    // The identity source survives account changes; it never owns project/document data.
    const authority = createScopedQueryClient(
      { runtimeId: String(owner.id), extensionId: "pstdio.account" },
      { client, maxInactive: 1 },
    );
    const account = authority.query({
      id: "account.status",
      dependsOn: [accountEvents.changed.id],
      read: (signal) => getRuntimeApiClient(owner).account.status({ signal }),
    });
    const stopEvents = subscribeToExtensionEventFeed((event) => {
      queries.invalidate({ ...event, type: "changed" });
      authority.invalidate({ ...event, type: "changed" });
    }, owner);
    const stopReset = subscribeToExtensionEventReset((event) => {
      const reset = {
        ...event,
        ...(event.extensionId ? { extensionId: canonicalExtensionId(event.extensionId) } : {}),
        type: "reset" as const,
      };
      queries.invalidate(reset);
      authority.invalidate(reset);
    }, owner);
    const stopCatalog = subscribeExtensionCatalogChanges(owner, (event) => publishExtensionEvent(event, owner));
    // One event-driven identity guard remains active for this runtime; there is no timer.
    let applied: AccountStatus | undefined;
    let knownCloudProjects = new Set<string>();
    const updateProjectRecovery = () => {
      const projects = owner.getCollection("projects");
      const localProjectsLoaded = owner.isInitialCollectionsSyncComplete();
      getWorkbenchOperations(queries).updateRetiredProjectAvailability((projectId, source) => {
        const row = projects.get(projectId);
        if (row && !row.deleted_at) return true;
        if (source === "cloud-project-picker") {
          if (knownCloudProjects.has(projectId)) return true;
          if (!applied?.cloudProjectsLoaded) return undefined;
        }
        return localProjectsLoaded ? false : undefined;
      });
    };
    const applyAuthority = () => {
      const status = account.getSnapshot().data;
      if (!status || status === applied) return;
      const previous = queries.getScope();
      const next = dashboardQueryAuthority(status);
      queries.setAuthority(next);
      if (previous.accountId !== next.accountId || previous.accountOrigin !== next.accountOrigin) {
        knownCloudProjects.clear();
      }
      if (status.cloudProjectsLoaded) {
        const accessible = new Set(status.cloudProjects);
        for (const projectId of knownCloudProjects)
          if (!accessible.has(projectId)) queries.clearScope({ ...next, projectId });
        knownCloudProjects = accessible;
      }
      applied = status;
      updateProjectRecovery();
    };
    const stopAccount = account.subscribe(applyAuthority);
    applyAuthority();
    const stopRows = owner.subscribeCollections((change) => {
      if (change && change.table !== "projects") return;
      for (const row of change?.changes ?? [])
        if (!row.value || (!row.previousValue?.deleted_at && row.value.deleted_at))
          queries.clearScope({ projectId: row.key });
      updateProjectRecovery();
    });
    return {
      queries,
      account,
      dispose() {
        stopRows();
        stopCatalog();
        stopEvents();
        stopReset();
        stopAccount();
        authority.dispose();
        queries.dispose();
      },
    };
  },
  (state) => state.dispose(),
);

export const getDashboardScopedQueries = (owner = getRuntimeCollections()) => runtimeQueries(owner).queries;
export const getDashboardAccountStatusQuery = (owner = getRuntimeCollections()) => runtimeQueries(owner).account;
