export type {
  WorkbenchPanelRenderInput,
  WorkbenchRendererRegistration,
  WorkbenchRendererRegistry,
} from "../core";
export { createWorkbenchRendererRegistry } from "../core";
export { WorkbenchBreadcrumbView } from "./breadcrumb/breadcrumb-view";
export { WorkbenchCommandPalette } from "./command-palette/command-palette";
export type { CommandParamEntry, CommandParamValue } from "./command-palette/command-palette-params";
export { commandParamName, readCommandParamValue } from "./command-palette/command-param-descriptors";
export type {
  CommandParamFieldProps,
  CommandParamFieldRenderer,
} from "./command-palette/command-params-dialog";
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
export {
  createWorkbenchResourceActions,
  useWorkbenchResourceActionResolver,
} from "./menus/resource-actions";
export { WorkbenchNotificationHost } from "./notifications/notification-host";
export { WorkbenchRegion } from "./region/region";
export { WorkbenchRegionTabs } from "./region/region-tabs";
export { WorkbenchWidgetHost } from "./region/widget-host";
export { WorkbenchDataTableView } from "./renderers/data-table/data-table-view";
export type { PreferenceParamEntry } from "./renderers/settings/preference-schema-to-params";
export { paramValueToPreference, preferenceSchemaToParams } from "./renderers/settings/preference-schema-to-params";
export type { WorkbenchPreferencesFormProps } from "./renderers/settings/preferences-form";
export { WorkbenchPreferencesForm } from "./renderers/settings/preferences-form";
export type { TreeActionParamsRequest } from "./renderers/tree/tree-actions";
export { createTreeContextMenuItems } from "./renderers/tree/tree-actions";
export { WorkbenchTreeView } from "./renderers/tree/tree-view";
export type { WorkbenchSettingsModuleOptions } from "./settings/settings-module";
export {
  createWorkbenchSettingsModule,
  WORKBENCH_SETTINGS_NAV_WIDGET_ID,
  WORKBENCH_SETTINGS_OPEN_COMMAND_ID,
  WORKBENCH_SETTINGS_PANEL_WIDGET_ID,
  WORKBENCH_SETTINGS_WIDGET_ID,
} from "./settings/settings-module";
export {
  isSettingsScopeVisible,
  SETTINGS_RESOURCE_KIND,
  settingsItemResource,
  settingsPanelResource,
} from "./settings/settings-resources";
export type { BuildSettingsTreeInput } from "./settings/settings-tree";
export { buildSettingsTreeBody } from "./settings/settings-tree";
export { WorkbenchIcon } from "./shared/icon";
export { useWorkbenchStore } from "./shared/use-workbench-store";
export { WorkbenchAttachedSidePanel, WorkbenchFloatingSidePanel } from "./side-panel/side-panel";
export {
  createWorkbenchTerminalModule,
  openWorkbenchTerminal,
  WORKBENCH_TERMINAL_LAUNCHER_WIDGET_ID,
  WORKBENCH_TERMINAL_OPEN_COMMAND_ID,
  WORKBENCH_TERMINAL_WIDGET_ID,
} from "./terminal/terminal-module";
export { createControllerTerminalBridge, WorkbenchTerminalPanel } from "./terminal/workbench-terminal-panel";
export { useWorkbenchThemePreferences } from "./theme/use-workbench-theme-preferences";
export { WorkbenchThemeProvider } from "./theme/workbench-theme-provider";
export { WorkbenchThemeScope } from "./theme/workbench-theme-scope";
export type { WorkbenchOverlayWidgetConfig } from "./workbench/overlay-layer";
export { WorkbenchOverlayLayer } from "./workbench/overlay-layer";
export { Workbench } from "./workbench/workbench";
export {
  disposeWorkbenchModuleHostRegistrations,
  syncWorkbenchModuleHostRegistrations,
  WorkbenchModuleHost,
  type WorkbenchModuleHostProps,
  type WorkbenchModuleHostRegistration,
} from "./workbench/workbench-module-host";
