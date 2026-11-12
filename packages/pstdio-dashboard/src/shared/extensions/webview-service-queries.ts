import type { WebviewHostProps } from "@pstdio/sdk/extensions";
import type { WorkbenchCore } from "@pstdio/workbench";
import { createWebviewServiceQueryAdapter } from "@pstdio/workbench/extensions";
import type { WebviewAccountQuery, WebviewPerformanceQuery } from "pstdio-api-contracts/extension-kernel";
import type { HostEventPublisher } from "pstdio-extensions/bridge/host";
import { dashboardQueryAuthority, getDashboardAccountStatusQuery } from "@/lib/scoped-queries";
import type { RuntimeCollections } from "@/lib/sync/collections";
import type { getPerformanceDiagnosticsAdapter } from "@/shared/app/performance-diagnostics";
import { getAccountQuerySources } from "./account-queries";

export const createDashboardWebviewServiceQueries = (input: {
  workbench?: WorkbenchCore;
  runtime: RuntimeCollections;
  projectId?: string;
  queryScope: WebviewHostProps["queryScope"];
  extensionId: string;
  source: readonly unknown[];
  events: HostEventPublisher;
  performance?: ReturnType<typeof getPerformanceDiagnosticsAdapter>;
}) => {
  const { runtime, projectId, performance, events } = input;
  const accountSources = getAccountQuerySources(runtime);
  const requireCurrent = () => {
    if (
      runtime.isDisposed() ||
      JSON.stringify(dashboardQueryAuthority(getDashboardAccountStatusQuery(runtime).getSnapshot().data)) !==
        JSON.stringify({ accountId: input.queryScope?.accountId, accountOrigin: input.queryScope?.accountOrigin })
    )
      throw new Error("Service query authority is closed");
  };
  const account = createWebviewServiceQueryAdapter<WebviewAccountQuery>({
    workbench: input.workbench,
    projectId,
    channel: "account.query",
    owner: JSON.stringify([input.queryScope, input.extensionId, input.source, "account"]),
    events,
    requireCurrent,
    sources: () => accountSources.sources(projectId),
    source(definition) {
      return accountSources.source(definition);
    },
  });
  const query = performance?.snapshotQuery;
  const diagnostics = query
    ? createWebviewServiceQueryAdapter<WebviewPerformanceQuery>({
        workbench: input.workbench,
        projectId,
        channel: "performance.query",
        owner: JSON.stringify([String(runtime.id), input.extensionId, input.source, "performance"]),
        events,
        requireCurrent() {
          if (runtime.isDisposed() || query.isDisposed()) throw new Error("Performance query authority is closed");
        },
        sources: () => [{ source: { service: "snapshot" }, query }],
        source: () => query,
      })
    : undefined;
  return { account, performance: diagnostics, requireCurrent };
};
