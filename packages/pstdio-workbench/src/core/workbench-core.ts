import {
  createWorkbenchBreadcrumbController,
  type WorkbenchBreadcrumbController,
} from "./controllers/breadcrumbs/breadcrumb-registry";
import {
  createWorkbenchCommandPaletteController,
  type WorkbenchCommandPaletteController,
} from "./controllers/command-palette/command-palette-controller";
import { createWorkbenchFocusController, type WorkbenchFocusController } from "./controllers/focus/focus-controller";
import {
  createWorkbenchPanelsController,
  type WorkbenchPanelsController,
  type WorkbenchPanelsPersistenceAdapter,
} from "./controllers/panels/panels-controller";
import {
  createWorkbenchSessionPanelController,
  type WorkbenchSessionPanelController,
  type WorkbenchSessionPanelMode,
} from "./controllers/session-panel/session-panel-controller";
import { createWorkbenchThemeController, type WorkbenchThemeController } from "./controllers/theme/theme-controller";
import { type CommandRegistry, createCommandRegistry } from "./registries/commands/command-registry";
import { createKeybindingRegistry, type KeybindingRegistry } from "./registries/keybindings/keybinding-registry";
import { createLayoutModel, type LayoutModel, type LayoutPersistenceAdapter } from "./registries/layout/layout-model";
import { createLifecycleRegistry, type LifecycleRegistry } from "./registries/lifecycle/lifecycle-registry";
import { createMenuRegistry, type MenuRegistry } from "./registries/menus/menu-registry";
import { createWorkbenchModeRegistry, type WorkbenchModeRegistry } from "./registries/modes/mode-registry";
import { createNavigationRegistry, type NavigationRegistry } from "./registries/navigation/navigation-registry";
import {
  createNotificationRegistry,
  type NotificationRegistry,
} from "./registries/notifications/notification-registry";
import {
  createPreferenceRegistry,
  type PreferencePersistenceAdapter,
  type PreferenceRegistry,
} from "./registries/preferences/preference-registry";
import {
  createWorkbenchRendererRegistry,
  type WorkbenchRendererRegistry,
} from "./registries/renderers/renderer-registry";
import { createResourceRegistry, type ResourceRegistry } from "./registries/resources/resource-registry";
import {
  createTreeViewRegistry,
  type TreeViewPersistenceAdapter,
  type TreeViewRegistry,
} from "./registries/trees/tree-view-registry";
import { type ContextKeyService, createContextKeyService } from "./shared/context/context-key-service";
import type { ContributionMetadata, ContributionSource } from "./shared/contributions/metadata";
import type { Disposable } from "./shared/disposable";
import { createDisposable } from "./shared/disposable";
import { registerWorkbenchBuiltIns } from "./workbench-built-ins";

export interface WorkbenchCoreContributionContext {
  breadcrumbs: WorkbenchBreadcrumbController;
  commandPalette: WorkbenchCommandPaletteController;
  commands: CommandRegistry;
  context: ContextKeyService;
  focus: WorkbenchFocusController;
  keybindings: KeybindingRegistry;
  layout: LayoutModel;
  lifecycle: LifecycleRegistry;
  menus: MenuRegistry;
  modes: WorkbenchModeRegistry;
  navigation: NavigationRegistry;
  notifications: NotificationRegistry;
  panels: WorkbenchPanelsController;
  preferences: PreferenceRegistry;
  renderers: WorkbenchRendererRegistry;
  resources: ResourceRegistry;
  sessionPanel: WorkbenchSessionPanelController;
  theme: WorkbenchThemeController;
  trees: TreeViewRegistry;
}

export interface WorkbenchCore extends WorkbenchCoreContributionContext {
  registerModule(module: WorkbenchModuleContribution): Disposable;
  unregisterModule(moduleId: string): void;
}

export type WorkbenchModuleContributionContext = WorkbenchCoreContributionContext;

export interface CreateWorkbenchCoreInput {
  layoutPersistence?: LayoutPersistenceAdapter;
  preferencePersistence?: PreferencePersistenceAdapter;
  treePersistence?: TreeViewPersistenceAdapter;
  panelsPersistence?: WorkbenchPanelsPersistenceAdapter;
  initialSessionPanelMode?: WorkbenchSessionPanelMode;
}

type WorkbenchModuleActivationResult = Disposable | readonly Disposable[] | undefined;

export interface WorkbenchModuleContribution {
  id: string;
  source?: ContributionSource;
  ownerId?: string;
  activate(ctx: WorkbenchModuleContributionContext): WorkbenchModuleActivationResult;
}

const withModuleMetadata = (
  input: { ownerId: string; source: ContributionSource },
  metadata?: ContributionMetadata,
) => ({
  ...metadata,
  source: input.source,
  ownerId: input.ownerId,
});

const toDisposables = (result: WorkbenchModuleActivationResult) => {
  if (!result) return [] as Disposable[];
  return Array.isArray(result) ? [...result] : [result as Disposable];
};

const disposeDisposables = (disposables: Disposable[]) => {
  for (let index = disposables.length - 1; index >= 0; index -= 1) {
    disposables[index]?.dispose();
  }
};

interface CreateModuleContextInput {
  ownerId: string;
  source: ContributionSource;
  track(disposable: Disposable): void;
}

const createModuleContext = (core: WorkbenchCore, input: CreateModuleContextInput) => {
  const contextScope = core.context.createScope(input.ownerId);
  input.track(contextScope);

  const track = <TDisposable extends Disposable>(disposable: TDisposable) => {
    input.track(disposable);
    return disposable;
  };

  const context = {
    ...core,
    breadcrumbs: {
      ...core.breadcrumbs,
      setItems: (items) => track(core.breadcrumbs.setItems(items)),
    },
    commandPalette: {
      ...core.commandPalette,
    },
    context: {
      ...core.context,
      set: (key, value) => contextScope.set(key, value),
      delete: (key) => contextScope.delete(key),
      createScope: (ownerId) => track(core.context.createScope(ownerId)),
    },
    commands: {
      ...core.commands,
      registerCommand: (command, handler, metadata) =>
        track(core.commands.registerCommand(command, handler, withModuleMetadata(input, metadata))),
    },
    keybindings: {
      ...core.keybindings,
      registerKeybinding: (keybinding, metadata) =>
        track(core.keybindings.registerKeybinding(keybinding, withModuleMetadata(input, metadata))),
    },
    layout: {
      ...core.layout,
      openWidget: (id, openInput) => {
        const placement = core.layout.openWidget(id, {
          ...openInput,
          ownerId: input.ownerId,
          source: input.source,
        });
        track(createDisposable(() => core.layout.removeWidgetPlacement(placement.widgetId)));
        return placement;
      },
      registerAreaPlaceholder: (placeholder, metadata) =>
        track(core.layout.registerAreaPlaceholder(placeholder, withModuleMetadata(input, metadata))),
      registerWidget: (widget, metadata) =>
        track(core.layout.registerWidget(widget, withModuleMetadata(input, metadata))),
    },
    lifecycle: {
      ...core.lifecycle,
      registerHook: (phase, hook, metadata) =>
        track(core.lifecycle.registerHook(phase, hook, withModuleMetadata(input, metadata))),
    },
    menus: {
      ...core.menus,
      registerMenuAction: (path, action, metadata) =>
        track(core.menus.registerMenuAction(path, action, withModuleMetadata(input, metadata))),
    },
    modes: {
      ...core.modes,
      registerMode: (mode) =>
        track(
          core.modes.registerMode({
            ...mode,
            activate: () => {
              const modeDisposables: Disposable[] = [];
              const modeContext = createModuleContext(core, {
                ...input,
                track: (disposable) => {
                  modeDisposables.push(disposable);
                },
              });
              const returnedDisposables = toDisposables(mode.activate(modeContext));
              return createDisposable(() => disposeDisposables([...modeDisposables, ...returnedDisposables]));
            },
          }),
        ),
    },
    navigation: {
      ...core.navigation,
      registerNavigator: (navigator, metadata) =>
        track(core.navigation.registerNavigator(navigator, withModuleMetadata(input, metadata))),
      registerParser: (parser, metadata) =>
        track(core.navigation.registerParser(parser, withModuleMetadata(input, metadata))),
    },
    notifications: {
      ...core.notifications,
      show: (notification, metadata) => core.notifications.show(notification, withModuleMetadata(input, metadata)),
    },
    panels: {
      ...core.panels,
    },
    preferences: {
      ...core.preferences,
      registerSchema: (schema, metadata) =>
        track(core.preferences.registerSchema(schema, withModuleMetadata(input, metadata))),
    },
    renderers: {
      ...core.renderers,
      registerRenderer: (renderer) => track(core.renderers.registerRenderer(renderer)),
    },
    resources: {
      ...core.resources,
      registerKind: (kind, metadata) => track(core.resources.registerKind(kind, withModuleMetadata(input, metadata))),
      registerOpener: (opener) => track(core.resources.registerOpener(opener)),
      registerProvider: (provider) => track(core.resources.registerProvider(provider)),
    },
    sessionPanel: {
      ...core.sessionPanel,
    },
    theme: {
      ...core.theme,
      registerTheme: (theme) => track(core.theme.registerTheme(theme)),
    },
    trees: {
      ...core.trees,
      registerTreeView: (view, metadata) =>
        track(core.trees.registerTreeView(view, withModuleMetadata(input, metadata))),
    },
  } satisfies WorkbenchModuleContributionContext;

  return context;
};

export const createWorkbenchCore = (input: CreateWorkbenchCoreInput = {}) => {
  const context = createContextKeyService();
  const commands = createCommandRegistry({ context });
  const moduleRecords = new Map<string, { disposable: Disposable }>();

  const core: WorkbenchCore = {
    breadcrumbs: createWorkbenchBreadcrumbController(),
    commandPalette: createWorkbenchCommandPaletteController(),
    commands,
    context,
    focus: createWorkbenchFocusController({ context }),
    keybindings: createKeybindingRegistry({ commands, context }),
    layout: createLayoutModel({ persistence: input.layoutPersistence }),
    lifecycle: createLifecycleRegistry(),
    menus: createMenuRegistry({ commands }),
    modes: undefined as unknown as WorkbenchModeRegistry,
    navigation: createNavigationRegistry(),
    notifications: createNotificationRegistry(),
    panels: createWorkbenchPanelsController({ persistence: input.panelsPersistence }),
    preferences: createPreferenceRegistry({ persistence: input.preferencePersistence }),
    renderers: createWorkbenchRendererRegistry(),
    resources: createResourceRegistry(),
    sessionPanel: createWorkbenchSessionPanelController({ initialMode: input.initialSessionPanelMode }),
    theme: createWorkbenchThemeController(),
    trees: createTreeViewRegistry({ persistence: input.treePersistence }),

    registerModule(module) {
      if (moduleRecords.has(module.id)) throw new Error(`Workbench module already registered: ${module.id}`);

      const disposables: Disposable[] = [];
      const record = {
        disposable: undefined as unknown as Disposable,
      };
      record.disposable = createDisposable(() => {
        if (moduleRecords.get(module.id) !== record) return;
        moduleRecords.delete(module.id);
        disposeDisposables(disposables);
      });

      moduleRecords.set(module.id, record);

      try {
        const context = createModuleContext(core, {
          ownerId: module.ownerId ?? module.id,
          source: module.source ?? "module",
          track: (disposable) => {
            disposables.push(disposable);
          },
        });
        disposables.push(...toDisposables(module.activate(context)));
      } catch (error) {
        record.disposable.dispose();
        throw error;
      }

      return record.disposable;
    },

    unregisterModule(moduleId) {
      moduleRecords.get(moduleId)?.disposable.dispose();
    },
  };

  core.modes = createWorkbenchModeRegistry({ resolveContext: () => core });
  registerWorkbenchBuiltIns(core);

  return core;
};
