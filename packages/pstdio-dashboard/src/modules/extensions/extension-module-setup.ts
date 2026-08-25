import type { WorkbenchModuleContext } from "@pstdio/workbench";
import type { ResolvedWorkbenchExtensionMetadata } from "@/shared/extensions/extension-localization";

export const refreshExtensionRenderers = (
  ctx: WorkbenchModuleContext,
  metadata: ResolvedWorkbenchExtensionMetadata | undefined,
) => {
  for (const record of metadata?.treeRenderers ?? []) {
    if (ctx.renderers.getTreeRenderer(record.id)) ctx.renderers.refresh(record.id);
  }
};
