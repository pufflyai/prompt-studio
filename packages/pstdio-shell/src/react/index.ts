export type {
  ShellRendererRegistration,
  ShellRendererRegistry,
  ShellWidgetRenderInput,
} from "../core";
export { createShellRendererRegistry } from "../core";
export { ShellArea } from "./area/area";
export { ShellAreaTabs } from "./area/area-tabs";
export { ShellWidgetHost } from "./area/widget-host";
export { ShellCommandPalette } from "./command-palette/command-palette";
export { ShellHeaderActions } from "./header/header-actions";
export type { ShellMenuActionItem } from "./menus/menu-action-items";
export { listShellMenuActionItems } from "./menus/menu-action-items";
export { ShellNotificationHost } from "./notifications/notification-host";
export { ShellSessionAttachedPanel, ShellSessionBubbleContainer } from "./session-panel/session-panel";
export { ShellIcon } from "./shared/icon";
export { useShellStore } from "./shared/use-shell-store";
export { ShellTreeView } from "./tree/tree-view";
export type { ShellOverlayWidgetConfig } from "./workbench/overlay-layer";
export { ShellOverlayLayer } from "./workbench/overlay-layer";
export { ShellWorkbench } from "./workbench/workbench";
