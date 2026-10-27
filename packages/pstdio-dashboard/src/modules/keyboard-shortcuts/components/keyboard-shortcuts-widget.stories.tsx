import { Dialog } from "@chakra-ui/react";
import { createWorkbench } from "@pstdio/workbench";
import { WorkbenchKeyboardShortcutsPanel } from "@pstdio/workbench/react";
import type { Meta, StoryObj } from "@storybook/react";

const workbench = createWorkbench();
workbench.resources.registerKind({ kind: "note", label: "Notes", extensionId: "pstdio.pstdio-notes" });
workbench.commands.registerCommand({ id: "notes.create", label: "New note" }, { execute() {} });
workbench.keybindings.registerKeybinding({
  sourceExtensionId: "pstdio.pstdio-notes",
  action: { kind: "command", commandId: "notes.create" },
  keybinding: "N",
  layer: "create",
});
workbench.commands.registerCommand(
  { id: "sessions.open", label: "Go to sessions", category: "Sessions" },
  { execute() {} },
);
workbench.keybindings.registerKeybinding({
  keybinding: "Alt+Shift+S",
  action: { kind: "command", commandId: "sessions.open" },
});
const meta = {
  title: "Help/Keyboard shortcuts",
  component: WorkbenchKeyboardShortcutsPanel,
  args: { workbench },
  decorators: [
    (Story) => (
      <Dialog.Root open>
        <Dialog.Positioner>
          <Dialog.Content maxW="palette-width" w="full">
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
export const FilteredResource: Story = { args: { initialFilter: "Sessions" } };
