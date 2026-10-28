import { Dialog } from "@chakra-ui/react";
import type { CanvasMeta, CanvasVariant } from "@pstdio/canvas";
import { WorkbenchStory } from "../../examples/workbench-story";
import { createKeyboardWorkbench } from "./keyboard.fixture";
import { WorkbenchKeyboardShortcutsPanel } from "./keyboard-shortcuts-panel";

const meta = {
  title: "pstdio-workbench/Reference/Keyboard",
  component: WorkbenchStory,
  parameters: { layout: "fullscreen" },
} satisfies CanvasMeta<typeof WorkbenchStory>;
export default meta;
type Story = CanvasVariant<typeof meta>;
export const VisiblePanels: Story = {
  id: "pstdio-workbench-reference-keyboard--visible-panels",
  args: { workbench: createKeyboardWorkbench() },
};
export const CrowdedTabs: Story = {
  id: "pstdio-workbench-reference-keyboard--crowded-tabs",
  args: { workbench: createKeyboardWorkbench(12) },
};
const menu = createKeyboardWorkbench();
menu.keyboard.open();
export const KeyboardBubble: Story = {
  id: "pstdio-workbench-reference-keyboard--keyboard-bubble",
  args: { workbench: menu },
};
export const ExpandedBubble: Story = {
  id: "pstdio-workbench-reference-keyboard--expanded-bubble",
  args: { workbench: menu },
};
const conflict = createKeyboardWorkbench();
conflict.keyboard.open();
void conflict.keyboard.press("a").then(() => conflict.keyboard.press("s"));
export const TargetSelection: Story = {
  id: "pstdio-workbench-reference-keyboard--target-selection",
  args: { workbench: conflict },
};
const management = createKeyboardWorkbench();
export const ShortcutReference: Story = {
  id: "pstdio-workbench-reference-keyboard--shortcut-reference",
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
