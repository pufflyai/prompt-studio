import type { Disposable, WorkbenchModuleContext } from "@pstdio/workbench";
import { dashboardWidgetIds } from "@/shared/app/widget-ids";
import { resolveLocalizableString } from "@/shared/extensions/extension-localization";
import type { DashboardExtensionMetadata } from "@/shared/extensions/workbench-extension-contributions";

type ExtensionStatusItem = NonNullable<DashboardExtensionMetadata["statusItems"]>[number];

const matchesActiveMode = (ctx: WorkbenchModuleContext, item: ExtensionStatusItem) => {
  const modes = item.when?.mode;
  if (!modes) return true;
  const activeModeId = ctx.modes.getActiveModeId() ?? "";
  return Array.isArray(modes) ? modes.includes(activeModeId) : modes === activeModeId;
};

// Status items are chrome, not docked panels: they live outside the mode-scoped
// layout, so each item follows the modes its `when.mode` expression names instead of
// being swept by a shared pass.
export const registerExtensionStatusItems = (
  ctx: WorkbenchModuleContext,
  metadata: DashboardExtensionMetadata,
  projectId: string,
) => {
  const disposables: Disposable[] = [];

  for (const [index, item] of (metadata.statusItems ?? []).entries()) {
    if (!item.webview) continue;
    const widgetId = item.id;
    disposables.push(
      ctx.layout.registerWidget({
        id: widgetId,
        title: resolveLocalizableString(item.title, item.extensionId),
        region: "status",
        rendererId: dashboardWidgetIds.extensionPanelRenderer,
        closable: false,
        priority: -index,
        config: { projectId },
      }),
    );

    const sync = () => {
      const placed = ctx.layout
        .getLayout()
        .regions.status.widgets.find((placement) => placement.contributionId === widgetId);
      if (matchesActiveMode(ctx, item) && !placed) ctx.layout.openWidget(widgetId, { region: "status" });
      else if (!matchesActiveMode(ctx, item) && placed) ctx.layout.removeWidgetPlacement(placed.widgetId);
    };
    sync();
    disposables.push(ctx.modes.onDidChangeActive(sync));
  }

  return disposables;
};
