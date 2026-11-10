import { useSyncExternalStore } from "react";
import { dashboardQueryAuthority, getDashboardAccountStatusQuery } from "@/lib/scoped-queries";
import { getRuntimeCollections } from "@/lib/sync/collections";

/** Account identity comes from its authoritative API, never an extension's event payload. */
export const useDashboardQueryScope = () => {
  const owner = getRuntimeCollections();
  const query = getDashboardAccountStatusQuery(owner);
  const snapshot = useSyncExternalStore(query.subscribe, query.getSnapshot, query.getSnapshot);
  return {
    runtimeId: String(owner.id),
    ...dashboardQueryAuthority(snapshot.data),
  };
};
