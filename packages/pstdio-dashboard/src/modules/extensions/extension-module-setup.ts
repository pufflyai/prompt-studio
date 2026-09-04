import type { WorkbenchModuleContext } from "@pstdio/workbench";
import type { ResolvedWorkbenchExtensionMetadata } from "@/shared/extensions/extension-localization";

export const refreshExtensionRenderers = (
  ctx: WorkbenchModuleContext,
  metadata: ResolvedWorkbenchExtensionMetadata | undefined,
) => {
  for (const view of metadata?.views ?? []) {
    if (ctx.views.getView(view.id)) ctx.views.refreshView(view.id);
  }
};
