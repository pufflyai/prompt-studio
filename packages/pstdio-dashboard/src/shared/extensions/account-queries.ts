import { getRuntimeApiClient } from "@/lib/api";
import { getDashboardAccountStatusQuery, getDashboardScopedQueries } from "@/lib/scoped-queries";
import { createRuntimeState } from "@/lib/sync/runtime-state";
import { createAccountQuerySources } from "./account-query-sources";

/** Reuse the mandatory identity guard and its independent runtime lifetime. */
export const getAccountQuerySources = createRuntimeState(
  (runtime) =>
    createAccountQuerySources({
      queries: getDashboardScopedQueries(runtime),
      account: getDashboardAccountStatusQuery(runtime),
      client: getRuntimeApiClient(runtime),
    }),
  (sources) => sources.dispose(),
);
