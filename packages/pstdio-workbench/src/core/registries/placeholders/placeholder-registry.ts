import type { ContributionMetadata } from "../../shared/contributions/metadata";
import type { Disposable } from "../../shared/disposable";
import type { LayoutModel } from "../layout/layout-model";
import type { WorkbenchRegion, WorkbenchRegionSize } from "../layout/layout-types";
import type { WorkbenchViewRegistry } from "../views/view-registry";

export interface WorkbenchPlaceholderContribution {
  id: string;
  viewId: string;
  title?: string;
  region: WorkbenchRegion;
  regionSize?: WorkbenchRegionSize;
  regionCollapsible?: boolean;
  config?: unknown;
}

export interface WorkbenchPlaceholderRegistry {
  registerPlaceholder(placeholder: WorkbenchPlaceholderContribution, metadata?: ContributionMetadata): Disposable;
}

export const createWorkbenchPlaceholderRegistry = (input: {
  layout: Pick<LayoutModel, "registerPlaceholder">;
  views: WorkbenchViewRegistry;
}): WorkbenchPlaceholderRegistry => ({
  registerPlaceholder(placeholder, metadata) {
    const view = input.views.getView(placeholder.viewId);
    if (!view) throw new Error(`Workbench placeholder view is not registered: ${placeholder.viewId}`);
    return input.layout.registerPlaceholder(
      {
        ...placeholder,
        title: placeholder.title ?? view.title,
        rendererId: view.id,
      },
      metadata,
    );
  },
});
