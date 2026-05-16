import type { ContextKeyService } from "../../shared/context/context-key-service";
import {
  byContributionPriority,
  type ContributionMetadata,
  normalizeContributionMetadata,
  type RegisteredContributionMetadata,
} from "../../shared/contributions/metadata";
import { createDisposable, type Disposable } from "../../shared/disposable";
import { createWorkbenchStore, type WorkbenchStore } from "../../shared/store/workbench-store";
import type { CommandRegistry } from "../commands/command-registry";

export interface Keybinding {
  commandId: string;
  keybinding: string;
  when?: string;
  args?: unknown;
}

export interface RegisteredKeybinding extends Keybinding, RegisteredContributionMetadata {}

interface KeybindingRegistryDeps {
  commands: CommandRegistry;
  context: ContextKeyService;
}

export interface KeybindingRegistryStoreState {
  keybindings: RegisteredKeybinding[];
}

export interface KeybindingRegistry {
  store: WorkbenchStore<KeybindingRegistryStoreState>;
  registerKeybinding(keybinding: Keybinding, metadata?: ContributionMetadata): Disposable;
  listKeybindings(): RegisteredKeybinding[];
  listActiveKeybindings(): RegisteredKeybinding[];
}

export const createKeybindingRegistry = (deps: KeybindingRegistryDeps): KeybindingRegistry => {
  const store = createWorkbenchStore<KeybindingRegistryStoreState>({
    name: "workbench.keybindings",
    initialState: { keybindings: [] },
  });

  return {
    store,

    registerKeybinding(keybinding, metadata) {
      if (!deps.commands.getCommand(keybinding.commandId))
        throw new Error(`Keybinding command not registered: ${keybinding.commandId}`);

      const record: RegisteredKeybinding = {
        ...normalizeContributionMetadata(metadata),
        ...keybinding,
      };

      const snapshot = store.getState();
      store.setState({ keybindings: [...snapshot.keybindings, record] }, false, "registerKeybinding");

      return createDisposable(() => {
        const current = store.getState();
        const next = current.keybindings.filter((candidate) => candidate !== record);
        if (next.length === current.keybindings.length) return;
        store.setState({ keybindings: next }, false, "unregisterKeybinding");
      });
    },

    listKeybindings() {
      return [...store.getState().keybindings].sort(byContributionPriority);
    },

    listActiveKeybindings() {
      return store
        .getState()
        .keybindings.filter((keybinding) => deps.context.matches(keybinding.when))
        .sort(byContributionPriority);
    },
  };
};
