import type { Meta, StoryObj } from "@storybook/react";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import { Canvas } from "./canvas";
import { FlowCanvasExample, FreeformCanvasExample, ScrollCanvasExample } from "./canvas.examples";

const meta: Meta<typeof Canvas> = {
  title: "Components/Layout/Canvas",
  component: Canvas,
  argTypes: {
    minZoom: { control: { type: "number", min: 0.01, step: 0.1 } },
    maxZoom: { control: { type: "number", min: 0.01, step: 0.1 } },
  },
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "A dotted viewport with fixed timeline-style zoom controls, pan, anchored zoom, keyboard, and touch. Callers own their camera and pass the controlled zoom. minZoom/maxZoom apply to every zoom input (defaults 0.25 and 1). Mark live content or drag targets with data-canvas-control.",
      },
    },
  },
};
export default meta;
type Story = StoryObj<typeof Canvas>;

export const LivePreviews: Story = {
  args: { minZoom: 0.1, maxZoom: 4 },
  render: (args) => <FreeformCanvasExample minZoom={args.minZoom} maxZoom={args.maxZoom} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const draft = canvas.getByRole("textbox", { name: "Preview draft" });
    await userEvent.type(draft, "Keep this draft");
    await userEvent.click(canvas.getByRole("button", { name: "Count 0" }));
    await userEvent.click(canvas.getByRole("button", { name: "Zoom in", exact: true }));
    await expect(draft).toHaveValue("Keep this draft");
    await expect(canvas.getByRole("button", { name: "Count 1" })).toBeVisible();
  },
};

export const CustomZoomLimits: Story = {
  args: { minZoom: 0.5, maxZoom: 1.2 },
  render: (args) => <FreeformCanvasExample minZoom={args.minZoom} maxZoom={args.maxZoom} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const out = canvas.getByRole("button", { name: "Zoom out", exact: true });
    const zoomIn = canvas.getByRole("button", { name: "Zoom in", exact: true });
    for (let i = 0; i < 8; i++) await userEvent.click(out);
    await expect(out).toBeDisabled();
    await userEvent.click(canvas.getByRole("button", { name: /Reset zoom to/ }));
    for (let i = 0; i < 4; i++) await userEvent.click(zoomIn);
    await expect(zoomIn).toBeDisabled();
  },
};
export const Timeline: Story = {
  args: { onScroll: fn() },
  render: (args) => <ScrollCanvasExample onScroll={args.onScroll} />,
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const viewport = canvas.getByRole("region", { name: "Timeline canvas" });
    viewport.focus();
    await userEvent.keyboard("{ArrowDown}");
    await expect(viewport.scrollTop).toBeGreaterThan(0);
    await waitFor(() => expect(args.onScroll).toHaveBeenCalled());
    await userEvent.click(canvas.getByRole("button", { name: "Ticket 1", exact: true }));
    await expect(canvas.getByRole("button", { name: "Ticket 1", exact: true })).toHaveAttribute("aria-pressed", "true");
  },
};
export const KeyboardNavigation: Story = {
  render: () => <FreeformCanvasExample />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const stage = canvasElement.querySelector<HTMLElement>("[data-example-stage]")!;
    canvas.getByRole("region", { name: "Live designs canvas" }).focus();
    const initial = stage.style.transform;
    await userEvent.keyboard("{ArrowRight}");
    await waitFor(() => expect(stage.style.transform).not.toBe(initial));
  },
};

export const FlowContent: Story = {
  render: () => <FlowCanvasExample />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(canvas.getByRole("textbox", { name: "Flow draft" }), "Editable content");
    await userEvent.click(canvas.getByRole("button", { name: "Click me" }));
    await expect(canvas.getByRole("button", { name: "Clicked" })).toBeVisible();
  },
};
