import type { Meta, StoryObj } from "@storybook/react";
import { createWorkbench } from "../../core";
import { WorkbenchStory } from "../../examples/workbench-story";

const workbench = createWorkbench();
workbench.commands.registerCommand(
  { id: "create-ticket", label: "Create ticket", params: { content: { type: "string" } } },
  { execute() {} },
);
workbench.views.registerView({
  id: "tickets",
  title: "Tickets",
  body: {
    kind: "kanban",
    createCommandId: "create-ticket",
    attributes: [
      {
        id: "priority",
        label: "Priority",
        editable: true,
        type: { kind: "enum", options: [{ value: "high", label: "High" }] },
      },
    ],
    executeQuery: () => [],
    createRow: {
      title: "New ticket",
      submitLabel: "Create ticket",
      fields: [
        {
          id: "content",
          label: "Description",
          type: "markdown",
          required: true,
          placeholder: "Describe the ticket...",
        },
        { id: "files", label: "Attach files", type: "files", multiple: true },
      ],
      labels: {
        cancel: "Cancel",
        properties: "Properties",
        submitError: "Could not create ticket",
        removeFile: "Remove file",
      },
    },
    onCreateRow() {},
  },
});
workbench.keybindings.registerKeybinding({
  layer: "create",
  keybinding: "T",
  action: { kind: "command", commandId: "create-ticket" },
});
workbench.keyboard.open();
void workbench.keyboard.press("C").then(() => workbench.keyboard.press("T"));

const meta = {
  title: "pstdio-workbench/Reference/Command creation",
  component: WorkbenchStory,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof WorkbenchStory>;
export default meta;
type Story = StoryObj<typeof meta>;
export const SharedCreationForm: Story = { args: { workbench } };
