import { Box, Button, Stack } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { expect, fn, within } from "storybook/test";
import { Canvas } from "./canvas";
import { FreeformCanvasExample } from "./canvas.examples";

const meta: Meta<typeof Canvas> = {
  title: "Components/Layout/Canvas Gestures",
  component: Canvas,
  tags: ["!manifest"],
  args: { zoom: 1, onPan: fn(), onZoom: fn(), onFit: fn() },
};
export default meta;
type Story = StoryObj<typeof Canvas>;

const innerPan = fn();
const innerZoom = fn();

export const NestedCanvases: Story = {
  render: (args) => (
    <Canvas {...args} h="600px" aria-label="Outer canvas">
      <Box p="lg" data-canvas-control>
        <Canvas h="300px" zoom={1} onPan={innerPan} onZoom={innerZoom} aria-label="Inner canvas" />
      </Box>
    </Canvas>
  ),
  play: async ({ canvasElement, args }) => {
    innerPan.mockClear();
    innerZoom.mockClear();
    const inner = within(canvasElement).getByRole("region", { name: "Inner canvas" });
    inner.dispatchEvent(new WheelEvent("wheel", { bubbles: true, cancelable: true, deltaY: 80 }));
    await expect(innerPan).toHaveBeenCalledOnce();
    await expect(args.onPan).not.toHaveBeenCalled();
    inner.dispatchEvent(new WheelEvent("wheel", { bubbles: true, cancelable: true, deltaY: 80, ctrlKey: true }));
    await expect(innerZoom).toHaveBeenCalledOnce();
    await expect(args.onZoom).not.toHaveBeenCalled();
  },
};

export const DiagonalPreviewScroll: Story = {
  render: (args) => <FreeformCanvasExample {...args} />,
  play: async ({ canvasElement, args }) => {
    const preview = canvasElement.querySelector<HTMLElement>(
      '[aria-label="Scrollable preview"] [data-part="viewport"]',
    )!;
    await expect(preview.scrollHeight).toBeGreaterThan(preview.clientHeight);
    const wheel = new WheelEvent("wheel", { bubbles: true, cancelable: true, deltaX: 80, deltaY: 40 });
    preview.dispatchEvent(wheel);
    await expect(wheel.defaultPrevented).toBe(false);
    await expect(args.onPan).not.toHaveBeenCalled();
  },
};

export const PanAfterPinch: Story = {
  render: (args) => (
    <Canvas {...args} h="400px" aria-label="Touch canvas">
      <Button onClick={args.onFit}>Touch action</Button>
    </Canvas>
  ),
  play: async ({ canvasElement, args }) => {
    const viewport = within(canvasElement).getByRole("region", { name: "Touch canvas" });
    const target = viewport.querySelector<HTMLElement>("[data-canvas-background]")!;
    const touch = (identifier: number, clientX: number, clientY: number) =>
      new Touch({ identifier, target, clientX, clientY });
    const dispatch = (type: string, touches: Touch[]) =>
      target.dispatchEvent(new TouchEvent(type, { bubbles: true, cancelable: true, touches, targetTouches: touches }));
    dispatch("touchstart", [touch(1, 100, 100), touch(2, 200, 100)]);
    dispatch("touchmove", [touch(1, 100, 100), touch(2, 240, 100)]);
    await expect(args.onZoom).toHaveBeenCalledOnce();
    dispatch("touchend", [touch(1, 100, 100)]);
    dispatch("touchmove", [touch(1, 130, 120)]);
    await expect(args.onPan).toHaveBeenCalledWith({ x: 30, y: 20 });
    dispatch("touchend", []);
    const button = within(canvasElement).getByRole("button", { name: "Touch action" });
    button.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, pointerType: "touch", button: 0 }));
    button.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, detail: 1 }));
    await expect(args.onFit).toHaveBeenCalledOnce();
  },
};

export const InvalidControlledZoom: Story = {
  render: (args) => (
    <Stack>
      {[0, -1, Number.NaN, Number.POSITIVE_INFINITY].map((zoom, index) => (
        <Canvas key={index} {...args} h="32" zoom={zoom} aria-label={`Invalid zoom ${index}`} />
      ))}
    </Stack>
  ),
  play: async ({ canvasElement, args }) => {
    await expect(within(canvasElement).getAllByRole("region")).toHaveLength(4);
    await expect(args.onZoom).not.toHaveBeenCalled();
  },
};
