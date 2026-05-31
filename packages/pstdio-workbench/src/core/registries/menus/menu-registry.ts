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

export interface MenuItem {
  commandId: string;
  label?: string;
  description?: string;
  icon?: string;
  iconSrc?: string;
  overflowLabel?: string;
  when?: string;
  group?: string;
  order?: number;
  args?: unknown;
  readOnly?: boolean;
  /** Marks a menu action that navigates outside the app, rendered with a trailing external-link icon. */
  external?: boolean;
}

export interface RegisteredMenuItem extends MenuItem, RegisteredContributionMetadata {
  path: MenuPath;
}

interface MenuRegistryDeps {
  commands: CommandRegistry;
}

const menuPathKey = (path: MenuPath) => path.join("/");

export interface MenuRegistryStoreState {
  itemsByPath: Record<string, RegisteredMenuItem[]>;
}

export interface MenuRegistry {
  menuStore: WorkbenchStore<MenuRegistryStoreState>;
  registerMenuItem(path: MenuPath, item: MenuItem, metadata?: ContributionMetadata): Disposable;
  listMenuItems(path: MenuPath): RegisteredMenuItem[];
}

export const createMenuRegistry = (deps: MenuRegistryDeps): MenuRegistry => {
  const menuStore = createWorkbenchStore<MenuRegistryStoreState>({
    name: "workbench.menus",
    initialState: { itemsByPath: {} },
  });

  return {
    menuStore,

    registerMenuItem(path, item, metadata) {
      if (!deps.commands.getCommand(item.commandId)) throw new Error(`Menu command not registered: ${item.commandId}`);

      const key = menuPathKey(path);
      const record: RegisteredMenuItem = {
        ...normalizeContributionMetadata(metadata),
        ...item,
        path,
      };
      const snapshot = menuStore.getState();
      const items = snapshot.itemsByPath[key] ?? [];
      menuStore.setState(
        {
          itemsByPath: { ...snapshot.itemsByPath, [key]: [...items, record] },
        },
        false,
        "registerMenuItem",
      );

      return createDisposable(() => {
        const current = menuStore.getState();
        const list = current.itemsByPath[key] ?? [];
        const filtered = list.filter((entry) => entry !== record);
        if (filtered.length === list.length) return;
        menuStore.setState(
          {
            itemsByPath: { ...current.itemsByPath, [key]: filtered },
          },
          false,
          "unregisterMenuItem",
        );
      });
    },

    listMenuItems(path) {
      return [...(menuStore.getState().itemsByPath[menuPathKey(path)] ?? [])].sort((left, right) => {
        const leftOrder = left.order ?? 0;
        const rightOrder = right.order ?? 0;
        return leftOrder - rightOrder || byContributionPriority(left, right);
      });
    },
  };
};
