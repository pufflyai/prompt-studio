export type {
  WorkbenchRendererRegistration,
  WorkbenchRendererRegistry,
  WorkbenchWidgetRenderInput,
} from "../core";
export { createWorkbenchRendererRegistry } from "../core";
export { WorkbenchArea } from "./area/area";
export { WorkbenchAreaTabs } from "./area/area-tabs";
export { WorkbenchWidgetHost } from "./area/widget-host";
export { WorkbenchCommandPalette } from "./command-palette/command-palette";
export { WorkbenchFocusRegion } from "./focus/focus-region";
export { WorkbenchHeaderActions } from "./header/header-actions";
export { useWorkbenchClaim, WorkbenchClaimContext } from "./keep-alive/use-workbench-claim";
export { WorkbenchKeepAliveLayer } from "./keep-alive/workbench-keep-alive-layer";
export type { WorkbenchHotkeyRegistration } from "./keybindings/workbench-keybinding-dispatcher";
export {
  createWorkbenchHotkeyRegistrations,
  normalizeWorkbenchKeybinding,
  WorkbenchKeybindingDispatcher,
} from "./keybindings/workbench-keybinding-dispatcher";
export type { WorkbenchMenuItem } from "./menus/menu-items";
export { listWorkbenchMenuItems } from "./menus/menu-items";
export { WorkbenchNotificationHost } from "./notifications/notification-host";
export { WorkbenchSessionAttachedPanel, WorkbenchSessionBubbleContainer } from "./session-panel/session-panel";
export { WorkbenchIcon } from "./shared/icon";
export { useWorkbenchStore } from "./shared/use-workbench-store";
export { WorkbenchThemeScope } from "./theme/workbench-theme-scope";
export { WorkbenchTreeView } from "./tree/tree-view";
export type { WorkbenchOverlayWidgetConfig } from "./workbench/overlay-layer";
export { WorkbenchOverlayLayer } from "./workbench/overlay-layer";
export { Workbench } from "./workbench/workbench";
