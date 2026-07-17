import { type Frame, resolveWorkbenchModeArea } from "@pstdio/workbench/core";
import { resolveWorkbenchViewArea, resolveWorkbenchViewWidgetPlacement } from "@pstdio/workbench/extensions";
import { dashboardWidgetIds } from "@/shared/app/widget-ids";
import type { DashboardExtensionMetadata } from "@/shared/extensions/workbench-extension-contributions";

type DashboardExtensionMode = DashboardExtensionMetadata["modes"][number];
type DashboardExtensionView = DashboardExtensionMetadata["views"][number];
type ModeLayoutOpenEntry = NonNullable<NonNullable<DashboardExtensionMode["layout"]>["open"]>[number];

export const dashboardExtensionViewKind = "extension-view";

export const extensionModeLayoutArea = (frame: Frame, target: ModeLayoutOpenEntry["target"]) =>
  resolveWorkbenchModeArea(frame, target);

export const extensionViewWidgetId = (viewId: string) => `${dashboardWidgetIds.extensionView}.${viewId}`;

// Webview views mount in the generic `ExtensionViewWidget` under a prefixed widget
// id; any native-renderer view (tree, file, ...) has its own widget registered by the
// matching pstdio-extensions bridge keyed by `view.id`.
export const extensionViewWidgetIdFor = (view: Pick<DashboardExtensionView, "id" | "webview">) =>
  view.webview ? extensionViewWidgetId(view.id) : view.id;

export const extensionViewArea = (target: DashboardExtensionView["target"] | undefined) =>
  resolveWorkbenchViewArea(target);

export const extensionViewPlacement = (view: DashboardExtensionView, views: DashboardExtensionView[]) =>
  resolveWorkbenchViewWidgetPlacement(view, views);
