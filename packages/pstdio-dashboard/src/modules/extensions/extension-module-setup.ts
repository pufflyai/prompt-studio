import type { WorkbenchModuleContext } from "@pstdio/workbench";
import type { ResolvedWorkbenchExtensionMetadata } from "@/shared/extensions/extension-localization";
import { dashboardExtensionRouteKind } from "@/shared/extensions/workbench-extension-contributions";
import { dashboardExtensionViewKind } from "./extension-view-placement";

export const refreshExtensionRenderers = (
  ctx: WorkbenchModuleContext,
  metadata: ResolvedWorkbenchExtensionMetadata | undefined,
) => {
  for (const record of metadata?.treeRenderers ?? []) {
    if (ctx.renderers.getTreeRenderer(record.id)) ctx.renderers.refresh(record.id);
  }
};

export const registerExtensionResourceKinds = (ctx: WorkbenchModuleContext) => {
  ctx.resources.registerKind({ kind: dashboardExtensionRouteKind, label: "Extension route", icon: "PanelLeft" });
  ctx.resources.registerKind({ kind: dashboardExtensionViewKind, label: "Extension view", icon: "PanelLeft" });
};
