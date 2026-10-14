import type { ResourceRef, WorkbenchModuleContext } from "@pstdio/workbench";
import { subscribeCollections } from "@/lib/sync/collections";
import { getDashboardSelectedProjectId } from "@/shared/app/project-context";
import type { DashboardSessionSelectionPersistence } from "@/shared/app/session-selection-persistence";
import { forgetDashboardSession, getDashboardSelectedSessionId } from "./state/session-selection";

const closeSessionViews = (ctx: WorkbenchModuleContext, id: string) => {
  const modePlacements = ctx.modes.listModes().flatMap((mode) => ctx.modePlacements.resolvePlacements(mode.id));
  for (const placement of [...modePlacements, ...ctx.shellPlacements.resolvePlacements()]) {
    if (placement.value.resource?.type !== "session" || placement.value.resource.id !== id) continue;
    const registry = placement.identity.kind === "mode" ? ctx.modePlacements : ctx.shellPlacements;
    registry.closePlacement(placement.identity);
  }
  const resource: ResourceRef = {
    type: "session",
    id,
    extensionId: "pstdio",
    projectId: getDashboardSelectedProjectId(ctx),
  };
  ctx.pageLocations.removeResource(resource, []);
};

export const registerSessionResourceSync = (
  ctx: WorkbenchModuleContext,
  persistence?: DashboardSessionSelectionPersistence,
) =>
  subscribeCollections((change) => {
    if (change?.table !== "sessions") return;
    for (const { key: id, value, previousValue } of change.changes) {
      if ((value ?? previousValue)?.project_id !== getDashboardSelectedProjectId(ctx)) continue;
      if (value && value.archived !== true) continue;
      if (persistence?.getSelectedSessionId() === id) persistence.setSelectedSessionId(undefined);
      if (getDashboardSelectedSessionId(ctx) === id) forgetDashboardSession(ctx);
      // Archive hides saved placements too, but does not announce permanent removal.
      closeSessionViews(ctx, id);
    }
  });
