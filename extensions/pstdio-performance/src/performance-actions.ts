import type { PerformanceMonitoringState } from "@pstdio/sdk/extensions";

type RenderOverlay = PerformanceMonitoringState["renderOverlay"];
interface PerformanceActionsState {
  renderOverlay?: RenderOverlay;
  overlayIntent?: boolean;
  copying: boolean;
  pendingExtensions: ReadonlySet<string>;
}

interface PerformanceActionsInput {
  readOverlay(): Promise<RenderOverlay>;
  writeOverlay(enabled: boolean): Promise<unknown>;
  copy(): Promise<boolean>;
  setPaused(installedExtensionId: string, paused: boolean): Promise<void>;
}

export const createPerformanceActions = (input: PerformanceActionsInput) => {
  let state: PerformanceActionsState = { copying: false, pendingExtensions: new Set() };
  let overlayRevision = 0;
  const listeners = new Set<() => void>();
  const publish = (patch: Partial<PerformanceActionsState>) => {
    state = { ...state, ...patch };
    for (const listener of listeners) listener();
  };

  return {
    snapshot: () => state,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    async refreshOverlay(signal?: AbortSignal) {
      if (state.overlayIntent !== undefined || signal?.aborted) return;
      const revision = ++overlayRevision;
      const renderOverlay = await input.readOverlay().catch(() => undefined);
      if (revision === overlayRevision && !signal?.aborted) publish({ renderOverlay });
    },
    async setOverlay(enabled: boolean) {
      if (!state.renderOverlay?.supported || state.overlayIntent !== undefined) return;
      overlayRevision += 1;
      publish({ overlayIntent: enabled });
      try {
        try {
          await input.writeOverlay(enabled);
        } catch (error) {
          const renderOverlay = await input.readOverlay().catch(() => undefined);
          if (renderOverlay) publish({ renderOverlay });
          if (!renderOverlay?.supported || renderOverlay.enabled !== enabled) throw error;
          return;
        }
        publish({ renderOverlay: await input.readOverlay() });
      } finally {
        publish({ overlayIntent: undefined });
      }
    },
    async copy() {
      if (state.copying) return false;
      publish({ copying: true });
      try {
        return await input.copy();
      } finally {
        publish({ copying: false });
      }
    },
    async setPaused(installedExtensionId: string, paused: boolean) {
      if (state.pendingExtensions.has(installedExtensionId)) return;
      publish({ pendingExtensions: new Set([...state.pendingExtensions, installedExtensionId]) });
      try {
        await input.setPaused(installedExtensionId, paused);
      } finally {
        const next = new Set(state.pendingExtensions);
        next.delete(installedExtensionId);
        publish({ pendingExtensions: next });
      }
    },
  };
};
