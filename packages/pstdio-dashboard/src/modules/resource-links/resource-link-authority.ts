import type { QueryScope } from "@pstdio/sdk/extensions";
import { getDashboardScopedQueries } from "@/lib/scoped-queries";
import { createRuntimeState } from "@/lib/sync/runtime-state";

export const getResourceLinkAuthority = createRuntimeState((owner) => {
  const queries = getDashboardScopedQueries(owner);
  const leases = new Map<string, { scope: QueryScope; controller: AbortController }>();
  queries.subscribeScopeRetirement((retired) => {
    for (const [projectId, lease] of leases) {
      if (!Object.entries(retired).every(([key, value]) => lease.scope[key as keyof QueryScope] === value)) continue;
      leases.delete(projectId);
      lease.controller.abort(new Error("This relationship belongs to a closed project or account."));
    }
  });
  return (projectId: string) => {
    let lease = leases.get(projectId);
    if (!lease) {
      lease = { scope: { ...queries.getScope(), projectId }, controller: new AbortController() };
      leases.set(projectId, lease);
    }
    const { signal } = lease.controller;
    return signal;
  };
});
