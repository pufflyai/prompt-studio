import type { AccountStatus } from "@pstdio/sdk/client";
import { accountEvents, createScopedQueryClient } from "@pstdio/sdk/extensions";
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
      queries.invalidate({ ...event, type: "reset" });
      authority.invalidate({ ...event, type: "reset" });
    }, owner);
    const stopCatalog = subscribeExtensionCatalogChanges(owner, (event) => publishExtensionEvent(event, owner));
    // One event-driven identity guard remains active for this runtime; there is no timer.
    let applied: AccountStatus | undefined;
    const applyAuthority = () => {
      const status = account.getSnapshot().data;
      if (!status || status === applied) return;
      queries.setAuthority(dashboardQueryAuthority(status));
      for (const projectId of applied?.cloudProjects ?? [])
        if (!status.cloudProjects.includes(projectId)) queries.clearScope({ projectId });
      applied = status;
    };
    const stopAccount = account.subscribe(applyAuthority);
    applyAuthority();
    const stopRows = owner.subscribeCollections((change) => {
      if (change?.table !== "projects") return;
      for (const row of change.changes) if (!row.value) queries.clearScope({ projectId: row.key });
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
