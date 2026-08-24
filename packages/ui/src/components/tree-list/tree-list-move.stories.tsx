import { Stack, Text } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { FileText, Folder } from "lucide-react";
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
  const [fileParent, setFileParent] = useState<"" | "docs">("");
  const [folderParent, setFolderParent] = useState<"" | "docs">("");
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
          icon: <Folder size={14} />,
          isContainer: true,
          canDrop: true,
          children: [
            ...(folderParent === "docs"
              ? [
                  {
                    id: "src",
                    label: "src",
                    icon: <Folder size={14} />,
                    isContainer: true,
                    canDrag: true,
                    canDrop: true,
                  },
                ]
              : []),
            ...(fileParent === "docs" ? [file] : []),
          ],
        },
        ...(folderParent
          ? []
          : [{ id: "src", label: "src", icon: <Folder size={14} />, isContainer: true, canDrag: true, canDrop: true }]),
        ...(fileParent ? [] : [file]),
      ],
    },
  ];

  return (
    <Stack maxW="20rem" h="16rem" borderWidth="1px" gap="0">
      <Text p="xs" textStyle="label/S/regular" color="fg.muted">
        Drag README.md or src onto docs or the empty tree background.
      </Text>
      <TreeList
        sections={sections}
        expandedNodeIds={["docs"]}
        rowVariant="tree"
        onMoveNode={(sourceNodeId, targetNodeId) => {
          const parent = targetNodeId === "docs" ? "docs" : "";
          if (sourceNodeId === "src") setFolderParent(parent);
          else setFileParent(parent);
        }}
      />
    </Stack>
  );
};

export const MovableFiles: Story = {
  render: () => <MovableFilesStory />,
};
