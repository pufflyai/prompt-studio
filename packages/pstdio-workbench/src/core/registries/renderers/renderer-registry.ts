import { createDisposable, type Disposable } from "../../shared/disposable";
import { createWorkbenchStore, type WorkbenchStore } from "../../shared/store/workbench-store";
import type { WorkbenchCore } from "../../workbench-core";
import type { RegisteredWidgetContribution, WorkbenchWidgetPlacement } from "../layout/layout-model";

export interface WorkbenchWidgetRenderInput {
  workbench: WorkbenchCore;
  widget: RegisteredWidgetContribution;
  placement: WorkbenchWidgetPlacement;
  refresh: () => void;
}

export interface WorkbenchRendererRegistration {
  id: string;
  render: (input: WorkbenchWidgetRenderInput) => unknown;
}

export type WorkbenchRendererChangeListener = () => void;

export interface WorkbenchRendererStoreState {
  renderers: Record<string, WorkbenchRendererRegistration>;
}

export interface WorkbenchRendererRegistry {
  store: WorkbenchStore<WorkbenchRendererStoreState>;
  registerRenderer(renderer: WorkbenchRendererRegistration): Disposable;
  getRenderer(id: string): WorkbenchRendererRegistration | undefined;
  listRenderers(): WorkbenchRendererRegistration[];
  onDidChange(listener: WorkbenchRendererChangeListener): Disposable;
}

export const createWorkbenchRendererRegistry = (
  initialRenderers: WorkbenchRendererRegistration[] = [],
): WorkbenchRendererRegistry => {
  const store = createWorkbenchStore<WorkbenchRendererStoreState>({
    name: "workbench.renderers",
    initialState: { renderers: {} },
  });

  const registry: WorkbenchRendererRegistry = {
    store,

    registerRenderer(renderer) {
      const snapshot = store.getState();
      if (snapshot.renderers[renderer.id]) throw new Error(`Renderer already registered: ${renderer.id}`);

      store.setState({ renderers: { ...snapshot.renderers, [renderer.id]: renderer } }, false, "registerRenderer");

      return createDisposable(() => {
        const current = store.getState();
        if (current.renderers[renderer.id] !== renderer) return;
        const { [renderer.id]: _removed, ...rest } = current.renderers;
        store.setState({ renderers: rest }, false, "unregisterRenderer");
      });
    },

    getRenderer(id) {
      return store.getState().renderers[id];
    },

    listRenderers() {
      return Object.values(store.getState().renderers);
    },

    onDidChange(listener) {
      const unsubscribe = store.subscribeSelector(
        (state) => state.renderers,
        () => listener(),
      );
      return createDisposable(unsubscribe);
    },
  };

  for (const renderer of initialRenderers) registry.registerRenderer(renderer);

  return registry;
};
