import type { WorkbenchModuleContext } from "@pstdio/workbench";
import type { ResolvedWorkbenchExtensionMetadata } from "@/shared/extensions/extension-localization";

export const refreshExtensionRenderers = (
  ctx: WorkbenchModuleContext,
  metadata: ResolvedWorkbenchExtensionMetadata | undefined,
) => {
  for (const view of metadata?.views ?? []) {
    if (view.body.kind === "tree" && ctx.renderers.getTreeRenderer(view.id)) ctx.renderers.refresh(view.id);
    if (view.body.kind === "file" && ctx.renderers.getFileRenderer(view.id)) ctx.renderers.refreshFileRenderer(view.id);
    if (view.body.kind === "kanban" && ctx.renderers.getKanbanRenderer(view.id)) {
      ctx.renderers.refreshKanbanRenderer(view.id);
    }
    if (view.body.kind === "dataTable" && ctx.renderers.getDataTableRenderer(view.id)) {
      ctx.renderers.refreshDataTableRenderer(view.id);
    }
  }
};
