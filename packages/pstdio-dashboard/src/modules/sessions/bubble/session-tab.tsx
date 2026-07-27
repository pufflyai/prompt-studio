import { Box, Icon, Menu, Text } from "@chakra-ui/react";
import {
  ListRow,
  resolveSessionIndicatorColor,
  resolveSessionIndicatorIcon,
  type SessionCompletionStatus,
  SessionIndicator,
} from "@pstdio/ui";
import type { WorkbenchPanelInstance } from "@pstdio/workbench";
import type { WorkbenchPanelRenderInput } from "@pstdio/workbench/react";
import { useWorkbenchStore } from "@pstdio/workbench/react";
import { ArrowUpRight, MessageCircle, PenBox } from "lucide-react";
import { useSyncExternalStore } from "react";
import { dashboardCommandIds } from "@/shared/app/commands";
import { dashboardSelectedProjectIdContextKey } from "@/shared/app/project-context";
import { createDashboardResource } from "@/shared/app/resources";
import { getDashboardDataVersion, subscribeDashboardData } from "@/shared/sync/dashboard-rows";
import {
  createDashboardSessions,
  type DashboardSession,
  resolveDashboardSessionViewForPlacement,
} from "../data/dashboard-sessions";

const createWorkspaceResource = (input: {
  workspaceId: string | null;
  workspaceTitle: string;
  workspaceShorthand: string;
  workspaceBranch: string | null;
  projectId: string | undefined;
}) => {
  if (!input.workspaceId) return undefined;

  return createDashboardResource(
    "workspace",
    input.workspaceId,
    input.workspaceTitle || input.workspaceShorthand || "Workspace",
    "GitBranch",
    input.projectId,
    {
      workspaceId: input.workspaceId,
      ...(input.workspaceBranch ? { workspaceBranch: input.workspaceBranch } : {}),
      ...(input.workspaceShorthand ? { workspaceShorthand: input.workspaceShorthand } : {}),
    },
  );
};

const getSessionStatus = (session: DashboardSession | undefined, instance: WorkbenchPanelInstance) => {
  const status = session?.status ?? instance.resource?.metadata?.status;
  return typeof status === "string" ? (status as SessionCompletionStatus) : undefined;
};

const useSessionTabState = (input: WorkbenchPanelRenderInput) => {
  useSyncExternalStore(subscribeDashboardData, getDashboardDataVersion, getDashboardDataVersion);
  const projectId = useWorkbenchStore(input.workbench.context.store, (state) => {
    const value = state.values[dashboardSelectedProjectIdContextKey];
    return typeof value === "string" ? value : undefined;
  });
  const activeResource = useWorkbenchStore(input.workbench.layout.store, (state) => {
    void state.layout;
    return input.workbench.layout.getActivePanel("main")?.resource;
  });
  const view = resolveDashboardSessionViewForPlacement(input.instance);
  const sessions = createDashboardSessions(projectId);
  const selectedSession = sessions.find((session) => session.id === view.sessionId);
  const workspace =
    activeResource?.kind === "workspace"
      ? activeResource
      : createWorkspaceResource({
          workspaceId: view.workspaceId,
          workspaceTitle: view.workspaceTitle,
          workspaceShorthand: view.workspaceShorthand,
          workspaceBranch: view.workspaceBranch,
          projectId,
        });

  return {
    sessions,
    selectedSession,
    selectedLabel: selectedSession?.title ?? input.instance.resource?.label ?? "New session",
    selectedStatus: getSessionStatus(selectedSession, input.instance),
    view,
    workspace,
  };
};

export const SessionTabContent = (props: { input: WorkbenchPanelRenderInput }) => {
  const { input } = props;
  const state = useSessionTabState(input);

  return (
    <Box display="flex" alignItems="center" gap="2xs" minW="0">
      <SessionIndicator status={state.selectedStatus} boxSize="12px" />
      <Text as="span" minW="0" truncate>
        {state.selectedLabel}
      </Text>
    </Box>
  );
};

const SessionMenuRow = (props: { session: DashboardSession; isSelected: boolean; onSelect: () => void }) => {
  const { isSelected, onSelect, session } = props;

  return (
    <Menu.Item value={session.id} asChild>
      <ListRow
        asChild
        variant="full-width"
        id={session.id}
        label={session.title}
        icon={<Icon as={resolveSessionIndicatorIcon(session.status as SessionCompletionStatus)} boxSize="16px" />}
        iconColor={resolveSessionIndicatorColor(session.status as SessionCompletionStatus)}
        isSelected={isSelected}
        onActivate={onSelect}
      />
    </Menu.Item>
  );
};

const SessionActionRow = (props: { id: string; icon: typeof PenBox; label: string; onSelect: () => void }) => {
  const { icon, id, label, onSelect } = props;

  return (
    <Menu.Item value={id} asChild>
      <ListRow
        asChild
        variant="full-width"
        id={id}
        label={label}
        icon={<Icon as={icon} boxSize="16px" />}
        onActivate={onSelect}
      />
    </Menu.Item>
  );
};

export const SessionTabMenu = (props: { input: WorkbenchPanelRenderInput }) => {
  const { input } = props;
  const state = useSessionTabState(input);

  return (
    <>
      <SessionActionRow
        id="new-session"
        icon={PenBox}
        label="New session"
        onSelect={() => {
          void input.workbench.commands.executeCommand(dashboardCommandIds.createSession, {
            ...(state.workspace ? { workspace: state.workspace } : {}),
            replaceWidgetId: input.instance.instanceId,
          });
        }}
      />
      <Menu.Separator />
      {state.sessions.length > 0 ? (
        state.sessions.map((session) => (
          <SessionMenuRow
            key={session.id}
            session={session}
            isSelected={session.id === state.view.sessionId}
            onSelect={() => {
              void input.workbench.commands.executeCommand(dashboardCommandIds.openSessionPanel, {
                resource: session.resource,
                replaceWidgetId: input.instance.instanceId,
              });
            }}
          />
        ))
      ) : (
        <Menu.Item value="empty" disabled asChild>
          <ListRow
            asChild
            variant="full-width"
            id="empty"
            label="No sessions yet"
            icon={<Icon as={MessageCircle} boxSize="16px" />}
            disabled
          />
        </Menu.Item>
      )}
      <Menu.Separator />
      <SessionActionRow
        id="view-all-sessions"
        icon={ArrowUpRight}
        label="View all sessions"
        onSelect={() => {
          void input.workbench.commands.executeCommand(dashboardCommandIds.openSessions);
        }}
      />
    </>
  );
};
