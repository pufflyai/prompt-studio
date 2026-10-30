import { Box } from "@chakra-ui/react";
import type { CanvasMeta, CanvasVariant } from "@pstdio/canvas";
import { Ellipsis, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
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
  description:
    "Named sections support inline renaming and shared context actions. Hosts own group persistence and membership.",
} satisfies CanvasMeta<typeof EditableGroup>;
export default meta;
type Story = CanvasVariant<typeof meta>;
export const Default: Story = {
  id: "components-tree-list-groups--default",
};
export const InlineName: Story = {
  id: "components-tree-list-groups--inline-name",
  args: { editing: true },
};
