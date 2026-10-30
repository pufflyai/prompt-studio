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
  globals: Record<string, any>;
  parameters: Record<string, any>;
  loaded: Record<string, any>;
}
export type CanvasRender<T = any> = (args: Props<T>, context: CanvasContext) => ReactNode;
export type CanvasDecorator = (Preview: (props?: any) => ReactNode, context: CanvasContext) => ReactNode;
export interface CanvasVariant<T = any> {
  id?: string;
  name?: string;
  args?: Partial<Props<T>>;
  render?: CanvasRender<T>;
  decorators?: CanvasDecorator[];
  parameters?: Record<string, any>;
  argTypes?: Record<string, any>;
  globals?: Record<string, any>;
  tags?: string[];
  loaders?: ((context: CanvasContext) => unknown | Promise<unknown>)[];
  setup?: () =>
    | { args?: Record<string, any>; dispose?: () => void }
    | Promise<{ args?: Record<string, any>; dispose?: () => void }>;
}
export interface CanvasMeta<T = any> extends CanvasVariant<T> {
  title?: string;
  id?: string;
  component?: ComponentType<Props<T>>;
  subcomponents?: Record<string, ComponentType<any>>;
  includeStories?: string[] | RegExp;
  excludeStories?: string[] | RegExp;
}
export type CanvasProject = Omit<CanvasVariant, "render">;

export const composePreview = async (
  variant: CanvasVariant | CanvasRender,
  meta: CanvasMeta = {},
  project: CanvasProject = {},
) => {
  const example = typeof variant === "function" ? { render: variant } : variant;
  const context: CanvasContext = {
    args: { ...meta.args, ...example.args },
    globals: { theme: "pstdio-light", ...project.globals, ...meta.globals, ...example.globals },
    parameters: { ...project.parameters, ...meta.parameters, ...example.parameters },
    loaded: {},
  };
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
      for (const loader of source.loaders ?? []) Object.assign(context.loaded, await loader(context));
    }
  } catch (error) {
    dispose();
    throw error;
  }
  const render = example.render ?? meta.render;
  const decorators = [...(project.decorators ?? []), ...(meta.decorators ?? []), ...(example.decorators ?? [])];
  const Component = (args: Record<string, unknown>) => {
    const current = { ...context, args: { ...context.args, ...args } };
    const body = () =>
      render ? render(current.args, current) : createElement(meta.component ?? (() => null), current.args);
    return decorators.reduceRight<() => ReactNode>((child, decorator) => () => decorator(child, current), body)();
  };
  return {
    Component,
    args: context.args,
    argTypes: { ...meta.argTypes, ...example.argTypes },
    parameters: context.parameters,
    dispose,
  };
};
