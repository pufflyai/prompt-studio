import type { PlacementIdentity } from "@pstdio/sdk/extensions";
import type { WorkbenchLayout, WorkbenchWidgetPlacement } from "../../registries/layout/layout-types";
import { placementIdentityKey, reconcileOwnedPlacements } from "../../registries/layout/placement-reconciliation";
import { editPagePlacementStates } from "../../registries/pages/page-placement-state";
import type { WorkbenchEditorOpen, WorkbenchPageRegistryStoreState } from "../../registries/pages/page-registry-types";
import type { WorkbenchViewRegistry } from "../../registries/views/view-registry";

import { resourceEditorKey } from "../navigation/resource-editor-lookup";

type State = WorkbenchPageRegistryStoreState<WorkbenchWidgetPlacement>;

const retainedEditor = (
  previous: State["placements"][number] | undefined,
  entry: State["placements"][number],
  explicit: boolean,
) => {
  if (!previous) return entry;
  if (!explicit) return previous;
  return {
    ...previous,
    value: {
      ...previous.value,
      resource: entry.value.resource,
      section: entry.value.section,
      title: entry.value.resource?.label ?? previous.value.title,
    },
  };
};
const layoutPlacements = (layout: WorkbenchLayout | undefined) =>
  Object.values(layout?.regions ?? {}).flatMap((region) =>
    region.widgets.map((value, order) => ({ region: region.id, order, value })),
  );

/** Binding cardinality controls a tray; view policy controls editor identity across trays and owners. */
export const reuseResourceEditors = (input: {
  state: State;
  current: State;
  layout: WorkbenchLayout | undefined;
  views: WorkbenchViewRegistry;
  activate?: readonly PlacementIdentity[];
  editorOpens?: readonly WorkbenchEditorOpen[];
}) => {
  const { state, current, layout, views } = input;
  const keyFor = (widget: WorkbenchWidgetPlacement) => {
    const viewId = widget.viewId;
    if (!widget.resource || !viewId || views.getView(viewId)?.instancePolicy !== "per-resource") return undefined;
    return resourceEditorKey(viewId, widget.resource, Object.values(state.pages));
  };
  const existing = new Map<string, State["placements"][number]>();
  for (const entry of layoutPlacements(layout)) {
    const key = keyFor(entry.value);
    if (key && entry.value.placementIdentity) existing.set(key, { ...entry, identity: entry.value.placementIdentity });
  }
  let pageStates = state.pageStates;
  const requested = new Set(input.activate?.map(placementIdentityKey));
  const placements = new Map<string, State["placements"][number]>();
  const replacements = new Map<string, State["placements"][number]>();
  for (const entry of state.placements) {
    const key = keyFor(entry.value);
    const previous = key ? existing.get(key) : undefined;
    const retained = retainedEditor(previous, entry, requested.has(placementIdentityKey(entry.identity)));
    const identity = placementIdentityKey(entry.identity);
    const retainedKey = placementIdentityKey(retained.identity);
    if (identity !== retainedKey && entry.identity.kind === "page")
      pageStates = editPagePlacementStates(pageStates, entry.identity, { kind: "close" });
    replacements.set(identity, retained);
    placements.set(retainedKey, retained);
    if (key) existing.set(key, retained);
  }
  for (const entry of existing.values()) {
    const identity = placementIdentityKey(entry.identity);
    if (requested.has(identity) && !placements.has(identity)) placements.set(identity, entry);
  }
  const activate = (input.activate ?? state.reconciliation.activate.map((entry) => entry.identity)).flatMap(
    (identity) => {
      const key = placementIdentityKey(identity);
      const retained = replacements.get(key) ?? placements.get(key);
      return retained ? [retained.identity] : [];
    },
  );
  const destinations = state.reconciliation.destinations?.filter((entry) => {
    const retained =
      replacements.get(placementIdentityKey(entry.identity)) ?? placements.get(placementIdentityKey(entry.identity));
    return (
      !retained ||
      !keyFor(retained.value) ||
      !Object.values(layout?.regions ?? {}).some((region) =>
        region.widgets.some((widget) => widget.widgetId === retained.value.widgetId),
      )
    );
  });
  const desired = [...placements.values()].map((entry) => {
    const request = input.editorOpens?.find(
      (open) => placementIdentityKey(open.identity) === placementIdentityKey(entry.identity),
    );
    return request
      ? {
          ...entry,
          value: {
            ...entry.value,
            resource: request.resource,
            section: request.section,
            title: request.resource.label ?? entry.value.title,
          },
        }
      : entry;
  });
  return {
    ...state,
    pageStates,
    placements: desired,
    reconciliation: reconcileOwnedPlacements({
      current: current.placements,
      desired,
      activate,
      destinations,
      valuesEqual: (a, b) => JSON.stringify(a) === JSON.stringify(b),
    }),
  };
};

export const createResourceEditorPreparation =
  (
    input: Pick<
      import("./page-runtime").CreateLiveWorkbenchPageRegistryInput,
      "views" | "layout" | "loadModeLayout" | "loadPageLayout"
    >,
  ) =>
  (
    state: State,
    current: State,
    activate?: readonly PlacementIdentity[],
    editorOpens?: readonly WorkbenchEditorOpen[],
  ) => {
    let layout = state.activeModeId ? input.loadModeLayout?.(state.projectId, state.activeModeId) : undefined;
    if (state.projectId === current.projectId && state.activeModeId === current.activeModeId)
      layout = input.layout.getLayout();
    const pageLayout = input.loadPageLayout?.(state);
    if (layout && pageLayout) layout = { ...layout, regions: { ...layout.regions, main: pageLayout.regions.main } };
    return reuseResourceEditors({ state, current, activate, editorOpens, views: input.views, layout });
  };
