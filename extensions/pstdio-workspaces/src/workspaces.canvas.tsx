import { Box, Button, CloseButton, Flex, Input, Stack, Tabs, Text } from "@chakra-ui/react";
import { Breadcrumb, ScopedDialog as Dialog, getIconComponent, Portal, TreeList } from "@pstdio/ui";
import { CodeEditor, DiffViewer } from "@pstdio/ui/diff";
import { ResourceListRenderer } from "@pstdio/ui/kanban-renderer";
import { useState } from "react";

export default {
  title: "Product/Workspaces/Workspaces extension",
  fullscreen: true,
  description:
    "The ordinary Workspaces extension owns presentation; native editors, trees and diff rendering stay shared.",
};

const Plus = getIconComponent("plus");

const attributes = [
  {
    id: "device",
    label: "Device",
    groupable: true,
    filterable: true,
    type: {
      kind: "enum" as const,
      options: [
        { value: "local", label: "MacBook Pro", icon: "monitor" },
        { value: "online", label: "Studio iMac", icon: "monitor" },
        { value: "offline", label: "Build box", icon: "monitor" },
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
const WorkspacesPreview = (props: { compact?: boolean; initial?: "create" }) => {
  const [opened, setOpened] = useState("");
  const [dialog, setDialog] = useState<"create" | undefined>(props.initial);
  const listAttributes = attributes.map((attribute) => ({
    ...attribute,
    type:
      attribute.type.kind === "enum"
        ? {
            ...attribute.type,
            options: attribute.type.options.map((option) => ({
              ...option,
              contextMenuActions: [
                ...(option.value === "local"
                  ? [{ id: "create", label: "Create workspace", onAction: () => setDialog("create") }]
                  : []),
              ],
            })),
          }
        : attribute.type,
  }));
  return (
    <Stack h="full" gap="0" minH="0">
      <Breadcrumb
        items={[
          {
            title: "Workspaces",
            contextMenuActions: [
              {
                key: "create",
                label: "Create workspace",
                icon: <Plus size={14} />,
                onClick: () => setDialog("create"),
              },
            ],
          },
        ]}
      />
      <ResourceListRenderer
        storageKey={props.compact ? "ps61-proposal-compact" : "workspaces-grouped-flat"}
        attributes={listAttributes}
        rows={rows}
        defaultSettings={{
          viewMode: "list",
          columnGrouping: props.compact ? "none" : "device",
          showChildren: false,
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
      />
      <Dialog.Root
        open={Boolean(dialog)}
        size="lg"
        scrollBehavior="inside"
        onOpenChange={({ open }) => !open && setDialog(undefined)}
      >
        <Portal>
          <Dialog.Backdrop />
          <Dialog.Positioner>
            <Dialog.Content>
              <Dialog.Header>
                <Dialog.Title>Create workspace</Dialog.Title>
                <Dialog.CloseTrigger asChild>
                  <CloseButton size="sm" />
                </Dialog.CloseTrigger>
              </Dialog.Header>
              <Dialog.Body>
                <CreateWorkspaceForm
                  onCreate={(name) => {
                    setOpened(`Created ${name}`);
                    setDialog(undefined);
                  }}
                />
              </Dialog.Body>
              <Dialog.Footer>
                <Button size="sm" variant="ghost" onClick={() => setDialog(undefined)}>
                  Cancel
                </Button>
              </Dialog.Footer>
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
export const GroupedByDevice = () => <WorkspacesPreview />;
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

const CreateWorkspaceForm = (props: { onCreate: (name: string) => void }) => {
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
      <Button variant="primary" disabled={!name.trim()} onClick={() => props.onCreate(name.trim())}>
        <Plus size={14} /> Create workspace
      </Button>
    </Stack>
  );
};
export const CreateWorkspaceModal = () => <WorkspacesPreview initial="create" />;

// The multi-resource list keeps the host tab surface so it can share Main with a session.
export const WorkspacesWithTabs = () => (
  <Tabs.Root defaultValue="workspaces" h="full" display="flex" flexDirection="column" minH="0" size="sm">
    <Tabs.List>
      <Tabs.Trigger value="workspaces">Workspaces</Tabs.Trigger>
    </Tabs.List>
    <Tabs.Content value="workspaces" flex="1" minH="0" p="0">
      <WorkspacesPreview />
    </Tabs.Content>
  </Tabs.Root>
);
