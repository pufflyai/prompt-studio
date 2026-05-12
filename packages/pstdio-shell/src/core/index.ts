export type {
  ActivityItem,
  ActivityKindContribution,
  ActivityRegistry,
  RegisteredActivityItem,
} from "./activity/activity-registry";
export { createActivityRegistry } from "./activity/activity-registry";
export type { Command, CommandHandler, CommandRegistry, RegisteredCommand } from "./commands/command-registry";
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
  RegisteredShellDiagnostic,
  ShellDiagnostic,
} from "./diagnostics/diagnostic-registry";
export { createDiagnosticRegistry } from "./diagnostics/diagnostic-registry";
export type { Disposable } from "./disposable";
export type { Keybinding, KeybindingRegistry, RegisteredKeybinding } from "./keybindings/keybinding-registry";
export { createKeybindingRegistry } from "./keybindings/keybinding-registry";
export type {
  LayoutModel,
  RegisteredWidgetContribution,
  ShellArea,
  ShellAreaState,
  ShellLayout,
  ShellWidgetPlacement,
  WebviewDescriptor,
  WidgetContribution,
} from "./layout/layout-model";
export { createLayoutModel, shellAreas } from "./layout/layout-model";
export type { LifecycleHook, LifecyclePhase, LifecycleRegistry } from "./lifecycle/lifecycle-registry";
export { createLifecycleRegistry } from "./lifecycle/lifecycle-registry";
export type { MenuAction, MenuPath, MenuRegistry, RegisteredMenuAction } from "./menus/menu-registry";
export { createMenuRegistry } from "./menus/menu-registry";
export type {
  PreferencePropertySchema,
  PreferenceRegistry,
  PreferenceSchemaContribution,
  PreferenceScope,
  PreferenceScopeRef,
  PreferenceValue,
} from "./preferences/preference-registry";
export { createPreferenceRegistry } from "./preferences/preference-registry";
export type {
  RegisteredResourceKind,
  ResourceKindContribution,
  ResourceOpener,
  ResourceRef,
  ResourceRegistry,
} from "./resources/resource-registry";
export { createResourceRegistry } from "./resources/resource-registry";
export type {
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
  TreeViewRegistry,
} from "./trees/tree-view-registry";
export { createTreeViewRegistry } from "./trees/tree-view-registry";
export type { RegisteredWebviewContribution, WebviewContribution, WebviewRegistry } from "./webviews/webview-registry";
export { createWebviewRegistry } from "./webviews/webview-registry";
