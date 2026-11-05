import type { SettingsRegistry } from "../../core";

export interface SettingsDraft {
  title: string;
  dirty: boolean;
  saving?: boolean;
  disabled?: boolean;
  save: () => void | Promise<void>;
  reset: () => void | Promise<void>;
}
interface Warning {
  title: string;
  saving: boolean;
  error?: string;
}
export const createSettingsLeaveGuard = () => {
  const drafts = new Set<SettingsDraft>();
  const listeners = new Set<() => void>();
  let warning: Warning | null = null;
  let actions: SettingsDraft | undefined;
  const changed = () => {
    const first = [...drafts][0];
    actions = first
      ? {
          title: first.title,
          dirty: [...drafts].some((draft) => draft.dirty),
          saving: [...drafts].some((draft) => draft.saving),
          disabled: [...drafts].some((draft) => draft.dirty && draft.disabled),
          save: async () => {
            for (const draft of drafts) if (draft.dirty) await draft.save();
          },
          reset: async () => {
            for (const draft of drafts) if (draft.dirty) await draft.reset();
          },
        }
      : undefined;
    for (const listener of listeners) listener();
  };
  let resolve: ((leave: boolean) => void) | undefined;
  const publish = (next: Warning | null) => {
    warning = next;
    for (const listener of listeners) listener();
  };
  const finish = (leave: boolean) => {
    const complete = resolve;
    resolve = undefined;
    publish(null);
    complete?.(leave);
  };
  return {
    getSnapshot: () => warning,
    getActions: () => actions,
    changed,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    register(draft: SettingsDraft) {
      drafts.add(draft);
      changed();
      return () => {
        drafts.delete(draft);
        changed();
      };
    },
    isDirty: () => [...drafts].some((draft) => draft.dirty),
    request() {
      if (resolve || [...drafts].some((draft) => draft.saving)) return Promise.resolve(false);
      const dirty = [...drafts].find((draft) => draft.dirty);
      if (!dirty) return Promise.resolve(true);
      const pending = new Promise<boolean>((done) => {
        resolve = done;
      });
      publish({ title: dirty.title, saving: false });
      return pending;
    },
    stay() {
      if (!warning?.saving) finish(false);
    },
    async leave(save: boolean) {
      if (!resolve || warning?.saving) return;
      publish({ title: warning!.title, saving: true });
      try {
        for (const draft of [...drafts].filter((entry) => entry.dirty)) {
          if (save) await draft.save();
          else await draft.reset();
        }
        finish(true);
      } catch (error) {
        publish({
          title: warning!.title,
          saving: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    },
  };
};
const guards = new WeakMap<SettingsRegistry["store"], ReturnType<typeof createSettingsLeaveGuard>>();
export const settingsLeaveGuard = (workbench: { settings: SettingsRegistry }) => {
  let guard = guards.get(workbench.settings.store);
  if (!guard) {
    guard = createSettingsLeaveGuard();
    guards.set(workbench.settings.store, guard);
  }
  return guard;
};
