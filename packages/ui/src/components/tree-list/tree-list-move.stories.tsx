import { Stack, Text } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { FileText } from "lucide-react";
import { useState } from "react";
import { TreeList } from "./tree-list";
import type { TreeListSection } from "./tree-list.types";

const meta: Meta<typeof TreeList> = {
  title: "Components/Data Display/Tree List/Move",
  component: TreeList,
};

export default meta;
type Story = StoryObj<typeof TreeList>;

const MovableFilesStory = () => {
  const [parent, setParent] = useState<"" | "docs">("");
  const file = {
    id: "README.md",
    label: "README.md",
    icon: <FileText size={14} />,
    canDrag: true,
  };
  const sections: TreeListSection[] = [
    {
      id: "files",
      nodes: [
        {
          id: "docs",
          label: "docs",
          isContainer: true,
          canDrop: true,
          children: parent === "docs" ? [file] : [],
        },
        ...(parent ? [] : [file]),
      ],
    },
  ];

  return (
    <Stack maxW="20rem" h="16rem" borderWidth="1px" gap="0">
      <Text p="xs" textStyle="label/S/regular" color="fg.muted">
        Drag README.md onto docs or the empty tree background.
      </Text>
      <TreeList
        sections={sections}
        expandedNodeIds={["docs"]}
        rowVariant="tree"
        onMoveNode={(_sourceNodeId, targetNodeId) => setParent(targetNodeId === "docs" ? "docs" : "")}
      />
    </Stack>
  );
};

export const MovableFiles: Story = {
  render: () => <MovableFilesStory />,
};
