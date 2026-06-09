import { Box, Button, Icon, Menu, Text } from "@chakra-ui/react";
import { ListRow, SearchableMenu, type SearchableMenuItem, Tooltip } from "@pstdio/ui";
import { ChevronDown, GitBranch } from "lucide-react";
import type { DashboardWorkspaceOption } from "@/shared/workspaces/workspace-options";

interface SessionWorkspaceMenuProps {
  workspaces: DashboardWorkspaceOption[];
  selectedWorkspaceId: string;
  selectedWorkspaceLabel: string;
  onSelectWorkspace: (workspaceId: string) => void;
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

const WorkspaceMenuButton = (props: { label: string; disabled?: boolean }) => {
  const { label, disabled = false } = props;

  return (
    <Button variant="ghost" size="sm" px="2" minW="0" aria-label="Select workspace" disabled={disabled}>
      <GitBranch size={14} />
      <Text textStyle="label/XS/medium" color="fg" ml="2xs" truncate>
        {label}
      </Text>
      {!disabled ? <ChevronDown size={14} /> : null}
    </Button>
  );
};

const WorkspaceStaticLabel = (props: { label: string }) => {
  const { label } = props;

  return (
    <Box display="flex" alignItems="center" gap="2xs" minW="0" px="2" h="8">
      <GitBranch size={14} />
      <Text textStyle="label/XS/medium" color="fg" truncate>
        {label}
      </Text>
    </Box>
  );
};

export const SessionWorkspaceMenu = (props: SessionWorkspaceMenuProps) => {
  const { workspaces, selectedWorkspaceId, selectedWorkspaceLabel, onSelectWorkspace, isDisabled = false } = props;
  const selectedLabel = selectedWorkspaceLabel || "Select workspace";

  if (isDisabled) {
    return (
      <Tooltip content="Workspace">
        <Box minW="0">
          <WorkspaceStaticLabel label={selectedLabel || "No workspace"} />
        </Box>
      </Tooltip>
    );
  }

  return (
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
  );
};
