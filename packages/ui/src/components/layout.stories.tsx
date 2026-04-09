import { Box, Button, Flex, HStack, IconButton, Spacer, Stack, Text } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
  useNavigate,
  useRouterState,
} from "@tanstack/react-router";
import {
  ArrowLeft,
  ChevronRight,
  CircleHelp,
  File,
  FlaskConical,
  KanbanSquare,
  LayoutDashboard,
  MessageCircle,
  Minimize2,
  Network,
  PanelLeftOpen,
  PenBox,
  Search,
  SettingsIcon,
  Workflow,
} from "lucide-react";
import { type ReactNode, useState } from "react";
import { expect, userEvent, within } from "storybook/test";

import { AttachedPanel } from "@/components/attached-panel";
import { Breadcrumb } from "@/components/breadcrumb";
import { BubbleButton } from "@/components/bubble-button";
import { BubblePanel } from "@/components/bubble-panel";
import { ContentPlaceholder } from "@/components/content-placeholder";
import { HorizontalMenuStack } from "@/components/horizontal-menu-stack";
import { PANEL_HEADER_HEIGHT } from "@/components/panel-header.constants";
import { useSidebarStore } from "@/components/sidebar/sidebar.store";
import { SidebarProjectMenu } from "@/components/sidebar/sidebar-project-menu";
import { Tooltip } from "@/components/tooltip";
import { Layout, PanelLayout, PanelSectionLayout } from "./layout";
import { Sidebar } from "./sidebar/sidebar";
import type { SidebarNavigateEvent, SidebarSection } from "./sidebar-tree/sidebar-tree.types";

type StoryFn = () => ReactNode;

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      staleTime: Number.POSITIVE_INFINITY,
    },
    mutations: {
      retry: false,
    },
  },
});

interface PanelActions {
  primaryLabel: string;
  secondaryLabel: string;
}

interface PanelContentSection {
  id: string;
  title: string;
  description: string;
  placeholderHeight?: string;
}

interface PanelStoryPageProps {
  title: string;
  menuItems: string[];
  actions: PanelActions;
  contentSections: PanelContentSection[];
}

const panelRoutes = [
  { id: "files", label: "Files", icon: <File size={14} />, path: "/files" },
  { id: "pipelines", label: "Pipelines", icon: <Workflow size={14} />, path: "/pipelines" },
  { id: "jobs", label: "Jobs", icon: <Network size={14} />, path: "/jobs" },
  { id: "extraction", label: "Extraction", icon: <FlaskConical size={14} />, path: "/extraction" },
  { id: "evals", label: "Evals", icon: <FlaskConical size={14} />, path: "/evals" },
] as const;

interface PanelStorySidebarProps {
  title: string;
  menuItems: string[];
}

const layoutSidebarItems = [
  {
    id: "search",
    label: "Search",
    icon: <Search size={14} />,
  },
  {
    id: "tickets",
    label: "Tickets",
    icon: <KanbanSquare size={14} />,
  },
] as const;

const buildPanelSidebarSections = (title: string, menuItems: string[]): SidebarSection[] => [
  {
    id: "workspace",
    nodes: layoutSidebarItems.map((item) => ({
      id: item.id,
      label: item.label,
      icon: item.icon,
    })),
  },
  {
    id: "panels",
    label: "Panels",
    nodes: panelRoutes.map((route) => ({
      id: route.id,
      label: route.label,
      isNavigable: true,
      navigationIntent: { id: "navigate", payload: route.path },
    })),
  },
  {
    id: "context",
    label: `${title} context`,
    nodes: menuItems.map((item, index) => ({
      id: `context-${index}`,
      label: item,
      description: "Supporting links and filters for this panel.",
    })),
  },
];

const PanelStorySidebarHeader = () => {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const modeLabel = isDarkMode ? "Switch to light mode" : "Switch to dark mode";

  return (
    <SidebarProjectMenu
      name="Prompt Studio"
      projectsLabel="Projects"
      themeModeLabel={modeLabel}
      isDarkMode={isDarkMode}
      onSelectProjects={() => undefined}
      onToggleThemePreference={() => setIsDarkMode((current) => !current)}
    />
  );
};

const storyFooterItems = [
  {
    id: "help",
    label: "Help",
    icon: <CircleHelp size={14} />,
  },
  {
    id: "settings",
    label: "Settings",
    icon: <SettingsIcon size={14} />,
  },
] as const;

interface PanelStorySidebarFooterProps {
  onNavigate?: (path: string) => void;
}

const PanelStorySidebarFooter = (props: PanelStorySidebarFooterProps) => {
  const { onNavigate } = props;

  return (
    <Stack gap="1">
      {storyFooterItems.map((item) => (
        <Button
          key={item.id}
          variant="ghost"
          size="sm"
          justifyContent="flex-start"
          width="full"
          onClick={item.id === "settings" ? () => onNavigate?.("/settings/general") : undefined}
        >
          {item.icon}
          {item.label}
        </Button>
      ))}
    </Stack>
  );
};

const PanelStorySidebar = (props: PanelStorySidebarProps) => {
  const { title, menuItems } = props;
  const navigate = useNavigate();
  const { location } = useRouterState();
  const activeNodeId = panelRoutes.find((route) => route.path === location.pathname)?.id ?? null;

  const handleNavigate = (event: SidebarNavigateEvent) => {
    if (event.intent?.id !== "navigate" || typeof event.intent.payload !== "string") {
      return;
    }

    navigate({ to: event.intent.payload });
  };

  const handleFooterNavigate = (path: string) => {
    navigate({ to: path });
  };

  return (
    <Sidebar
      storageKey="storybook-foundations-layout"
      sections={buildPanelSidebarSections(title, menuItems)}
      activeNodeId={activeNodeId}
      header={<PanelStorySidebarHeader />}
      footer={<PanelStorySidebarFooter onNavigate={handleFooterNavigate} />}
      onNavigate={handleNavigate}
      width="240px"
    />
  );
};

const STORY_SIDEBAR_KEY = "storybook-foundations-layout";

const settingsRoutes = [
  { id: "general", label: "General", path: "/settings/general" },
  { id: "appearance", label: "Appearance", path: "/settings/appearance" },
  { id: "notifications", label: "Notifications", path: "/settings/notifications" },
  { id: "integrations", label: "Integrations", path: "/settings/integrations" },
] as const;

const buildSettingsSidebarSections = (): SidebarSection[] => [
  {
    id: "settings",
    label: "Settings",
    nodes: settingsRoutes.map((route) => ({
      id: route.id,
      label: route.label,
      isNavigable: true,
      navigationIntent: { id: "navigate", payload: route.path },
    })),
  },
];

const SettingsSidebarHeader = () => {
  const navigate = useNavigate();

  return (
    <Button
      variant="ghost"
      size="sm"
      justifyContent="flex-start"
      width="full"
      onClick={() => navigate({ to: "/files" })}
    >
      <ArrowLeft size={14} />
      Control Panel
    </Button>
  );
};

const SettingsSidebar = () => {
  const navigate = useNavigate();
  const { location } = useRouterState();
  const activeNodeId = settingsRoutes.find((route) => route.path === location.pathname)?.id ?? null;

  const handleNavigate = (event: SidebarNavigateEvent) => {
    if (event.intent?.id !== "navigate" || typeof event.intent.payload !== "string") {
      return;
    }

    navigate({ to: event.intent.payload });
  };

  return (
    <Sidebar
      storageKey="storybook-foundations-settings"
      sections={buildSettingsSidebarSections()}
      activeNodeId={activeNodeId}
      header={<SettingsSidebarHeader />}
      onNavigate={handleNavigate}
      closable={false}
      width="240px"
    />
  );
};

const StoryBubbleButton = (props: { onClick: () => void }) => {
  return (
    <BubbleButton aria-label="Open chat" tooltip="Open chat" onClick={props.onClick}>
      <MessageCircle size={20} strokeWidth={2} />
    </BubbleButton>
  );
};

interface StoryBubbleProps {
  onClose: () => void;
  onPopOut: () => void;
}

const StoryBubble = (props: StoryBubbleProps) => {
  const { onClose, onPopOut } = props;

  return (
    <BubblePanel
      isOpen
      aria-label="Chat"
      closeLabel="Minimize"
      popOutLabel="Attach panel"
      onClose={onClose}
      onPopOut={onPopOut}
      menu={
        <Button size="xs" variant="ghost">
          Session 1
        </Button>
      }
    >
      <Box flex="1" minH={0} display="flex" flexDirection="column" p="md">
        <ContentPlaceholder flex="1" borderRadius="md" />
      </Box>
    </BubblePanel>
  );
};

type BubbleState = "closed" | "bubble" | "attached";

const StoryAttachedPanel = (props: { onDetach: () => void }) => {
  return (
    <AttachedPanel
      data-testid="story-attached-panel"
      resizable
      header={
        <HorizontalMenuStack minH={PANEL_HEADER_HEIGHT} gap="sm" py="2xs">
          <Button size="xs" variant="ghost">
            Session 1
          </Button>
          <Tooltip content="New session">
            <IconButton size="xs" variant="ghost" aria-label="New session">
              <PenBox size={16} />
            </IconButton>
          </Tooltip>
          <Spacer />
          <Tooltip content="Detach panel">
            <IconButton size="xs" variant="ghost" aria-label="Detach panel" onClick={props.onDetach}>
              <Minimize2 size={16} />
            </IconButton>
          </Tooltip>
        </HorizontalMenuStack>
      }
    >
      <Flex flex="1" minH={0} direction="column" p="md">
        <ContentPlaceholder flex="1" borderRadius="md" />
      </Flex>
    </AttachedPanel>
  );
};

const useBubbleState = () => {
  const [state, setState] = useState<BubbleState>("closed");
  return { state, setState };
};

interface StoryBubbleContainerProps {
  state: BubbleState;
  onStateChange: (state: BubbleState) => void;
}

const StoryBubbleContainer = (props: StoryBubbleContainerProps) => {
  const { state, onStateChange } = props;

  if (state === "closed") {
    return <StoryBubbleButton onClick={() => onStateChange("bubble")} />;
  }

  if (state === "bubble") {
    return <StoryBubble onClose={() => onStateChange("closed")} onPopOut={() => onStateChange("attached")} />;
  }

  return null;
};

const LayoutStoryShell = () => {
  const { state: bubbleState, setState: setBubbleState } = useBubbleState();

  return (
    <Flex height="100%" width="100%" minH="0">
      <Flex flex="1" minW={0} minH={0} overflow="hidden">
        <Outlet />
      </Flex>
      {bubbleState === "attached" ? <StoryAttachedPanel onDetach={() => setBubbleState("bubble")} /> : null}
      <StoryBubbleContainer state={bubbleState} onStateChange={setBubbleState} />
    </Flex>
  );
};

interface PageHeaderProps {
  sidebarStorageKey?: string;
  breadcrumbItems: { title: ReactNode; url?: string }[];
  primaryLabel: string;
  secondaryLabel: string;
}

const PageHeader = (props: PageHeaderProps) => {
  const { sidebarStorageKey, breadcrumbItems, primaryLabel, secondaryLabel } = props;
  const sidebarOpen = useSidebarStore(sidebarStorageKey ?? "", (s) => s.open);
  const openSidebar = useSidebarStore(sidebarStorageKey ?? "", (s) => s.openSidebar);

  return (
    <Flex width="100%" alignItems="center" gap="sm" flexWrap="wrap">
      {sidebarStorageKey && !sidebarOpen ? (
        <IconButton variant="ghost" size="xs" aria-label="Show sidebar" onClick={openSidebar}>
          <PanelLeftOpen size={16} />
        </IconButton>
      ) : null}
      <Breadcrumb items={breadcrumbItems} separator={<ChevronRight size={12} />} textStyle="label/M/medium" />
      <HStack gap="sm" ml="auto">
        <Button size="sm" variant="solid">
          {primaryLabel}
        </Button>
        <Button size="sm" variant="ghost">
          {secondaryLabel}
        </Button>
      </HStack>
    </Flex>
  );
};

interface PanelSectionContentProps {
  sections: PanelContentSection[];
}

const PanelSectionContent = (props: PanelSectionContentProps) => {
  const { sections } = props;

  return (
    <Stack flex="1" minH="0" width="100%" p="md" gap="lg" overflowY="auto">
      {sections.map((section) => (
        <Stack key={section.id} gap="md">
          <Stack gap="2xs">
            <Text textStyle="label/L/medium">{section.title}</Text>
            <Text textStyle="paragraph/XS/regular" color="fg.muted">
              {section.description}
            </Text>
          </Stack>
          <ContentPlaceholder minH={section.placeholderHeight ?? "260px"} borderRadius="md" />
        </Stack>
      ))}
    </Stack>
  );
};

const PanelStoryPage = (props: PanelStoryPageProps) => {
  const { title, menuItems, actions, contentSections } = props;
  const route = panelRoutes.find((r) => r.label === title);

  return (
    <PanelLayout
      sidebar={<PanelStorySidebar title={title} menuItems={menuItems} />}
      errorLabel={`Unable to render the ${title} panel.`}
    >
      <Stack flex="1" gap="lg" height="100%" width="100%" minW={0}>
        <PanelSectionLayout
          actions={
            <PageHeader
              sidebarStorageKey={STORY_SIDEBAR_KEY}
              breadcrumbItems={[
                {
                  title: (
                    <HStack gap="xs">
                      <LayoutDashboard size={14} />
                      Control Panel
                    </HStack>
                  ),
                },
                {
                  title: (
                    <HStack gap="xs">
                      {route?.icon}
                      {title}
                    </HStack>
                  ),
                },
              ]}
              primaryLabel={actions.primaryLabel}
              secondaryLabel={actions.secondaryLabel}
            />
          }
          content={<PanelSectionContent sections={contentSections} />}
        />
      </Stack>
    </PanelLayout>
  );
};

const createPanelPage = (panelStoryProps: PanelStoryPageProps) => () => <PanelStoryPage {...panelStoryProps} />;

const filesPage = createPanelPage({
  title: "Files",
  menuItems: ["Inbox", "Archive", "Shared"],
  actions: { primaryLabel: "Upload file", secondaryLabel: "Refresh" },
  contentSections: [
    {
      id: "incoming",
      title: "Incoming uploads",
      description: "Newly added files ready for ingestion.",
      placeholderHeight: "360px",
    },
    {
      id: "processing",
      title: "Processing queue",
      description: "Jobs running extraction or cleanup.",
      placeholderHeight: "240px",
    },
    {
      id: "library",
      title: "Library",
      description: "Previously processed documents and assets.",
      placeholderHeight: "320px",
    },
  ],
});

const pipelinesPage = createPanelPage({
  title: "Pipelines",
  menuItems: ["Active pipelines", "Drafts", "Retired"],
  actions: { primaryLabel: "New pipeline", secondaryLabel: "Import" },
  contentSections: [
    {
      id: "versions",
      title: "Current versions",
      description: "Rollouts and approvals for each pipeline.",
      placeholderHeight: "300px",
    },
    {
      id: "runs",
      title: "Recent runs",
      description: "Latest executions with status and outputs.",
      placeholderHeight: "260px",
    },
    {
      id: "approvals",
      title: "Approval queue",
      description: "Changes awaiting review before shipping.",
      placeholderHeight: "220px",
    },
  ],
});

const jobsPage = createPanelPage({
  title: "Jobs",
  menuItems: ["Running", "Completed", "Failed"],
  actions: { primaryLabel: "Create job", secondaryLabel: "Retry failed" },
  contentSections: [
    {
      id: "live",
      title: "Live jobs",
      description: "Active runs streaming logs and metrics.",
      placeholderHeight: "340px",
    },
    {
      id: "history",
      title: "History",
      description: "Completed work with artifacts and summaries.",
      placeholderHeight: "280px",
    },
    {
      id: "alerts",
      title: "Alerts",
      description: "Failures that need your attention.",
      placeholderHeight: "200px",
    },
  ],
});

const extractionPage = createPanelPage({
  title: "Extraction",
  menuItems: ["Schemas", "Previews", "Mappings"],
  actions: { primaryLabel: "New schema", secondaryLabel: "Run preview" },
  contentSections: [
    {
      id: "schemas",
      title: "Schemas",
      description: "Fields and validation rules for incoming data.",
      placeholderHeight: "260px",
    },
    {
      id: "previews",
      title: "Previews",
      description: "Sample documents and rendered results.",
      placeholderHeight: "320px",
    },
    {
      id: "templates",
      title: "Templates",
      description: "Reusable extraction logic across datasets.",
      placeholderHeight: "240px",
    },
  ],
});

const evalsPage = createPanelPage({
  title: "Evals",
  menuItems: ["Datasets", "Runs", "Reports"],
  actions: { primaryLabel: "New eval", secondaryLabel: "Refresh" },
  contentSections: [
    {
      id: "datasets",
      title: "Datasets",
      description: "Collections of labeled documents for checks.",
      placeholderHeight: "300px",
    },
    {
      id: "runs",
      title: "Eval runs",
      description: "Execution history across evaluators.",
      placeholderHeight: "260px",
    },
    {
      id: "reports",
      title: "Reports",
      description: "Metrics, charts, and downloadable summaries.",
      placeholderHeight: "340px",
    },
  ],
});

const SettingsPage = () => {
  const { location } = useRouterState();
  const activeRoute = settingsRoutes.find((route) => route.path === location.pathname);
  const title = activeRoute?.label ?? "General";

  return (
    <PanelLayout sidebar={<SettingsSidebar />} errorLabel="Unable to render settings.">
      <Stack gap="lg" height="100%" width="100%">
        <PanelSectionLayout
          actions={
            <PageHeader
              breadcrumbItems={[
                {
                  title: (
                    <HStack gap="xs">
                      <LayoutDashboard size={14} />
                      Control Panel
                    </HStack>
                  ),
                  url: "/files",
                },
                {
                  title: (
                    <HStack gap="xs">
                      <SettingsIcon size={14} />
                      Settings
                    </HStack>
                  ),
                },
                { title },
              ]}
              primaryLabel="Save"
              secondaryLabel="Reset"
            />
          }
          content={
            <PanelSectionContent
              sections={[
                {
                  id: "settings-content",
                  title: `${title} settings`,
                  description: `Configure your ${title.toLowerCase()} preferences.`,
                  placeholderHeight: "400px",
                },
              ]}
            />
          }
        />
      </Stack>
    </PanelLayout>
  );
};

const rootRoute = createRootRoute({
  component: LayoutStoryShell,
});

const layoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: "layout",
  component: Layout,
});

const filesRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: "files",
  component: filesPage,
});

const pipelinesRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: "pipelines",
  component: pipelinesPage,
});

const jobsRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: "jobs",
  component: jobsPage,
});

const extractionRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: "extraction",
  component: extractionPage,
});

const evalsRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: "evals",
  component: evalsPage,
});

const settingsRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: "settings/$section",
  component: SettingsPage,
});

const routeTree = rootRoute.addChildren([
  layoutRoute.addChildren([filesRoute, pipelinesRoute, jobsRoute, extractionRoute, evalsRoute, settingsRoute]),
]);

const createLayoutStoryRouter = () =>
  createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: ["/files"] }),
  });

const meta = {
  title: "Foundations/Layout",
  component: Layout,
  decorators: [
    (Story: StoryFn) => (
      <QueryClientProvider client={queryClient}>
        <Box height="100vh" background="bg" display="flex" flexDirection="column" overflow="hidden">
          <Story />
        </Box>
      </QueryClientProvider>
    ),
  ],
} satisfies Meta<typeof Layout>;

export default meta;

type Story = StoryObj<typeof meta>;

export const AppShell: Story = {
  render: () => <RouterProvider router={createLayoutStoryRouter()} />,
  tags: ["sidebar-overflow"],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const documentBody = within(canvasElement.ownerDocument.body);
    const sidebar = canvas.getByTestId("sidebar");
    const sidebarHeader = canvas.getByTestId("sidebar-header");
    const panelSectionActions = canvas.getByTestId("panel-section-actions");
    const sidebarContent = within(sidebar);

    if (!sidebarContent.queryByText("Files")) {
      await userEvent.click(sidebarContent.getByText("Panels"));
    }

    if (!sidebarContent.queryByText("Inbox")) {
      await userEvent.click(sidebarContent.getByText("Files context"));
    }

    const listbox = sidebar.querySelector<HTMLElement>('[role="listbox"]');

    expect(listbox).not.toBeNull();
    expect(listbox!.scrollWidth).toBeLessThanOrEqual(sidebar.clientWidth + 1);
    expect(sidebarHeader.clientHeight).toBe(41);
    expect(panelSectionActions.clientHeight).toBeGreaterThanOrEqual(41);

    await userEvent.click(canvas.getByLabelText("Open chat"));
    expect(documentBody.getByRole("dialog", { name: "Chat" })).not.toBeNull();
    await userEvent.click(documentBody.getByLabelText("Attach panel"));

    expect(canvas.getByTestId("story-attached-panel")).not.toBeNull();
    expect(canvas.getByLabelText("Resize attached panel")).not.toBeNull();

    await userEvent.click(canvas.getByRole("button", { name: "Settings" }));

    expect(canvas.getByText("General settings")).not.toBeNull();
    expect(canvas.getByTestId("story-attached-panel")).not.toBeNull();
  },
};
