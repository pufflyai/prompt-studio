import { createDisposable, type Disposable } from "../../shared/disposable";
import { createWorkbenchStore, type WorkbenchStore } from "../../shared/store/workbench-store";
import { runWorkbenchEffect } from "../../shared/workbench-effect";

export type WorkbenchStatusBarSlot = "leading" | "center" | "trailing";

export interface WorkbenchStatusBarItem {
  id: string;
  viewId: string;
  popoverViewId?: string;
  slot: WorkbenchStatusBarSlot;
  order?: number;
  isVisible?(): boolean;
}

export interface WorkbenchStatusBarRegistryState {
  items: Record<string, WorkbenchStatusBarItem>;
  order: string[];
  slots: Record<string, WorkbenchStatusBarSlot>;
}

export interface WorkbenchStatusBarPersistenceAdapter {
  getOrder(): string[] | undefined;
  setOrder(ids: string[]): void;
  getSlots?(): Record<string, WorkbenchStatusBarSlot> | undefined;
  setSlots?(slots: Record<string, WorkbenchStatusBarSlot>): void;
}

export type WorkbenchStatusBarPosition = { beforeItemId: string } | { afterItemId: string };

export interface WorkbenchStatusBarRegistry {
  store: WorkbenchStore<WorkbenchStatusBarRegistryState>;
  registerItem(item: WorkbenchStatusBarItem): Disposable;
  getItem(id: string): WorkbenchStatusBarItem | undefined;
  listItems(): WorkbenchStatusBarItem[];
  listVisibleItems(slot?: WorkbenchStatusBarSlot): WorkbenchStatusBarItem[];
  reorderItem(id: string, position: WorkbenchStatusBarPosition): void;
  moveItem(id: string, slot: WorkbenchStatusBarSlot, position?: WorkbenchStatusBarPosition): void;
}

export interface CreateWorkbenchStatusBarRegistryInput {
  hasView(viewId: string): boolean;
  persistence?: WorkbenchStatusBarPersistenceAdapter;
}

const slotRank = { leading: 0, center: 1, trailing: 2 };

export const createStatusBarRegistry = (input: CreateWorkbenchStatusBarRegistryInput): WorkbenchStatusBarRegistry => {
  const store = createWorkbenchStore<WorkbenchStatusBarRegistryState>({
    name: "workbench.statusBar",
    initialState: {
      items: {},
      order: runWorkbenchEffect("status bar order read", () => input.persistence?.getOrder()) ?? [],
      slots: runWorkbenchEffect("status bar alignment read", () => input.persistence?.getSlots?.()) ?? {},
    },
  });

  const placed = (item: WorkbenchStatusBarItem) => {
    const slot = store.getState().slots[item.id] ?? item.slot;
    return slot === item.slot ? item : { ...item, slot };
  };
  const listItems = () => {
    const { items, order } = store.getState();
    const rank = new Map(order.map((id, index) => [id, index]));
    return Object.values(items)
      .map(placed)
      .sort((left, right) => {
        const leftRank = rank.get(left.id) ?? Infinity;
        const rightRank = rank.get(right.id) ?? Infinity;
        return (
          slotRank[left.slot] - slotRank[right.slot] ||
          leftRank - rightRank ||
          (left.order ?? 0) - (right.order ?? 0) ||
          left.id.localeCompare(right.id)
        );
      });
  };

  const moveItem = (id: string, slot: WorkbenchStatusBarSlot, position?: WorkbenchStatusBarPosition) => {
    const snapshot = store.getState();
    if (!snapshot.items[id]) return;
    const targetId = position && ("beforeItemId" in position ? position.beforeItemId : position.afterItemId);
    if (targetId && (id === targetId || !snapshot.items[targetId] || placed(snapshot.items[targetId]).slot !== slot))
      return;
    // Retain preferences for absent owners so replacement restores the person's layout.
    const order = [...new Set([...snapshot.order, ...listItems().map((item) => item.id)])].filter((key) => key !== id);
    const index = targetId ? order.indexOf(targetId) + (position && "afterItemId" in position ? 1 : 0) : order.length;
    order.splice(index, 0, id);
    const slots = { ...snapshot.slots, [id]: slot };
    store.setState({ order, slots }, false, "moveItem");
    runWorkbenchEffect("status bar order write", () => input.persistence?.setOrder(order));
    runWorkbenchEffect("status bar alignment write", () => input.persistence?.setSlots?.(slots));
  };

  return {
    store,

    registerItem(item) {
      const current = store.getState();
      if (current.items[item.id]) throw new Error(`Status bar item already registered: ${item.id}`);
      if (!input.hasView(item.viewId)) throw new Error(`Status bar view is not registered: ${item.viewId}`);
      if (item.popoverViewId && !input.hasView(item.popoverViewId)) {
        throw new Error(`Status bar popover view is not registered: ${item.popoverViewId}`);
      }
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
      const item = store.getState().items[id];
      return item && placed(item);
    },

    listItems,
    moveItem,

    reorderItem(id, position) {
      const snapshot = store.getState();
      const targetId = "beforeItemId" in position ? position.beforeItemId : position.afterItemId;
      const item = snapshot.items[id];
      const target = snapshot.items[targetId];
      if (!item || !target || item.id === target.id) return;
      if (placed(item).slot !== placed(target).slot) return;
      moveItem(id, placed(item).slot, position);
    },

    listVisibleItems(slot) {
      return listItems().filter((item) => (!slot || item.slot === slot) && (item.isVisible?.() ?? true));
    },
  };
};
