import type { Meta, StoryObj } from "@storybook/react";
import { PaletteShortcut } from "./palette-shortcut";

const meta = {
  title: "Components/PaletteShortcut",
  component: PaletteShortcut,
  args: { binding: "Alt+Shift+N" },
} satisfies Meta<typeof PaletteShortcut>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Inline: Story = {};
