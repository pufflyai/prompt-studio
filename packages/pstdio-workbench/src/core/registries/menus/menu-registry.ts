import {
  byContributionPriority,
  type ContributionMetadata,
  normalizeContributionMetadata,
  type RegisteredContributionMetadata,
} from "../../shared/contributions/metadata";
import { createDisposable, type Disposable } from "../../shared/disposable";
import { createWorkbenchStore, type WorkbenchStore } from "../../shared/store/workbench-store";
import type { CommandRegistry } from "../commands/command-registry";

export type MenuPath = readonly string[];

export interface MenuAction {
  commandId: string;
  label?: string;
  icon?: string;
  overflowLabel?: string;
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

export interface MenuRegistryStoreState {
  actionsByPath: Record<string, RegisteredMenuAction[]>;
}

export interface MenuRegistry {
  store: WorkbenchStore<MenuRegistryStoreState>;
  registerMenuAction(path: MenuPath, action: MenuAction, metadata?: ContributionMetadata): Disposable;
  listMenuActions(path: MenuPath): RegisteredMenuAction[];
}

export const createMenuRegistry = (deps: MenuRegistryDeps): MenuRegistry => {
  const store = createWorkbenchStore<MenuRegistryStoreState>({
    name: "workbench.menus",
    initialState: { actionsByPath: {} },
  });

  return {
    store,

    registerMenuAction(path, action, metadata) {
      if (!deps.commands.getCommand(action.commandId))
        throw new Error(`Menu command not registered: ${action.commandId}`);

      const key = menuPathKey(path);
      const record: RegisteredMenuAction = {
        ...normalizeContributionMetadata(metadata),
        ...action,
        path,
      };
      const snapshot = store.getState();
      const actions = snapshot.actionsByPath[key] ?? [];
      store.setState(
        {
          actionsByPath: { ...snapshot.actionsByPath, [key]: [...actions, record] },
        },
        false,
        "registerMenuAction",
      );

      return createDisposable(() => {
        const current = store.getState();
        const list = current.actionsByPath[key] ?? [];
        const filtered = list.filter((item) => item !== record);
        if (filtered.length === list.length) return;
        store.setState(
          {
            actionsByPath: { ...current.actionsByPath, [key]: filtered },
          },
          false,
          "unregisterMenuAction",
        );
      });
    },

    listMenuActions(path) {
      return [...(store.getState().actionsByPath[menuPathKey(path)] ?? [])].sort((left, right) => {
        const leftOrder = left.order ?? 0;
        const rightOrder = right.order ?? 0;
        return leftOrder - rightOrder || byContributionPriority(left, right);
      });
    },
  };
};
