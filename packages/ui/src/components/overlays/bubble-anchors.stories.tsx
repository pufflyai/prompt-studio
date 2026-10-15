import { Stack, Text } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { MessageCircle } from "lucide-react";
import { useState } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";
import type { BubbleAnchor } from "@/theme/recipes/bubble-anchor";
import { BubbleButton } from "./bubble-button";
import { BubblePanel } from "./bubble-panel";

const AnchoredBubble = (props: { anchor: BubbleAnchor }) => {
  const { anchor } = props;
  const [open, setOpen] = useState(true);
  return (
    <>
      <BubbleButton
        anchor={anchor}
        isOpen={open}
        aria-label={open ? "Close Side Panel" : "Open Side Panel"}
        onClick={() => setOpen(!open)}
      >
        <MessageCircle />
      </BubbleButton>
      <BubblePanel
        anchor={anchor}
        isOpen={open}
        title="Side Panel"
        closeLabel="Hide Sidebar"
        onClose={() => setOpen(false)}
      >
        <Stack p="sm">
          <Text>Floating Side at {anchor}</Text>
        </Stack>
      </BubblePanel>
    </>
  );
};

const meta = {
  title: "Components/Overlays/Bubble/Anchors",
  component: AnchoredBubble,
  parameters: { layout: "fullscreen" },
  args: { anchor: "bottom-right" },
  argTypes: {
    anchor: {
      control: "select",
      options: ["top-left", "top", "top-right", "left", "right", "bottom-left", "bottom", "bottom-right"],
    },
  },
} satisfies Meta<typeof AnchoredBubble>;
export default meta;
type Story = StoryObj<typeof meta>;
const play: Story["play"] = async () => {
  const canvas = within(document.body);
  await waitFor(() => expect(canvas.getByRole("dialog", { name: "Side Panel" })).toBeVisible());
  await userEvent.click(canvas.getByRole("button", { name: "Hide Sidebar" }));
  await expect(await canvas.findByRole("button", { name: "Open Side Panel" })).toHaveAttribute("aria-pressed", "false");
};
export const TopLeft: Story = { args: { anchor: "top-left" }, play };
export const Top: Story = { args: { anchor: "top" }, play };
export const TopRight: Story = { args: { anchor: "top-right" }, play };
export const Left: Story = { args: { anchor: "left" }, play };
export const Right: Story = { args: { anchor: "right" }, play };
export const BottomLeft: Story = { args: { anchor: "bottom-left" }, play };
export const Bottom: Story = { args: { anchor: "bottom" }, play };
export const BottomRight: Story = { args: { anchor: "bottom-right" }, play };
