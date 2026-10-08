import { Dialog } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { ShortcutReference } from "./keyboard-shortcuts-widget";

const meta = {
  title: "Help/Keyboard shortcuts",
  component: ShortcutReference,
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
} satisfies Meta<typeof ShortcutReference>;
export default meta;
type Story = StoryObj<typeof meta>;

export const BoundAndUnassigned: Story = {
  args: {
    shortcuts: [
      { id: "palette", label: "Toggle Command Palette", category: "Workbench", keybindings: ["Mod+P"] },
      {
        id: "document",
        label: "Open a document with a very long name in the project workspace",
        category: "Notes",
        keybindings: [["Mod+K", "Mod+O"], ["Mod+K", "Mod+N"], ["Mod+K", "Mod+D"], "Alt+O"],
      },
      { id: "note", label: "Create note", category: "Notes", keybindings: [] },
      { id: "link", label: "https://example.com/documentation", category: "Notes", keybindings: ["Mod+Shift+H"] },
      { id: "panel", label: "Notes + Inspector", category: "Notes", keybindings: ["Alt+Shift+N"] },
    ],
  },
};
