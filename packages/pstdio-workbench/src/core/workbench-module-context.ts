import type { ResourceRef } from "./registries/resources/resource-registry";
import type { ContributionMetadata, ContributionSource } from "./shared/contributions/metadata";
import type { Disposable } from "./shared/disposable";
import { createDisposable } from "./shared/disposable";
import type { WorkbenchCore, WorkbenchModuleContribution, WorkbenchModuleContributionContext } from "./workbench-core";

type WorkbenchModuleActivationResult = Disposable | readonly Disposable[] | undefined;

const withModuleMetadata = (
  input: { ownerId: string; source: ContributionSource },
  metadata?: ContributionMetadata,
) => ({
  ...metadata,
  source: input.source,
  ownerId: input.ownerId,
});

export const toDisposables = (result: WorkbenchModuleActivationResult) => {
  if (!result) return [] as Disposable[];
  return Array.isArray(result) ? [...result] : [result as Disposable];
};

export const disposeDisposables = (disposables: Disposable[]) => {
  for (let index = disposables.length - 1; index >= 0; index -= 1) disposables[index]?.dispose();
};

interface CreateModuleContextInput {
  ownerId: string;
  source: ContributionSource;
  track(disposable: Disposable): void;
}

export const createModuleContext = (
  core: WorkbenchCore,
  input: CreateModuleContextInput,
): WorkbenchModuleContributionContext => {
  const contextScope = core.context.createScope(input.ownerId);
  input.track(contextScope);

  const track = <TDisposable extends Disposable>(disposable: TDisposable) => {
    input.track(disposable);
    return disposable;
  };

  const {
    openPanel: _openPanel,
    openWidget: _openWidget,
    registerPanel: _registerPanel,
    registerPanelMenu: _registerPanelMenu,
    registerPlaceholder: _registerPlaceholder,
    registerWidget: _registerWidget,
    ...moduleLayout
  } = core.layout;
  return {
    ...core,
    registerChildModule: (module: WorkbenchModuleContribution) => track(core.registerModule(module)),
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
    layout: {
      ...moduleLayout,
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
                track: (disposable) => modeDisposables.push(disposable),
              });
              const returnedDisposables = toDisposables(mode.activate(modeContext));
              return createDisposable(() => disposeDisposables([...modeDisposables, ...returnedDisposables]));
            },
          }),
        ),
      onDidChangeActive: (listener) => track(core.modes.onDidChangeActive(listener)),
    },
    modePlacements: {
      ...core.modePlacements,
      registerPlacement: (placement) => track(core.modePlacements.registerPlacement(placement)),
      onDidChange: (listener) => track(core.modePlacements.onDidChange(listener)),
    },
    shellPlacements: {
      ...core.shellPlacements,
      registerPlacement: (placement) => track(core.shellPlacements.registerPlacement(placement)),
      onDidChange: (listener) => track(core.shellPlacements.onDidChange(listener)),
    },
    navigation: {
      ...core.navigation,
      registerParser: (parser, metadata) =>
        track(core.navigation.registerParser(parser, withModuleMetadata(input, metadata))),
    },
    navigationTrees: {
      ...core.navigationTrees,
      registerContribution: (contribution) => track(core.navigationTrees.registerContribution(contribution)),
      onDidChange: (listener) => track(core.navigationTrees.onDidChange(listener)),
    },
    notifications: {
      ...core.notifications,
      show: (notification, metadata) => core.notifications.show(notification, withModuleMetadata(input, metadata)),
    },
    overlays: {
      ...core.overlays,
      registerOverlay: (overlay) => track(core.overlays.registerOverlay(overlay)),
    },
    placeholders: {
      ...core.placeholders,
      registerPlaceholder: (placeholder, metadata) =>
        track(core.placeholders.registerPlaceholder(placeholder, withModuleMetadata(input, metadata))),
    },
    pages: {
      ...core.pages,
      registerPage: (page) => track(core.pages.registerPage(page)),
    },
    panelMenuState: {
      ...core.panelMenuState,
      onDidChange: (listener) => track(core.panelMenuState.onDidChange(listener)),
    },
    preferences: {
      ...core.preferences,
      registerSchema: (schema, metadata) =>
        track(core.preferences.registerSchema(schema, withModuleMetadata(input, metadata))),
    },
    resources: {
      ...core.resources,
      registerKind: (kind, metadata) => track(core.resources.registerKind(kind, withModuleMetadata(input, metadata))),
      registerHierarchyProvider: (provider) => track(core.resources.registerHierarchyProvider(provider)),
      registerProvider: (provider) => track(core.resources.registerProvider(provider)),
    },
    views: {
      ...core.views,
      registerView: (view, metadata) => track(core.views.registerView(view, withModuleMetadata(input, metadata))),
    },
    viewMenus: {
      ...core.viewMenus,
      registerViewMenu: (menu) => track(core.viewMenus.registerViewMenu(menu)),
    },
    settings: {
      ...core.settings,
      registerSection: (section, metadata) =>
        track(core.settings.registerSection(section, withModuleMetadata(input, metadata))),
      registerPanel: (panel, metadata) =>
        track(core.settings.registerPanel(panel, withModuleMetadata(input, metadata))),
    },
    statusBar: {
      ...core.statusBar,
      registerItem: (item) => track(core.statusBar.registerItem(item)),
    },
    statuses: {
      ...core.statuses,
      registerStatusSet: (statusSet, metadata) =>
        track(core.statuses.registerStatusSet(statusSet, withModuleMetadata(input, metadata))),
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
};
