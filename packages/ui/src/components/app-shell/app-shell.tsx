import {
  Avatar,
  Box,
  Button,
  HStack,
  Icon,
  IconButton,
  Kbd,
  Menu,
  Portal,
  Spacer,
  Stack,
  Text,
} from "@chakra-ui/react";
import {
  ChevronDown,
  FolderIcon,
  KanbanSquare,
  MessageSquare,
  Minimize2,
  PanelLeftOpen,
  PenBox,
  Search,
  Settings as SettingsIcon,
  SquareArrowOutUpRight,
} from "lucide-react";
import { useEffect, useState } from "react";

import { AttachedPanel } from "../attached-panel";
import { Breadcrumb, type BreadcrumbItem } from "../breadcrumb";
import { BubbleButton } from "../bubble-button";
import { BubblePanel } from "../bubble-panel";
import { ChatPanel } from "../chat-ui/components/chat-panel";
import { Header } from "../header";
import { ListRow } from "../list-row/list-row";
import { ResizableSplitLayout } from "../resizable-split-layout";
import { SearchableMenu, type SearchableMenuItem } from "../searchable-menu";
import { Sidebar } from "../sidebar/sidebar";
import { DisplayMenu } from "../tickets/display-menu";
import { FilterMenu } from "../tickets/filter-menu";
import { countFilterValues } from "../tickets/ticket-grouping";
import {
  DEFAULT_DISPLAY_PROPERTY_OPTIONS,
  DEFAULT_GROUPING_OPTIONS,
  DEFAULT_ORDERING_OPTIONS,
  type WorkspaceTicket,
} from "../tickets/types";
import { useTicketsWorkspaceStore } from "../tickets/use-workspace-store";
import { buildDefaultFilterCategories, buildTagOptions } from "../tickets/workspace-helpers";
import { Tooltip } from "../tooltip";
import type { TreeListSection } from "../tree-list/tree-list.types";
import { CommandPalette } from "./command-palette";
import { mockChatMessages } from "./mock-chat";
import { type MockProject, mockProjects, mockSessions, mockTagDefinitions, mockTickets } from "./mock-data";
import { ProjectListPage } from "./pages/project-list-page";
import { SessionsPage } from "./pages/sessions-page";
import { SettingsPage } from "./pages/settings-page";
import { TicketDetailsPage } from "./pages/ticket-details-page";
import { TICKETS_STORAGE_KEY, TicketsPage } from "./pages/tickets-page";
import { WorkspacePage } from "./pages/workspace-page";

const APP_SHELL_SIDEBAR_KEY = "app-shell-sidebar";

type View =
  | { name: "project-list" }
  | { name: "tickets"; projectId: string }
  | { name: "ticket-details"; projectId: string; ticket: WorkspaceTicket }
  | { name: "workspace"; projectId: string; ticket: WorkspaceTicket; workspaceShorthand: string }
  | { name: "sessions"; projectId: string; sessionId: string | null }
  | { name: "project-settings"; projectId: string }
  | { name: "global-settings" };

const projectSidebarSections: TreeListSection[] = [
  {
    id: "navigation",
    nodes: [
      {
        id: "tickets",
        label: "Tickets",
        icon: <KanbanSquare size={14} />,
        isNavigable: true,
        navigationIntent: { id: "tickets" },
      },
      {
        id: "sessions",
        label: "Sessions",
        icon: <MessageSquare size={14} />,
        isNavigable: true,
        navigationIntent: { id: "sessions" },
      },
    ],
  },
];

const ProjectSwitcher = (props: { project: MockProject; onSelectProjects: () => void }) => {
  const { project, onSelectProjects } = props;

  return (
    <Menu.Root>
      <Menu.Trigger asChild>
        <Button variant="ghost" size="sm" width="full" justifyContent="flex-start">
          <HStack gap="2" minW="0" flex="1">
            <Avatar.Root size="2xs">
              <Avatar.Fallback name={project.name} />
            </Avatar.Root>
            <Text textStyle="label/S/medium" truncate>
              {project.name}
            </Text>
          </HStack>
          <ChevronDown size={14} />
        </Button>
      </Menu.Trigger>
      <Portal>
        <Menu.Positioner>
          <Menu.Content minW="240px" bg="bg">
            <Menu.Item value="all-projects" asChild>
              <ListRow
                asChild
                variant="compact"
                id="all-projects"
                label="All projects"
                icon={<FolderIcon size={14} />}
                onActivate={onSelectProjects}
              />
            </Menu.Item>
          </Menu.Content>
        </Menu.Positioner>
      </Portal>
    </Menu.Root>
  );
};

const ProjectSidebar = (props: {
  project: MockProject;
  activeNodeId: string | null;
  onNavigate: (intent: string) => void;
  onSelectProjects: () => void;
  onOpenSettings: () => void;
  isSettingsActive: boolean;
}) => {
  const { project, activeNodeId, onNavigate, onSelectProjects, onOpenSettings, isSettingsActive } = props;

  return (
    <Sidebar
      storageKey={APP_SHELL_SIDEBAR_KEY}
      sections={projectSidebarSections}
      activeNodeId={activeNodeId}
      closable={false}
      resizable={false}
      width="full"
      header={<ProjectSwitcher project={project} onSelectProjects={onSelectProjects} />}
      onNavigate={(event) => {
        if (event.intent?.id) onNavigate(event.intent.id);
      }}
      footer={
        <ListRow
          isSelected={isSettingsActive}
          id="project-settings"
          label="Project settings"
          icon={<SettingsIcon size={14} />}
          onActivate={onOpenSettings}
        />
      }
    />
  );
};

const resolveActiveNodeId = (view: View) => {
  if (view.name === "tickets" || view.name === "ticket-details" || view.name === "workspace") return "tickets";
  if (view.name === "sessions") return "sessions";
  return null;
};

const buildBreadcrumbs = (input: {
  view: View;
  project: MockProject;
  onProjectList: () => void;
  onTickets: () => void;
  onSessions: () => void;
  onTicketDetails: () => void;
}): BreadcrumbItem[] => {
  const { view, project, onProjectList, onTickets, onSessions } = input;
  const projectCrumb: BreadcrumbItem = { title: project.name, onClick: onTickets };
  const projectsCrumb: BreadcrumbItem = { title: "Projects", onClick: onProjectList };

  if (view.name === "tickets") {
    return [projectsCrumb, projectCrumb, { title: "Tickets" }];
  }

  if (view.name === "ticket-details") {
    return [
      projectsCrumb,
      projectCrumb,
      { title: "Tickets", onClick: onTickets },
      { title: `${view.ticket.ticketId} ${view.ticket.title}` },
    ];
  }

  if (view.name === "workspace") {
    return [
      projectsCrumb,
      projectCrumb,
      { title: "Tickets", onClick: onTickets },
      { title: `${view.ticket.ticketId} ${view.ticket.title}`, onClick: input.onTicketDetails },
      { title: `Workspace ${view.workspaceShorthand}` },
    ];
  }

  if (view.name === "sessions") {
    const session = view.sessionId;
    return [
      projectsCrumb,
      projectCrumb,
      { title: "Sessions", onClick: session ? onSessions : undefined },
      ...(session ? [{ title: session } as BreadcrumbItem] : []),
    ];
  }

  if (view.name === "project-settings") {
    return [projectsCrumb, projectCrumb, { title: "Settings" }];
  }

  return [projectsCrumb, projectCrumb];
};

const TicketsHeaderActions = () => {
  const tagOptions = buildTagOptions(mockTagDefinitions);
  const groupingOptions = [...DEFAULT_GROUPING_OPTIONS, ...tagOptions.grouping];
  const orderingOptions = [...DEFAULT_ORDERING_OPTIONS, ...tagOptions.ordering];
  const displayPropertyOptions = [...DEFAULT_DISPLAY_PROPERTY_OPTIONS, ...tagOptions.display];
  const categoryOptions = buildDefaultFilterCategories(mockTickets, mockTagDefinitions);
  const countsByCategory = Object.fromEntries(
    categoryOptions.map((category) => [category.id, countFilterValues(mockTickets, category.id)]),
  );

  const settings = useTicketsWorkspaceStore(TICKETS_STORAGE_KEY, (state) => state.settings);
  const filters = useTicketsWorkspaceStore(TICKETS_STORAGE_KEY, (state) => state.filters);
  const setViewMode = useTicketsWorkspaceStore(TICKETS_STORAGE_KEY, (state) => state.setViewMode);
  const setColumnGrouping = useTicketsWorkspaceStore(TICKETS_STORAGE_KEY, (state) => state.setColumnGrouping);
  const setRowGrouping = useTicketsWorkspaceStore(TICKETS_STORAGE_KEY, (state) => state.setRowGrouping);
  const setOrderingField = useTicketsWorkspaceStore(TICKETS_STORAGE_KEY, (state) => state.setOrderingField);
  const toggleSortDirection = useTicketsWorkspaceStore(TICKETS_STORAGE_KEY, (state) => state.toggleSortDirection);
  const toggleDisplayProperty = useTicketsWorkspaceStore(TICKETS_STORAGE_KEY, (state) => state.toggleDisplayProperty);
  const toggleFilterValue = useTicketsWorkspaceStore(TICKETS_STORAGE_KEY, (state) => state.toggleFilterValue);
  const clearFilter = useTicketsWorkspaceStore(TICKETS_STORAGE_KEY, (state) => state.clearFilter);
  const clearAllFilters = useTicketsWorkspaceStore(TICKETS_STORAGE_KEY, (state) => state.clearAllFilters);

  return (
    <HStack gap="2xs">
      <FilterMenu
        categories={categoryOptions}
        filters={filters}
        countsByCategory={countsByCategory}
        onToggleFilterValue={toggleFilterValue}
        onClearFilter={clearFilter}
        onClearAll={clearAllFilters}
      />
      <DisplayMenu
        settings={settings}
        groupingOptions={groupingOptions}
        orderingOptions={orderingOptions}
        displayPropertyOptions={displayPropertyOptions}
        onViewModeChange={setViewMode}
        onColumnGroupingChange={setColumnGrouping}
        onRowGroupingChange={setRowGrouping}
        onOrderingFieldChange={setOrderingField}
        onSortDirectionToggle={toggleSortDirection}
        onDisplayPropertyToggle={toggleDisplayProperty}
      />
    </HStack>
  );
};

const ShellHeader = (props: {
  items: BreadcrumbItem[];
  onOpenPalette: () => void;
  actions?: React.ReactNode;
  sidebarOpen?: boolean;
  onOpenSidebar?: () => void;
}) => (
  <Header variant="main" bg="bg" borderBottomWidth="1px" borderColor="border.muted" flexShrink={0} overflow="hidden">
    {props.sidebarOpen === false && props.onOpenSidebar ? (
      <IconButton variant="ghost" size="xs" aria-label="Show sidebar" onClick={props.onOpenSidebar} flexShrink={0}>
        <PanelLeftOpen size={16} />
      </IconButton>
    ) : null}
    <Breadcrumb items={props.items} separator="/" separatorGap="xs" />
    <Spacer />
    {props.actions ? (
      <HStack gap="xs" mr="xs">
        {props.actions}
      </HStack>
    ) : null}
    <Button size="xs" variant="ghost" onClick={props.onOpenPalette} aria-label="Open command palette" px="xs" gap="xs">
      <Search size={14} />
      <Text textStyle="label/XS" color="fg.muted">
        Search
      </Text>
      <HStack gap="2xs">
        <Kbd size="sm">⌘</Kbd>
        <Kbd size="sm">K</Kbd>
      </HStack>
    </Button>
  </Header>
);

type SessionMode = "closed" | "bubble" | "attached";

const sessionLabel = "Triage failing e2e suite";

const SessionChat = () => (
  <ChatPanel
    messages={mockChatMessages}
    emptyStateTitle="No messages yet"
    emptyStateDescription="Start the conversation."
    chatInputPlaceholder="Reply to the agent…"
  />
);

const buildSessionMenuItems = (activeId: string, onSelect: (id: string) => void): SearchableMenuItem[] =>
  mockSessions.map((session) => ({
    id: session.id,
    label: session.title,
    secondaryLabel: session.preview,
    searchText: `${session.title} ${session.preview}`,
    icon: MessageSquare,
    isSelected: session.id === activeId,
    onSelect: () => onSelect(session.id),
  }));

const SessionBubble = (props: { mode: SessionMode; onChange: (mode: SessionMode) => void }) => {
  const { mode, onChange } = props;
  const [activeSessionId, setActiveSessionId] = useState(mockSessions[0]?.id ?? "");
  const activeSession = mockSessions.find((session) => session.id === activeSessionId) ?? mockSessions[0];
  const sessionMenuItems = buildSessionMenuItems(activeSessionId, setActiveSessionId);

  return (
    <>
      <BubblePanel
        isOpen={mode === "bubble"}
        title="Active session"
        closeLabel="Minimize"
        popOutLabel="Attach panel"
        onClose={() => onChange("closed")}
        onPopOut={() => onChange("attached")}
        menu={
          <SearchableMenu
            trigger={
              <Button variant="ghost" size="sm" px="2" gap="2xs" minW="0">
                <MessageSquare size={14} />
                <Text textStyle="label/S/medium" lineClamp={1}>
                  {activeSession?.title ?? sessionLabel}
                </Text>
                <ChevronDown size={14} />
              </Button>
            }
            items={sessionMenuItems}
            width="320px"
            searchPlaceholder="Search sessions…"
            emptyState={
              <Menu.Item value="empty" asChild>
                <ListRow
                  asChild
                  variant="compact"
                  label="No sessions found"
                  icon={<Icon as={MessageSquare} boxSize="16px" />}
                  disabled
                />
              </Menu.Item>
            }
          />
        }
      >
        <Box flex="1" minH="0">
          <SessionChat />
        </Box>
      </BubblePanel>
      {mode === "closed" ? (
        <BubbleButton aria-label="Open session" tooltip="Open session" onClick={() => onChange("bubble")}>
          <MessageSquare size={20} />
        </BubbleButton>
      ) : null}
    </>
  );
};

const SessionAttached = (props: { onChange: (mode: SessionMode) => void }) => {
  const { onChange } = props;

  return (
    <AttachedPanel
      width="full"
      minWidth="0"
      header={
        <Header variant="main" borderBottomWidth="1px" borderColor="border.muted" bg="bg" flexShrink={0}>
          <HStack gap="2xs" minW="0">
            <MessageSquare size={14} />
            <Text textStyle="label/S/medium" lineClamp={1}>
              {sessionLabel}
            </Text>
          </HStack>
          <Tooltip content="New session">
            <IconButton size="xs" variant="ghost" aria-label="New session">
              <PenBox size={16} />
            </IconButton>
          </Tooltip>
          <Spacer />
          <Tooltip content="Pop out">
            <IconButton size="xs" variant="ghost" aria-label="Pop out" onClick={() => onChange("bubble")}>
              <SquareArrowOutUpRight size={14} />
            </IconButton>
          </Tooltip>
          <Tooltip content="Minimize">
            <IconButton size="xs" variant="ghost" aria-label="Minimize" onClick={() => onChange("closed")}>
              <Minimize2 size={16} />
            </IconButton>
          </Tooltip>
        </Header>
      }
    >
      <Box flex="1" minH="0" px="sm" pb="sm">
        <SessionChat />
      </Box>
    </AttachedPanel>
  );
};

interface ProjectViewContentProps {
  view: View;
  project: MockProject;
  setView: (next: View) => void;
}

const ProjectViewContent = (props: ProjectViewContentProps) => {
  const { view, project, setView } = props;

  if (view.name === "tickets") {
    return (
      <TicketsPage onSelectTicket={(ticket) => setView({ name: "ticket-details", projectId: project.id, ticket })} />
    );
  }

  if (view.name === "ticket-details") {
    return (
      <TicketDetailsPage
        ticket={view.ticket}
        onOpenWorkspace={(workspaceShorthand) =>
          setView({ name: "workspace", projectId: project.id, ticket: view.ticket, workspaceShorthand })
        }
      />
    );
  }

  if (view.name === "workspace") return <WorkspacePage />;

  if (view.name === "sessions") {
    return (
      <SessionsPage
        selectedSessionId={view.sessionId}
        onSelectSession={(id) => setView({ name: "sessions", projectId: project.id, sessionId: id })}
      />
    );
  }

  if (view.name === "project-settings") return <SettingsPage scope="project" />;

  return null;
};

export const AppShell = () => {
  const [view, setView] = useState<View>({ name: "project-list" });
  const [sessionMode, setSessionMode] = useState<SessionMode>("closed");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [paletteOpen, setPaletteOpen] = useState(false);

  const projectId = "projectId" in view ? view.projectId : null;
  const project = projectId ? (mockProjects.find((p) => p.id === projectId) ?? mockProjects[0]) : null;
  const showSession = view.name !== "sessions" && view.name !== "project-list" && view.name !== "global-settings";

  const goTickets = (id: string) => setView({ name: "tickets", projectId: id });
  const goProjectSettings = (id: string) => setView({ name: "project-settings", projectId: id });
  const goGlobalSettings = () => setView({ name: "global-settings" });
  const goProjectList = () => setView({ name: "project-list" });

  const openPalette = () => setPaletteOpen(true);
  const closePalette = () => setPaletteOpen(false);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen((current) => !current);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const activeProjectId = projectId ?? mockProjects[0].id;
  const paletteHandlers = {
    onOpenTickets: () => goTickets(activeProjectId),
    onOpenSessions: () => setView({ name: "sessions", projectId: activeProjectId, sessionId: null }),
    onOpenProjectSettings: () => goProjectSettings(activeProjectId),
    onOpenGlobalSettings: goGlobalSettings,
    onOpenProjects: goProjectList,
    onSelectTicket: (ticket: WorkspaceTicket) =>
      setView({ name: "ticket-details", projectId: activeProjectId, ticket }),
    onSelectSession: (sessionId: string) => setView({ name: "sessions", projectId: activeProjectId, sessionId }),
  };

  const handleSidebarNavigate = (intent: string) => {
    if (!projectId) return;
    if (intent === "tickets") setView({ name: "tickets", projectId });
    else if (intent === "sessions") setView({ name: "sessions", projectId, sessionId: null });
  };

  if (view.name === "project-list" || view.name === "global-settings") {
    return (
      <Box height="100vh" width="100%" bg="bg" color="fg" overflow="hidden">
        {view.name === "project-list" ? (
          <ProjectListPage onSelectProject={(p) => goTickets(p.id)} onOpenSettings={goGlobalSettings} />
        ) : (
          <Stack gap="0" height="100%">
            <ShellHeader
              items={[{ title: "Projects", onClick: goProjectList }, { title: "Settings" }]}
              onOpenPalette={openPalette}
            />
            <SettingsPage scope="global" />
          </Stack>
        )}
        <CommandPalette open={paletteOpen} onClose={closePalette} {...paletteHandlers} />
      </Box>
    );
  }

  if (!project) return null;

  const breadcrumbItems = buildBreadcrumbs({
    view,
    project,
    onProjectList: goProjectList,
    onTickets: () => goTickets(project.id),
    onSessions: () => setView({ name: "sessions", projectId: project.id, sessionId: null }),
    onTicketDetails: () => {
      if (view.name === "workspace") {
        setView({ name: "ticket-details", projectId: project.id, ticket: view.ticket });
      }
    },
  });
  const projectContent = (
    <Stack flex="1" minW="0" minH="0" gap="0">
      <ShellHeader
        items={breadcrumbItems}
        onOpenPalette={openPalette}
        actions={view.name === "tickets" ? <TicketsHeaderActions /> : null}
        sidebarOpen={sidebarOpen}
        onOpenSidebar={() => setSidebarOpen(true)}
      />
      <ProjectViewContent view={view} project={project} setView={setView} />
    </Stack>
  );
  const contentWithSession =
    showSession && sessionMode === "attached" ? (
      <ResizableSplitLayout
        flex="1"
        minH="0"
        minW="0"
        resizableSide="right"
        contentPanel={projectContent}
        resizablePanel={<SessionAttached onChange={setSessionMode} />}
        defaultSizePx={448}
        minSizePx={320}
        contentMinSizePx={320}
        resizeLabel="Resize attached panel"
        showResizeSeparator={false}
        onCollapsedChange={(collapsed) => {
          if (collapsed) setSessionMode("bubble");
        }}
      />
    ) : (
      projectContent
    );

  return (
    <HStack height="100vh" width="100%" gap="0" align="stretch" bg="bg" color="fg" overflow="hidden">
      <ResizableSplitLayout
        flex="1"
        minH="0"
        minW="0"
        resizablePanel={
          <ProjectSidebar
            project={project}
            activeNodeId={resolveActiveNodeId(view)}
            onNavigate={handleSidebarNavigate}
            onSelectProjects={goProjectList}
            onOpenSettings={() => goProjectSettings(project.id)}
            isSettingsActive={view.name === "project-settings"}
          />
        }
        contentPanel={contentWithSession}
        collapsed={!sidebarOpen}
        defaultSizePx={240}
        minSizePx={200}
        maxSizePx={420}
        contentMinSizePx={320}
        resizeLabel="Resize sidebar"
        showResizeSeparator={false}
        onCollapsedChange={(collapsed) => setSidebarOpen(!collapsed)}
      />
      {showSession ? (
        <SessionBubble mode={sessionMode === "attached" ? "closed" : sessionMode} onChange={setSessionMode} />
      ) : null}
      <CommandPalette open={paletteOpen} onClose={closePalette} {...paletteHandlers} />
    </HStack>
  );
};
