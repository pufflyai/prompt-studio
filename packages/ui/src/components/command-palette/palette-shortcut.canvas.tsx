import { Button, HStack, Kbd } from "@chakra-ui/react";
import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";
import { Tooltip } from "../primitives/tooltip";
import { PaletteShortcut } from "./palette-shortcut";

const meta = {
  title: "Components/PaletteShortcut",
  component: PaletteShortcut,
  args: { binding: "Alt+Shift+N" },
} satisfies CanvasMeta<typeof PaletteShortcut>;
export default meta;
type Story = CanvasFrame<typeof meta>;
export const Inline: Story = {
  id: "components-paletteshortcut--inline",
};
export const Sequence: Story = {
  id: "components-paletteshortcut--sequence",
  args: { binding: ["Mod+K", "Mod+S"] },
};
export const ArrowKeys: Story = {
  id: "components-paletteshortcut--arrow-keys",
  args: { binding: ["ArrowLeft", "ArrowUp", "ArrowDown", "ArrowRight"] },
};
export const InTooltip: Story = {
  id: "components-paletteshortcut--in-tooltip",
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
  id: "components-paletteshortcut--keys-in-tooltip",
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
