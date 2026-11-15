import { batchWorkbenchChanges, type WorkbenchModuleContext } from "@pstdio/workbench";
import { WORKBENCH_SETTINGS_WIDGET_ID } from "@pstdio/workbench/react";

const eligible = (ctx: WorkbenchModuleContext, panel: ReturnType<WorkbenchModuleContext["settings"]["getPanel"]>) =>
  panel?.scope === "global" && panel.kind !== "collection" && !panel.parentPanelId && ctx.context.matches(panel.when);

const captureTarget = (ctx: WorkbenchModuleContext) => {
  const shell = ctx.layout
    .getLayout()
    .regions.overlay.widgets.find((widget) => widget.viewId === WORKBENCH_SETTINGS_WIDGET_ID);
  if (!shell) return undefined;
  const panelId = shell.resource?.metadata?.panelId;
  const panel = typeof panelId === "string" ? ctx.settings.getPanel(panelId) : undefined;
  const preserve = eligible(ctx, panel) && shell.resource?.metadata?.itemId === undefined;
  return {
    instanceId: shell.widgetId,
    panelId: preserve && typeof panelId === "string" ? panelId : undefined,
    resourceType: preserve ? shell.resource?.type : undefined,
  };
};

/** A host-owned destination survives retirement; private content and item identity do not. */
export const createExtensionSettingsRetirement = (ctx: WorkbenchModuleContext) => {
  const target = captureTarget(ctx);
  const panelId = target?.panelId;
  let active = true;
  let prepared = false;
  let instanceId = target?.instanceId;
  let current = instanceId ? ctx.overlays.captureInvocation(instanceId) : undefined;
  const selected = () => {
    if (!current?.() || !instanceId) return undefined;
    const widget = ctx.layout.getLayout().regions.overlay.widgets.find((widget) => widget.widgetId === instanceId);
    return panelId === undefined ||
      (widget?.resource?.metadata?.panelId === panelId && widget?.resource?.metadata?.itemId === undefined)
      ? widget
      : undefined;
  };
  const prepare = () => {
    if (!active || prepared) return;
    prepared = true;
    const widget = selected();
    if (!widget) return;
    if (panelId === undefined || !target?.resourceType) {
      ctx.overlays.closeOverlay(widget.widgetId);
      return;
    }
    // Install the closable, data-free shell before disposal can call out.
    instanceId = ctx.overlays.openOverlay(WORKBENCH_SETTINGS_WIDGET_ID, {
      resource: { type: target.resourceType, id: panelId, metadata: { panelId } },
      title: ctx.views.getView(WORKBENCH_SETTINGS_WIDGET_ID)?.title,
    });
    current = ctx.overlays.captureInvocation(instanceId);
    if (!active && selected()) ctx.overlays.closeOverlay(instanceId);
  };
  return {
    retire(retire: () => void) {
      batchWorkbenchChanges(() => {
        prepare();
        // A repeated account/project retirement keeps the same opaque shell.
        retire();
      });
    },
    complete() {
      if (!active || typeof panelId !== "string") return;
      const widget = selected();
      if (!widget?.resource) return;
      const panel = ctx.settings.getPanel(panelId);
      if (!panel || !eligible(ctx, panel)) {
        ctx.overlays.closeOverlay(widget.widgetId);
        return;
      }
      ctx.overlays.openOverlay(WORKBENCH_SETTINGS_WIDGET_ID, {
        resource: {
          type: widget.resource.type,
          id: panel.id,
          label: panel.title,
          icon: panel.icon,
          metadata: { panelId: panel.id },
        },
        title: panel.title,
      });
    },
    dispose() {
      active = false;
      const widget = selected();
      if (widget) ctx.overlays.closeOverlay(widget.widgetId);
    },
  };
};
