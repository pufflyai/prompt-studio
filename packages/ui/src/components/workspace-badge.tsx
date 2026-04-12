import { Box, HStack, Icon, IconButton, Menu, Spinner, Text } from "@chakra-ui/react";
import { ChevronDown, Circle, GitBranch, GitCommit } from "lucide-react";
import type { KeyboardEvent, MouseEvent } from "react";
import { DiffBubble } from "@/components/diff-bubble";
import type { SessionCompletionStatus } from "@/components/session-indicator";
import { SessionIndicator } from "@/components/session-indicator";
import { Tooltip } from "@/components/tooltip";

export interface WorkspaceBadgeAttemptStatus {
  name: string;
  color: string;
  description?: string | null;
}

export interface WorkspaceBadgeProps {
  workspaceType: "worktree" | "current_branch";
  initializing?: boolean;
  shorthand?: string;
  attemptStatus?: WorkspaceBadgeAttemptStatus;
  sessionStatus?: SessionCompletionStatus;
  diffAdditions?: number;
  diffDeletions?: number;
  hasMultipleWorkspaces?: boolean;
  workspaceOptions?: { id: string; label: string }[];
  onClick?: () => void;
  onWorkspaceOptionSelect?: (workspaceId: string) => void;
}

const resolveWorkspaceStatusTooltip = (status: WorkspaceBadgeAttemptStatus) => {
  if (status.description) {
    return `${status.name}: ${status.description}`;
  }

  return status.name;
};

const handleDropdownClick = (event: MouseEvent<HTMLButtonElement>) => {
  event.stopPropagation();
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
    workspaceOptions = [],
    onClick,
    onWorkspaceOptionSelect,
  } = props;

  const workspaceIcon = workspaceType === "worktree" ? GitBranch : GitCommit;
  const isClickable = typeof onClick === "function";
  const hasDiff = typeof diffAdditions === "number" && typeof diffDeletions === "number";
  const hasStatusIndicator = Boolean(attemptStatus) || Boolean(sessionStatus);
  const canOpenWorkspaceMenu = hasMultipleWorkspaces && workspaceOptions.length > 0 && Boolean(onWorkspaceOptionSelect);

  const onKeyDown = (event: KeyboardEvent<HTMLSpanElement>) => {
    if (!isClickable) return;
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    onClick?.();
  };

  return (
    <HStack
      as="span"
      display="inline-flex"
      alignItems="center"
      gap="2xs"
      border="1px solid"
      borderColor="border.muted"
      borderRadius="xs"
      paddingX="2xs"
      paddingY="1px"
      minH="18px"
      cursor={isClickable ? "pointer" : "default"}
      onClick={onClick}
      role={isClickable ? "button" : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onKeyDown={onKeyDown}
      _hover={{ bg: isClickable ? "bg.hover" : "transparent" }}
    >
      <Icon as={workspaceIcon} boxSize="12px" color="fg.muted" />
      {initializing ? <Spinner size="xs" color="fg.muted" /> : null}

      {shorthand ? (
        <Text textStyle="label/S/regular" color="fg.muted">
          {shorthand}
        </Text>
      ) : null}

      {hasStatusIndicator ? (
        <HStack gap="2xs" alignItems="center">
          {sessionStatus ? <SessionIndicator status={sessionStatus} boxSize="10px" ariaLabel="Session status" /> : null}
          {attemptStatus ? (
            <Tooltip content={resolveWorkspaceStatusTooltip(attemptStatus)} disabled={false} openDelay={300}>
              <Box color={`var(--chakra-colors-${attemptStatus.color}-solid)`} display="inline-flex">
                <Circle size={8} fill="currentColor" />
              </Box>
            </Tooltip>
          ) : null}
        </HStack>
      ) : null}

      {hasDiff ? <DiffBubble additions={diffAdditions} deletions={diffDeletions} variant="ghost" size="small" /> : null}

      {canOpenWorkspaceMenu ? (
        <Menu.Root positioning={{ placement: "bottom-end" }}>
          <Menu.Trigger asChild>
            <IconButton aria-label="Switch workspace" variant="ghost" size="2xs" onClick={handleDropdownClick}>
              <ChevronDown size={12} />
            </IconButton>
          </Menu.Trigger>
          <Menu.Positioner>
            <Menu.Content minW="180px" bg="bg" onClick={(event) => event.stopPropagation()}>
              {workspaceOptions.map((workspace) => (
                <Menu.Item
                  key={workspace.id}
                  value={workspace.id}
                  onClick={(event) => {
                    event.stopPropagation();
                    onWorkspaceOptionSelect?.(workspace.id);
                  }}
                >
                  {workspace.label}
                </Menu.Item>
              ))}
            </Menu.Content>
          </Menu.Positioner>
        </Menu.Root>
      ) : null}
    </HStack>
  );
};
