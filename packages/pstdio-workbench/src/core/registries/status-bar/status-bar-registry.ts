import { createDisposable, type Disposable } from "../../shared/disposable";
import { createWorkbenchStore, type WorkbenchStore } from "../../shared/store/workbench-store";

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
}

export interface WorkbenchStatusBarRegistry {
  store: WorkbenchStore<WorkbenchStatusBarRegistryState>;
  registerItem(item: WorkbenchStatusBarItem): Disposable;
  getItem(id: string): WorkbenchStatusBarItem | undefined;
  listItems(): WorkbenchStatusBarItem[];
  listVisibleItems(slot?: WorkbenchStatusBarSlot): WorkbenchStatusBarItem[];
}

export interface CreateWorkbenchStatusBarRegistryInput {
  hasView(viewId: string): boolean;
}

const bySlotOrderAndId = (left: WorkbenchStatusBarItem, right: WorkbenchStatusBarItem) =>
  left.slot.localeCompare(right.slot) || (left.order ?? 0) - (right.order ?? 0) || left.id.localeCompare(right.id);

export const createStatusBarRegistry = (input: CreateWorkbenchStatusBarRegistryInput): WorkbenchStatusBarRegistry => {
  const store = createWorkbenchStore<WorkbenchStatusBarRegistryState>({
    name: "workbench.statusBar",
    initialState: { items: {} },
  });

  const listItems = () => Object.values(store.getState().items).sort(bySlotOrderAndId);

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

    listVisibleItems(slot) {
      return listItems().filter((item) => (!slot || item.slot === slot) && (item.isVisible?.() ?? true));
    },
  };
};
