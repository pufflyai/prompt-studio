import { type ComponentType, createContext, createElement, type ReactNode, useContext } from "react";
import type { CanvasControls, CanvasMotion, CanvasSave } from "./parameters";

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
  controls?: CanvasControls;
  motion?: CanvasMotion;
  save?: CanvasSave;
  render?: CanvasRender<T>;
  decorators?: CanvasDecorator[];
  description?: string;
  /** The frame's initial theme, before a saved user choice. */
  defaultTheme?: string;
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

// The args and theme of the frame being rendered. Layers read them here, so each layer's component
// stays the same across renders and React keeps the state inside the frame.
const FrameContext = createContext<CanvasContext>({ args: {}, theme: { id: "light", mode: "light" } });

export const composePreview = (
  frame: CanvasFrame | CanvasRender,
  meta: CanvasMeta = {},
  preview: CanvasPreview = {},
) => {
  const example = typeof frame === "function" ? { render: frame } : frame;
  const args = { ...meta.args, ...example.args };
  const render = example.render ?? meta.render;
  const decorators = [...(preview.decorators ?? []), ...(meta.decorators ?? []), ...(example.decorators ?? [])];
  const Body = () => {
    const current = useContext(FrameContext);
    return render ? render(current.args, current) : createElement(meta.component ?? (() => null), current.args);
  };
  // Built once per preview: a decorator always receives the same inner component.
  const Decorated = decorators.reduceRight<() => ReactNode>((Inner, decorator) => {
    const Layer = () => decorator(Inner, useContext(FrameContext));
    return Layer;
  }, Body);
  const Component = (props: Record<string, unknown>) => {
    const current: CanvasContext = { args: { ...args, ...props }, theme: useContext(CanvasThemeContext) };
    return createElement(FrameContext.Provider, { value: current }, createElement(Decorated));
  };
  return {
    Component,
    args,
    controls: { ...meta.controls, ...example.controls },
    motion: example.motion ?? meta.motion,
    description: example.description,
    fullscreen: example.fullscreen ?? meta.fullscreen ?? false,
  };
};
