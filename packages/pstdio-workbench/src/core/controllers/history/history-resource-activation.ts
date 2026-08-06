import type { LayoutModel } from "../../registries/layout/layout-model";
import { getActiveLocationPlacement } from "../../registries/layout/layout-operations";
import type { WorkbenchWidgetPlacement } from "../../registries/layout/layout-types";
import type { ResourceRegistry } from "../../registries/resources/resource-registry";
import type { WorkbenchNavigationEntry } from "./history-types";

interface ActivateHistoryResourceInput {
  entry: WorkbenchNavigationEntry;
  resource: NonNullable<WorkbenchNavigationEntry["resource"]>;
  placement?: WorkbenchWidgetPlacement;
  layout: LayoutModel;
  resources: ResourceRegistry;
  replayCurrentLocation?: boolean;
  replayResource(entry: WorkbenchNavigationEntry, replaceActive: boolean): Promise<unknown>;
  restoreSelections(entry: WorkbenchNavigationEntry): void;
}

export const activateHistoryResource = (input: ActivateHistoryResourceInput) => {
  const { entry, layout, placement, replayCurrentLocation, replayResource, resource, resources, restoreSelections } =
    input;
  const presenter = Object.values(resources.store.getState().presenters).find((candidate) =>
    candidate.canOpen(resource),
  );
  const activeLocationUri = getActiveLocationPlacement(layout.getLayout())?.resourceUri;
  if (presenter && (replayCurrentLocation || activeLocationUri !== resource.uri)) {
    return replayResource(entry, placement === undefined);
  }

  if (placement?.resourceUri === resource.uri) layout.activateWidget(placement.widgetId);
  else if (entry.contributionId && layout.getWidget(entry.contributionId)?.role === "location") {
    layout.openWidget(entry.contributionId, {
      resource,
      title: entry.title,
      replaceActive: Boolean(placement),
    });
  } else if (placement) layout.activateWidget(placement.widgetId);
  else if (entry.contributionId && layout.getWidget(entry.contributionId)) {
    layout.openWidget(entry.contributionId, { title: entry.title });
  }
  restoreSelections(entry);
  return undefined;
};
