import { Button, Stack, Text } from "@chakra-ui/react";
import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";
import { TreeList } from "@pstdio/ui";
import { useState } from "react";
import { createWorkbench, type ResourceRef, type TreeViewSection } from "../../../core";
import { WorkbenchThemeProvider } from "../../theme/workbench-theme-provider";
import { resolveTreeListSelection } from "./tree-list-adapter";

const ticketPage = { kind: "page", extensionId: "planner", id: "ticket" } as const;
const workspacePage = { kind: "page", extensionId: "pstdio", id: "workspace" } as const;
const ticket = { type: "ticket", id: "ticket" };
const workspace = (id: string) => ({ type: "workspace", id });
const sections = [
  {
    id: "context",
    label: "Ticket context",
    collapsible: false,
    nodes: [
      {
        id: "body",
        label: "Ticket body",
        selected: true,
        target: { kind: "page", page: ticketPage, resource: ticket },
      },
      ...["first", "second"].map((id) => ({ id, label: `${id} workspace`, resource: workspace(id) })),
    ],
  },
] satisfies TreeViewSection[];
const WorkspaceSelection = () => {
  const [selected, setSelected] = useState("first");
  const resource = selected === "body" ? ticket : workspace(selected);
  const activeNodeId = resolveTreeListSelection({
    sections,
    childrenByNodeId: {},
    activeResource: resource,
    activeLocation: { page: selected === "body" ? ticketPage : workspacePage, resource },
  });
  return (
    <TreeList
      sections={sections.map((section) => ({
        ...section,
        nodes: section.nodes.map((node) => ({
          id: node.id,
          label: node.label,
          isNavigable: true,
        })),
      }))}
      activeNodeId={activeNodeId}
      onNavigate={(event) => setSelected(event.nodeId)}
    />
  );
};
const meta = {
  title: "Product/Workbench/Navigation/Tree/Workspace selection",
  component: WorkspaceSelection,
  decorators: [
    (Story) => (
      <WorkbenchThemeProvider>
        <Story />
      </WorkbenchThemeProvider>
    ),
  ],
} satisfies CanvasMeta<typeof WorkspaceSelection>;
export default meta;
type Story = CanvasFrame<typeof meta>;
export const TicketContext: Story = {
  id: "pstdio-workbench-guides-workspace-selection--ticket-context",
};

const FileNavigation = () => {
  const [path, setPath] = useState<string>();
  const [workbench] = useState(() => {
    const core = createWorkbench();
    core.pages.registerPage({
      id: "files",
      modeId: "project",
      ref: { kind: "page", extensionId: "example", id: "files" },
      path: "files",
      resource: { kinds: [{ kind: "resource-kind", id: "workspace" }] },
      document: { metadataKey: "filePath" },
      main: { kind: "panels" },
      slots: [],
    });
    return core;
  });
  const page = { kind: "page", extensionId: "example", id: "files" } as const;
  const parent = { ...page, id: "workspaces" };
  const workspace = { type: "workspace", id: "project-folder" };
  const resource: ResourceRef = { ...workspace, metadata: path ? { filePath: path } : {} };
  const navigation: TreeViewSection[] = [
    {
      id: "project",
      nodes: [
        { id: "files", label: "Files", target: { kind: "page", page, resource: workspace } },
        { id: "workspaces", label: "Workspaces", target: { kind: "page", page: parent } },
      ],
    },
  ];
  const activeNodeId = resolveTreeListSelection({
    sections: navigation,
    childrenByNodeId: {},
    activeLocation: { page, resource, parent: { page: parent } },
    activeResource: resource,
    resourceReferenceKey: (value) => workbench.pages.resourceReferenceKey(value),
  });
  return (
    <Stack>
      <TreeList
        sections={navigation.map((section) => ({
          id: section.id,
          nodes: section.nodes.map(({ id, label }) => ({ id, label, isNavigable: true })),
        }))}
        activeNodeId={activeNodeId}
      />
      <Button onClick={() => setPath("README.md")}>Open README.md</Button>
      <Button onClick={() => setPath("src/index.ts")}>Open src/index.ts</Button>
      <Text>{path ?? "Select a file"}</Text>
    </Stack>
  );
};
export const ProjectFiles: Story = {
  render: () => <FileNavigation />,
  description: "Open either file and keep Files selected in project navigation.",
};
