import type { WorkbenchWidgetPlacement } from "pstdio-workbench/core";

const sessionResourceUriPrefix = "dashboard-workbench://session/";

const getSessionIdFromResourceUri = (resourceUri: string | undefined) => {
  if (!resourceUri?.startsWith(sessionResourceUriPrefix)) return undefined;
  return resourceUri.slice(sessionResourceUriPrefix.length);
};

export const resolveDashboardSessionPlacementId = (
  placement: Pick<WorkbenchWidgetPlacement, "resource" | "resourceUri">,
) => {
  if (placement.resource?.kind === "session") return placement.resource.id;
  return getSessionIdFromResourceUri(placement.resourceUri);
};
