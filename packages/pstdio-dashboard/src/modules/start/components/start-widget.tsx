import { Badge, Box, Button, Flex, HStack, Icon, Stack, Text } from "@chakra-ui/react";
import {
  ListRow,
  resolveSessionIndicatorColor,
  resolveSessionIndicatorIcon,
  type SessionCompletionStatus,
} from "@pstdio/ui";
import { GitBranch } from "lucide-react";
import type { ResourceRef } from "pstdio-workbench/core";
import { useWorkbenchStore, type WorkbenchWidgetRenderInput } from "pstdio-workbench/react";
import { useSyncExternalStore } from "react";
import { dashboardCommandIds } from "@/shared/app/commands";
import { dashboardSelectedProjectIdContextKey } from "@/shared/app/project-context";
import { createDashboardResource } from "@/shared/app/resources";
import {
  type DashboardRows,
  getDashboardDataVersion,
  isDashboardProjectRow,
  isVisibleDashboardRow,
  readDashboardRows,
  subscribeDashboardData,
} from "@/shared/sync/dashboard-rows";

export interface StartSession {
  id: string;
  title: string;
  status: string;
  updatedAt: string;
  workspaceShorthand: string;
  resource: ResourceRef;
  workspaceResource?: ResourceRef;
}

const formatUpdatedAt = (updatedAt: string) => {
  if (!updatedAt) return "";

  const date = new Date(updatedAt);
  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

const rowString = (value: unknown) => (typeof value === "string" ? value : "");

const createStartWorkspaceResource = (
  workspace: DashboardRows["workspaces"][number],
  projectId: string | undefined,
) => {
  const title = rowString(workspace.name) || rowString(workspace.workspace_shorthand) || "Workspace";
  const shorthand = rowString(workspace.workspace_shorthand);
  const branch = rowString(workspace.branch);
  const workspaceType = rowString(workspace.worktree_path) ? "worktree" : "current_branch";

  return createDashboardResource("workspace", workspace.id, title, "GitBranch", projectId, {
    workspaceId: workspace.id,
    workspaceType,
    workspaceIsDefault: Boolean(workspace.is_default),
    ...(branch ? { workspaceBranch: branch } : {}),
    ...(shorthand ? { workspaceShorthand: shorthand } : {}),
  });
};

const createWorkspaceBySessionId = (rows: DashboardRows, projectId: string | undefined) => {
  const workspaceById = new Map(
    rows.workspaces
      .filter((workspace) => isVisibleDashboardRow(workspace) && isDashboardProjectRow(workspace, projectId))
      .map((workspace) => [workspace.id, workspace]),
  );
  const workspaceBySessionId = new Map<string, DashboardRows["workspaces"][number]>();

  for (const link of rows.workspaceSessions) {
    const workspace = workspaceById.get(rowString(link.workspace_id));
    if (workspace) workspaceBySessionId.set(rowString(link.session_id), workspace);
  }

  return workspaceBySessionId;
};

const createStartSessions = (rows: DashboardRows, projectId: string | undefined) => {
  const workspaceBySessionId = createWorkspaceBySessionId(rows, projectId);

  return rows.sessions
    .filter((session) => isVisibleDashboardRow(session) && isDashboardProjectRow(session, projectId))
    .map((session) => {
      const workspace = workspaceBySessionId.get(session.id);
      const title = rowString(session.title) || "Session";
      const status = rowString(session.status) || "unknown";
      const sessionProjectId = rowString(session.project_id) || rowString(workspace?.project_id) || projectId;
      const workspaceShorthand = rowString(workspace?.workspace_shorthand);

      return {
        id: session.id,
        title,
        status,
        updatedAt: rowString(session.updated_at) || rowString(session.created_at),
        workspaceShorthand,
        resource: createDashboardResource("session", session.id, title, "MessageCircle", sessionProjectId, { status }),
        ...(workspace ? { workspaceResource: createStartWorkspaceResource(workspace, sessionProjectId) } : {}),
      } satisfies StartSession;
    })
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
};

const createStartData = (projectId: string | undefined, _dataVersion: number) => {
  const rows = readDashboardRows();
  const sessions = createStartSessions(rows, projectId);

  return {
    recentSessions: sessions.slice(0, 5),
  };
};

interface RecentSessionRowProps {
  session: StartSession;
  onOpenSession: (session: StartSession) => void;
  onOpenWorkspace: (resource: ResourceRef) => void;
}

interface RecentSessionRowMetaProps {
  session: StartSession;
  updatedAt: string;
  workspaceResource?: ResourceRef;
  onOpenWorkspace: (resource: ResourceRef) => void;
}

const RecentSessionRowMeta = (props: RecentSessionRowMetaProps) => {
  const { session, updatedAt, workspaceResource, onOpenWorkspace } = props;

  if (!workspaceResource && !updatedAt) return null;

  return (
    <HStack gap="xs" minW="0" maxW={{ base: "48%", md: "60%" }}>
      {workspaceResource ? (
        <Button
          variant="plain"
          size="xs"
          h="auto"
          minH="0"
          minW="0"
          maxW="full"
          px="0"
          py="0"
          color="fg.muted"
          justifyContent="flex-start"
          onClick={(event) => {
            event.stopPropagation();
            onOpenWorkspace(workspaceResource);
          }}
          onKeyDown={(event) => event.stopPropagation()}
          _hover={{ color: "fg", textDecoration: "underline" }}
        >
          <Icon as={GitBranch} boxSize="12px" flexShrink={0} />
          <Text textStyle="label/XS" truncate>
            {session.workspaceShorthand || workspaceResource.label}
          </Text>
        </Button>
      ) : null}
      {updatedAt ? (
        <Badge size="sm" variant="subtle" bg="bg.muted" color="fg.muted" flexShrink={0}>
          {updatedAt}
        </Badge>
      ) : null}
    </HStack>
  );
};

export const RecentSessionRow = (props: RecentSessionRowProps) => {
  const { session, onOpenSession, onOpenWorkspace } = props;
  const updatedAt = formatUpdatedAt(session.updatedAt);
  const status = session.status as SessionCompletionStatus;
  const workspaceResource = session.workspaceResource;

  return (
    <ListRow
      asChild
      role="button"
      tabIndex={0}
      id={session.id}
      label={session.title}
      tooltip={session.title}
      icon={<Icon as={resolveSessionIndicatorIcon(status)} boxSize="16px" />}
      iconColor={resolveSessionIndicatorColor(status)}
      endContent={
        <RecentSessionRowMeta
          session={session}
          updatedAt={updatedAt}
          workspaceResource={workspaceResource}
          onOpenWorkspace={onOpenWorkspace}
        />
      }
      onClick={() => onOpenSession(session)}
      onKeyDown={(event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        onOpenSession(session);
      }}
    />
  );
};

export const StartWidget = (props: { input: WorkbenchWidgetRenderInput }) => {
  const { input } = props;
  const projectId = useWorkbenchStore(input.workbench.context.store, (state) => {
    const value = state.values[dashboardSelectedProjectIdContextKey];
    return typeof value === "string" ? value : undefined;
  });
  const dashboardDataVersion = useSyncExternalStore(
    subscribeDashboardData,
    getDashboardDataVersion,
    getDashboardDataVersion,
  );
  const data = createStartData(projectId, dashboardDataVersion);
  const openSession = (session: StartSession) => {
    void input.workbench.commands.executeCommand(dashboardCommandIds.openFloatingSession, {
      resource: session.resource,
    });
  };
  const openWorkspace = (resource: ResourceRef) => {
    void input.workbench.resources.openResource(resource, { replaceActive: true });
  };

  return (
    <Flex h="full" minH="0" w="full" bg="bg" overflow="auto">
      <Stack w="full" maxW="48rem" mx="auto" px={{ base: "sm", md: "lg" }} py="lg" gap="md">
        <Stack gap="xs" minW="0">
          <Text textStyle="heading/M">Recent sessions</Text>
          <Stack gap="0" minW="0">
            {data.recentSessions.map((session) => (
              <RecentSessionRow
                key={session.id}
                session={session}
                onOpenSession={openSession}
                onOpenWorkspace={openWorkspace}
              />
            ))}
            {data.recentSessions.length === 0 ? (
              <Box px="sm" py="md" color="fg.muted">
                <Text fontSize="sm">No recent sessions</Text>
              </Box>
            ) : null}
          </Stack>
        </Stack>
      </Stack>
    </Flex>
  );
};
