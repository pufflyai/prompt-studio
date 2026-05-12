import {
  byContributionPriority,
  type ContributionMetadata,
  normalizeContributionMetadata,
  type RegisteredContributionMetadata,
} from "../contributions/metadata";
import { createDisposable } from "../disposable";

export type LifecyclePhase = "activate" | "deactivate" | "reload" | string;
export type LifecycleHook = () => void | Promise<void>;

interface RegisteredLifecycleHook extends RegisteredContributionMetadata {
  hook: LifecycleHook;
}

export const createLifecycleRegistry = () => {
  const hooksByPhase = new Map<LifecyclePhase, RegisteredLifecycleHook[]>();

  return {
    registerHook(phase: LifecyclePhase, hook: LifecycleHook, metadata?: ContributionMetadata) {
      const record = {
        ...normalizeContributionMetadata(metadata),
        hook,
      };
      const hooks = hooksByPhase.get(phase) ?? [];

      hooks.push(record);
      hooksByPhase.set(phase, hooks);

      return createDisposable(() => {
        const current = hooksByPhase.get(phase) ?? [];
        hooksByPhase.set(
          phase,
          current.filter((candidate) => candidate !== record),
        );
      });
    },

    async runHooks(phase: LifecyclePhase) {
      const hooks = [...(hooksByPhase.get(phase) ?? [])].sort(byContributionPriority);
      for (const hook of hooks) await hook.hook();
    },
  };
};

export type LifecycleRegistry = ReturnType<typeof createLifecycleRegistry>;
