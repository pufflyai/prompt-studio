import type { WorkbenchLayout } from "@pstdio/workbench";
import type { DashboardExtensionMetadata } from "@/shared/extensions/workbench-extension-contributions";
import { extensionViewWidgetId, extensionViewWidgetIdFor } from "./extension-view-placement";

interface ExtensionLayoutPanelCompatibility {
  aliases: string[];
  contributionId: string;
  extensionId: string;
  logicalId: string;
}

interface ExtensionLayoutOwnerCompatibility {
  extensionId: string;
  name: string;
}

type WorkbenchWidgetPlacement = WorkbenchLayout["regions"]["main"]["widgets"][number];

export interface ExtensionLayoutCompatibility {
  owners: ExtensionLayoutOwnerCompatibility[];
  panels: ExtensionLayoutPanelCompatibility[];
  revision: string;
}

const panelBodyKind = (panel: DashboardExtensionMetadata["panels"][number]) => {
  if (panel.webview) return "webview";
  if (panel.dataTableRendererId) return "data-table";
  if (panel.treeRendererId) return "tree";
  if (panel.fileRendererId) return "file";
  if (panel.controlsRendererId) return "controls";
  return "unknown";
};

export const createExtensionLayoutCompatibility = (metadata: DashboardExtensionMetadata) => {
  const owners = metadata.extensions
    .map((extension) => ({ extensionId: extension.id, name: extension.name }))
    .sort((left, right) => left.extensionId.localeCompare(right.extensionId));
  const panelRecords = metadata.panels
    .map((panel) => ({
      aliases: [panel.id, extensionViewWidgetId(panel.id)],
      body: panelBodyKind(panel),
      contributionId: extensionViewWidgetIdFor(panel),
      extensionId: panel.extensionId,
      logicalId: panel.id,
      region: panel.region,
    }))
    .sort((left, right) => left.logicalId.localeCompare(right.logicalId));
  const panels = panelRecords.map(({ body: _body, region: _region, ...panel }) => panel);
  return {
    owners,
    panels,
    revision: JSON.stringify({ owners, panels: panelRecords }),
  } satisfies ExtensionLayoutCompatibility;
};

const ownedByExtension = (placement: WorkbenchWidgetPlacement, compatibility: ExtensionLayoutCompatibility) => {
  if (
    placement.source === "extension" &&
    compatibility.owners.some((owner) => owner.extensionId === placement.ownerId)
  ) {
    return true;
  }
  return compatibility.owners.some(
    (owner) =>
      placement.contributionId.startsWith(`${owner.name}.`) ||
      placement.contributionId.startsWith(`${extensionViewWidgetId(owner.name)}.`),
  );
};

const migratedWidgetId = (placement: WorkbenchWidgetPlacement, contributionId: string) => {
  if (placement.widgetId === placement.contributionId) return contributionId;
  if (placement.widgetId.startsWith(`${placement.contributionId}:`)) {
    return `${contributionId}${placement.widgetId.slice(placement.contributionId.length)}`;
  }
  return placement.widgetId;
};

const placementIdentity = (placement: WorkbenchWidgetPlacement) =>
  [placement.contributionId, placement.resourceUri ?? "", placement.ownerResourceUri ?? ""].join("\0");

const reconcilePlacement = (input: {
  currentByLogicalId: Map<string, ExtensionLayoutPanelCompatibility>;
  panelByAlias: Map<string, ExtensionLayoutPanelCompatibility>;
  placement: WorkbenchWidgetPlacement;
  previous: ExtensionLayoutCompatibility;
}) => {
  const knownPanel = input.panelByAlias.get(input.placement.contributionId);
  const currentPanel = knownPanel ? input.currentByLogicalId.get(knownPanel.logicalId) : undefined;
  if (!currentPanel) {
    return knownPanel || ownedByExtension(input.placement, input.previous) ? undefined : input.placement;
  }
  return {
    ...input.placement,
    contributionId: currentPanel.contributionId,
    widgetId: migratedWidgetId(input.placement, currentPanel.contributionId),
  };
};

export const reconcileExtensionLayout = (input: {
  current: ExtensionLayoutCompatibility;
  layout: WorkbenchLayout;
  previous?: ExtensionLayoutCompatibility;
}) => {
  const { current, layout } = input;
  const previous = input.previous ?? current;
  const currentByLogicalId = new Map(current.panels.map((panel) => [panel.logicalId, panel]));
  const panelByAlias = new Map<string, ExtensionLayoutPanelCompatibility>();
  for (const panel of [...previous.panels, ...current.panels]) {
    for (const alias of panel.aliases) panelByAlias.set(alias, panel);
  }

  const widgetIdMap = new Map<string, string>();
  const retainedWidgetIds = new Set<string>();
  const identities = new Map<string, string>();
  const regions = Object.fromEntries(
    Object.entries(layout.regions).map(([regionId, region]) => {
      const widgets: WorkbenchWidgetPlacement[] = [];
      for (const placement of region.widgets) {
        const next = reconcilePlacement({ currentByLogicalId, panelByAlias, placement, previous });
        if (!next) continue;
        const extensionPanel = panelByAlias.has(placement.contributionId) || panelByAlias.has(next.contributionId);
        if (extensionPanel) {
          const identity = placementIdentity(next);
          const retainedWidgetId = identities.get(identity);
          if (retainedWidgetId) {
            widgetIdMap.set(placement.widgetId, retainedWidgetId);
            continue;
          }
          identities.set(identity, next.widgetId);
        }
        widgetIdMap.set(placement.widgetId, next.widgetId);
        retainedWidgetIds.add(next.widgetId);
        widgets.push(next);
      }

      const mappedActiveWidgetId = region.activeWidgetId ? widgetIdMap.get(region.activeWidgetId) : undefined;
      return [
        regionId,
        {
          ...region,
          widgets,
          activeWidgetId:
            mappedActiveWidgetId && retainedWidgetIds.has(mappedActiveWidgetId)
              ? mappedActiveWidgetId
              : widgets[0]?.widgetId,
        },
      ];
    }),
  ) as WorkbenchLayout["regions"];

  const mappedActiveWidgetId = layout.activeWidgetId ? widgetIdMap.get(layout.activeWidgetId) : undefined;
  const mappedActiveLocationWidgetId = layout.activeLocationWidgetId
    ? widgetIdMap.get(layout.activeLocationWidgetId)
    : undefined;
  const activeWidgetId =
    mappedActiveWidgetId && retainedWidgetIds.has(mappedActiveWidgetId)
      ? mappedActiveWidgetId
      : Object.values(regions).flatMap((region) => region.widgets)[0]?.widgetId;
  const activeLocationWidgetId =
    mappedActiveLocationWidgetId && retainedWidgetIds.has(mappedActiveLocationWidgetId)
      ? mappedActiveLocationWidgetId
      : undefined;
  const locationSubPanelSelections = Object.fromEntries(
    Object.entries(layout.locationSubPanelSelections ?? {}).map(([resourceUri, selections]) => [
      resourceUri,
      Object.fromEntries(
        Object.entries(selections).flatMap(([region, widgetId]) => {
          if (!widgetId) return [];
          const mappedWidgetId = widgetIdMap.get(widgetId);
          return mappedWidgetId && retainedWidgetIds.has(mappedWidgetId) ? [[region, mappedWidgetId]] : [];
        }),
      ),
    ]),
  );

  return {
    ...layout,
    regions,
    activeWidgetId,
    activeLocationWidgetId,
    activeResourceUri:
      mappedActiveWidgetId && retainedWidgetIds.has(mappedActiveWidgetId) ? layout.activeResourceUri : undefined,
    locationSubPanelSelections,
  };
};

export const resetExtensionLayout = (
  layout: WorkbenchLayout,
  compatibility: ExtensionLayoutCompatibility,
  extensionId: string,
) =>
  reconcileExtensionLayout({
    current: {
      ...compatibility,
      panels: compatibility.panels.filter((panel) => panel.extensionId !== extensionId),
    },
    layout,
    previous: compatibility,
  });
