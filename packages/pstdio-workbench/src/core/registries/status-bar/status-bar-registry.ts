import { createDisposable, type Disposable } from "../../shared/disposable";
import { createWorkbenchStore, type WorkbenchStore } from "../../shared/store/workbench-store";
import { runWorkbenchEffect } from "../../shared/workbench-effect";

export type WorkbenchStatusBarSlot = "leading" | "trailing";

export interface WorkbenchStatusBarItem {
  id: string;
  viewId: string;
  slot: WorkbenchStatusBarSlot;
  order?: number;
  isVisible?(): boolean;
}

export interface WorkbenchStatusBarRegistryState {
  items: Record<string, WorkbenchStatusBarItem>;
  order: string[];
}

export interface WorkbenchStatusBarPersistenceAdapter {
  getOrder(): string[] | undefined;
  setOrder(ids: string[]): void;
}

export type WorkbenchStatusBarPosition = { beforeItemId: string } | { afterItemId: string };

export interface WorkbenchStatusBarRegistry {
  store: WorkbenchStore<WorkbenchStatusBarRegistryState>;
  registerItem(item: WorkbenchStatusBarItem): Disposable;
  getItem(id: string): WorkbenchStatusBarItem | undefined;
  listItems(): WorkbenchStatusBarItem[];
  listVisibleItems(slot?: WorkbenchStatusBarSlot): WorkbenchStatusBarItem[];
  reorderItem(id: string, position: WorkbenchStatusBarPosition): void;
}

export interface CreateWorkbenchStatusBarRegistryInput {
  hasView(viewId: string): boolean;
  persistence?: WorkbenchStatusBarPersistenceAdapter;
}

const bySlotOrderAndId = (left: WorkbenchStatusBarItem, right: WorkbenchStatusBarItem) =>
  left.slot.localeCompare(right.slot) || (left.order ?? 0) - (right.order ?? 0) || left.id.localeCompare(right.id);

export const createStatusBarRegistry = (input: CreateWorkbenchStatusBarRegistryInput): WorkbenchStatusBarRegistry => {
  const store = createWorkbenchStore<WorkbenchStatusBarRegistryState>({
    name: "workbench.statusBar",
    initialState: {
      items: {},
      order: runWorkbenchEffect("status bar order read", () => input.persistence?.getOrder()) ?? [],
    },
  });

  const listItems = () => {
    const { items, order } = store.getState();
    const rank = new Map(order.map((id, index) => [id, index]));
    return Object.values(items).sort((left, right) => {
      const leftRank = rank.get(left.id) ?? Infinity;
      const rightRank = rank.get(right.id) ?? Infinity;
      return left.slot.localeCompare(right.slot) || leftRank - rightRank || bySlotOrderAndId(left, right);
    });
  };

  return {
    store,

    registerItem(item) {
      const current = store.getState();
      if (current.items[item.id]) throw new Error(`Status bar item already registered: ${item.id}`);
      if (!input.hasView(item.viewId)) throw new Error(`Status bar view is not registered: ${item.viewId}`);
      if (item.order !== undefined && !Number.isFinite(item.order)) {
        throw new Error(`Status bar item order must be finite: ${item.id}`);
      }

      store.setState({ items: { ...current.items, [item.id]: item } }, false, "registerItem");
      return createDisposable(() => {
        const snapshot = store.getState();
        if (snapshot.items[item.id] !== item) return;
        const { [item.id]: _removed, ...items } = snapshot.items;
        store.setState({ items }, false, "unregisterItem");
      });
    },

    getItem(id) {
      return store.getState().items[id];
    },

    listItems,

    reorderItem(id, position) {
      const snapshot = store.getState();
      const targetId = "beforeItemId" in position ? position.beforeItemId : position.afterItemId;
      const item = snapshot.items[id];
      const target = snapshot.items[targetId];
      if (!item || !target || item.id === target.id || item.slot !== target.slot) return;
      // Keep disabled owners in the preference so re-registering them restores their place.
      const ids = [...new Set([...snapshot.order, ...listItems().map((entry) => entry.id)])].filter(
        (entry) => entry !== id,
      );
      ids.splice(ids.indexOf(targetId) + ("afterItemId" in position ? 1 : 0), 0, id);
      store.setState({ order: ids }, false, "reorderItem");
      runWorkbenchEffect("status bar order write", () => input.persistence?.setOrder(ids));
    },

    listVisibleItems(slot) {
      return listItems().filter((item) => (!slot || item.slot === slot) && (item.isVisible?.() ?? true));
    },
  };
};
