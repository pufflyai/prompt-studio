import { ScopedDialog as Dialog } from "@pstdio/ui";

import type { Meta, StoryObj } from "@storybook/react";
import { userEvent, within } from "storybook/test";
import { WorkbenchStory } from "../../examples/workbench-story";
import { createKeyboardWorkbench } from "./keyboard.fixture";
import { WorkbenchKeyboardShortcutsPanel } from "./keyboard-shortcuts-panel";

const meta = {
  title: "pstdio-workbench/Reference/Keyboard",
  component: WorkbenchStory,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof WorkbenchStory>;
export default meta;
type Story = StoryObj<typeof meta>;
export const VisiblePanels: Story = { args: { workbench: createKeyboardWorkbench() } };
export const CrowdedTabs: Story = { args: { workbench: createKeyboardWorkbench(12) } };
export const ShortcutPreview: Story = {
  args: { workbench: createKeyboardWorkbench() },
  play: async () => {
    await userEvent.keyboard("{Alt>}");
  },
};
const menu = createKeyboardWorkbench();
menu.keyboard.open();
export const KeyboardBubble: Story = { args: { workbench: menu } };
export const ExpandedBubble: Story = {
  args: { workbench: menu },
  play: async ({ canvasElement }) => {
    await userEvent.hover(
      within(canvasElement.ownerDocument.body).getByRole("region", { name: "Keyboard shortcut mode" }),
    );
  },
};
const conflict = createKeyboardWorkbench();
conflict.keyboard.open();
void conflict.keyboard.press("a").then(() => conflict.keyboard.press("s"));
export const TargetSelection: Story = { args: { workbench: conflict } };
const management = createKeyboardWorkbench();
export const ShortcutReference: Story = {
  args: { workbench: management },
  render: () => (
    <Dialog.Root open>
      <Dialog.Backdrop />
      <Dialog.Positioner>
        <Dialog.Content maxW="palette-width" w="full">
          <WorkbenchKeyboardShortcutsPanel workbench={management} />
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  ),
};
