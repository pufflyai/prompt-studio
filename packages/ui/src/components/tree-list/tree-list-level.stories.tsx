import { Box } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { ArrowLeft, FileText, Plus } from "lucide-react";
import { TreeList } from "./tree-list";

const meta: Meta<typeof TreeList> = {
  title: "Components/Data Display/Tree List/Navigation Level",
  component: TreeList,
};
export default meta;
type Story = StoryObj<typeof TreeList>;
export const NotesLevel: Story = {
  render: () => (
    <Box maxW="sm" p="xs">
      <TreeList
        rowVariant="compact"
        sections={[
          {
            id: "back",
            canReorder: false,
            nodes: [
              {
                id: "back",
                label: "Project",
                icon: <ArrowLeft />,
                rowVariant: "back",
                canHide: false,
                canReorder: false,
                canDrag: false,
                canDrop: false,
              },
            ],
          },
          {
            id: "notes",
            label: "Notes",
            actions: [{ id: "new", label: "New note", icon: <Plus /> }],
            nodes: [
              { id: "one", label: "Release checklist", icon: <FileText /> },
              { id: "two", label: "Team notes", icon: <FileText /> },
            ],
          },
        ]}
      />
    </Box>
  ),
};
