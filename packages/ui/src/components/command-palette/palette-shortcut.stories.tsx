import { Button, HStack, Kbd } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { Tooltip } from "../primitives/tooltip";
import { PaletteShortcut } from "./palette-shortcut";

const meta = {
  title: "Components/PaletteShortcut",
  component: PaletteShortcut,
  args: { binding: "Alt+Shift+N" },
} satisfies Meta<typeof PaletteShortcut>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Inline: Story = {};

export const Sequence: Story = { args: { binding: ["Mod+K", "Mod+S"] } };

export const InTooltip: Story = {
  render: (args) => (
    <Tooltip
      open
      content={
        <HStack>
          <span>New note</span>
          <PaletteShortcut {...args} />
        </HStack>
      }
    >
      <Button>New note</Button>
    </Tooltip>
  ),
};

export const KeysInTooltip: Story = {
  render: () => (
    <Tooltip
      open
      content={
        <HStack>
          <span>Open search</span>
          <HStack gap="shortcut-key-gap">
            <Kbd>⌘</Kbd>
            <Kbd>K</Kbd>
          </HStack>
        </HStack>
      }
    >
      <Button>Open search</Button>
    </Tooltip>
  ),
};
