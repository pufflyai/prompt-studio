import { HStack, Text } from "@chakra-ui/react";
import type { SidebarNode, SidebarSection } from "@pstdio/ui";
import { Circle, GitBranch } from "lucide-react";
import type { TicketAttempt } from "@/features/ticket-list/types";
import type { AttemptStatusMapEntry } from "@/features/workspaces/hooks/attempt-status-map";
import { getAttemptLabelFromWorkspaceShorthand } from "@/features/workspaces/utils/workspace-shorthand";
import { buildWorkspaceStatusIndicatorTooltip } from "../utils/workspace-status-indicator";
import { resolveWorkspaceDiffTotalLabel, type WorkspaceDiffTotals } from "./workspace-diff-total";

const buildWorkspaceIndicator = (input: { attemptStatus?: AttemptStatusMapEntry; diffTotalLabel: string | null }) => {
  const { attemptStatus, diffTotalLabel } = input;
  if (!attemptStatus && !diffTotalLabel) return undefined;

  return {
    icon: (
      <HStack gap="1" align="center">
        {attemptStatus ? <Circle size={8} fill="currentColor" /> : null}
        {diffTotalLabel ? (
          <Text textStyle="paragraph/XS/regular" color="fg.muted">
            {diffTotalLabel}
          </Text>
        ) : null}
      </HStack>
    ),
    color: attemptStatus ? `var(--chakra-colors-${attemptStatus.color}-solid)` : undefined,
    tooltip: attemptStatus ? buildWorkspaceStatusIndicatorTooltip(attemptStatus) : undefined,
  } satisfies SidebarNode["indicator"];
};

export const buildWorkspacesSection = (
  workspaces: TicketAttempt[],
  attemptStatusMap: Map<string, AttemptStatusMapEntry>,
  diffTotalsByWorkspaceId: Map<string, WorkspaceDiffTotals>,
): SidebarSection => {
  const nodes: SidebarNode[] = workspaces.map((workspace) => {
    const attemptStatus = workspace.attemptStatusId ? attemptStatusMap.get(workspace.attemptStatusId) : undefined;
    const diffTotalLabel = resolveWorkspaceDiffTotalLabel(diffTotalsByWorkspaceId, workspace.id);

    return {
      id: `workspace:${workspace.id}`,
      label: getAttemptLabelFromWorkspaceShorthand(workspace.shorthand),
      icon: <GitBranch size={14} />,
      indicator: buildWorkspaceIndicator({ attemptStatus, diffTotalLabel }),
      isNavigable: true,
      navigationIntent: { id: "select-workspace", payload: { workspaceShorthand: workspace.shorthand } },
    };
  });

  return {
    id: "workspaces",
    label: "Workspaces",
    nodes,
    emptyState: (
      <Text textStyle="paragraph/S/regular" color="fg.muted" px="3" py="4" textAlign="center">
        No workspaces yet
      </Text>
    ),
  };
};
