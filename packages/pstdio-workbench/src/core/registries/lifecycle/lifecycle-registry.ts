import {
  byContributionPriority,
  type ContributionMetadata,
  normalizeContributionMetadata,
  type RegisteredContributionMetadata,
} from "../../shared/contributions/metadata";
import { createDisposable, type Disposable } from "../../shared/disposable";
import { createWorkbenchStore, type WorkbenchStore } from "../../shared/store/workbench-store";

export type LifecyclePhase = "activate" | "deactivate" | "reload" | string;
export type LifecycleHook = () => void | Promise<void>;

interface RegisteredLifecycleHook extends RegisteredContributionMetadata {
  hook: LifecycleHook;
}

export interface LifecycleRegistryStoreState {
  hooksByPhase: Record<LifecyclePhase, RegisteredLifecycleHook[]>;
}

export interface LifecycleRegistry {
  store: WorkbenchStore<LifecycleRegistryStoreState>;
  registerHook(phase: LifecyclePhase, hook: LifecycleHook, metadata?: ContributionMetadata): Disposable;
  runHooks(phase: LifecyclePhase): Promise<void>;
}

export const createLifecycleRegistry = (): LifecycleRegistry => {
  const store = createWorkbenchStore<LifecycleRegistryStoreState>({
    name: "workbench.lifecycle",
    initialState: { hooksByPhase: {} },
  });

  return {
    store,

    registerHook(phase, hook, metadata) {
      const record: RegisteredLifecycleHook = {
        ...normalizeContributionMetadata(metadata),
        hook,
      };
      const snapshot = store.getState();
      const hooks = snapshot.hooksByPhase[phase] ?? [];
      store.setState(
        {
          hooksByPhase: { ...snapshot.hooksByPhase, [phase]: [...hooks, record] },
        },
        false,
        "registerHook",
      );

      return createDisposable(() => {
        const current = store.getState();
        const list = current.hooksByPhase[phase] ?? [];
        const filtered = list.filter((candidate) => candidate !== record);
        if (filtered.length === list.length) return;
        store.setState(
          {
            hooksByPhase: { ...current.hooksByPhase, [phase]: filtered },
          },
          false,
          "unregisterHook",
        );
      });
    },

    async runHooks(phase) {
      const hooks = [...(store.getState().hooksByPhase[phase] ?? [])].sort(byContributionPriority);
      for (const hook of hooks) await hook.hook();
    },
  };
};
