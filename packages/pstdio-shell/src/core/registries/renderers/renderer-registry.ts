import { createDisposable, type Disposable } from "../../shared/disposable";
import { createShellStore, type ShellStore } from "../../shared/store/shell-store";
import type { ShellCore } from "../../shell-core";
import type { RegisteredWidgetContribution, ShellWidgetPlacement } from "../layout/layout-model";

export interface ShellWidgetRenderInput {
  shell: ShellCore;
  widget: RegisteredWidgetContribution;
  placement: ShellWidgetPlacement;
  refresh: () => void;
}

export interface ShellRendererRegistration {
  id: string;
  render: (input: ShellWidgetRenderInput) => unknown;
}

export type ShellRendererChangeListener = () => void;

export interface ShellRendererStoreState {
  renderers: Record<string, ShellRendererRegistration>;
}

export interface ShellRendererRegistry {
  store: ShellStore<ShellRendererStoreState>;
  registerRenderer(renderer: ShellRendererRegistration): Disposable;
  getRenderer(id: string): ShellRendererRegistration | undefined;
  listRenderers(): ShellRendererRegistration[];
  onDidChange(listener: ShellRendererChangeListener): Disposable;
}

export const createShellRendererRegistry = (
  initialRenderers: ShellRendererRegistration[] = [],
): ShellRendererRegistry => {
  const store = createShellStore<ShellRendererStoreState>({
    name: "shell.renderers",
    initialState: { renderers: {} },
  });

  const registry: ShellRendererRegistry = {
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
