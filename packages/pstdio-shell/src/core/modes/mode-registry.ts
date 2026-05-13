import { createDisposable, type Disposable } from "../disposable";
import type { ShellCoreContributionContext } from "../shell-core";

export type ShellModeActivationContext = ShellCoreContributionContext;

export type ShellModeActivationResult = Disposable | readonly Disposable[] | undefined;

export interface ShellModeContribution {
  id: string;
  label?: string;
  activate(ctx: ShellModeActivationContext): ShellModeActivationResult;
}

export type ShellModeChangeListener = () => void;

export interface ShellModeRegistry {
  registerMode(mode: ShellModeContribution): Disposable;
  getMode(id: string): ShellModeContribution | undefined;
  listModes(): ShellModeContribution[];
  getActiveModeId(): string | undefined;
  setActiveMode(id: string | undefined): void;
  onDidChangeActive(listener: ShellModeChangeListener): Disposable;
}

const toDisposables = (result: ShellModeActivationResult) => {
  if (!result) return [] as Disposable[];
  return Array.isArray(result) ? [...result] : [result as Disposable];
};

export interface CreateShellModeRegistryInput {
  resolveContext(): ShellModeActivationContext;
}

export const createShellModeRegistry = (input: CreateShellModeRegistryInput): ShellModeRegistry => {
  const modes = new Map<string, ShellModeContribution>();
  const listeners = new Set<ShellModeChangeListener>();
  let activeModeId: string | undefined;
  let activeDisposables: Disposable[] = [];

  const notify = () => {
    for (const listener of listeners) listener();
  };

  const disposeActive = () => {
    for (let index = activeDisposables.length - 1; index >= 0; index -= 1) {
      activeDisposables[index]?.dispose();
    }
    activeDisposables = [];
    activeModeId = undefined;
  };

  const activate = (id: string) => {
    const mode = modes.get(id);
    if (!mode) throw new Error(`Shell mode not registered: ${id}`);

    activeDisposables = toDisposables(mode.activate(input.resolveContext()));
    activeModeId = id;
  };

  return {
    registerMode(mode) {
      if (modes.has(mode.id)) throw new Error(`Shell mode already registered: ${mode.id}`);

      modes.set(mode.id, mode);

      return createDisposable(() => {
        if (modes.get(mode.id) !== mode) return;
        if (activeModeId === mode.id) {
          disposeActive();
          notify();
        }
        modes.delete(mode.id);
      });
    },

    getMode(id) {
      return modes.get(id);
    },

    listModes() {
      return [...modes.values()];
    },

    getActiveModeId() {
      return activeModeId;
    },

    setActiveMode(id) {
      if (id === activeModeId) return;

      disposeActive();
      if (id !== undefined) activate(id);
      notify();
    },

    onDidChangeActive(listener) {
      listeners.add(listener);
      return createDisposable(() => {
        listeners.delete(listener);
      });
    },
  };
};
