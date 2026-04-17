import { Flex, IconButton, Menu, Stack, Text } from "@chakra-ui/react";
import type { SessionCompletionStatus } from "@pstdio/ui";
import {
  MenuItem,
  resolveSessionIndicatorColor,
  resolveSessionIndicatorIcon,
  Tooltip,
  WorkspaceBadge,
} from "@pstdio/ui";
import { ChevronRight, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { toSessionIndicatorStatus } from "@/features/ticket-list/utils/ticket-attempts";
import { getAttemptLabelFromWorkspaceShorthand } from "@/features/workspaces/utils/workspace-shorthand";
import type { WorkspaceSessionEntry } from "../hooks/use-workspace-sessions";

interface WorkspaceListItem {
  id: string;
  label: string;
  shorthand: string;
  updatedAt: string;
  worktreePath: string | null;
  setupError: string | null;
  attemptStatusName?: string;
  attemptStatusColor?: string;
}

interface WorkspaceListPanelProps {
  workspaces: WorkspaceListItem[];
  diffTotalsByWorkspaceId?: Map<string, { additions: number; deletions: number }>;
  sessionsByWorkspaceId: Map<string, WorkspaceSessionEntry[]>;
  activeSessionId: string | null;
  onSelectSession: (workspaceShorthand: string, sessionId: string) => void;
  onCreateAttempt?: () => void;
  onCreateSession?: (workspaceId: string, workspaceShorthand: string) => void;
}

export type { WorkspaceListItem };

const getLatestWorkspaceSessionStatus = (sessions: WorkspaceSessionEntry[]) => {
  return toSessionIndicatorStatus(
    (sessions.at(-1)?.status as SessionCompletionStatus | "cancelled" | null | undefined) ?? null,
  );
};

export const WorkspaceListPanel = (props: WorkspaceListPanelProps) => {
  const {
    workspaces,
    diffTotalsByWorkspaceId = new Map(),
    sessionsByWorkspaceId,
    activeSessionId,
    onSelectSession,
    onCreateAttempt,
    onCreateSession,
  } = props;

  const [expandedWorkspaces, setExpandedWorkspaces] = useState<Set<string>>(() => new Set(workspaces.map((w) => w.id)));

  useEffect(() => {
    if (!activeSessionId) return;
    for (const [workspaceId, sessions] of sessionsByWorkspaceId) {
      if (sessions.some((s) => s.id === activeSessionId)) {
        setExpandedWorkspaces((prev) => (prev.has(workspaceId) ? prev : new Set(prev).add(workspaceId)));
        break;
      }
    }
  }, [activeSessionId, sessionsByWorkspaceId]);

  const toggleWorkspace = (id: string) => {
    setExpandedWorkspaces((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <Stack h="full" minW="200px" maxW="240px" borderRightWidth="1px" bg="background.primary" gap="0" overflowY="auto">
      <Flex px="sm" py="xs" borderBottomWidth="1px" align="center" justify="space-between">
        <Text textStyle="label/S/medium" color="foreground.secondary">
          Workspaces
        </Text>

        {onCreateAttempt ? (
          <Tooltip content="New attempt">
            <IconButton size="xs" variant="ghost" aria-label="New attempt" onClick={onCreateAttempt}>
              <Plus size={14} />
            </IconButton>
          </Tooltip>
        ) : null}
      </Flex>

      <Menu.Root>
        <Stack gap="0" py="xs">
          {workspaces.map((workspace) => {
            const sessions = sessionsByWorkspaceId.get(workspace.id) ?? [];
            const isExpanded = expandedWorkspaces.has(workspace.id);

            return (
              <Stack key={workspace.id} gap="0">
                <Flex
                  px="sm"
                  py="2xs"
                  align="center"
                  gap="xs"
                  cursor="pointer"
                  borderRadius="xs"
                  _hover={{ bg: "bg.subtle" }}
                  onClick={() => toggleWorkspace(workspace.id)}
                >
                  <ChevronRight
                    size={12}
                    style={{ transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)", transition: "120ms" }}
                  />
                  <WorkspaceBadge
                    workspaceType={workspace.worktreePath ? "worktree" : "current_branch"}
                    shorthand={getAttemptLabelFromWorkspaceShorthand(workspace.shorthand)}
                    attemptStatus={
                      workspace.attemptStatusName && workspace.attemptStatusColor
                        ? { name: workspace.attemptStatusName, color: workspace.attemptStatusColor }
                        : undefined
                    }
                    sessionStatus={getLatestWorkspaceSessionStatus(sessions)}
                    showLeadingSessionIndicator={false}
                    diffAdditions={diffTotalsByWorkspaceId.get(workspace.id)?.additions}
                    diffDeletions={diffTotalsByWorkspaceId.get(workspace.id)?.deletions}
                  />
                  {onCreateSession ? (
                    <Tooltip content="New workspace session">
                      <IconButton
                        size="2xs"
                        variant="ghost"
                        aria-label="New workspace session"
                        onClick={(e) => {
                          e.stopPropagation();
                          onCreateSession(workspace.id, workspace.shorthand);
                        }}
                      >
                        <Plus size={12} />
                      </IconButton>
                    </Tooltip>
                  ) : null}
                </Flex>

                {isExpanded
                  ? sessions.map((session) => (
                      <MenuItem
                        key={session.id}
                        primaryLabel={session.title}
                        tooltipLabel={session.title}
                        variant="compact"
                        isSelected={session.id === activeSessionId}
                        leftIcon={resolveSessionIndicatorIcon(session.status as SessionCompletionStatus)}
                        leftIconColor={resolveSessionIndicatorColor(session.status as SessionCompletionStatus)}
                        onClick={() => onSelectSession(workspace.shorthand, session.id)}
                      />
                    ))
                  : null}
              </Stack>
            );
          })}

          {workspaces.length === 0 ? (
            <Text textStyle="paragraph/XS/regular" color="foreground.tertiary" px="sm" py="sm">
              No workspaces yet.
            </Text>
          ) : null}
        </Stack>
      </Menu.Root>
    </Stack>
  );
};
