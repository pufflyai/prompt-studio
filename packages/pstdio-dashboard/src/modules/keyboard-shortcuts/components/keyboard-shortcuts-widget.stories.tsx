import { Dialog } from "@chakra-ui/react";
import { createWorkbench } from "@pstdio/workbench";
import { WorkbenchKeyboardShortcutsPanel } from "@pstdio/workbench/react";
import type { Meta, StoryObj } from "@storybook/react";

const workbench = createWorkbench();
workbench.commands.registerCommand({ id: "notes.create", label: "New note" }, { execute() {} });
workbench.keybindings.registerKeybinding({
  sourceExtensionId: "pstdio.pstdio-notes",
  action: { kind: "command", commandId: "notes.create" },
  keybinding: "N",
  layer: "create",
});
const meta = {
  title: "Help/Keyboard shortcuts",
  component: WorkbenchKeyboardShortcutsPanel,
  args: { workbench },
  decorators: [
    (Story) => (
      <Dialog.Root open>
        <Dialog.Positioner>
          <Dialog.Content>
            <Story />
          </Dialog.Content>
        </Dialog.Positioner>
      </Dialog.Root>
    ),
  ],
} satisfies Meta<typeof WorkbenchKeyboardShortcutsPanel>;
export default meta;
type Story = StoryObj<typeof meta>;
export const AssignedShortcuts: Story = {};
