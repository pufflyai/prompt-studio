import { type ComponentType, createContext, createElement, type ReactNode, useContext } from "react";

type Props<T> =
  T extends ComponentType<infer P>
    ? P
    : T extends { component?: ComponentType<infer P> }
      ? P
      : T extends { args: infer P }
        ? P
        : T;
/**
 * The theme the host chose for a frame. Canvas passes it through unchanged; each project applies
 * it with its own theme provider. `tokens` carries a theme's own values, such as a VS Code theme's.
 */
export interface CanvasTheme {
  id: string;
  mode: "light" | "dark";
  tokens?: Record<string, string>;
}
export interface CanvasContext {
  args: Record<string, any>;
  theme: CanvasTheme;
}
/** Provided by the frame runtime; previews outside a frame render light. */
export const CanvasThemeContext = createContext<CanvasTheme>({ id: "light", mode: "light" });
export type CanvasRender<T = any> = (args: Props<T>, context: CanvasContext) => ReactNode;
export type CanvasDecorator = (Preview: (props?: any) => ReactNode, context: CanvasContext) => ReactNode;
/** An object frame: Canvas renders `render(args)`, or the canvas `component` with `args`. */
export interface CanvasFrame<T = any> {
  id?: string;
  name?: string;
  args?: Partial<Props<T>>;
  render?: CanvasRender<T>;
  decorators?: CanvasDecorator[];
  description?: string;
  /** The frame is at least as tall as the Canvas viewport, for full-page previews. */
  fullscreen?: boolean;
}
/** The default export of a canvas file. */
export interface CanvasMeta<T = any> extends CanvasFrame<T> {
  title?: string;
  component?: ComponentType<Props<T>>;
}
/** The default export of `.canvas/preview.tsx`. */
export interface CanvasPreview {
  decorators?: CanvasDecorator[];
}

export const composePreview = (
  frame: CanvasFrame | CanvasRender,
  meta: CanvasMeta = {},
  preview: CanvasPreview = {},
) => {
  const example = typeof frame === "function" ? { render: frame } : frame;
  const args = { ...meta.args, ...example.args };
  const render = example.render ?? meta.render;
  const decorators = [...(preview.decorators ?? []), ...(meta.decorators ?? []), ...(example.decorators ?? [])];
  const Component = (props: Record<string, unknown>) => {
    const current: CanvasContext = { args: { ...args, ...props }, theme: useContext(CanvasThemeContext) };
    const body = () =>
      render ? render(current.args, current) : createElement(meta.component ?? (() => null), current.args);
    return decorators.reduceRight<() => ReactNode>((child, decorator) => () => decorator(child, current), body)();
  };
  return {
    Component,
    args,
    description: example.description,
    fullscreen: example.fullscreen ?? meta.fullscreen ?? false,
  };
};
