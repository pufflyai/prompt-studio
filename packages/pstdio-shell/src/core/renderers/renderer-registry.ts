import { createDisposable, type Disposable } from "../disposable";
import type { RegisteredWidgetContribution, ShellWidgetPlacement } from "../layout/layout-model";
import type { ShellCore } from "../shell-core";

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

export interface ShellRendererRegistry {
  registerRenderer(renderer: ShellRendererRegistration): Disposable;
  getRenderer(id: string): ShellRendererRegistration | undefined;
  listRenderers(): ShellRendererRegistration[];
  onDidChange(listener: ShellRendererChangeListener): Disposable;
}

export const resolveShellWidgetRendererId = (widget: RegisteredWidgetContribution) =>
  widget.rendererId ?? widget.renderer;

export const createShellRendererRegistry = (initialRenderers: ShellRendererRegistration[] = []) => {
  const renderers = new Map<string, ShellRendererRegistration>();
  const listeners = new Set<ShellRendererChangeListener>();
  const notify = () => {
    for (const listener of listeners) listener();
  };

  const registry: ShellRendererRegistry = {
    registerRenderer(renderer) {
      if (renderers.has(renderer.id)) throw new Error(`Renderer already registered: ${renderer.id}`);

      renderers.set(renderer.id, renderer);
      notify();

      return createDisposable(() => {
        if (renderers.get(renderer.id) === renderer) {
          renderers.delete(renderer.id);
          notify();
        }
      });
    },

    getRenderer(id) {
      return renderers.get(id);
    },

    listRenderers() {
      return [...renderers.values()];
    },

    onDidChange(listener) {
      listeners.add(listener);
      return createDisposable(() => {
        listeners.delete(listener);
      });
    },
  };

  for (const renderer of initialRenderers) registry.registerRenderer(renderer);

  return registry;
};
