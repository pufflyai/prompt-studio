import type { WorkbenchRegion } from "@pstdio/workbench";
import { dashboardWidgetIds } from "@/shared/app/widget-ids";
import type { DashboardExtensionMetadata } from "@/shared/extensions/workbench-extension-contributions";

type DashboardExtensionMode = DashboardExtensionMetadata["modes"][number];
type DashboardExtensionPanel = DashboardExtensionMetadata["panels"][number];
type ModeLayoutOpenEntry = NonNullable<NonNullable<DashboardExtensionMode["layout"]>["open"]>[number];

export const dashboardExtensionViewKind = "extension-view";

export const extensionModeLayoutRegion = (region: ModeLayoutOpenEntry["region"]) =>
  (region ?? "main") as WorkbenchRegion;

export const extensionViewWidgetId = (viewId: string) => `${dashboardWidgetIds.extensionView}.${viewId}`;

// Webview views mount in the generic `ExtensionViewWidget` under a prefixed widget
// id; any native-renderer view (tree, file, ...) has its own widget registered by the
// matching pstdio-extensions bridge keyed by `view.id`.
export const extensionViewWidgetIdFor = (panel: Pick<DashboardExtensionPanel, "id" | "webview">) =>
  panel.webview ? extensionViewWidgetId(panel.id) : panel.id;

export const extensionViewRegion = (region: DashboardExtensionPanel["region"]) => region;
