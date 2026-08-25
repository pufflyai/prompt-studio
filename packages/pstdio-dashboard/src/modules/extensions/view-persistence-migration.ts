import type {
  HistoryStoreState,
  ResourceRef,
  WorkbenchNavigationEntry,
  WorkbenchSubPanelRef,
  WorkbenchViewRegistry,
} from "@pstdio/workbench";

const legacyViewPrefix = "dashboard-workbench.extension-view.";

const viewIdFromPlacementId = (value: string | undefined, views: WorkbenchViewRegistry) => {
  if (!value) return undefined;
  return views.resolveViewId(value) ?? views.resolveViewId(value.replace(legacyViewPrefix, ""));
};

const viewIdFromResource = (resource: ResourceRef | undefined, views: WorkbenchViewRegistry) => {
  if (
    !resource ||
    (resource.kind !== "extension-view" && resource.kind !== "extension-route" && resource.kind !== "dashboard-view")
  )
    return undefined;
  const routePath = resource.metadata?.routePath;
  if (typeof routePath === "string") return views.resolvePath(routePath)?.viewId;
  const route = resource.metadata?.route;
  if (route && typeof route === "object" && typeof (route as { id?: unknown }).id === "string") {
    return views.resolveViewId((route as { id: string }).id);
  }
  return resource.id ? views.resolveViewId(resource.id) : undefined;
};

const migrateSubPanel = (reference: WorkbenchSubPanelRef, views: WorkbenchViewRegistry) => {
  const viewId = viewIdFromPlacementId(reference.contributionId, views);
  if (!viewId) return reference;
  const panelId = views.getView(viewId)?.panelId ?? viewId;
  return { ...reference, contributionId: panelId, instanceKey: panelId };
};

const migrateEntry = (entry: WorkbenchNavigationEntry, views: WorkbenchViewRegistry) => {
  const resource = entry.resource ?? entry.location.resource;
  const legacyResourceViewId = viewIdFromResource(resource, views);
  if (resource && !entry.viewId && !legacyResourceViewId) return entry;

  const viewId =
    (entry.viewId ? (views.resolveViewId(entry.viewId) ?? entry.viewId) : undefined) ??
    legacyResourceViewId ??
    viewIdFromPlacementId(entry.contributionId ?? entry.location.contributionId, views);
  if (!viewId) return entry;

  const panelId = views.getView(viewId)?.panelId ?? viewId;
  const boundResource = entry.viewId && !legacyResourceViewId ? resource : undefined;
  const selectedSubPanels = Object.fromEntries(
    Object.entries(entry.selectedSubPanels).map(([region, reference]) => [
      region,
      reference ? migrateSubPanel(reference, views) : reference,
    ]),
  );
  const closedSubPanel = entry.closedSubPanel
    ? { ...entry.closedSubPanel, reference: migrateSubPanel(entry.closedSubPanel.reference, views) }
    : undefined;

  return {
    ...entry,
    kind: "view" as const,
    viewId,
    resource: boundResource,
    widgetId: panelId,
    contributionId: panelId,
    selectedSubPanels,
    closedSubPanel,
    location: {
      ...entry.location,
      key: `${entry.modeId ?? "global"}:view:${viewId}${boundResource ? `:resource:${boundResource.uri}` : ""}`,
      viewId,
      resource: boundResource,
      contributionId: panelId,
      instanceKey: panelId,
    },
  };
};

export const migrateLegacyViewHistory = (
  state: HistoryStoreState,
  views: WorkbenchViewRegistry,
): HistoryStoreState => ({
  ...state,
  entries: state.entries.map((entry) => migrateEntry(entry, views)),
  recentlyClosed: state.recentlyClosed.map((entry) => migrateEntry(entry, views)),
});
