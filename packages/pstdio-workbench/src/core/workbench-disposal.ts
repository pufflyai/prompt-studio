import { disposeWorkbenchPageRuntime } from "./controllers/page-runtime/page-runtime-lifetime";
import { closeWorkbenchModes } from "./registries/modes/mode-registry-internals";
import type { Disposable } from "./shared/disposable";
import { disposeWorkbenchStore } from "./shared/store/workbench-store";
import { disposePlacementTextGuests } from "./text-editing/placement-text-guests";
import { disposeLayoutPersistence } from "./workbench-core-persistence";
import type { createWorkbenchInput, WorkbenchCore, WorkbenchRenderers } from "./workbench-core-types";
import { closeWorkbenchRequiredWork, disposeWorkbenchRequiredWork } from "./workbench-required-work";

const stopObservation = (core: WorkbenchCore, renderers: WorkbenchRenderers) => {
  for (const owner of [
    core.activation,
    core.breadcrumbs,
    core.commandPalette,
    core.commandPaletteResources,
    core.commands,
    core.context,
    core.focus,
    core.fullscreen,
    core.keyboard,
    core.keybindings,
    core.layout,
    core.modes,
    core.navigation,
    core.notifications,
    core.pages,
    core.panelMenuState,
    core.preferences,
    core.resources,
    core.settings,
    core.statusBar,
    core.statuses,
    core.themes,
    core.fileIconThemes,
    core.terminal,
    core.views,
    renderers,
  ])
    disposeWorkbenchStore(owner.store);
  for (const store of [
    core.layout.menuStore,
    core.pageLocations.historyStore,
    renderers.treeStore,
    renderers.dataStore,
    renderers.dataTableStore,
    renderers.fileRendererStore,
    renderers.controlsStore,
  ])
    disposeWorkbenchStore(store);
};

/** Stop optional effects first; required document work drains before contributions are released. */
export const createWorkbenchDisposal = (
  core: WorkbenchCore,
  input: {
    renderers: WorkbenchRenderers;
    persistence: createWorkbenchInput["layoutPersistence"];
    modules: Disposable & { close(): void };
    stopRuntime(): void;
    location: Disposable;
    viewers: Disposable;
    queries: Disposable;
  },
) => {
  let pending: Promise<void> | undefined;
  const dispose = async () => {
    const errors: unknown[] = [];
    const release = (effect: () => void) => {
      try {
        effect();
      } catch (error) {
        errors.push(error);
      }
    };
    input.modules.close();
    closeWorkbenchModes(core.modes);
    // Close required write admission before terminal adapters can synchronously reenter editing or preferences.
    closeWorkbenchRequiredWork(core);
    const preferences = core.preferences.dispose?.();
    const terminals = Promise.allSettled([core.terminal.dispose()]);
    const domainWork = disposeWorkbenchRequiredWork(core);
    stopObservation(core, input.renderers);
    for (const effect of [
      () => disposeWorkbenchPageRuntime(core.pages),
      input.stopRuntime,
      () => input.location.dispose(),
      () => core.pageLocations.dispose(),
      () => input.viewers.dispose(),
      () => core.navigationTrees.dispose?.(),
    ])
      release(effect);
    const reads = Promise.allSettled([core.views.reads.dispose()]);
    const required = await Promise.allSettled([domainWork, disposePlacementTextGuests(core), preferences]);
    // Persist the user's last layout before unregistering its contributions.
    release(() => disposeLayoutPersistence(input.persistence));
    for (const effect of [
      () => input.modules.dispose(),
      () => core.modes.dispose(),
      () => core.shellPlacements.dispose?.(),
      () => core.modePlacements.dispose?.(),
      () => core.presence.dispose(),
    ])
      release(effect);
    const [stoppedReads, terminal] = await Promise.all([reads, terminals]);
    release(() => input.queries.dispose());
    for (const result of [...required, ...stoppedReads, ...terminal])
      if (result.status === "rejected") errors.push(result.reason);
    if (errors.length === 1) throw errors[0];
    if (errors.length > 1) throw new AggregateError(errors, "Workbench disposal failed");
  };
  return () => {
    if (pending) return pending;
    const settled = Promise.withResolvers<void>();
    pending = settled.promise;
    // Publish the barrier before external teardown can reenter core.dispose().
    void dispose().then(settled.resolve, settled.reject);
    return pending;
  };
};
