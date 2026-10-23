import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { Canvas } from "./canvas";
import { FlowCanvasExample, FreeformCanvasExample, ScrollCanvasExample } from "./canvas.examples";

const meta: Meta<typeof Canvas> = {
  title: "Components/Layout/Canvas",
  component: Canvas,
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "A themed viewport for pan, anchored zoom, keyboard navigation, and touch gestures. Callers own layout and camera state. Mark live content or drag targets with data-canvas-control. See the native-scroll and transform examples for Planner and design-canvas integration.",
      },
    },
  },
};
export default meta;
type Story = StoryObj<typeof Canvas>;

export const LivePreviews: Story = {
  render: () => <FreeformCanvasExample />,
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
export const Timeline: Story = {
  render: () => <ScrollCanvasExample />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const viewport = canvas.getByRole("region", { name: "Timeline canvas" });
    viewport.focus();
    await userEvent.keyboard("{ArrowDown}");
    await expect(viewport.scrollTop).toBeGreaterThan(0);
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
