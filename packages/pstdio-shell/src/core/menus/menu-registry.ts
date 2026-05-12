import type { CommandRegistry } from "../commands/command-registry";
import {
  byContributionPriority,
  type ContributionMetadata,
  normalizeContributionMetadata,
  type RegisteredContributionMetadata,
} from "../contributions/metadata";
import { createDisposable } from "../disposable";

export type MenuPath = readonly string[];

export interface MenuAction {
  commandId: string;
  label?: string;
  icon?: string;
  when?: string;
  group?: string;
  order?: number;
  args?: unknown;
}

export interface RegisteredMenuAction extends MenuAction, RegisteredContributionMetadata {
  path: MenuPath;
}

interface MenuRegistryDeps {
  commands: CommandRegistry;
}

const menuPathKey = (path: MenuPath) => path.join("/");

export const createMenuRegistry = (deps: MenuRegistryDeps) => {
  const actionsByPath = new Map<string, RegisteredMenuAction[]>();

  return {
    registerMenuAction(path: MenuPath, action: MenuAction, metadata?: ContributionMetadata) {
      if (!deps.commands.getCommand(action.commandId))
        throw new Error(`Menu command not registered: ${action.commandId}`);

      const key = menuPathKey(path);
      const record = {
        ...normalizeContributionMetadata(metadata),
        ...action,
        path,
      };
      const actions = actionsByPath.get(key) ?? [];

      actions.push(record);
      actionsByPath.set(key, actions);

      return createDisposable(() => {
        const current = actionsByPath.get(key) ?? [];
        actionsByPath.set(
          key,
          current.filter((item) => item !== record),
        );
      });
    },

    listMenuActions(path: MenuPath) {
      return [...(actionsByPath.get(menuPathKey(path)) ?? [])].sort((left, right) => {
        const leftOrder = left.order ?? 0;
        const rightOrder = right.order ?? 0;
        return leftOrder - rightOrder || byContributionPriority(left, right);
      });
    },
  };
};

export type MenuRegistry = ReturnType<typeof createMenuRegistry>;
