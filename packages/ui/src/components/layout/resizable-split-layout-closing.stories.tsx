import { Box, Button, Stack, Text } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { ResizableSplitLayout } from "./resizable-split-layout";
import { getResizableSplitAxis, type ResizableSplitSide } from "./resizable-split-layout.geometry";

const ClosingPanel = (props: { side?: ResizableSplitSide; collapsible?: boolean }) => {
  const { side = "right", collapsible = true } = props;
  const [collapsed, setCollapsed] = useState(false);
  return (
    <Stack h="2xl" gap="sm">
      <Button onClick={() => setCollapsed(!collapsed)}>Toggle panel</Button>
      <ResizableSplitLayout
        resizableSide={side}
        collapsed={collapsed}
        onCollapsedChange={setCollapsed}
        collapsible={collapsible}
        defaultSizePx={240}
        minSizePx={120}
        maxSizePx={360}
        contentMinSizePx={160}
        resizablePanel={
          <Box h="full" bg="bg.subtle">
            <Text>Panel content</Text>
          </Box>
        }
        contentPanel={<Text>Main content</Text>}
      />
    </Stack>
  );
};

const meta = {
  title: "Components/Layout/Resizable Split Layout/Closing",
  component: ClosingPanel,
  tags: ["!manifest"],
  parameters: {
    docs: {
      description: {
        component:
          "Drag below half the minimum to preview closing. Release closes. Escape or pointer cancel restores the previous size. Reopening restores the saved size. Home and double-click also close without changing that size.",
      },
    },
  },
} satisfies Meta<typeof ClosingPanel>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Right: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const user = userEvent.setup();
    const separator = canvas.getByRole("separator");
    const panel = canvas.getByText("Panel content").closest<HTMLElement>("[data-collapsed]")!;
    const root = panel.parentElement!;
    const axis = getResizableSplitAxis(args.side ?? "right");
    const size = () => panel.getBoundingClientRect()[axis.dimension];
    const settled = () => waitFor(() => expect(root.getAnimations()).toHaveLength(0));
    const toggle = canvas.getByRole("button", { name: "Toggle panel" });
    const rect = separator.getBoundingClientRect();
    const start = { clientX: rect.x + rect.width / 2, clientY: rect.y + rect.height / 2 };
    const coords = (requested: number) => ({
      ...start,
      [axis.pointerCoordinate]: start[axis.pointerCoordinate] + (requested - 240) * axis.deltaDirection,
    });
    const begin = () => user.pointer({ target: separator, keys: "[MouseLeft>]", coords: start });
    const move = (requested: number) => user.pointer({ target: separator, coords: coords(requested) });
    const release = () => user.pointer({ target: separator, keys: "[/MouseLeft]" });

    const bar = separator.querySelector<HTMLElement>("[data-part=bar]")!;
    const normalColor = getComputedStyle(bar).backgroundColor;
    await begin();
    await move(60);
    await expect(panel).toHaveAttribute("data-closing", "false");
    await move(59);
    await waitFor(() => expect(panel).toHaveAttribute("data-closing", "true"));
    await expect(panel).toBeVisible();
    await expect(getComputedStyle(panel).opacity).toBe("0.4");
    await expect(getComputedStyle(bar).backgroundColor).not.toBe(normalColor);
    await move(61);
    await waitFor(() => expect(panel).toHaveAttribute("data-closing", "false"));
    await move(59);
    await user.keyboard("{Escape}");
    await release();
    await settled();
    await expect(size()).toBe(240);
    await expect(panel).toHaveAttribute("data-collapsed", "false");
    await expect(panel).toHaveAttribute("data-closing", "false");

    await begin();
    await move(59);
    separator.dispatchEvent(new PointerEvent("pointercancel", { bubbles: true, pointerId: 1 }));
    await release();
    await settled();
    await expect(size()).toBe(240);
    await expect(panel).toHaveAttribute("data-collapsed", "false");

    separator.focus();
    const shrink = axis.deltaDirection === 1 ? -1 : 1;
    const positiveKey = axis.dimension === "width" ? "ArrowRight" : "ArrowDown";
    const negativeKey = axis.dimension === "width" ? "ArrowLeft" : "ArrowUp";
    const key = shrink === 1 ? positiveKey : negativeKey;
    await user.keyboard(`{${key}}`);
    await settled();
    await expect(size()).toBe(216);

    const nextRect = separator.getBoundingClientRect();
    await user.pointer({
      target: separator,
      keys: "[MouseLeft>]",
      coords: { clientX: nextRect.x, clientY: nextRect.y },
    });
    await user.pointer({
      target: separator,
      coords: {
        clientX: nextRect.x,
        clientY: nextRect.y,
        [axis.pointerCoordinate]: nextRect[axis.dimension === "width" ? "x" : "y"] - 180 * axis.deltaDirection,
      },
    });
    await expect(panel).toHaveAttribute("data-closing", "true");
    await release();
    await waitFor(() => expect(panel).not.toBeVisible());
    await user.click(toggle);
    await settled();
    await expect(size()).toBe(216);
    separator.focus();
    await user.keyboard("{Home}");
    await waitFor(() => expect(panel).not.toBeVisible());
    await user.click(toggle);
    await settled();
    await expect(size()).toBe(216);
    await user.dblClick(separator);
    await waitFor(() => expect(panel).not.toBeVisible());
    await user.click(toggle);
    await settled();
    await expect(size()).toBe(216);
  },
};
export const Left: Story = { ...Right, args: { side: "left" } };
export const Bottom: Story = { ...Right, args: { side: "bottom" } };
export const Top: Story = { ...Right, args: { side: "top" } };
export const CannotClose: Story = {
  args: { collapsible: false },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const separator = canvas.getByRole("separator");
    const rect = separator.getBoundingClientRect();
    await userEvent.pointer([
      { target: separator, keys: "[MouseLeft>]", coords: { clientX: rect.x, clientY: rect.y } },
      { target: separator, coords: { clientX: rect.x + 400, clientY: rect.y } },
      { target: separator, keys: "[/MouseLeft]" },
    ]);
    const panel = canvas.getByText("Panel content").closest<HTMLElement>("[data-collapsed]")!;
    await waitFor(() => expect(panel.getBoundingClientRect().width).toBe(120));
    await expect(panel).toHaveAttribute("data-closing", "false");
    await expect(panel).toHaveAttribute("data-collapsed", "false");
  },
};
