import { Stack, Text } from "@chakra-ui/react";
import type { CanvasMeta, CanvasVariant } from "@pstdio/canvas";
import { FileText, Folder } from "lucide-react";
import { useState } from "react";
import { TreeList } from "./tree-list";
import type { TreeListSection } from "./tree-list.types";

const meta: CanvasMeta<typeof TreeList> = {
  title: "Components/Data Display/Tree List/Move",
  component: TreeList,
};
export default meta;
type Story = CanvasVariant<typeof TreeList>;
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
  id: "components-data-display-tree-list-move--movable-files",
  render: () => <MovableFilesStory />,
};
const MovableNotes = () => {
  const [inFolder, setInFolder] = useState(false);
  const [order, setOrder] = useState(["note", "second"]);
  const [navigationOrder, setNavigationOrder] = useState(["workspaces", "notes"]);
  const note = { id: "note", label: "Research note", canDrag: true, canDrop: true };
  const second = { id: "second", label: "Meeting notes", canDrag: true, canDrop: true };
  return (
    <TreeList
      draggable
      expandedNodeIds={["notes", "folder"]}
      sections={[
        {
          id: "navigation",
          nodes: [
            { id: "workspaces", label: "Workspaces" },
            {
              id: "notes",
              label: "Notes",
              canDrop: true,
              children: [
                { id: "folder", label: "Ideas", canDrop: true, isContainer: true, children: inFolder ? [note] : [] },
                ...order.flatMap((id) => {
                  if (id === "second") return [second];
                  return inFolder ? [] : [note];
                }),
              ],
            },
          ].sort((a, b) => navigationOrder.indexOf(a.id) - navigationOrder.indexOf(b.id)),
        },
      ]}
      onReorderNodes={(_, ids) => setNavigationOrder(ids)}
      onMoveNode={(source, target, position) => {
        if (source !== "note" || !target) return;
        setInFolder(target === "folder");
        if (target === "second") setOrder(position === "after" ? ["second", "note"] : ["note", "second"]);
      }}
    />
  );
};
export const NotesInSortableNavigation: Story = {
  id: "components-data-display-tree-list-move--notes-in-sortable-navigation",
  render: () => <MovableNotes />,
};
export const ExpandedNavigation: Story = {
  id: "components-data-display-tree-list-move--expanded-navigation",
  tags: ["motion"],
  render: () => <MovableNotes />,
  parameters: {
    docs: {
      description: {
        story: "Drag Workspaces below expanded Notes. The placement line appears after the last visible descendant.",
      },
    },
  },
};
