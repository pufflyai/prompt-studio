import { type ComponentType, createElement, type ReactNode } from "react";

type Props<T> =
  T extends ComponentType<infer P>
    ? P
    : T extends { component?: ComponentType<infer P> }
      ? P
      : T extends { args: infer P }
        ? P
        : T;
export interface CanvasContext {
  args: Record<string, any>;
}
export type CanvasRender<T = any> = (args: Props<T>, context: CanvasContext) => ReactNode;
export type CanvasDecorator = (Preview: (props?: any) => ReactNode, context: CanvasContext) => ReactNode;
export interface CanvasVariant<T = any> {
  id?: string;
  name?: string;
  args?: Partial<Props<T>>;
  render?: CanvasRender<T>;
  decorators?: CanvasDecorator[];
  description?: string;
  /** The frame is at least as tall as the Canvas viewport, for full-page previews. */
  fullscreen?: boolean;
  setup?: () =>
    | { args?: Record<string, any>; dispose?: () => void }
    | Promise<{ args?: Record<string, any>; dispose?: () => void }>;
}
export interface CanvasMeta<T = any> extends CanvasVariant<T> {
  title?: string;
  component?: ComponentType<Props<T>>;
}
export type CanvasProject = Omit<CanvasVariant, "render">;

export const composePreview = async (
  variant: CanvasVariant | CanvasRender,
  meta: CanvasMeta = {},
  project: CanvasProject = {},
) => {
  const example = typeof variant === "function" ? { render: variant } : variant;
  const context: CanvasContext = { args: { ...meta.args, ...example.args } };
  const cleanups: (() => void)[] = [];
  let disposed = false;
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    for (const cleanup of cleanups.reverse()) cleanup();
  };
  try {
    for (const source of [project, meta, example]) {
      const setup = await source.setup?.();
      if (setup?.dispose) cleanups.push(setup.dispose);
      Object.assign(context.args, setup?.args);
    }
  } catch (error) {
    dispose();
    throw error;
  }
  const render = example.render ?? meta.render;
  const decorators = [...(project.decorators ?? []), ...(meta.decorators ?? []), ...(example.decorators ?? [])];
  const Component = (args: Record<string, unknown>) => {
    const current = { args: { ...context.args, ...args } };
    const body = () =>
      render ? render(current.args, current) : createElement(meta.component ?? (() => null), current.args);
    return decorators.reduceRight<() => ReactNode>((child, decorator) => () => decorator(child, current), body)();
  };
  return {
    Component,
    args: context.args,
    description: example.description,
    fullscreen: example.fullscreen ?? meta.fullscreen ?? project.fullscreen ?? false,
    dispose,
  };
};
