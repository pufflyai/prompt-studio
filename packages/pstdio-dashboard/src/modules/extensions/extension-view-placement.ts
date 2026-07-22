import type { WorkbenchRegion } from "@pstdio/workbench/core";
import { dashboardWidgetIds } from "@/shared/app/widget-ids";
import type { DashboardExtensionMetadata } from "@/shared/extensions/workbench-extension-contributions";

type DashboardExtensionMode = DashboardExtensionMetadata["modes"][number];
type DashboardExtensionView = DashboardExtensionMetadata["views"][number];
type ModeLayoutOpenEntry = NonNullable<NonNullable<DashboardExtensionMode["layout"]>["open"]>[number];

export const dashboardExtensionViewKind = "extension-view";

const targetRegion = {
  "workbench.left": "sidenav",
  "workbench.main.left": "main-left-menu",
  "workbench.main": "main",
  "workbench.main.right": "main-right-menu",
  "workbench.secondary": "secondary",
} as const satisfies Record<ModeLayoutOpenEntry["target"], WorkbenchRegion>;

export const extensionModeLayoutRegion = (target: ModeLayoutOpenEntry["target"]) => targetRegion[target];

export const extensionViewWidgetId = (viewId: string) => `${dashboardWidgetIds.extensionView}.${viewId}`;

// Webview views mount in the generic `ExtensionViewWidget` under a prefixed widget
// id; any native-renderer view (tree, file, ...) has its own widget registered by the
// matching pstdio-extensions bridge keyed by `view.id`.
export const extensionViewWidgetIdFor = (view: Pick<DashboardExtensionView, "id" | "webview">) =>
  view.webview ? extensionViewWidgetId(view.id) : view.id;

export const extensionViewRegion = (target: DashboardExtensionView["target"] | undefined) =>
  target ? targetRegion[target] : "main";
