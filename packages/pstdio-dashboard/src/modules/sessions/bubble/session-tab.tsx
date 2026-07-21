import { Box, Button, Icon, Menu, Text } from "@chakra-ui/react";
import {
  ListRow,
  resolveSessionIndicatorColor,
  resolveSessionIndicatorIcon,
  type SessionCompletionStatus,
  SessionIndicator,
} from "@pstdio/ui";
import type { WorkbenchWidgetPlacement } from "@pstdio/workbench/core";
import type { WorkbenchWidgetRenderInput } from "@pstdio/workbench/react";
import { useWorkbenchStore } from "@pstdio/workbench/react";
import { MessageCircle, PenBox } from "lucide-react";
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

const getActivePlacement = (widgets: WorkbenchWidgetPlacement[], activeWidgetId?: string) =>
  widgets.find((placement) => placement.widgetId === activeWidgetId) ?? widgets[0];

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

const getSessionStatus = (session: DashboardSession | undefined, placement: WorkbenchWidgetPlacement) => {
  const status = session?.status ?? placement.resource?.metadata?.status;
  return typeof status === "string" ? (status as SessionCompletionStatus) : undefined;
};

const useSessionTabState = (input: WorkbenchWidgetRenderInput) => {
  useSyncExternalStore(subscribeDashboardData, getDashboardDataVersion, getDashboardDataVersion);
  const projectId = useWorkbenchStore(input.workbench.context.store, (state) => {
    const value = state.values[dashboardSelectedProjectIdContextKey];
    return typeof value === "string" ? value : undefined;
  });
  const mainRegion = useWorkbenchStore(input.workbench.layout.store, (state) => state.layout.regions.main);
  const view = resolveDashboardSessionViewForPlacement(input.placement);
  const sessions = createDashboardSessions(projectId);
  const selectedSession = sessions.find((session) => session.id === view.sessionId);
  const activeResource = getActivePlacement(mainRegion.widgets, mainRegion.activeWidgetId)?.resource;
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
    selectedLabel: selectedSession?.title ?? input.placement.resource?.label ?? "New session",
    selectedStatus: getSessionStatus(selectedSession, input.placement),
    view,
    workspace,
  };
};

export const SessionTabContent = (props: { input: WorkbenchWidgetRenderInput }) => {
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

export const SessionTabContextMenu = (props: { input: WorkbenchWidgetRenderInput }) => {
  const { input } = props;
  const state = useSessionTabState(input);

  return (
    <>
      <Box p="sm">
        <Button
          variant="outline"
          size="xs"
          width="full"
          justifyContent="flex-start"
          onClick={() => {
            void input.workbench.commands.executeCommand(dashboardCommandIds.createSession, {
              ...(state.workspace ? { workspace: state.workspace } : {}),
            });
          }}
        >
          <PenBox size={14} />
          New session
        </Button>
      </Box>
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
    </>
  );
};
