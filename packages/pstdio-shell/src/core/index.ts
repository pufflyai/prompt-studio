export type {
  ActivityItem,
  ActivityKindContribution,
  ActivityRegistry,
  RegisteredActivityItem,
} from "./activity/activity-registry";
export { createActivityRegistry } from "./activity/activity-registry";
export type {
  ShellBreadcrumbChangeListener,
  ShellBreadcrumbController,
  ShellBreadcrumbItem,
} from "./breadcrumbs/breadcrumb-registry";
export {
  buildActiveWidgetBreadcrumb,
  createShellBreadcrumbController,
} from "./breadcrumbs/breadcrumb-registry";
export type {
  CreateShellCommandPaletteControllerInput,
  ShellCommandPaletteChangeListener,
  ShellCommandPaletteController,
} from "./command-palette/command-palette-controller";
export { createShellCommandPaletteController } from "./command-palette/command-palette-controller";
export type {
  Command,
  CommandHandler,
  CommandRegistry,
  RegisteredCommand,
  ShellCommandExecutionError,
  ShellCommandExecutionErrorListener,
} from "./commands/command-registry";
export { createCommandRegistry } from "./commands/command-registry";
export type { ContextKeyService, ContextKeyValue } from "./context/context-key-service";
export { createContextKeyService } from "./context/context-key-service";
export type {
  ContributionMetadata,
  ContributionSource,
  RegisteredContributionMetadata,
} from "./contributions/metadata";
export type {
  RuntimeExtensionAdapterInput,
  RuntimeExtensionContributionDescriptor,
} from "./contributions/runtime-extension-adapter";
export { adaptRuntimeExtensionContributions } from "./contributions/runtime-extension-adapter";
export type {
  DiagnosticAction,
  DiagnosticRegistry,
  DiagnosticSourceContribution,
  RegisteredDiagnosticSource,
  RegisteredShellDiagnostic,
  ShellDiagnostic,
} from "./diagnostics/diagnostic-registry";
export { createDiagnosticRegistry } from "./diagnostics/diagnostic-registry";
export type { Disposable } from "./disposable";
export type { Keybinding, KeybindingRegistry, RegisteredKeybinding } from "./keybindings/keybinding-registry";
export { createKeybindingRegistry } from "./keybindings/keybinding-registry";
export type {
  CreateLayoutModelInput,
  LayoutModel,
  LayoutPersistenceAdapter,
  RegisteredWidgetContribution,
  ShellArea,
  ShellAreaSize,
  ShellAreaState,
  ShellLayout,
  ShellWidgetPlacement,
  WebviewDescriptor,
  WidgetContribution,
} from "./layout/layout-model";
export { createDefaultShellLayout, createLayoutModel, shellAreas } from "./layout/layout-model";
export type { LifecycleHook, LifecyclePhase, LifecycleRegistry } from "./lifecycle/lifecycle-registry";
export { createLifecycleRegistry } from "./lifecycle/lifecycle-registry";
export type { MenuAction, MenuPath, MenuRegistry, RegisteredMenuAction } from "./menus/menu-registry";
export { createMenuRegistry } from "./menus/menu-registry";
export {
  headerLeadingMenuPath,
  headerTrailingMenuPath,
  workbenchCommandPaletteMenuPath,
  workbenchTopHeaderLeadingMenuPath,
  workbenchTopHeaderTrailingMenuPath,
} from "./menus/workbench-menu-paths";
export type {
  ShellModeActivationContext,
  ShellModeActivationResult,
  ShellModeContribution,
  ShellModeRegistry,
} from "./modes/mode-registry";
export { createShellModeRegistry } from "./modes/mode-registry";
export type {
  NavigationParser,
  NavigationRegistry,
  RegisteredNavigationParser,
  RegisteredResourceNavigator,
  ResourceNavigator,
} from "./navigation/navigation-registry";
export { createNavigationRegistry } from "./navigation/navigation-registry";
export type {
  NotificationRegistry,
  RegisteredShellNotification,
  ShellNotification,
  ShellNotificationAction,
  ShellNotificationEvent,
  ShellNotificationLevel,
} from "./notifications/notification-registry";
export { createNotificationRegistry } from "./notifications/notification-registry";
export type {
  CreatePreferenceRegistryInput,
  PreferencePersistenceAdapter,
  PreferencePropertySchema,
  PreferenceRegistry,
  PreferenceSchemaContribution,
  PreferenceScope,
  PreferenceScopeRef,
  PreferenceValue,
} from "./preferences/preference-registry";
export { createPreferenceRegistry } from "./preferences/preference-registry";
export type {
  ShellRendererRegistration,
  ShellRendererRegistry,
  ShellWidgetRenderInput,
} from "./renderers/renderer-registry";
export {
  createShellRendererRegistry,
  resolveShellWidgetRendererId,
} from "./renderers/renderer-registry";
export type {
  OpenResourceInput,
  RegisteredResourceKind,
  ResourceKindContribution,
  ResourceOpener,
  ResourceRef,
  ResourceRegistry,
} from "./resources/resource-registry";
export { createResourceRegistry } from "./resources/resource-registry";
export type {
  CreateShellSessionPanelControllerInput,
  ShellSessionPanelChangeListener,
  ShellSessionPanelController,
  ShellSessionPanelMode,
} from "./session-panel/session-panel-controller";
export { createShellSessionPanelController } from "./session-panel/session-panel-controller";
export type {
  CreateShellCoreInput,
  ProductModuleContribution,
  ProductModuleContributionContext,
  ShellCore,
  ShellCoreContributionContext,
} from "./shell-core";
export { activateProductModule, createShellCore } from "./shell-core";
export type {
  RegisteredTreeViewContribution,
  TreeContext,
  TreeNode,
  TreeViewContribution,
  TreeViewRefreshEvent,
  TreeViewRegistry,
  TreeViewRole,
  TreeViewSection,
  TreeViewState,
} from "./trees/tree-view-registry";
export { createTreeViewRegistry } from "./trees/tree-view-registry";
export type { RegisteredWebviewContribution, WebviewContribution, WebviewRegistry } from "./webviews/webview-registry";
export { createWebviewRegistry } from "./webviews/webview-registry";
