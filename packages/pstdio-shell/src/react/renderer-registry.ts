import type { ReactNode } from "react";
import type { Disposable, RegisteredWidgetContribution, ShellCore, ShellWidgetPlacement } from "../core";

export interface ShellWidgetRenderInput {
  shell: ShellCore;
  widget: RegisteredWidgetContribution;
  placement: ShellWidgetPlacement;
  refresh: () => void;
}

export interface ShellRendererRegistration {
  id: string;
  render: (input: ShellWidgetRenderInput) => ReactNode;
}

export interface ShellRendererRegistry {
  registerRenderer(renderer: ShellRendererRegistration): Disposable;
  getRenderer(id: string): ShellRendererRegistration | undefined;
  listRenderers(): ShellRendererRegistration[];
}

export const resolveShellWidgetRendererId = (widget: RegisteredWidgetContribution) =>
  widget.rendererId ?? widget.renderer;

export const createShellRendererRegistry = (initialRenderers: ShellRendererRegistration[] = []) => {
  const renderers = new Map<string, ShellRendererRegistration>();

  const registry: ShellRendererRegistry = {
    registerRenderer(renderer) {
      if (renderers.has(renderer.id)) throw new Error(`Renderer already registered: ${renderer.id}`);

      renderers.set(renderer.id, renderer);

      return {
        dispose: () => {
          if (renderers.get(renderer.id) === renderer) renderers.delete(renderer.id);
        },
      };
    },

    getRenderer(id) {
      return renderers.get(id);
    },

    listRenderers() {
      return [...renderers.values()];
    },
  };

  for (const renderer of initialRenderers) registry.registerRenderer(renderer);

  return registry;
};

export const resolveShellRendererRegistry = (
  renderers?: ShellRendererRegistry | ShellRendererRegistration[],
): ShellRendererRegistry => {
  if (!renderers) return createShellRendererRegistry();
  if (Array.isArray(renderers)) return createShellRendererRegistry(renderers);
  return renderers;
};
