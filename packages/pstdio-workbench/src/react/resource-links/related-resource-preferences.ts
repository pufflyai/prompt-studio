import { type RelatedResourceOpening, type ResourceRef, resourceKey } from "@pstdio/sdk/extensions";
import type { WorkbenchModuleContext, WorkbenchRegionState } from "../../core";
import { relatedResourcePageKey } from "./related-resource-page-key";

const regions = ["side", "secondary"] as const;
interface PanelChoice {
  visible: boolean;
  resource?: ResourceRef;
  intent?: "preview" | "pin";
}
type PageChoices = Partial<Record<(typeof regions)[number], PanelChoice>>;
const selected = (region: WorkbenchRegionState) =>
  region.widgets.find((panel) => panel.widgetId === region.activeWidgetId) ?? region.widgets[0];
const choiceChanged = (before: WorkbenchRegionState, after: WorkbenchRegionState) =>
  before.visible !== after.visible ||
  resourceKey(selected(before)?.resource) !== resourceKey(selected(after)?.resource) ||
  selected(before)?.tabRetention !== selected(after)?.tabRetention ||
  before.widgets.some((tab) => !after.widgets.some((next) => next.widgetId === tab.widgetId));

// Layout state follows the project. These are only the user's overrides of a
// resource page's related-opening defaults, not another copy of its layout.
export const createRelatedResourcePreferences = (ctx: WorkbenchModuleContext, changed: () => void) => {
  const writes = new Map<string, { value: PageChoices; promise: Promise<void> }>();
  const scope = () => ({ scope: "user" as const, scopeId: relatedResourcePageKey(ctx) });
  const read = () =>
    writes.get(scope().scopeId)?.value ??
    (ctx.preferences.getOwnedValue("workbench.related-resources", "panels", scope()) as PageChoices | undefined) ??
    {};
  const write = (value: PageChoices) => {
    const destination = scope();
    const queued = writes.get(destination.scopeId);
    const save = () => ctx.preferences.setOwnedValue("workbench.related-resources", "panels", value, destination);
    const result = queued ? queued.promise.then(save) : save();
    if (!(result instanceof Promise)) return;
    const pending = { value, promise: result };
    writes.set(destination.scopeId, pending);
    void result
      .finally(() => {
        if (writes.get(destination.scopeId) === pending) writes.delete(destination.scopeId);
      })
      .catch((error) => console.warn("Could not save resource page choices", error));
  };
  const removedOwner = (before: WorkbenchRegionState, after: WorkbenchRegionState) =>
    before.widgets.some(
      (panel) =>
        !after.widgets.some((next) => next.widgetId === panel.widgetId) &&
        (!ctx.layout.getWidget(panel.contributionId) || (panel.viewId && !ctx.views.getView(panel.viewId))),
    );
  const forSource = (source: ResourceRef) =>
    resourceKey(source) === resourceKey(ctx.pages.store.getState().location?.resource) ? read() : {};
  const isResourcePage = () => {
    const source = ctx.pages.store.getState().location?.resource;
    const owner = source && ctx.resources.getKind(source.type);
    return source && owner?.extensionId === source.extensionId && Boolean(owner.relatedOpenings);
  };
  const snapshot = () => ({
    key: relatedResourcePageKey(ctx),
    scope: ctx.layout.getPersistenceScope(),
    layout: ctx.layout.getLayout(),
  });
  let previous = snapshot();
  let observing: string | undefined;
  let updating = 0;
  const run = <T>(action: () => T) => {
    updating++;
    try {
      return action();
    } finally {
      previous = snapshot();
      updating--;
    }
  };
  const unsubscribe = ctx.layout.store.subscribe(() => {
    const before = previous;
    previous = snapshot();
    if (updating) return;
    if (before.key !== previous.key || before.scope !== previous.scope) {
      observing = undefined;
      return;
    }
    if (observing !== previous.key) return;
    if (!isResourcePage()) return;
    const choices = { ...read() };
    let edited = false;
    for (const id of regions) {
      const old = before.layout.regions[id];
      const region = previous.layout.regions[id];
      const panel = selected(region);
      if (removedOwner(old, region) || !choiceChanged(old, region)) continue;
      choices[id] = {
        visible: region.visible,
        resource: panel?.resource,
        intent: panel?.tabRetention === "persistent" ? "pin" : "preview",
      };
      edited = true;
    }
    if (edited) {
      void write(choices);
      changed();
    }
  });
  const reset = ctx.onDidResetLayout(() => {
    void write({});
    previous = snapshot();
  });
  return {
    run,
    enter(source: ResourceRef) {
      if (resourceKey(source) !== resourceKey(ctx.pages.store.getState().location?.resource)) return;
      observing = relatedResourcePageKey(ctx);
      previous = snapshot();
    },
    openings(source: ResourceRef, defaults: RelatedResourceOpening[]) {
      const choices = forSource(source);
      return [
        ...defaults.filter((entry) => !(entry.region in choices)),
        ...regions.flatMap((region) => {
          const choice = choices[region];
          return choice?.visible && choice.resource
            ? [{ resource: choice.resource, region, autoOpen: true, open: choice.intent }]
            : [];
        }),
      ];
    },
    restoreVisibility(source: ResourceRef) {
      const choices = forSource(source);
      for (const region of regions) {
        const choice = choices[region];
        if (choice && (!choice.visible || !choice.resource)) ctx.shell.setRegionOpen(region, choice.visible);
      }
    },
    allows(source: ResourceRef, entry: RelatedResourceOpening) {
      const choices = forSource(source);
      const actual = Object.values(ctx.layout.getLayout().regions).find((region) =>
        region.widgets.some((panel) => resourceKey(panel.resource) === resourceKey(entry.resource)),
      );
      return !regions.some((region) => region === (actual?.id ?? entry.region) && choices[region]?.visible === false);
    },
    select(source: ResourceRef) {
      for (const choice of Object.values(forSource(source))) {
        if (!choice.visible || !choice.resource) continue;
        for (const region of Object.values(ctx.layout.getLayout().regions)) {
          const panel = region.widgets.find((panel) => resourceKey(panel.resource) === resourceKey(choice.resource));
          if (panel) ctx.layout.setRegionActiveWidget(region.id, panel.widgetId);
        }
      }
    },
    dispose() {
      unsubscribe();
      reset.dispose();
    },
  };
};
