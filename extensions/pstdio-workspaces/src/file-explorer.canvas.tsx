import { Box, Button, CloseButton, Flex, Stack, Text } from "@chakra-ui/react";
import { ScopedDialog as Dialog, Portal, TreeList } from "@pstdio/ui";
import { CodeEditor } from "@pstdio/ui/diff";
import { useState } from "react";

export default {
  title: "Product/Workspaces/File explorer",
  fullscreen: true,
  description: "Right-click empty tree space to create an entry. Deletion confirms over the open editor.",
};

export const FileOperations = () => {
  const [files, setFiles] = useState(["README.md", "notes.md"]);
  const [selected, setSelected] = useState("README.md");
  const [creating, setCreating] = useState<"file" | "folder">();
  const [deleting, setDeleting] = useState<string>();
  const actions = (["file", "folder"] as const).map((kind) => ({
    key: `create-${kind}`,
    label: `New ${kind}`,
    onClick: () => setCreating(kind),
  }));
  return (
    <Flex h="full" minH="0">
      <Box w="2xs" display="flex" flexDirection="column" borderRightWidth="1px" borderColor="border.subtle">
        <TreeList
          backgroundContextActions={actions}
          sections={[
            {
              id: "files",
              label: "Files",
              collapsible: false,
              inlineInput: creating
                ? {
                    ariaLabel: creating === "file" ? "File name" : "Folder name",
                    onCommit: (name) => {
                      setFiles((files) => [...files, name]);
                      setCreating(undefined);
                    },
                    onCancel: () => setCreating(undefined),
                  }
                : undefined,
              nodes: files.map((name) => ({
                id: name,
                label: name,
                isNavigable: true,
                contextMenuItems: [{ id: "delete", label: "Delete file", onAction: () => setDeleting(name) }],
              })),
            },
          ]}
          activeNodeId={selected}
          onNavigate={({ nodeId }) => setSelected(nodeId)}
        />
      </Box>
      <Stack flex="1" minW="0" gap="0">
        <Text px="md" py="sm">
          {selected}
        </Text>
        <Box flex="1" minH="0">
          <CodeEditor
            fileName={selected}
            defaultCode="# Project files\n\nThe editor stays open during confirmation.\n"
            isEditable
          />
        </Box>
      </Stack>
      <Dialog.Root open={Boolean(deleting)} onOpenChange={({ open }) => !open && setDeleting(undefined)}>
        <Portal>
          <Dialog.Backdrop />
          <Dialog.Positioner>
            <Dialog.Content>
              <Dialog.Header>
                <Dialog.Title>Delete entry</Dialog.Title>
                <Dialog.CloseTrigger asChild>
                  <CloseButton size="sm" />
                </Dialog.CloseTrigger>
              </Dialog.Header>
              <Dialog.Body>
                <Text>Delete {deleting}? The entry and its contents will be permanently removed.</Text>
              </Dialog.Body>
              <Dialog.Footer>
                <Button variant="ghost" onClick={() => setDeleting(undefined)}>
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => {
                    setFiles((files) => files.filter((file) => file !== deleting));
                    setDeleting(undefined);
                  }}
                >
                  Delete
                </Button>
              </Dialog.Footer>
            </Dialog.Content>
          </Dialog.Positioner>
        </Portal>
      </Dialog.Root>
    </Flex>
  );
};
