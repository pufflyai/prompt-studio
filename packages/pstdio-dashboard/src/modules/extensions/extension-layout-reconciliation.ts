import type { WorkbenchLayout, WorkbenchRegion, WorkbenchWidgetPlacement } from "@pstdio/workbench";
import type { DashboardExtensionMetadata } from "@/shared/extensions/workbench-extension-contributions";
import { extensionModeLayoutRegion, extensionViewWidgetId, extensionViewWidgetIdFor } from "./extension-view-placement";

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

const compareRecord = (left: ExtensionLayoutCompatibilityRecord, right: ExtensionLayoutCompatibilityRecord) =>
  left.extensionId.localeCompare(right.extensionId) || left.panelId.localeCompare(right.panelId);

const modeIdsByPanelId = (metadata: DashboardExtensionMetadata) => {
  const modeIds = new Map<string, string[]>();
  for (const mode of metadata.modes) {
    for (const entry of mode.layout?.open ?? []) {
      if (!entry.panel) continue;
      const current = modeIds.get(entry.panel) ?? [];
      current.push(mode.modeId);
      modeIds.set(entry.panel, current);
    }
  }
  return modeIds;
};

export const createExtensionLayoutCompatibility = (metadata: DashboardExtensionMetadata) => {
  const panelModeIds = modeIdsByPanelId(metadata);
  const records = metadata.panels
    .map(
      (panel): ExtensionLayoutCompatibilityRecord => ({
        bodyKind: panel.webview ? "webview" : "native",
        extensionId: panel.extensionId,
        modeIds: [...(panelModeIds.get(panel.id) ?? [])].sort(),
        panelId: panel.id,
        region: extensionModeLayoutRegion(panel.region),
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

const placementExtensionId = (placement: WorkbenchWidgetPlacement, knownExtensionIds: Set<string>) => {
  const resourceExtensionId = placement.resource?.metadata?.extensionId;
  if (typeof resourceExtensionId === "string") return resourceExtensionId;
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

export const reconcileExtensionLayout = (input: ReconcileExtensionLayoutInput) => {
  const current = parseCompatibility(createExtensionLayoutCompatibility(input.metadata));
  const previous = parseCompatibility(input.previousCompatibility);
  const currentWidgetIds = new Set(current.map((record) => record.widgetId));
  const migration = createMigration({ current, previous });
  const knownExtensionIds = extensionIds(input.metadata);
  const originalCurrentWidgetIds = new Set<string>();

  for (const region of Object.values(input.layout.regions)) {
    for (const placement of region.widgets) {
      if (currentWidgetIds.has(placement.widgetId)) originalCurrentWidgetIds.add(placement.widgetId);
    }
  }

  const retainedWidgetIds = new Set<string>();
  const widgetIdReplacements = new Map<string, string>();
  const regions = Object.fromEntries(
    Object.entries(input.layout.regions).map(([regionId, region]) => {
      const widgets: WorkbenchWidgetPlacement[] = [];
      for (const placement of region.widgets) {
        const extensionId = placementExtensionId(placement, knownExtensionIds);
        const replacementWidgetId = migration.get(placement.widgetId);
        const widgetId = replacementWidgetId ?? placement.widgetId;
        if (replacementWidgetId) widgetIdReplacements.set(placement.widgetId, replacementWidgetId);
        const isExtensionOwned = Boolean(extensionId);
        const reset = input.resetExtensionId && extensionId === input.resetExtensionId;
        const obsolete = isExtensionOwned && !currentWidgetIds.has(widgetId);
        const duplicateMigration = Boolean(replacementWidgetId && originalCurrentWidgetIds.has(replacementWidgetId));
        const duplicateRetained = retainedWidgetIds.has(widgetId);
        if (reset || obsolete || duplicateMigration || duplicateRetained) continue;

        retainedWidgetIds.add(widgetId);
        widgets.push(
          widgetId === placement.widgetId ? placement : { ...placement, widgetId, contributionId: widgetId },
        );
      }
      return [
        regionId,
        {
          ...region,
          widgets,
          activeWidgetId: region.activeWidgetId
            ? (widgetIdReplacements.get(region.activeWidgetId) ?? region.activeWidgetId)
            : undefined,
        },
      ];
    }),
  ) as WorkbenchLayout["regions"];

  for (const region of Object.values(regions)) {
    if (!region.activeWidgetId || !retainedWidgetIds.has(region.activeWidgetId))
      region.activeWidgetId = region.widgets[0]?.widgetId;
  }

  const replaceWidgetId = (widgetId: string | undefined) => {
    const next = widgetId ? (widgetIdReplacements.get(widgetId) ?? widgetId) : undefined;
    return next && retainedWidgetIds.has(next) ? next : undefined;
  };
  const activeWidgetId = replaceWidgetId(input.layout.activeWidgetId);
  const activeLocationWidgetId = replaceWidgetId(input.layout.activeLocationWidgetId);
  const locationSubPanelSelections = Object.fromEntries(
    Object.entries(input.layout.locationSubPanelSelections ?? {}).map(([resourceUri, selections]) => [
      resourceUri,
      Object.fromEntries(
        Object.entries(selections)
          .map(([region, widgetId]) => [region, replaceWidgetId(widgetId)] as const)
          .filter((entry): entry is [string, string] => Boolean(entry[1])),
      ),
    ]),
  );

  return {
    ...input.layout,
    regions,
    activeWidgetId,
    activeLocationWidgetId,
    activeResourceUri: activeWidgetId ? input.layout.activeResourceUri : undefined,
    locationSubPanelSelections,
  } satisfies WorkbenchLayout;
};
