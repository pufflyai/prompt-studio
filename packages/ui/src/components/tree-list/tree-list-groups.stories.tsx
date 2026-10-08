import { Box } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { Ellipsis, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { expect, userEvent, within } from "storybook/test";
import { TreeList } from "./tree-list";

const EditableGroup = (props: { editing?: boolean }) => {
  const [label, setLabel] = useState("Research");
  const [editing, setEditing] = useState(props.editing ?? false);
  const [removed, setRemoved] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const menuItems = [
    { id: "rename", label: "Rename group", icon: <Pencil />, onAction: () => setEditing(true) },
    { id: "remove", label: "Remove group", icon: <Trash2 />, onAction: () => setRemoved(true) },
  ];
  return (
    <Box maxW="20rem">
      <TreeList
        sections={
          removed
            ? []
            : [
                {
                  id: "research",
                  label,
                  nodes: [{ id: "notes", label: "Meeting notes" }],
                  contextMenuItems: menuItems,
                  actions: [{ id: "group-actions", label: "Group actions", icon: <Ellipsis />, menuItems }],
                  inlineInput: editing
                    ? {
                        ariaLabel: "Group name",
                        defaultValue: label,
                        onCommit: (value) => {
                          if (!value) throw new Error("Enter a group name.");
                          setLabel(value);
                          setEditing(false);
                        },
                        onCancel: () => setEditing(false),
                      }
                    : undefined,
                },
              ]
        }
        expandedSectionIds={expanded ? ["research"] : []}
        onToggleSection={() => setExpanded(!expanded)}
      />
    </Box>
  );
};

const meta = {
  title: "Components/Tree List/Groups",
  component: EditableGroup,
  parameters: {
    docs: {
      description: {
        component:
          "Named sections support inline renaming and shared context actions. Hosts own group persistence and membership.",
      },
    },
  },
} satisfies Meta<typeof EditableGroup>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const InlineName: Story = {
  args: { editing: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByRole("textbox", { name: "Group name" });
    await userEvent.clear(input);
    await userEvent.type(input, "Product research{Enter}");
    await expect(canvas.getByText("Product research")).toBeVisible();
  },
};
