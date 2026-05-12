import type { CommandRegistry } from "../commands/command-registry";
import type { ContextKeyService } from "../context/context-key-service";
import {
  byContributionPriority,
  type ContributionMetadata,
  normalizeContributionMetadata,
  type RegisteredContributionMetadata,
} from "../contributions/metadata";
import { createDisposable } from "../disposable";

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

export const createKeybindingRegistry = (deps: KeybindingRegistryDeps) => {
  const keybindings: RegisteredKeybinding[] = [];

  return {
    registerKeybinding(keybinding: Keybinding, metadata?: ContributionMetadata) {
      if (!deps.commands.getCommand(keybinding.commandId))
        throw new Error(`Keybinding command not registered: ${keybinding.commandId}`);

      const record = {
        ...normalizeContributionMetadata(metadata),
        ...keybinding,
      };

      keybindings.push(record);

      return createDisposable(() => {
        const index = keybindings.indexOf(record);
        if (index >= 0) keybindings.splice(index, 1);
      });
    },

    listKeybindings() {
      return [...keybindings].sort(byContributionPriority);
    },

    listActiveKeybindings() {
      return keybindings.filter((keybinding) => deps.context.matches(keybinding.when)).sort(byContributionPriority);
    },
  };
};

export type KeybindingRegistry = ReturnType<typeof createKeybindingRegistry>;
