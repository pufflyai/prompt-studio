import { Box, Button, HStack, Icon, IconButton, Menu, Text } from "@chakra-ui/react";
import { ListRow, SearchableMenu, type SearchableMenuItem, Tooltip } from "@pstdio/ui";
import { ArrowUpRight, ChevronDown, GitBranch } from "lucide-react";
import type { DashboardWorkspaceOption } from "@/shared/workspaces/workspace-options";

interface SessionWorkspaceMenuProps {
  workspaces: DashboardWorkspaceOption[];
  selectedWorkspaceId: string;
  selectedWorkspaceLabel: string;
  onSelectWorkspace: (workspaceId: string) => void;
  onOpenWorkspace?: () => void;
  isDisabled?: boolean;
}

const buildWorkspaceItems = (
  workspaces: DashboardWorkspaceOption[],
  selectedWorkspaceId: string,
  onSelectWorkspace: (workspaceId: string) => void,
) =>
  workspaces.map(
    (workspace): SearchableMenuItem => ({
      id: workspace.id,
      label: workspace.title,
      searchText: [workspace.title, workspace.shorthand, workspace.branch].filter(Boolean).join(" "),
      icon: GitBranch,
      isSelected: workspace.id === selectedWorkspaceId,
      onSelect: () => onSelectWorkspace(workspace.id),
    }),
  );

interface WorkspaceMenuButtonProps {
  label: string;
  disabled?: boolean;
  opensWorkspace?: boolean;
  onClick?: () => void;
}

const WorkspaceMenuButton = (props: WorkspaceMenuButtonProps) => {
  const { label, disabled = false, opensWorkspace = false, onClick } = props;

  return (
    <Button
      variant="ghost"
      size="xs"
      px="2xs"
      minW="0"
      aria-label={opensWorkspace ? "Open workspace" : "Select workspace"}
      disabled={disabled}
      onClick={onClick}
    >
      <Icon as={GitBranch} boxSize="14px" color="fg" />
      <Text textStyle="label/XS/medium" color="fg" ml="2xs" truncate>
        {label}
      </Text>
      {opensWorkspace ? <Icon as={ArrowUpRight} boxSize="14px" color="fg.muted" /> : null}
      {!opensWorkspace && !disabled ? <Icon as={ChevronDown} boxSize="14px" color="fg.muted" /> : null}
    </Button>
  );
};

export const SessionWorkspaceMenu = (props: SessionWorkspaceMenuProps) => {
  const {
    workspaces,
    selectedWorkspaceId,
    selectedWorkspaceLabel,
    onSelectWorkspace,
    onOpenWorkspace,
    isDisabled = false,
  } = props;
  const selectedLabel = selectedWorkspaceLabel || "Select workspace";

  if (isDisabled) {
    return (
      <Tooltip content="Open workspace">
        <Box minW="0">
          <WorkspaceMenuButton
            label={selectedLabel}
            opensWorkspace
            disabled={!onOpenWorkspace}
            onClick={onOpenWorkspace}
          />
        </Box>
      </Tooltip>
    );
  }

  return (
    <HStack gap="sm" minW="0">
      <SearchableMenu
        trigger={
          <Box minW="0">
            <Tooltip content={workspaces.length === 0 ? "No workspaces" : "Select workspace"}>
              <WorkspaceMenuButton label={selectedLabel} disabled={workspaces.length === 0} />
            </Tooltip>
          </Box>
        }
        items={buildWorkspaceItems(workspaces, selectedWorkspaceId, onSelectWorkspace)}
        width="280px"
        showSearch={workspaces.length > 10}
        searchPlaceholder="Search workspaces..."
        contentTestId="session-workspace-options"
        emptyState={
          <Menu.Item value="empty" asChild>
            <ListRow
              asChild
              variant="compact"
              id="empty"
              label="No workspaces"
              icon={<Icon as={GitBranch} boxSize="16px" />}
              disabled
            />
          </Menu.Item>
        }
      />
      {onOpenWorkspace ? (
        <Tooltip content="Open workspace">
          <IconButton size="xs" variant="ghost" aria-label="Open workspace" onClick={onOpenWorkspace}>
            <ArrowUpRight size={14} />
          </IconButton>
        </Tooltip>
      ) : null}
    </HStack>
  );
};
