import { Box, Flex, Stack, Text } from "@chakra-ui/react";
import { DeleteConfirmationModal, getIconComponent, TreeList } from "@pstdio/ui";
import { CodeEditor } from "@pstdio/ui/diff";
import { useState } from "react";

const File = getIconComponent("file");
const Folder = getIconComponent("folder");

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
            language="markdown"
            fileName={selected}
            defaultCode="# Project files\n\nThe editor stays open during confirmation.\n"
            isEditable
          />
        </Box>
      </Stack>
      <DeleteConfirmationModal
        open={Boolean(deleting)}
        headline={`Delete entry: ${deleting}?`}
        notificationText="The entry and its contents will be permanently removed."
        buttonText="Delete"
        onClose={() => setDeleting(undefined)}
        onDelete={() => setFiles((files) => files.filter((file) => file !== deleting))}
      />
    </Flex>
  );
};

export const GitIgnoredEntries = () => {
  const [selected, setSelected] = useState("readme");
  const sections = [
    {
      id: "files",
      label: "Files",
      collapsible: false,
      nodes: [
        { id: "readme", label: "README.md", icon: <File />, isNavigable: true, rowVariant: "file" as const },
        {
          id: "cache",
          label: ".cache",
          icon: <Folder />,
          tone: "muted" as const,
          rowVariant: "file" as const,
          children: [
            {
              id: "cache/data",
              label: "data.json",
              icon: <File />,
              tone: "muted" as const,
              isNavigable: true,
              rowVariant: "file" as const,
            },
          ],
        },
        {
          id: "log",
          label: "debug.log",
          icon: <File />,
          tone: "muted" as const,
          isNavigable: true,
          rowVariant: "file" as const,
        },
      ],
    },
  ];
  return <TreeList sections={sections} activeNodeId={selected} onNavigate={({ nodeId }) => setSelected(nodeId)} />;
};
