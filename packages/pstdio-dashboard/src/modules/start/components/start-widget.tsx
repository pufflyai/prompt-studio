import { Badge, Box, Button, Flex, HStack, Icon, Stack, Text } from "@chakra-ui/react";
import { ArrowRight, MessageCircle } from "lucide-react";
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

interface StartSession {
  id: string;
  title: string;
  status: string;
  updatedAt: string;
  workspaceShorthand: string;
  resource: ResourceRef;
}

const formatStatus = (status: string) => {
  const normalized = status.replaceAll("_", " ").trim();
  if (!normalized) return "Unknown";

  return `${normalized.charAt(0).toUpperCase()}${normalized.slice(1)}`;
};

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

      return {
        id: session.id,
        title,
        status,
        updatedAt: rowString(session.updated_at) || rowString(session.created_at),
        workspaceShorthand: rowString(workspace?.workspace_shorthand),
        resource: createDashboardResource("session", session.id, title, "MessageCircle", sessionProjectId, { status }),
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
  input: WorkbenchWidgetRenderInput;
  session: StartSession;
}

const RecentSessionRow = (props: RecentSessionRowProps) => {
  const { input, session } = props;
  const updatedAt = formatUpdatedAt(session.updatedAt);
  const detail = [session.workspaceShorthand, updatedAt].filter(Boolean).join(" - ");

  return (
    <Button
      variant="ghost"
      borderRadius="sm"
      h="auto"
      minH="3.25rem"
      justifyContent="flex-start"
      px="sm"
      py="xs"
      onClick={() => {
        void input.workbench.commands.executeCommand(dashboardCommandIds.openFloatingSession, {
          resource: session.resource,
        });
      }}
    >
      <HStack gap="sm" minW="0" w="full">
        <Icon as={MessageCircle} boxSize="16px" flexShrink="0" color="fg.muted" />
        <Stack gap="2xs" minW="0" flex="1" alignItems="flex-start">
          <Text fontSize="sm" fontWeight="medium" truncate>
            {session.title}
          </Text>
          {detail ? (
            <Text fontSize="xs" color="fg.muted" truncate>
              {detail}
            </Text>
          ) : null}
        </Stack>
        <Badge size="sm" variant="outline" flexShrink="0">
          {formatStatus(session.status)}
        </Badge>
        <Icon as={ArrowRight} boxSize="14px" flexShrink="0" color="fg.muted" />
      </HStack>
    </Button>
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

  return (
    <Flex h="full" minH="0" w="full" bg="bg" overflow="auto">
      <Stack w="full" maxW="48rem" mx="auto" px={{ base: "sm", md: "lg" }} py="lg" gap="md">
        <Stack gap="xs" minW="0">
          <Text fontSize="sm" fontWeight="semibold">
            Recent sessions
          </Text>
          <Stack gap="2xs" minW="0">
            {data.recentSessions.map((session) => (
              <RecentSessionRow key={session.id} input={input} session={session} />
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
