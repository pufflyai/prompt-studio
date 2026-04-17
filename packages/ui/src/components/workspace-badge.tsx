import { Box, HStack, Icon, Spinner, Text } from "@chakra-ui/react";
import { ChevronDown, GitBranchIcon, GitCommitIcon } from "lucide-react";
import type { MouseEvent } from "react";
import { DiffBubble } from "@/components/diff-bubble";
import { type SessionCompletionStatus, SessionIndicator } from "@/components/session-indicator";
import { Tooltip } from "@/components/tooltip";

interface WorkspaceAttemptStatus {
  name: string;
  color: string;
  description?: string | null;
}

export interface WorkspaceBadgeProps {
  workspaceType: "worktree" | "current_branch";
  initializing?: boolean;
  shorthand?: string;
  attemptStatus?: WorkspaceAttemptStatus;
  sessionStatus?: SessionCompletionStatus;
  diffAdditions?: number;
  diffDeletions?: number;
  hasMultipleWorkspaces?: boolean;
  onClick?: () => void;
  onDropdownClick?: () => void;
  onSessionIndicatorClick?: () => void;
}

const resolveWorkspaceIcon = (workspaceType: WorkspaceBadgeProps["workspaceType"]) => {
  if (workspaceType === "current_branch") {
    return GitCommitIcon;
  }

  return GitBranchIcon;
};

const resolveAttemptStatusColor = (color: string) => {
  if (color.startsWith("#") || color.startsWith("rgb") || color.startsWith("hsl") || color.startsWith("var(")) {
    return color;
  }

  return `var(--chakra-colors-${color}-solid)`;
};

const buildAttemptStatusTooltip = (attemptStatus: WorkspaceAttemptStatus | undefined) => {
  if (!attemptStatus) return null;

  if (attemptStatus.description) {
    return `${attemptStatus.name}: ${attemptStatus.description}`;
  }

  return attemptStatus.name;
};

const handleIconClick = (event: MouseEvent<SVGSVGElement>, onClick: (() => void) | undefined) => {
  event.stopPropagation();
  onClick?.();
};

const handleBadgeClick = (event: MouseEvent<HTMLSpanElement>, onClick: (() => void) | undefined) => {
  event.stopPropagation();
  onClick?.();
};

const WorkspaceTypeIndicator = (props: {
  workspaceType: WorkspaceBadgeProps["workspaceType"];
  initializing: boolean;
}) => {
  const { workspaceType, initializing } = props;
  const WorkspaceTypeIcon = resolveWorkspaceIcon(workspaceType);

  return (
    <HStack as="span" gap="3xs" alignItems="center" color="fg.muted" flexShrink={0}>
      <Icon
        as={WorkspaceTypeIcon}
        boxSize="12px"
        aria-label={workspaceType === "worktree" ? "Worktree" : "Current branch"}
      />
      {initializing ? <Spinner size="xs" color="fg.muted" /> : null}
    </HStack>
  );
};

const WorkspaceStatusIndicator = (props: {
  attemptStatus?: WorkspaceAttemptStatus;
  sessionStatus?: SessionCompletionStatus;
  onSessionIndicatorClick?: () => void;
}) => {
  const { attemptStatus, sessionStatus, onSessionIndicatorClick } = props;

  if (attemptStatus) {
    return (
      <Tooltip content={buildAttemptStatusTooltip(attemptStatus)}>
        <Box
          as="span"
          boxSize="8px"
          borderRadius="full"
          background={resolveAttemptStatusColor(attemptStatus.color)}
          flexShrink={0}
          aria-label={`Attempt status ${attemptStatus.name}`}
        />
      </Tooltip>
    );
  }

  if (!sessionStatus) {
    return null;
  }

  const sessionTooltip = onSessionIndicatorClick ? "Open latest session" : "Latest session status";

  return (
    <Tooltip content={sessionTooltip}>
      <SessionIndicator
        status={sessionStatus}
        boxSize="12px"
        ariaLabel={sessionTooltip}
        cursor={onSessionIndicatorClick ? "pointer" : "default"}
        onClick={onSessionIndicatorClick ? (event) => handleIconClick(event, onSessionIndicatorClick) : undefined}
      />
    </Tooltip>
  );
};

const WorkspaceDiffTotals = (props: { diffAdditions?: number; diffDeletions?: number }) => {
  const { diffAdditions, diffDeletions } = props;

  if (typeof diffAdditions !== "number" || typeof diffDeletions !== "number") {
    return null;
  }

  return (
    <DiffBubble additions={diffAdditions} deletions={diffDeletions} variant="ghost" size="small" fileName={undefined} />
  );
};

const WorkspaceDropdownTrigger = (props: { hasMultipleWorkspaces: boolean; onDropdownClick?: () => void }) => {
  const { hasMultipleWorkspaces, onDropdownClick } = props;

  if (!hasMultipleWorkspaces) {
    return null;
  }

  return (
    <Icon
      as={ChevronDown}
      boxSize="12px"
      color="fg.muted"
      cursor={onDropdownClick ? "pointer" : "default"}
      aria-label="Workspace selector"
      onClick={onDropdownClick ? (event) => handleIconClick(event, onDropdownClick) : undefined}
    />
  );
};

export const WorkspaceBadge = (props: WorkspaceBadgeProps) => {
  const {
    workspaceType,
    initializing = false,
    shorthand,
    attemptStatus,
    sessionStatus,
    diffAdditions,
    diffDeletions,
    hasMultipleWorkspaces = false,
    onClick,
    onDropdownClick,
    onSessionIndicatorClick,
  } = props;

  return (
    <HStack
      as="span"
      display="inline-flex"
      gap="2xs"
      alignItems="center"
      minW="0"
      cursor={onClick ? "pointer" : "default"}
      onClick={onClick ? (event) => handleBadgeClick(event, onClick) : undefined}
      data-testid="workspace-badge"
    >
      <WorkspaceTypeIndicator workspaceType={workspaceType} initializing={initializing} />

      {shorthand ? (
        <Text as="span" textStyle="label/XS/regular" color="fg.muted" flexShrink={0}>
          {shorthand}
        </Text>
      ) : null}

      <WorkspaceStatusIndicator
        attemptStatus={attemptStatus}
        sessionStatus={sessionStatus}
        onSessionIndicatorClick={onSessionIndicatorClick}
      />
      <WorkspaceDiffTotals diffAdditions={diffAdditions} diffDeletions={diffDeletions} />
      <WorkspaceDropdownTrigger hasMultipleWorkspaces={hasMultipleWorkspaces} onDropdownClick={onDropdownClick} />
    </HStack>
  );
};
