import { dashboardWidgetIds } from "@/shared/app/widget-ids";
import type { DashboardExtensionMetadata } from "@/shared/extensions/workbench-extension-contributions";

type DashboardExtensionPanel = DashboardExtensionMetadata["panels"][number];

export const dashboardExtensionViewKind = "extension-view";

export const extensionViewWidgetId = (viewId: string) => `${dashboardWidgetIds.extensionView}.${viewId}`;

// Webview views mount in the generic `ExtensionViewWidget` under a prefixed widget
// id; any native-renderer view (tree, file, ...) has its own widget registered by the
// matching pstdio-extensions bridge keyed by `view.id`.
export const extensionViewWidgetIdFor = (panel: Pick<DashboardExtensionPanel, "id" | "webview">) =>
  panel.webview ? extensionViewWidgetId(panel.id) : panel.id;
