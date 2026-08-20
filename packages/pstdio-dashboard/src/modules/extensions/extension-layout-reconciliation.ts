import type { WorkbenchLayout, WorkbenchRegion, WorkbenchWidgetPlacement } from "@pstdio/workbench";
import type { DashboardExtensionMetadata } from "@/shared/extensions/workbench-extension-contributions";
import { modeIdsByPanelId } from "./extension-composition";
import { extensionViewWidgetId, extensionViewWidgetIdFor } from "./extension-view-placement";

interface ExtensionLayoutCompatibilityRecord {
  bodyKind: "native" | "webview";
  extensionId: string;
  modeIds: string[];
  panelId: string;
  region: WorkbenchRegion;
  widgetId: string;
}

interface ReconcileExtensionLayoutInput {
  layout: WorkbenchLayout;
  metadata: DashboardExtensionMetadata;
  previousCompatibility?: string;
  resetExtensionId?: string;
}

interface PlacementCandidate {
  migrated: boolean;
  originalWidgetId: string;
  placement: WorkbenchWidgetPlacement;
  sourceRegion: WorkbenchRegion;
  targetRegion: WorkbenchRegion;
}

type LayoutRegionEntry = [WorkbenchRegion, WorkbenchLayout["regions"][WorkbenchRegion]];

const compareRecord = (left: ExtensionLayoutCompatibilityRecord, right: ExtensionLayoutCompatibilityRecord) =>
  left.extensionId.localeCompare(right.extensionId) || left.panelId.localeCompare(right.panelId);

export const createExtensionLayoutCompatibility = (metadata: DashboardExtensionMetadata) => {
  const panelModeIds = modeIdsByPanelId(metadata);
  const records = metadata.panels
    .map(
      (panel): ExtensionLayoutCompatibilityRecord => ({
        bodyKind: panel.webview ? "webview" : "native",
        extensionId: panel.extensionId,
        modeIds: [...(panelModeIds.get(panel.id) ?? [])].sort(),
        panelId: panel.id,
        // A panel's own capability, not a mode recipe: the fingerprint must change
        // when the regions a panel can dock into change.
        region: (panel.supportedRegions[0] ?? "main") as WorkbenchRegion,
        widgetId: extensionViewWidgetIdFor(panel),
      }),
    )
    .sort(compareRecord);
  return JSON.stringify(records);
};

const parseCompatibility = (value: string | undefined) => {
  if (!value) return [] as ExtensionLayoutCompatibilityRecord[];
  try {
    const parsed = JSON.parse(value) as ExtensionLayoutCompatibilityRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [] as ExtensionLayoutCompatibilityRecord[];
  }
};

const recordKey = (record: Pick<ExtensionLayoutCompatibilityRecord, "extensionId" | "panelId">) =>
  `${record.extensionId}:${record.panelId}`;

const extensionIds = (metadata: DashboardExtensionMetadata) =>
  new Set(metadata.extensions.map((extension) => extension.id));

const placementExtensionId = (
  placement: WorkbenchWidgetPlacement,
  knownExtensionIds: Set<string>,
  extensionIdByPlacementId: Map<string, string>,
) => {
  const resourceExtensionId = placement.resource?.metadata?.extensionId;
  if (typeof resourceExtensionId === "string") return resourceExtensionId;
  const recordedExtensionId =
    extensionIdByPlacementId.get(placement.widgetId) ?? extensionIdByPlacementId.get(placement.contributionId);
  if (recordedExtensionId) return recordedExtensionId;
  for (const extensionId of knownExtensionIds) {
    if (placement.contributionId.startsWith(extensionId) || placement.widgetId.startsWith(extensionId))
      return extensionId;
  }
  return undefined;
};

const createMigration = (input: {
  current: ExtensionLayoutCompatibilityRecord[];
  previous: ExtensionLayoutCompatibilityRecord[];
}) => {
  const currentByKey = new Map(input.current.map((record) => [recordKey(record), record]));
  const migration = new Map<string, string>();

  for (const previous of input.previous) {
    const current = currentByKey.get(recordKey(previous));
    if (current && current.widgetId !== previous.widgetId) migration.set(previous.widgetId, current.widgetId);
  }
  for (const current of input.current) {
    if (current.bodyKind === "native") migration.set(extensionViewWidgetId(current.panelId), current.widgetId);
  }

  return migration;
};

const layoutRegionEntries = (layout: WorkbenchLayout) => Object.entries(layout.regions) as LayoutRegionEntry[];

const createExtensionIdByPlacementId = (records: ExtensionLayoutCompatibilityRecord[]) => {
  const extensionIdByPlacementId = new Map<string, string>();
  for (const record of records) {
    extensionIdByPlacementId.set(record.widgetId, record.extensionId);
    extensionIdByPlacementId.set(extensionViewWidgetId(record.panelId), record.extensionId);
  }
  return extensionIdByPlacementId;
};

const createPlacementCandidates = (input: {
  current: ExtensionLayoutCompatibilityRecord[];
  extensionIdByPlacementId: Map<string, string>;
  knownExtensionIds: Set<string>;
  layout: WorkbenchLayout;
  migration: Map<string, string>;
  resetExtensionId: string | undefined;
}) => {
  const currentWidgetIds = new Set(input.current.map((record) => record.widgetId));
  const currentRecordByWidgetId = new Map(input.current.map((record) => [record.widgetId, record]));
  const candidates: PlacementCandidate[] = [];

  for (const [sourceRegion, region] of layoutRegionEntries(input.layout)) {
    for (const placement of region.widgets) {
      const extensionId = placementExtensionId(placement, input.knownExtensionIds, input.extensionIdByPlacementId);
      const replacementWidgetId = input.migration.get(placement.widgetId);
      const widgetId = replacementWidgetId ?? placement.widgetId;
      const reset = input.resetExtensionId && extensionId === input.resetExtensionId;
      // These records describe extension panels, so only a placement that is one may be
      // judged obsolete by them. A dashboard-owned panel that merely presents an
      // extension resource — a route panel, for instance — keeps its placement as long
      // as the extension is installed; comparing it against panel ids it never had would
      // drop the open view on every metadata refresh.
      const panelPlacement =
        input.extensionIdByPlacementId.has(placement.widgetId) ||
        input.extensionIdByPlacementId.has(placement.contributionId);
      const obsolete = panelPlacement
        ? !currentWidgetIds.has(widgetId)
        : Boolean(extensionId) && !input.knownExtensionIds.has(extensionId!);
      if (reset || obsolete) continue;

      candidates.push({
        migrated: Boolean(replacementWidgetId),
        originalWidgetId: placement.widgetId,
        placement: widgetId === placement.widgetId ? placement : { ...placement, widgetId, contributionId: widgetId },
        sourceRegion,
        targetRegion: currentRecordByWidgetId.get(widgetId)?.region ?? sourceRegion,
      });
    }
  }
  return candidates;
};

const selectPlacementCandidates = (candidates: PlacementCandidate[]) => {
  const candidateByWidgetId = new Map<string, PlacementCandidate>();
  for (const candidate of candidates) {
    const currentCandidate = candidateByWidgetId.get(candidate.placement.widgetId);
    if (!currentCandidate || (candidate.migrated && !currentCandidate.migrated))
      candidateByWidgetId.set(candidate.placement.widgetId, candidate);
  }
  const retainedCandidates = new Set(candidateByWidgetId.values());
  const candidateByOriginalWidgetId = new Map(
    candidates.map((candidate) => [candidate.originalWidgetId, candidateByWidgetId.get(candidate.placement.widgetId)!]),
  );
  return { candidateByOriginalWidgetId, retainedCandidates };
};

const createReconciledRegions = (input: {
  candidates: PlacementCandidate[];
  layout: WorkbenchLayout;
  retainedCandidates: Set<PlacementCandidate>;
}) => {
  const regions = Object.fromEntries(
    layoutRegionEntries(input.layout).map(([regionId, region]) => [
      regionId,
      {
        ...region,
        widgets: input.candidates
          .filter(
            (candidate) =>
              input.retainedCandidates.has(candidate) &&
              candidate.sourceRegion === regionId &&
              candidate.targetRegion === regionId,
          )
          .map((candidate) => candidate.placement),
        activeWidgetId: undefined,
      },
    ]),
  ) as WorkbenchLayout["regions"];

  for (const candidate of input.candidates) {
    if (!input.retainedCandidates.has(candidate) || candidate.sourceRegion === candidate.targetRegion) continue;
    regions[candidate.targetRegion].widgets.push(candidate.placement);
  }
  return regions;
};

const restoreActiveRegionWidgets = (input: {
  globalActiveCandidate: PlacementCandidate | undefined;
  layout: WorkbenchLayout;
  regions: WorkbenchLayout["regions"];
  resolveCandidate: (widgetId: string | undefined) => PlacementCandidate | undefined;
  retainedCandidates: Set<PlacementCandidate>;
}) => {
  for (const [regionId, region] of layoutRegionEntries(input.layout)) {
    const activeCandidate = input.resolveCandidate(region.activeWidgetId);
    if (activeCandidate && input.retainedCandidates.has(activeCandidate)) {
      const target = input.regions[activeCandidate.targetRegion];
      if (!target.activeWidgetId) target.activeWidgetId = activeCandidate.placement.widgetId;
    }
    const nextRegion = input.regions[regionId];
    if (!nextRegion.activeWidgetId) nextRegion.activeWidgetId = nextRegion.widgets[0]?.widgetId;
  }
  const globalActiveCandidate = input.globalActiveCandidate;
  if (globalActiveCandidate && input.retainedCandidates.has(globalActiveCandidate))
    input.regions[globalActiveCandidate.targetRegion].activeWidgetId = globalActiveCandidate.placement.widgetId;
};

const reconcileLocationSubPanelSelections = (input: {
  layout: WorkbenchLayout;
  resolveCandidate: (widgetId: string | undefined) => PlacementCandidate | undefined;
  retainedCandidates: Set<PlacementCandidate>;
}) =>
  Object.fromEntries(
    Object.entries(input.layout.locationSubPanelSelections ?? {}).map(([resourceUri, selections]) => [
      resourceUri,
      Object.fromEntries(
        Object.values(selections)
          .map((widgetId) => input.resolveCandidate(widgetId))
          .filter((candidate): candidate is PlacementCandidate =>
            Boolean(candidate && input.retainedCandidates.has(candidate)),
          )
          .map((candidate) => [candidate.targetRegion, candidate.placement.widgetId]),
      ),
    ]),
  );

export const reconcileExtensionLayout = (input: ReconcileExtensionLayoutInput) => {
  const current = parseCompatibility(createExtensionLayoutCompatibility(input.metadata));
  const previous = parseCompatibility(input.previousCompatibility);
  const migration = createMigration({ current, previous });
  const knownExtensionIds = extensionIds(input.metadata);
  const extensionIdByPlacementId = createExtensionIdByPlacementId([...previous, ...current]);
  const candidates = createPlacementCandidates({
    current,
    extensionIdByPlacementId,
    knownExtensionIds,
    layout: input.layout,
    migration,
    resetExtensionId: input.resetExtensionId,
  });
  const { candidateByOriginalWidgetId, retainedCandidates } = selectPlacementCandidates(candidates);
  const regions = createReconciledRegions({ candidates, layout: input.layout, retainedCandidates });

  const resolveCandidate = (widgetId: string | undefined) =>
    widgetId ? candidateByOriginalWidgetId.get(widgetId) : undefined;
  const globalActiveCandidate = resolveCandidate(input.layout.activeWidgetId);
  restoreActiveRegionWidgets({
    globalActiveCandidate,
    layout: input.layout,
    regions,
    resolveCandidate,
    retainedCandidates,
  });

  const replaceWidgetId = (widgetId: string | undefined) => {
    const candidate = resolveCandidate(widgetId);
    return candidate && retainedCandidates.has(candidate) ? candidate.placement.widgetId : undefined;
  };
  const activeWidgetId = replaceWidgetId(input.layout.activeWidgetId);
  const activeLocationWidgetId = replaceWidgetId(input.layout.activeLocationWidgetId);
  const locationSubPanelSelections = reconcileLocationSubPanelSelections({
    layout: input.layout,
    resolveCandidate,
    retainedCandidates,
  });

  return {
    ...input.layout,
    regions,
    activeWidgetId,
    activeLocationWidgetId,
    activeResourceUri: activeWidgetId ? input.layout.activeResourceUri : undefined,
    locationSubPanelSelections,
  } satisfies WorkbenchLayout;
};
