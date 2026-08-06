import type { ResourceRef } from "./registries/resources/resource-registry";
import type { ContributionMetadata, ContributionSource } from "./shared/contributions/metadata";
import type { Disposable } from "./shared/disposable";
import { createDisposable } from "./shared/disposable";
import type {
  WorkbenchCore,
  WorkbenchModuleContribution,
  WorkbenchModuleContributionContext,
} from "./workbench-core-types";

const withModuleMetadata = (
  input: { ownerId: string; source: ContributionSource },
  metadata?: ContributionMetadata,
) => ({
  ...metadata,
  source: input.source,
  ownerId: input.ownerId,
});

export const toDisposables = (result: ReturnType<WorkbenchModuleContribution["activate"]>) => {
  if (!result) return [] as Disposable[];
  return Array.isArray(result) ? [...result] : [result as Disposable];
};

export const disposeDisposables = (disposables: Disposable[]) => {
  for (let index = disposables.length - 1; index >= 0; index -= 1) {
    disposables[index]?.dispose();
  }
};

interface CreateModuleContextInput {
  ownerId: string;
  source: ContributionSource;
  track(disposable: Disposable): void;
}

export const createModuleContext = (core: WorkbenchCore, input: CreateModuleContextInput) => {
  const contextScope = core.context.createScope(input.ownerId);
  input.track(contextScope);

  const track = <TDisposable extends Disposable>(disposable: TDisposable) => {
    input.track(disposable);
    return disposable;
  };

  const context = {
    ...core,
    onDidChangePrimaryResource: (listener: (resource: ResourceRef | undefined) => void) =>
      track(core.onDidChangePrimaryResource(listener)),
    onDidChangeActiveResource: (listener: (resource: ResourceRef | undefined) => void) =>
      track(core.onDidChangeActiveResource(listener)),
    breadcrumbs: {
      ...core.breadcrumbs,
      setItems: (items) => track(core.breadcrumbs.setItems(items)),
      onDidChange: (listener) => track(core.breadcrumbs.onDidChange(listener)),
    },
    commandPalette: {
      ...core.commandPalette,
      onDidChange: (listener) => track(core.commandPalette.onDidChange(listener)),
    },
    context: {
      ...core.context,
      set: (key, value) => contextScope.set(key, value),
      delete: (key) => contextScope.delete(key),
      createScope: (ownerId) => track(core.context.createScope(ownerId)),
    },
    focus: {
      ...core.focus,
      onDidChange: (listener) => track(core.focus.onDidChange(listener)),
    },
    commands: {
      ...core.commands,
      registerCommand: (command, handler, metadata) =>
        track(core.commands.registerCommand(command, handler, withModuleMetadata(input, metadata))),
      onDidExecuteError: (listener) => track(core.commands.onDidExecuteError(listener)),
    },
    keybindings: {
      ...core.keybindings,
      registerKeybinding: (keybinding, metadata) =>
        track(core.keybindings.registerKeybinding(keybinding, withModuleMetadata(input, metadata))),
    },
    lastResource: { ...core.lastResource },
    layout: {
      ...core.layout,
      openPanel: (id, openInput) => {
        const instance = core.layout.openPanel(id, openInput);
        track(createDisposable(() => core.layout.removeWidgetPlacement(instance.instanceId)));
        return instance;
      },
      openWidget: (id, openInput) => {
        const placement = core.layout.openWidget(id, {
          ...openInput,
          ownerId: input.ownerId,
          source: input.source,
        });
        track(createDisposable(() => core.layout.removeWidgetPlacement(placement.widgetId)));
        return placement;
      },
      registerPlaceholder: (placeholder, metadata) =>
        track(core.layout.registerPlaceholder(placeholder, withModuleMetadata(input, metadata))),
      registerPanel: (panel, metadata) => track(core.layout.registerPanel(panel, withModuleMetadata(input, metadata))),
      registerWidget: (widget, metadata) =>
        track(core.layout.registerWidget(widget, withModuleMetadata(input, metadata))),
      registerLocation: (location, metadata) =>
        track(core.layout.registerLocation(location, withModuleMetadata(input, metadata))),
      registerSubPanel: (subPanel, metadata) =>
        track(core.layout.registerSubPanel(subPanel, withModuleMetadata(input, metadata))),
      registerPanelMenu: (panelMenu, metadata) =>
        track(core.layout.registerPanelMenu(panelMenu, withModuleMetadata(input, metadata))),
      registerMenuItem: (path, item, metadata) =>
        track(core.layout.registerMenuItem(path, item, withModuleMetadata(input, metadata))),
      onWillChangePersistenceScope: (listener) => track(core.layout.onWillChangePersistenceScope(listener)),
      onDidChangePersistenceScope: (listener) => track(core.layout.onDidChangePersistenceScope(listener)),
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
      onDidChangeActive: (listener) => track(core.modes.onDidChangeActive(listener)),
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
      onDidChange: (listener) => track(core.panels.onDidChange(listener)),
    },
    preferences: {
      ...core.preferences,
      registerSchema: (schema, metadata) =>
        track(core.preferences.registerSchema(schema, withModuleMetadata(input, metadata))),
    },
    renderers: {
      ...core.renderers,
      registerRenderer: (renderer) => track(core.renderers.registerRenderer(renderer)),
      registerTreeRenderer: (view, metadata) =>
        track(core.renderers.registerTreeRenderer(view, withModuleMetadata(input, metadata))),
      registerKanbanRenderer: (contribution, metadata) =>
        track(core.renderers.registerKanbanRenderer(contribution, withModuleMetadata(input, metadata))),
      registerDataTableRenderer: (contribution, metadata) =>
        track(core.renderers.registerDataTableRenderer(contribution, withModuleMetadata(input, metadata))),
      registerFileRenderer: (contribution, metadata) =>
        track(core.renderers.registerFileRenderer(contribution, withModuleMetadata(input, metadata))),
      registerControlsRenderer: (contribution, metadata) =>
        track(core.renderers.registerControlsRenderer(contribution, withModuleMetadata(input, metadata))),
      onDidChange: (listener) => track(core.renderers.onDidChange(listener)),
      onDidRefresh: (listener) => track(core.renderers.onDidRefresh(listener)),
    },
    resources: {
      ...core.resources,
      registerKind: (kind, metadata) => track(core.resources.registerKind(kind, withModuleMetadata(input, metadata))),
      registerHierarchyProvider: (provider) => track(core.resources.registerHierarchyProvider(provider)),
      registerPresenter: (presenter) => track(core.resources.registerPresenter(presenter)),
      registerProvider: (provider) => track(core.resources.registerProvider(provider)),
      onDidOpenResource: (listener) => track(core.resources.onDidOpenResource(listener)),
    },
    settings: {
      ...core.settings,
      registerSection: (section, metadata) =>
        track(core.settings.registerSection(section, withModuleMetadata(input, metadata))),
      registerPanel: (panel, metadata) =>
        track(core.settings.registerPanel(panel, withModuleMetadata(input, metadata))),
    },
    shell: {
      ...core.shell,
      onDidChange: (listener) => track(core.shell.onDidChange(listener)),
    },
    sidePanel: {
      ...core.sidePanel,
      onDidChange: (listener) => track(core.sidePanel.onDidChange(listener)),
    },
    themes: {
      ...core.themes,
      register: (themes) => track(core.themes.register(themes)),
    },
    fileIconThemes: {
      ...core.fileIconThemes,
      register: (themes) => track(core.fileIconThemes.register(themes)),
    },
  } satisfies WorkbenchModuleContributionContext;

  return context;
};
