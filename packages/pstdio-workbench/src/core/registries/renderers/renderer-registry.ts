import { createDisposable, type Disposable } from "../../shared/disposable";
import { createWorkbenchStore, type WorkbenchStore } from "../../shared/store/workbench-store";
import type { WorkbenchCore } from "../../workbench-core";
import type {
  PlaceholderContribution,
  RegisteredPlaceholderContribution,
  WorkbenchPanelContribution,
  WorkbenchPanelInstance,
} from "../layout/layout-model";

export interface WorkbenchPanelRenderInput {
  workbench: WorkbenchCore;
  panel: WorkbenchPanelContribution | PlaceholderContribution | RegisteredPlaceholderContribution;
  instance: WorkbenchPanelInstance;
  refresh: () => void;
}

export interface WorkbenchRendererRegistration {
  id: string;
  render: (input: WorkbenchPanelRenderInput) => unknown;
}

export type WorkbenchRendererChangeListener = () => void;

export interface WorkbenchRendererStoreState {
  renderers: Record<string, WorkbenchRendererRegistration>;
  refreshKeys: Record<string, number>;
}

export interface WorkbenchRendererRegistry {
  store: WorkbenchStore<WorkbenchRendererStoreState>;
  registerRenderer(renderer: WorkbenchRendererRegistration): Disposable;
  getRenderer(id: string): WorkbenchRendererRegistration | undefined;
  listRenderers(): WorkbenchRendererRegistration[];
  refreshRenderer(id: string): void;
  onDidChange(listener: WorkbenchRendererChangeListener): Disposable;
}

export interface CreateWorkbenchRendererRegistryInput {
  initialRenderers?: WorkbenchRendererRegistration[];
}

export const createWorkbenchRendererRegistry = (
  input: CreateWorkbenchRendererRegistryInput = {},
): WorkbenchRendererRegistry => {
  const store = createWorkbenchStore<WorkbenchRendererStoreState>({
    name: "workbench.renderers",
    initialState: { renderers: {}, refreshKeys: {} },
  });

  const registry: WorkbenchRendererRegistry = {
    store,

    registerRenderer(renderer) {
      const snapshot = store.getState();
      if (snapshot.renderers[renderer.id]) throw new Error(`Renderer already registered: ${renderer.id}`);
      store.setState(
        { ...snapshot, renderers: { ...snapshot.renderers, [renderer.id]: renderer } },
        false,
        "registerRenderer",
      );

      return createDisposable(() => {
        const current = store.getState();
        if (current.renderers[renderer.id] !== renderer) return;
        const { [renderer.id]: _removed, ...renderers } = current.renderers;
        const { [renderer.id]: _refreshKey, ...refreshKeys } = current.refreshKeys;
        store.setState({ renderers, refreshKeys }, false, "unregisterRenderer");
      });
    },

    getRenderer: (id) => store.getState().renderers[id],

    listRenderers: () => Object.values(store.getState().renderers),

    refreshRenderer(id) {
      const snapshot = store.getState();
      if (!snapshot.renderers[id]) throw new Error(`Renderer is not registered: ${id}`);
      store.setState(
        { ...snapshot, refreshKeys: { ...snapshot.refreshKeys, [id]: (snapshot.refreshKeys[id] ?? 0) + 1 } },
        false,
        "refreshRenderer",
      );
    },

    onDidChange(listener) {
      return createDisposable(
        store.subscribeSelector(
          (state) => state.renderers,
          () => listener(),
        ),
      );
    },
  };

  for (const renderer of input.initialRenderers ?? []) registry.registerRenderer(renderer);
  return registry;
};
