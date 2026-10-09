import type { Meta, StoryObj } from "@storybook/react";
import { ListRow } from "../list-row/list-row";
import { PaletteShortcut } from "./palette-shortcut";

const meta = {
  title: "Components/PaletteShortcut",
  component: PaletteShortcut,
  args: { binding: "Alt+Shift+N" },
} satisfies Meta<typeof PaletteShortcut>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Inline: Story = {};

export const SidenavHoverAndFocus: Story = {
  args: { variant: "sidenav" },
  render: (args) => <ListRow label="Notes" tooltip="Notes" endContent={<PaletteShortcut {...args} />} />,
};
