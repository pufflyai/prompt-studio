export type {
  ShellRendererRegistration,
  ShellRendererRegistry,
  ShellWidgetRenderInput,
} from "../core";
export { createShellRendererRegistry, resolveShellWidgetRendererId } from "../core";
export { ShellArea } from "./shell-area";
export { ShellAreaTabs } from "./shell-area-tabs";
export { ShellCommandPalette } from "./shell-command-palette";
export { ShellHeaderActions } from "./shell-header-actions";
export { ShellIcon } from "./shell-icons";
export type { ShellMenuActionItem } from "./shell-menu-action-items";
export { listShellMenuActionItems } from "./shell-menu-action-items";
export { ShellNotificationHost } from "./shell-notification-host";
export { ShellSessionAttachedPanel, ShellSessionBubbleContainer } from "./shell-session-panel";
export type { ShellSessionPanelMode, ShellSessionPanelStore } from "./shell-session-panel-store";
export {
  createShellSessionPanelStore,
  ShellSessionPanelProvider,
  useShellSessionPanelStore,
} from "./shell-session-panel-store";
export { ShellTreeView } from "./shell-tree-view";
export { ShellWidgetHost } from "./shell-widget-host";
export { ShellWorkbench } from "./shell-workbench";
