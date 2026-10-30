import type { CanvasMeta, CanvasVariant } from "@pstdio/canvas";
import { Canvas } from "./canvas";
import { FlowCanvasExample, FreeformCanvasExample, ScrollCanvasExample } from "./canvas.examples";

const meta: CanvasMeta<typeof Canvas> = {
  title: "Components/Layout/Canvas",
  component: Canvas,
  args: {
    onPan: () => {},
    onZoom: () => {},
    onFit: () => {},
    onReset: () => {},
    onNavigationEnd: () => {},
  },
  description:
    "A dotted viewport with fixed timeline-style zoom controls, pan, anchored zoom, keyboard, and touch. Callers own their camera and pass the controlled zoom. minZoom/maxZoom apply to every zoom input (defaults 0.25 and 1). Mark live content or drag targets with data-canvas-control. Focus the canvas and press F to fit or 0 to reset the example camera.",
  fullscreen: true,
};
export default meta;
type Story = CanvasVariant<typeof Canvas>;
export const LivePreviews: Story = {
  id: "components-layout-canvas--live-previews",
  args: { minZoom: 0.1, maxZoom: 4 },
  render: (args) => <FreeformCanvasExample {...args} />,
};
export const CustomZoomLimits: Story = {
  id: "components-layout-canvas--custom-zoom-limits",
  args: { minZoom: 0.5, maxZoom: 1.2 },
  render: (args) => <FreeformCanvasExample {...args} />,
};
export const Timeline: Story = {
  id: "components-layout-canvas--timeline",
  args: { onScroll: () => {} },
  render: (args) => <ScrollCanvasExample onScroll={args.onScroll} />,
};
export const KeyboardNavigation: Story = {
  id: "components-layout-canvas--keyboard-navigation",
  render: (args) => <FreeformCanvasExample {...args} />,
};
export const FlowContent: Story = {
  id: "components-layout-canvas--flow-content",
  render: () => <FlowCanvasExample />,
};
