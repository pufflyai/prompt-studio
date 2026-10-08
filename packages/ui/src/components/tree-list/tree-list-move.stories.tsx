import { Stack, Text } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { FileText, Folder } from "lucide-react";
import { useState } from "react";
import { expect, fireEvent, waitFor, within } from "storybook/test";
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
  const [order, setOrder] = useState(["note", "second"]);
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
          ],
        },
      ]}
      onMoveNode={(source, target, position) => {
        if (source !== "note" || !target) return;
        setInFolder(target === "folder");
        if (target === "second") setOrder(position === "after" ? ["second", "note"] : ["note", "second"]);
      }}
    />
  );
};

export const NotesInSortableNavigation: Story = {
  render: () => <MovableNotes />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const transfer = new DataTransfer();
    const drag = (type: string, element: HTMLElement, clientY = 0) =>
      fireEvent(element, new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer: transfer, clientY }));
    const moveAt = (after: boolean) => {
      const row = canvas.getByRole("option", { name: "Research note" });
      const second = canvas.getByRole("option", { name: "Meeting notes" });
      const bounds = second.parentElement!.getBoundingClientRect();
      drag("dragstart", row.parentElement!);
      drag("dragover", second.parentElement!, after ? bounds.bottom - 1 : bounds.top + 1);
      drag("drop", second.parentElement!, after ? bounds.bottom - 1 : bounds.top + 1);
    };
    moveAt(true);
    await waitFor(() =>
      expect(
        canvas
          .getByRole("option", { name: "Meeting notes" })
          .compareDocumentPosition(canvas.getByRole("option", { name: "Research note" })) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy(),
    );
    moveAt(false);
    await waitFor(() =>
      expect(
        canvas
          .getByRole("option", { name: "Research note" })
          .compareDocumentPosition(canvas.getByRole("option", { name: "Meeting notes" })) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy(),
    );

    drag("dragstart", canvas.getByRole("option", { name: "Research note" }).parentElement!);
    drag("drop", canvas.getByRole("option", { name: "Ideas" }).parentElement!);
    await waitFor(() =>
      expect(canvas.getByRole("option", { name: "Research note" })).toHaveAttribute("aria-level", "3"),
    );
    drag("dragstart", canvas.getByRole("option", { name: "Research note" }).parentElement!);
    drag("drop", canvas.getByRole("option", { name: "Notes" }).parentElement!);
    await waitFor(() =>
      expect(canvas.getByRole("option", { name: "Research note" })).toHaveAttribute("aria-level", "2"),
    );
  },
};
