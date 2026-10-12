import { Box, Button, Stack, Text } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { ResizableSplitLayout } from "./resizable-split-layout";
import type { ResizableSplitSide } from "./resizable-split-layout.geometry";

const MotionPanel = (props: { side?: ResizableSplitSide }) => {
  const { side = "right" } = props;
  const [collapsed, setCollapsed] = useState(true);
  return (
    <Stack h="96" gap="sm">
      <Button onClick={() => setCollapsed(!collapsed)}>Toggle panel</Button>
      <ResizableSplitLayout
        resizableSide={side}
        collapsed={collapsed}
        onCollapsedChange={setCollapsed}
        defaultSizePx={240}
        minSizePx={120}
        contentMinSizePx={160}
        resizablePanel={
          <Box h="full" bg="bg.subtle">
            <Text>Saved size content</Text>
          </Box>
        }
        contentPanel={
          <Box>
            <Text>Main content</Text>
          </Box>
        }
      />
    </Stack>
  );
};
const meta = {
  tags: ["motion"],
  title: "Components/Layout/Resizable Split Layout/Motion",
  component: MotionPanel,
  parameters: {
    docs: {
      description: {
        component: "Resize a divider, drag it closed, then reopen. The content should fill the restored panel.",
      },
    },
  },
} satisfies Meta<typeof MotionPanel>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Right: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const toggle = canvas.getByRole("button", { name: "Toggle panel" });
    const content = canvas.getByText("Saved size content");
    const panel = content.closest<HTMLElement>("[data-collapsed]")!;
    const root = panel.parentElement!;
    await expect(content).not.toBeVisible();
    await userEvent.click(toggle);
    await waitFor(() => expect(content).toBeVisible());
    await waitFor(() => expect(root.getAnimations()).toHaveLength(0));
    const dimension = args.side === "top" || args.side === "bottom" ? "height" : "width";
    const separator = canvas.getByRole("separator", { hidden: true });
    const inner = panel.querySelector<HTMLElement>("[data-split-panel-content]")!;
    separator.focus();
    await userEvent.keyboard("{End}");
    await waitFor(() => expect(root.getAnimations()).toHaveLength(0));
    const initialSize = panel.getBoundingClientRect()[dimension];
    const positiveKey = dimension === "width" ? "ArrowRight" : "ArrowDown";
    const negativeKey = dimension === "width" ? "ArrowLeft" : "ArrowUp";
    const panelFirst = args.side === "left" || args.side === "top";
    await userEvent.keyboard(`{${panelFirst ? negativeKey : positiveKey}}`);
    await waitFor(() => expect(root.getAnimations()).toHaveLength(0));
    const resizedSize = panel.getBoundingClientRect()[dimension];
    await expect(resizedSize).toBeLessThan(initialSize);
    await userEvent.click(toggle);
    await expect(panel).toHaveAttribute("inert");
    await expect(panel).toBeVisible();
    await expect(panel.getBoundingClientRect()[dimension]).toBeGreaterThan(0);
    await waitFor(() => expect(content).not.toBeVisible());
    await expect(separator.getBoundingClientRect()[dimension]).toBe(0);
    await userEvent.click(toggle);
    await waitFor(() => expect(content).toBeVisible());
    await waitFor(() => expect(root.getAnimations()).toHaveLength(0));
    await expect(panel.getBoundingClientRect()[dimension]).toBe(resizedSize);
    await expect(inner.getBoundingClientRect()[dimension]).toBe(resizedSize);
  },
};
export const Left: Story = { ...Right, args: { side: "left" } };
export const Bottom: Story = { ...Right, args: { side: "bottom" } };
export const Top: Story = { ...Right, args: { side: "top" } };
