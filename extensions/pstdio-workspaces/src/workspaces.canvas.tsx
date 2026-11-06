import { Box, Button, Flex, HStack, Input, Stack, Text } from "@chakra-ui/react";
import { ScopedDialog as Dialog, Portal, Switch, TreeList } from "@pstdio/ui";
import { CodeEditor, DiffViewer } from "@pstdio/ui/diff";
import { ResourceListRenderer } from "@pstdio/ui/kanban-renderer";
import { useState } from "react";

export default {
  title: "Product/Workspaces/Workspaces extension",
  fullscreen: true,
  description:
    "The ordinary Workspaces extension owns presentation; native editors, trees and diff rendering stay shared.",
};

const attributes = [
  {
    id: "device",
    label: "Device",
    groupable: true,
    filterable: true,
    type: {
      kind: "enum" as const,
      options: [
        { value: "local", label: "MacBook Pro", icon: "monitor", note: "This device · 2 / 6 active", canCreate: true },
        { value: "online", label: "Studio iMac", icon: "monitor", note: "Online · 1 / 4 active", canCreate: false },
        {
          value: "offline",
          label: "Build box",
          icon: "monitor",
          note: "Last seen 2 days ago · Limit 2",
          canCreate: false,
        },
      ],
    },
  },
  { id: "type", label: "Type", type: { kind: "string" as const }, displayable: true, groupable: true },
  { id: "date", label: "Created", type: { kind: "date" as const }, sortable: true, displayable: true },
];
const rows = [
  {
    id: "project",
    title: "Project folder",
    icon: "folder",
    attributes: { id: "WS-1", device: "local", type: "Project folder", date: "2026-11-01" },
  },
  {
    id: "local",
    title: "Extract workspace presentation",
    icon: "git-branch",
    attributes: { id: "PS-61_A1", device: "local", type: "Git worktree", date: "2026-11-04" },
    children: [
      {
        id: "running",
        title: "Implement the Workspaces extension",
        icon: "loader-circle",
        attributes: { harness: "Codex", date: "2026-11-04" },
      },
      {
        id: "waiting",
        title: "Check file actions",
        icon: "circle-help",
        attributes: { harness: "Claude Code", date: "2026-11-04" },
      },
    ],
  },
  {
    id: "remote",
    title: "Review search changes",
    icon: "git-branch",
    attributes: { id: "PS-72_A1", device: "online", type: "Git worktree", date: "2026-11-03" },
  },
  {
    id: "offline",
    title: "Build release",
    icon: "git-branch",
    attributes: { id: "WS-4", device: "offline", type: "Git worktree", date: "2026-11-01" },
  },
];
const WorkspacesPreview = (props: { compact?: boolean }) => {
  const [opened, setOpened] = useState("");
  const [dialog, setDialog] = useState<"create" | "device" | undefined>();
  const listAttributes = attributes.map((attribute) => ({
    ...attribute,
    type:
      attribute.type.kind === "enum"
        ? {
            ...attribute.type,
            options: attribute.type.options.map((option) => ({
              ...option,
              onNoteClick: () => setDialog("device"),
            })),
          }
        : attribute.type,
  }));
  return (
    <Stack h="full" gap="0" minH="0">
      <ResourceListRenderer
        storageKey={props.compact ? "ps61-proposal-compact" : "ps61-proposal-nested"}
        attributes={listAttributes}
        rows={rows}
        defaultSettings={{
          viewMode: "list",
          columnGrouping: props.compact ? "none" : "device",
          showChildren: !props.compact,
          displayProperties: ["type", "date"],
        }}
        onRowClick={(row) => setOpened(row.title)}
        getRowContextMenuActions={(row) =>
          row.id === "remote" || row.id === "offline"
            ? [{ key: "history", label: "Open session history", onClick: () => setOpened(row.title) }]
            : [
                { key: "open", label: "Open", onClick: () => setOpened(row.title) },
                { key: "rename", label: "Rename", onClick: () => setOpened(`Rename ${row.title}`) },
              ]
        }
        createRow={{
          title: "New workspace",
          submitLabel: "Create workspace",
          fields: [],
          labels: { cancel: "Cancel", properties: "Properties", submitError: "Could not create", removeFile: "Remove" },
        }}
        onCreateRow={() => setDialog("create")}
      />
      <Dialog.Root open={Boolean(dialog)} onOpenChange={({ open }) => !open && setDialog(undefined)} placement="center">
        <Portal>
          <Dialog.Backdrop />
          <Dialog.Positioner>
            <Dialog.Content maxW="xl" p="lg">
              <Dialog.Title>{dialog === "create" ? "Create workspace" : "This device"}</Dialog.Title>
              {dialog === "create" ? <CreateWorkspaceForm /> : <DeviceLimit />}
              <Button variant="ghost" onClick={() => setDialog(undefined)}>
                Cancel
              </Button>
            </Dialog.Content>
          </Dialog.Positioner>
        </Portal>
      </Dialog.Root>
      {opened && (
        <Text aria-live="polite" px="md" py="sm">
          {opened}
        </Text>
      )}
    </Stack>
  );
};
export const GroupedAndNested = () => <WorkspacesPreview />;
export const Compact = () => <WorkspacesPreview compact />;

export const ProjectFiles = () => {
  const [selected, setSelected] = useState("README.md");
  const [expanded, setExpanded] = useState<string[]>(["src"]);
  return (
    <Flex h="full" minH="0">
      <Box w="2xs" borderRightWidth="1px" borderColor="border.subtle">
        <TreeList
          sections={[
            {
              id: "files",
              label: "Files",
              nodes: [
                {
                  id: "src",
                  label: "src",
                  icon: "folder",
                  isContainer: true,
                  children: [{ id: "src/index.ts", label: "index.ts", href: "#index" }],
                },
                { id: "README.md", label: "README.md", href: "#readme" },
              ],
            },
          ]}
          expandedSectionIds={["files"]}
          expandedNodeIds={expanded}
          activeNodeId={selected}
          onToggleNode={(id) =>
            setExpanded((ids) => (ids.includes(id) ? ids.filter((value) => value !== id) : [...ids, id]))
          }
          onNavigate={({ nodeId }) => setSelected(nodeId)}
        />
      </Box>
      <Stack flex="1" minW="0" gap="0">
        <Text px="md" py="sm" color="fg.muted">
          {selected}
        </Text>
        <Box flex="1" minH="0">
          <CodeEditor
            key={selected}
            language={selected.endsWith(".ts") ? "typescript" : "markdown"}
            fileName={selected}
            defaultCode={
              selected.endsWith(".ts")
                ? "export const ready = true;\n"
                : "# Project files\n\nThe project folder has no Changes tab.\n"
            }
            isEditable
            showLineNumbers
          />
        </Box>
      </Stack>
    </Flex>
  );
};

export const WorktreeChanges = () => (
  <Box h="full" minH="0">
    <DiffViewer
      diffs={[
        {
          change: "modified",
          oldPath: "src/index.ts",
          newPath: "src/index.ts",
          oldContent: "export const ready = false;\n",
          newContent: "export const ready = true;\n",
          additions: 1,
          deletions: 1,
        },
      ]}
      changedFilePaths={["src/index.ts"]}
      defaultSelectedPath="src/index.ts"
    />
  </Box>
);

export const DeviceLimit = () => {
  const [limit, setLimit] = useState("6");
  const [limited, setLimited] = useState(false);
  const [saved, setSaved] = useState("6");
  return (
    <Stack maxW="xl" p="lg" gap="lg">
      <Stack gap="xs">
        <Text textStyle="heading/M">Workspaces</Text>
        <Text color="fg.muted">Limits for this device. Other devices choose their own limits.</Text>
      </Stack>
      <Stack gap="sm">
        <Switch checked={limited} onCheckedChange={({ checked }) => setLimited(checked)}>
          Limit workspaces
        </Switch>
        <Text>Workspace limit</Text>
        <Input
          aria-label="Workspace limit"
          disabled={!limited}
          type="number"
          min="1"
          value={limit}
          onChange={(event) => setLimit(event.target.value)}
        />
        <Text color="fg.muted">
          More sessions wait as Queued until a slot opens. Auto Build waits while this device is full.
        </Text>
        <HStack>
          <Button variant="primary" onClick={() => setSaved(limit)}>
            Apply
          </Button>
          {limited && <Text aria-live="polite">2 of {saved} active</Text>}
        </HStack>
      </Stack>
      <Stack gap="xs">
        <Text>Other devices</Text>
        <Text color="fg.muted">Studio iMac · Online · 1 of 4 active</Text>
        <Text color="fg.muted">Build box · Offline · Limit 2</Text>
      </Stack>
    </Stack>
  );
};

const CreateWorkspaceForm = () => {
  const [name, setName] = useState("");
  return (
    <Stack gap="md" py="md">
      <Text>Git worktree</Text>
      <Input
        aria-label="Workspace name"
        placeholder="Workspace name"
        value={name}
        onChange={(event) => setName(event.target.value)}
      />
      <Button variant="primary" disabled={!name}>
        Create workspace
      </Button>
    </Stack>
  );
};
export const CreateWorkspaceModal = () => <WorkspacesPreview />;
export const ThisDeviceModal = () => <WorkspacesPreview />;
