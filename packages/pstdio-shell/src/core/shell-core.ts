import { type ActivityRegistry, createActivityRegistry } from "./activity/activity-registry";
import { type CommandRegistry, createCommandRegistry } from "./commands/command-registry";
import { type ContextKeyService, createContextKeyService } from "./context/context-key-service";
import type { ContributionMetadata } from "./contributions/metadata";
import { createDiagnosticRegistry, type DiagnosticRegistry } from "./diagnostics/diagnostic-registry";
import type { Disposable } from "./disposable";
import { createDisposable } from "./disposable";
import { createKeybindingRegistry, type KeybindingRegistry } from "./keybindings/keybinding-registry";
import { createLayoutModel, type LayoutModel, type LayoutPersistenceAdapter } from "./layout/layout-model";
import { createLifecycleRegistry, type LifecycleRegistry } from "./lifecycle/lifecycle-registry";
import { createMenuRegistry, type MenuRegistry } from "./menus/menu-registry";
import { createNavigationRegistry, type NavigationRegistry } from "./navigation/navigation-registry";
import { createNotificationRegistry, type NotificationRegistry } from "./notifications/notification-registry";
import {
  createPreferenceRegistry,
  type PreferencePersistenceAdapter,
  type PreferenceRegistry,
} from "./preferences/preference-registry";
import { createShellRendererRegistry, type ShellRendererRegistry } from "./renderers/renderer-registry";
import { createResourceRegistry, type ResourceRegistry } from "./resources/resource-registry";
import { createTreeViewRegistry, type TreeViewRegistry } from "./trees/tree-view-registry";
import { createWebviewRegistry, type WebviewRegistry } from "./webviews/webview-registry";

export interface ShellCoreContributionContext {
  activity: ActivityRegistry;
  commands: CommandRegistry;
  context: ContextKeyService;
  diagnostics: DiagnosticRegistry;
  keybindings: KeybindingRegistry;
  layout: LayoutModel;
  lifecycle: LifecycleRegistry;
  menus: MenuRegistry;
  navigation: NavigationRegistry;
  notifications: NotificationRegistry;
  preferences: PreferenceRegistry;
  renderers: ShellRendererRegistry;
  resources: ResourceRegistry;
  trees: TreeViewRegistry;
  webviews: WebviewRegistry;
}

export type ShellCore = ShellCoreContributionContext;
export type ProductModuleContributionContext = ShellCoreContributionContext;

export interface CreateShellCoreInput {
  layoutPersistence?: LayoutPersistenceAdapter;
  preferencePersistence?: PreferencePersistenceAdapter;
}

type ProductModuleActivationResult = Disposable | readonly Disposable[] | undefined;

export interface ProductModuleContribution {
  id: string;
  activate(ctx: ProductModuleContributionContext): ProductModuleActivationResult;
}

const withProductModuleMetadata = (ownerId: string, metadata?: ContributionMetadata) => ({
  ...metadata,
  source: "product-module" as const,
  ownerId,
});

export const createShellCore = (input: CreateShellCoreInput = {}) => {
  const commands = createCommandRegistry();
  const context = createContextKeyService();

  return {
    activity: createActivityRegistry(),
    commands,
    context,
    diagnostics: createDiagnosticRegistry(),
    keybindings: createKeybindingRegistry({ commands, context }),
    layout: createLayoutModel({ persistence: input.layoutPersistence }),
    lifecycle: createLifecycleRegistry(),
    menus: createMenuRegistry({ commands }),
    navigation: createNavigationRegistry(),
    notifications: createNotificationRegistry(),
    preferences: createPreferenceRegistry({ persistence: input.preferencePersistence }),
    renderers: createShellRendererRegistry(),
    resources: createResourceRegistry(),
    trees: createTreeViewRegistry(),
    webviews: createWebviewRegistry(),
  };
};

const createProductModuleContext = (core: ShellCore, ownerId: string) =>
  ({
    ...core,
    activity: {
      ...core.activity,
      registerKind: (kind, metadata) => core.activity.registerKind(kind, withProductModuleMetadata(ownerId, metadata)),
      emit: (item, metadata) => core.activity.emit(item, withProductModuleMetadata(ownerId, metadata)),
    },
    commands: {
      ...core.commands,
      registerCommand: (command, handler, metadata) =>
        core.commands.registerCommand(command, handler, withProductModuleMetadata(ownerId, metadata)),
    },
    diagnostics: {
      ...core.diagnostics,
      report: (diagnostic, metadata) =>
        core.diagnostics.report(diagnostic, withProductModuleMetadata(ownerId, metadata)),
    },
    keybindings: {
      ...core.keybindings,
      registerKeybinding: (keybinding, metadata) =>
        core.keybindings.registerKeybinding(keybinding, withProductModuleMetadata(ownerId, metadata)),
    },
    layout: {
      ...core.layout,
      registerWidget: (widget, metadata) =>
        core.layout.registerWidget(widget, withProductModuleMetadata(ownerId, metadata)),
    },
    lifecycle: {
      ...core.lifecycle,
      registerHook: (phase, hook, metadata) =>
        core.lifecycle.registerHook(phase, hook, withProductModuleMetadata(ownerId, metadata)),
    },
    menus: {
      ...core.menus,
      registerMenuAction: (path, action, metadata) =>
        core.menus.registerMenuAction(path, action, withProductModuleMetadata(ownerId, metadata)),
    },
    navigation: {
      ...core.navigation,
      registerNavigator: (navigator, metadata) =>
        core.navigation.registerNavigator(navigator, withProductModuleMetadata(ownerId, metadata)),
      registerParser: (parser, metadata) =>
        core.navigation.registerParser(parser, withProductModuleMetadata(ownerId, metadata)),
    },
    notifications: {
      ...core.notifications,
      show: (notification, metadata) =>
        core.notifications.show(notification, withProductModuleMetadata(ownerId, metadata)),
    },
    preferences: {
      ...core.preferences,
      registerSchema: (schema, metadata) =>
        core.preferences.registerSchema(schema, withProductModuleMetadata(ownerId, metadata)),
    },
    renderers: {
      ...core.renderers,
    },
    resources: {
      ...core.resources,
      registerKind: (kind, metadata) => core.resources.registerKind(kind, withProductModuleMetadata(ownerId, metadata)),
    },
    trees: {
      ...core.trees,
      registerTreeView: (view, metadata) =>
        core.trees.registerTreeView(view, withProductModuleMetadata(ownerId, metadata)),
    },
    webviews: {
      ...core.webviews,
      registerWebview: (webview, metadata) =>
        core.webviews.registerWebview(webview, withProductModuleMetadata(ownerId, metadata)),
    },
  }) satisfies ProductModuleContributionContext;

const toDisposables = (result: ProductModuleActivationResult) => {
  if (!result) return [];
  return Array.isArray(result) ? [...result] : [result];
};

export const activateProductModule = (core: ShellCore, module: ProductModuleContribution) => {
  const disposables = toDisposables(module.activate(createProductModuleContext(core, module.id)));

  return createDisposable(() => {
    for (let index = disposables.length - 1; index >= 0; index -= 1) {
      disposables[index]?.dispose();
    }
  });
};
