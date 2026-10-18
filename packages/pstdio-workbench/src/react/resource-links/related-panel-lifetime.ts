import { resourceKey } from "@pstdio/sdk/extensions";
import type { WorkbenchModuleContext, WorkbenchRegion, WorkbenchRegionState } from "../../core";
import { batchWorkbenchChanges } from "../../core/shared/store/workbench-batch";
import { relatedResourcePageKey } from "./related-resource-page-key";

const survivingOrder = (region: WorkbenchRegionState, other: WorkbenchRegionState) =>
  region.widgets
    .filter((tab) => other.widgets.some((next) => next.widgetId === tab.widgetId))
    .map((tab) => tab.widgetId);

// A page owns visibility only when it reveals a closed panel. An explicit tab
// or visibility edit hands that panel back to the user's global layout.
export const createRelatedPanelLifetime = (ctx: WorkbenchModuleContext) => {
  const ownersByMode = new Map<string, Map<"side" | "secondary", string>>();
  const modeKey = () => JSON.stringify([ctx.pages.store.getState().projectId, ctx.modes.getActiveModeId()]);
  const snapshot = () => ({
    layout: ctx.layout.getLayout(),
    scope: ctx.layout.getPersistenceScope(),
    widgets: ctx.layout.store.getState().widgets,
    mode: modeKey(),
    page: relatedResourcePageKey(ctx),
  });
  let previous = snapshot();
  let updating = 0;
  const run = <T>(action: () => T) => {
    updating++;
    try {
      return batchWorkbenchChanges(action);
    } finally {
      previous = snapshot();
      updating--;
    }
  };
  const unsubscribe = ctx.layout.store.subscribe(() => {
    const before = previous;
    previous = snapshot();
    if (updating || before.scope !== previous.scope || before.mode !== previous.mode || before.page !== previous.page)
      return;
    const owners = ownersByMode.get(previous.mode);
    if (!owners) return;
    for (const region of owners.keys()) {
      const old = before.layout.regions[region];
      const next = previous.layout.regions[region];
      const added = next.widgets.some((tab) => !old.widgets.some((prior) => prior.widgetId === tab.widgetId));
      const nextOrder = survivingOrder(next, old);
      const reordered = survivingOrder(old, next).some((id, index) => nextOrder[index] !== id);
      const edited = old.widgets.some((tab) => {
        const current = next.widgets.find((item) => item.widgetId === tab.widgetId);
        if (current)
          return (
            current.tabRetention !== tab.tabRetention ||
            current.relatedSource !== tab.relatedSource ||
            resourceKey(current.resource) !== resourceKey(tab.resource)
          );
        return (
          ctx.layout.getWidget(tab.contributionId) === before.widgets[tab.contributionId] &&
          (!tab.viewId || Boolean(ctx.views.getView(tab.viewId)))
        );
      });
      if (old.visible !== next.visible || added || edited || reordered) owners.delete(region);
    }
  });
  return {
    run,
    claim(region: WorkbenchRegion, sourceKey: string) {
      if (region !== "side" && region !== "secondary") return;
      const owners = ownersByMode.get(modeKey()) ?? new Map<"side" | "secondary", string>();
      owners.set(region, sourceKey);
      ownersByMode.set(modeKey(), owners);
    },
    leave(sourceKey: string) {
      const owners = ownersByMode.get(modeKey());
      if (!owners) return;
      for (const [region, owner] of owners) {
        if (owner !== sourceKey) continue;
        owners.delete(region);
        ctx.shell.setRegionOpen(region, false);
      }
    },
    dispose: unsubscribe,
  };
};
