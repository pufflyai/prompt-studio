import { type ComponentType, createContext, createElement, type ReactNode, useContext } from "react";

type Props<T> =
  T extends ComponentType<infer P>
    ? P
    : T extends { component?: ComponentType<infer P> }
      ? P
      : T extends { args: infer P }
        ? P
        : T;
export type CanvasTheme = "light" | "dark";
export interface CanvasContext {
  args: Record<string, any>;
  /** The frame's theme switch. Decorators use it to set the project's own theme provider. */
  theme: CanvasTheme;
}
/** Provided by the frame runtime; previews outside a frame render light. */
export const CanvasThemeContext = createContext<CanvasTheme>("light");
export type CanvasRender<T = any> = (args: Props<T>, context: CanvasContext) => ReactNode;
export type CanvasDecorator = (Preview: (props?: any) => ReactNode, context: CanvasContext) => ReactNode;
export interface CanvasVariant<T = any> {
  id?: string;
  name?: string;
  args?: Partial<Props<T>>;
  render?: CanvasRender<T>;
  decorators?: CanvasDecorator[];
  description?: string;
  /** The frame's initial theme, before a saved user choice. */
  defaultTheme?: string;
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
/** One frame: a component with no props, or an object rendering `render(args)` or `component`. */
export type CanvasFrame<T = any> = CanvasVariant<T> | ComponentType;
/** The default export of `.canvas/preview.tsx`. */
export type CanvasPreview = CanvasProject;

export const composePreview = async (
  variant: CanvasVariant | CanvasRender,
  meta: CanvasMeta = {},
  project: CanvasProject = {},
) => {
  const example = typeof variant === "function" ? { render: variant } : variant;
  const context = { args: { ...meta.args, ...example.args } };
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
    const current: CanvasContext = { args: { ...context.args, ...args }, theme: useContext(CanvasThemeContext) };
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
