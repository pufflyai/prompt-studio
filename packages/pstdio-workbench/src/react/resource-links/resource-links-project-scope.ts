import type { WorkbenchModuleContext } from "../../core";

export const closeResourceLinksOnProjectChange = (
  ctx: Pick<WorkbenchModuleContext, "pages" | "layout" | "overlays">,
  viewId: string,
) => ({
  dispose: ctx.pages.store.subscribeSelector(
    (state) => state.projectId,
    () => {
      for (const widget of ctx.layout.getLayout().regions.overlay.widgets) {
        if (widget.viewId === viewId) ctx.overlays.closeOverlay(widget.widgetId);
      }
    },
  ),
});
