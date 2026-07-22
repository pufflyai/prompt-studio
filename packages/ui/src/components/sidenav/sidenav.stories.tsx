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
import { ResizableSplitLayout } from "@/components/layout/resizable-split-layout";
import type { ResourceContextAction } from "@/components/overlays/resource-context-menu";
import {
  resolveSessionIndicatorColor,
  resolveSessionIndicatorIcon,
  type SessionCompletionStatus,
} from "@/components/primitives/session-indicator";
import type { TreeListSection } from "../tree-list/tree-list.types";
import { Sidenav } from "./sidenav";
import { useSidenavStore } from "./sidenav.store";

const sidenavSections: TreeListSection[] = [
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

interface SidenavShellProps {
  storageKey: string;
  sections?: TreeListSection[];
  header?: ReactNode;
  contextActions?: ResourceContextAction[];
}

const SidenavShell = (props: SidenavShellProps) => {
  const { storageKey, sections = sidenavSections, header, contextActions } = props;
  const [activeNodeId, setActiveNodeId] = useState<string | null>("overview");
  const [navigationOutput, setNavigationOutput] = useState("No navigation yet");
  const [openState, setOpenState] = useState(true);

  const openSidenav = useSidenavStore(storageKey, (state) => state.openSidenav);
  const closeSidenav = useSidenavStore(storageKey, (state) => state.closeSidenav);
  const setSidenavOpen = (open: boolean) => {
    if (open) openSidenav();
    else closeSidenav();
  };

  return (
    <Stack align="stretch" h="560px" borderWidth="1px" borderColor="border.subtle">
      <ResizableSplitLayout
        flex="1"
        minH="0"
        minW="0"
        collapsed={!openState}
        defaultSizePx={240}
        minSizePx={200}
        maxSizePx={480}
        contentMinSizePx={320}
        resizeLabel="Resize sidenav"
        showResizeSeparator={false}
        onCollapsedChange={(collapsed) => setSidenavOpen(!collapsed)}
        resizablePanel={
          <Sidenav
            storageKey={storageKey}
            sections={sections}
            contextActions={contextActions}
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
              <Button size="sm" onClick={openSidenav}>
                Reopen Sidenav
              </Button>
              <Badge colorPalette={openState ? "green" : "orange"}>{openState ? "Open" : "Hidden"}</Badge>
            </HStack>

            <Box borderWidth="1px" borderColor="border.subtle" borderRadius="md" p="3">
              <Text textStyle="paragraph/S/medium">Navigation output</Text>
              <Text textStyle="paragraph/S/regular" color="fg.muted">
                {navigationOutput}
              </Text>
            </Box>

            <Box borderWidth="1px" borderColor="border.subtle" borderRadius="md" p="3" flex="1">
              <Text textStyle="paragraph/S/regular" color="fg.muted">
                Content area reclaims width when sidenav is hidden.
              </Text>
            </Box>
          </Stack>
        }
      />
    </Stack>
  );
};

const meta: Meta<typeof Sidenav> = {
  title: "Components/Navigation/Sidenav",
  component: Sidenav,
  parameters: {
    layout: "fullscreen",
  },
};

export default meta;

type Story = StoryObj<typeof Sidenav>;

export const DefaultDocsTree: Story = {
  render: () => <SidenavShell storageKey="storybook-sidenav-default" />,
};

export const HeaderAndFooterLayout: Story = {
  render: () => <SidenavShell storageKey="storybook-sidenav-layout" />,
};

export const HiddenWithExternalReopen: Story = {
  render: () => <SidenavShell storageKey="storybook-sidenav-reopen" />,
  parameters: {
    docs: {
      description: {
        story: "Hide the sidenav by dragging past the collapse threshold and reopen from the external button.",
      },
    },
  },
};

export const PersistenceRestore: Story = {
  render: () => <SidenavShell storageKey="storybook-sidenav-persist" />,
  parameters: {
    docs: {
      description: {
        story: "Expand or collapse nodes, hide the sidenav, then refresh Storybook to verify persisted state restore.",
      },
    },
  },
};

const WholeSidenavContextMenuStory = () => {
  const [notificationsVisible, setNotificationsVisible] = useState(true);
  const sections = sidenavSections.map((section) => ({
    ...section,
    nodes: section.nodes.filter((node) => node.id !== "notifications" || notificationsVisible),
  }));
  const contextActions: ResourceContextAction[] = [
    {
      key: "notifications",
      label: notificationsVisible ? "Hide Notifications" : "Show Notifications",
      icon: notificationsVisible ? <Bell size={14} /> : <Plus size={14} />,
      onClick: () => setNotificationsVisible((visible) => !visible),
    },
  ];

  return (
    <SidenavShell storageKey="storybook-sidenav-context-menu" sections={sections} contextActions={contextActions} />
  );
};

export const WholeSidenavContextMenu: Story = {
  render: () => <WholeSidenavContextMenuStory />,
  parameters: {
    docs: {
      description: {
        story: "Right-click the header, navigation tree, empty space, or footer to customize Sidenav items.",
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
            Sidenav A
          </Text>
          <SidenavShell storageKey="storybook-sidenav-namespace-a" sections={sidenavSections} />
        </Box>
        <Box flex="1" minW="0">
          <Text mb="2" textStyle="paragraph/S/medium">
            Sidenav B
          </Text>
          <SidenavShell storageKey="storybook-sidenav-namespace-b" sections={sidenavSections} />
        </Box>
      </Stack>
    );
  },
};

export const ColoredSessionIcons: Story = {
  render: () => <SidenavShell storageKey="storybook-sidenav-colored-icons" sections={coloredSessionSections} />,
  parameters: {
    docs: {
      description: {
        story: "Sidenav nodes can provide iconColor so status-driven icons keep their semantic colors.",
      },
    },
  },
};
