import { Stack, Text } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { FileText, Folder } from "lucide-react";
import { useState } from "react";
import { expect, fireEvent, within } from "storybook/test";
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

const MovableNotes = () => {
  const [inFolder, setInFolder] = useState(false);
  const note = { id: "note", label: "Research note", canDrag: true };
  return (
    <TreeList
      draggable
      expandedNodeIds={["notes", "folder"]}
      sections={[
        {
          id: "navigation",
          nodes: [
            {
              id: "notes",
              label: "Notes",
              canDrop: true,
              children: [
                { id: "folder", label: "Ideas", canDrop: true, isContainer: true, children: inFolder ? [note] : [] },
                ...(inFolder ? [] : [note]),
              ],
            },
          ],
        },
      ]}
      onMoveNode={(_source, target) => setInFolder(target === "folder")}
    />
  );
};

export const NotesInSortableNavigation: Story = {
  render: () => <MovableNotes />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const transfer = new DataTransfer();
    const note = canvas.getByRole("option", { name: "Research note" });
    fireEvent.dragStart(note.parentElement!, { dataTransfer: transfer });
    fireEvent.drop(canvas.getByRole("option", { name: "Ideas" }).parentElement!, { dataTransfer: transfer });
    await expect(canvas.getByRole("option", { name: "Research note" })).toHaveAttribute("aria-level", "3");
    fireEvent.dragStart(canvas.getByRole("option", { name: "Research note" }).parentElement!, {
      dataTransfer: transfer,
    });
    fireEvent.drop(canvas.getByRole("option", { name: "Notes" }).parentElement!, { dataTransfer: transfer });
    await expect(canvas.getByRole("option", { name: "Research note" })).toHaveAttribute("aria-level", "2");
  },
};
