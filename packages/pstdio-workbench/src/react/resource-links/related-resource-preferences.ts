import { type RelatedResourceOpening, type ResourceRef, resourceKey } from "@pstdio/sdk/extensions";
import type { WorkbenchModuleContext, WorkbenchRegionState } from "../../core";
import { relatedResourcePageKey } from "./related-resource-page-key";

const regions = ["side", "secondary"] as const;
interface PanelChoice {
  visible: boolean;
  resource?: ResourceRef;
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
export const createRelatedResourcePreferences = (
  ctx: WorkbenchModuleContext,
  canonicalize: (source: ResourceRef) => ResourceRef | undefined,
) => {
  // Only the current owner's automatic destinations have page-specific choices.
  // Other trays keep the project's live layout, including closures made elsewhere.
  let relatedRegions: Set<string> | undefined;
  let pendingChoices: PageChoices = {};
  const writes = new Map<string, { value: PageChoices; promise: Promise<void> }>();
  const currentResource = () => {
    const source = ctx.pages.store.getState().location?.resource;
    return source && canonicalize(source);
  };
  const pageKey = () => relatedResourcePageKey(ctx, currentResource());
  const scope = () => ({ scope: "user" as const, scopeId: pageKey() });
  const read = () =>
    writes.get(scope().scopeId)?.value ??
    (ctx.preferences.getOwnedValue("workbench.related-resources", "panels", scope()) as PageChoices | undefined) ??
    {};
  const write = (value: PageChoices) => {
    const destination = scope();
    const queued = writes.get(destination.scopeId);
    const save = () => {
      try {
        return ctx.preferences.setOwnedValue("workbench.related-resources", "panels", value, destination);
      } catch (error) {
        console.warn("Could not save resource page choices", error);
      }
    };
    const result = queued ? queued.promise.then(save, save) : save();
    if (!(result instanceof Promise)) return;
    const pending = { value, promise: result };
    writes.set(destination.scopeId, pending);
    void result
      .finally(() => {
        if (writes.get(destination.scopeId) === pending) writes.delete(destination.scopeId);
      })
      .catch((error) => console.warn("Could not save resource page choices", error));
  };
  const removedOwner = (
    before: WorkbenchRegionState,
    after: WorkbenchRegionState,
    widgets: ReturnType<typeof ctx.layout.store.getState>["widgets"],
  ) =>
    before.widgets.some(
      (panel) =>
        !after.widgets.some((next) => next.widgetId === panel.widgetId) &&
        (!ctx.layout.getWidget(panel.contributionId) ||
          widgets[panel.contributionId] !== ctx.layout.getWidget(panel.contributionId) ||
          (panel.viewId && !ctx.views.getView(panel.viewId))),
    );
  const forSource = (source: ResourceRef) => {
    const choices: PageChoices =
      resourceKey(canonicalize(source)) === resourceKey(currentResource())
        ? Object.fromEntries(Object.entries(read()).filter(([region]) => relatedRegions?.has(region)))
        : {};
    return choices;
  };
  const isResourcePage = () => {
    const source = currentResource();
    const owner = source && ctx.resources.getKind(source.type, source.extensionId);
    return source && owner?.extensionId === source.extensionId && Boolean(owner?.relatedOpenings);
  };
  const snapshot = () => ({
    key: pageKey(),
    scope: ctx.layout.getPersistenceScope(),
    layout: ctx.layout.getLayout(),
    widgets: ctx.layout.store.getState().widgets,
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
    const changedRegions = regions.filter((id) => {
      const old = before.layout.regions[id];
      const region = previous.layout.regions[id];
      return !removedOwner(old, region, before.widgets) && choiceChanged(old, region);
    });
    if (!changedRegions.length) return;
    const choices = { ...forSource(currentResource()!), ...pendingChoices };
    const relatedChanges = changedRegions.filter((id) => !relatedRegions || relatedRegions.has(id));
    for (const id of relatedChanges) {
      const region = previous.layout.regions[id];
      const panel = selected(region);
      choices[id] = {
        visible: region.visible,
        resource: panel?.resource ?? selected(before.layout.regions[id])?.resource,
      };
    }
    if (!relatedRegions) pendingChoices = choices;
    else if (relatedChanges.length) void write(choices);
  });
  const reset = ctx.onDidResetLayout(() => {
    void write({});
    previous = snapshot();
  });
  const removing = ctx.resources.onWillRemove((resource) => {
    updating++;
    const forget = (choices: PageChoices) =>
      Object.fromEntries(
        Object.entries(choices).map(([region, choice]) => [
          region,
          resourceKey(choice.resource) === resourceKey(resource) ? { visible: choice.visible } : choice,
        ]),
      ) as PageChoices;
    const choices = read();
    if (Object.values(choices).some((choice) => resourceKey(choice.resource) === resourceKey(resource)))
      void write(forget(choices));
    pendingChoices = forget(pendingChoices);
    return [];
  });
  const removed = ctx.resources.onDidRemove(() => {
    previous = snapshot();
    updating--;
  });
  return {
    run,
    enter(source: ResourceRef) {
      if (resourceKey(canonicalize(source)) !== resourceKey(currentResource())) return;
      if (observing !== pageKey()) {
        relatedRegions = undefined;
        pendingChoices = {};
      }
      observing = pageKey();
      previous = snapshot();
    },
    openings(source: ResourceRef, defaults: RelatedResourceOpening[]) {
      if (resourceKey(canonicalize(source)) === resourceKey(currentResource())) {
        relatedRegions = new Set(defaults.map((entry) => entry.region));
        const edits = Object.fromEntries(
          Object.entries(pendingChoices).filter(([region]) => relatedRegions?.has(region)),
        );
        pendingChoices = {};
        if (Object.keys(edits).length) void write({ ...forSource(source), ...edits });
      }
      const choices = forSource(source);
      return defaults.map((entry) => {
        const choice = entry.region === "side" || entry.region === "secondary" ? choices[entry.region] : undefined;
        return choice?.resource ? { ...entry, resource: choice.resource } : entry;
      });
    },
    shouldReveal(source: ResourceRef, entry: RelatedResourceOpening) {
      const choices = forSource(source);
      const actual = Object.values(ctx.layout.getLayout().regions).find((region) =>
        region.widgets.some((panel) => resourceKey(panel.resource) === resourceKey(entry.resource)),
      );
      const region = actual?.id ?? entry.region;
      return (region !== "side" && region !== "secondary") || choices[region]?.visible !== false;
    },
    dispose() {
      unsubscribe();
      reset.dispose();
      removing.dispose();
      removed.dispose();
    },
  };
};
