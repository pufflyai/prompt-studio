import { Badge, Box, Button, HStack, Input, Stack, Text } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import {
  Bell,
  Copy,
  EllipsisVertical,
  FileText,
  Folder,
  Home,
  Pencil,
  Plus,
  Search,
  Settings,
  Star,
  Trash2,
} from "lucide-react";
import { type ReactNode, useState } from "react";
import { ResizableSplitLayout } from "../resizable-split-layout";
import {
  resolveSessionIndicatorColor,
  resolveSessionIndicatorIcon,
  type SessionCompletionStatus,
} from "../session-indicator";
import type { TreeListSection } from "../tree-list/tree-list.types";
import { Sidebar } from "./sidebar";
import { useSidebarStore } from "./sidebar.store";
import { SidebarProjectMenu } from "./sidebar-project-menu";

const sidebarSections: TreeListSection[] = [
  {
    id: "top-level",
    nodes: [
      { id: "home", label: "Home", icon: <Home size={14} />, isNavigable: true },
      { id: "notifications", label: "Notifications", icon: <Bell size={14} />, isNavigable: true },
    ],
  },
  {
    id: "docs",
    label: "Documentation",
    actions: [{ id: "add-doc", label: "Add document", icon: <Plus size={14} /> }],
    nodes: [
      {
        id: "overview",
        label: "Overview",
        icon: <FileText size={14} />,
        isNavigable: true,
        navigationIntent: { id: "docs/open", payload: { slug: "overview" } },
        actions: [
          { id: "edit", label: "Edit", icon: <Pencil size={14} /> },
          {
            id: "more",
            label: "More actions",
            icon: <EllipsisVertical size={14} />,
            menuItems: [
              { id: "rename", label: "Rename" },
              { id: "duplicate", label: "Duplicate", icon: <Copy size={14} /> },
              { id: "delete", label: "Delete", icon: <Trash2 size={14} /> },
            ],
          },
        ],
      },
      {
        id: "guides",
        label: "Guides",
        icon: <Folder size={14} />,
        children: [
          {
            id: "projects",
            label: "Projects",
            icon: <Folder size={14} />,
            children: [
              {
                id: "projects-create",
                label: "Create a project",
                icon: <FileText size={14} />,
                isNavigable: true,
              },
              {
                id: "projects-settings",
                label: "Project settings",
                icon: <Star size={14} />,
                isNavigable: true,
                children: [
                  {
                    id: "projects-settings-advanced",
                    label: "Advanced",
                    isNavigable: true,
                  },
                ],
              },
            ],
          },
          {
            id: "pipelines",
            label: "Pipelines",
            icon: <Folder size={14} />,
            children: [
              {
                id: "pipelines-author",
                label: "Author pipeline",
                icon: <FileText size={14} />,
                isNavigable: true,
                actions: [
                  {
                    id: "more",
                    label: "More actions",
                    icon: <EllipsisVertical size={14} />,
                    menuItems: [
                      { id: "rename", label: "Rename" },
                      { id: "delete", label: "Delete", icon: <Trash2 size={14} /> },
                    ],
                  },
                ],
              },
              {
                id: "pipelines-run",
                label: "Run pipeline",
                icon: <FileText size={14} />,
                isNavigable: true,
                disabled: true,
                description: "Coming soon",
              },
            ],
          },
        ],
      },
    ],
  },
  {
    id: "settings",
    label: "Settings",
    nodes: [
      {
        id: "workspace",
        label: "Workspace",
        icon: <Settings size={14} />,
        isNavigable: true,
      },
    ],
  },
];

const sessionStatuses: SessionCompletionStatus[] = [
  "in_progress",
  "awaiting_input",
  "completed",
  "failed",
  "cancelled",
];

const coloredSessionSections: TreeListSection[] = [
  {
    id: "sessions",
    label: "Sessions",
    nodes: sessionStatuses.map((status) => ({
      id: status,
      label: status.replaceAll("_", " "),
      icon: (() => {
        const IconComponent = resolveSessionIndicatorIcon(status);
        return <IconComponent size={14} />;
      })(),
      iconColor: resolveSessionIndicatorColor(status),
      isNavigable: true,
      navigationIntent: { id: `session/${status}` },
    })),
  },
];

const SidebarShell = (props: { storageKey: string; sections?: TreeListSection[]; header?: ReactNode }) => {
  const { storageKey, sections = sidebarSections, header } = props;
  const [activeNodeId, setActiveNodeId] = useState<string | null>("overview");
  const [navigationOutput, setNavigationOutput] = useState("No navigation yet");
  const [openState, setOpenState] = useState(true);

  const openSidebar = useSidebarStore(storageKey, (state) => state.openSidebar);
  const closeSidebar = useSidebarStore(storageKey, (state) => state.closeSidebar);
  const setSidebarOpen = (open: boolean) => {
    if (open) openSidebar();
    else closeSidebar();
  };

  return (
    <Stack align="stretch" h="560px" borderWidth="1px" borderColor="border.muted">
      <ResizableSplitLayout
        flex="1"
        minH="0"
        minW="0"
        collapsed={!openState}
        defaultSizePx={240}
        minSizePx={200}
        maxSizePx={480}
        contentMinSizePx={320}
        resizeLabel="Resize sidebar"
        showResizeSeparator={false}
        onCollapsedChange={(collapsed) => setSidebarOpen(!collapsed)}
        resizablePanel={
          <Sidebar
            storageKey={storageKey}
            sections={sections}
            activeNodeId={activeNodeId}
            resizable={false}
            width="full"
            header={
              header ?? (
                <HStack gap="2" w="100%">
                  <Search size={14} />
                  <Input size="sm" placeholder="Search docs" />
                </HStack>
              )
            }
            footer={
              <HStack justify="space-between" w="100%">
                <Text textStyle="paragraph/XS/regular" color="fg.muted">
                  Footer actions stay visible
                </Text>
                <Button size="xs" variant="ghost">
                  Help
                </Button>
              </HStack>
            }
            onOpenChange={setOpenState}
            onNavigate={(event) => {
              setActiveNodeId(event.nodeId);
              setNavigationOutput(`${event.nodeId} (${event.intent?.id ?? "no-intent"})`);
            }}
          />
        }
        contentPanel={
          <Stack flex="1" p="4" gap="3" minW="0">
            <HStack gap="2" flexWrap="wrap">
              <Button size="sm" onClick={openSidebar}>
                Reopen Sidebar
              </Button>
              <Badge colorPalette={openState ? "green" : "orange"}>{openState ? "Open" : "Hidden"}</Badge>
            </HStack>

            <Box borderWidth="1px" borderColor="border.muted" borderRadius="md" p="3">
              <Text textStyle="paragraph/S/medium">Navigation output</Text>
              <Text textStyle="paragraph/S/regular" color="fg.muted">
                {navigationOutput}
              </Text>
            </Box>

            <Box borderWidth="1px" borderColor="border.muted" borderRadius="md" p="3" flex="1">
              <Text textStyle="paragraph/S/regular" color="fg.muted">
                Content area reclaims width when sidebar is hidden.
              </Text>
            </Box>
          </Stack>
        }
      />
    </Stack>
  );
};

const meta: Meta<typeof Sidebar> = {
  title: "Components/Navigation/Sidebar",
  component: Sidebar,
  parameters: {
    layout: "fullscreen",
  },
};

export default meta;

type Story = StoryObj<typeof Sidebar>;

export const DefaultDocsTree: Story = {
  render: () => <SidebarShell storageKey="storybook-sidebar-default" />,
};

export const HeaderAndFooterLayout: Story = {
  render: () => <SidebarShell storageKey="storybook-sidebar-layout" />,
};

export const ProjectMenuHeader: Story = {
  render: () => (
    <SidebarShell
      storageKey="storybook-sidebar-project-menu"
      header={<SidebarProjectMenu name="Prompt Studio" projectsLabel="Projects" onSelectProjects={() => undefined} />}
    />
  ),
  parameters: {
    docs: {
      description: {
        story: "Project menu dropdown remains visible when rendered inside the clipped resizable sidebar panel.",
      },
    },
  },
};

export const HiddenWithExternalReopen: Story = {
  render: () => <SidebarShell storageKey="storybook-sidebar-reopen" />,
  parameters: {
    docs: {
      description: {
        story: "Hide the sidebar by dragging past the collapse threshold and reopen from the external button.",
      },
    },
  },
};

export const PersistenceRestore: Story = {
  render: () => <SidebarShell storageKey="storybook-sidebar-persist" />,
  parameters: {
    docs: {
      description: {
        story: "Expand or collapse nodes, hide the sidebar, then refresh Storybook to verify persisted state restore.",
      },
    },
  },
};

export const NamespaceIsolation: Story = {
  render: () => {
    return (
      <Stack direction={{ base: "column", lg: "row" }} gap="4" p="4">
        <Box flex="1" minW="0">
          <Text mb="2" textStyle="paragraph/S/medium">
            Sidebar A
          </Text>
          <SidebarShell storageKey="storybook-sidebar-namespace-a" sections={sidebarSections} />
        </Box>
        <Box flex="1" minW="0">
          <Text mb="2" textStyle="paragraph/S/medium">
            Sidebar B
          </Text>
          <SidebarShell storageKey="storybook-sidebar-namespace-b" sections={sidebarSections} />
        </Box>
      </Stack>
    );
  },
};

export const ColoredSessionIcons: Story = {
  render: () => <SidebarShell storageKey="storybook-sidebar-colored-icons" sections={coloredSessionSections} />,
  parameters: {
    docs: {
      description: {
        story: "Sidebar nodes can provide iconColor so status-driven icons keep their semantic colors.",
      },
    },
  },
};
