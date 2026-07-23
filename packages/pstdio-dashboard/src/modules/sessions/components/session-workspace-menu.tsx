import { Box, Button, Flex, Icon, Menu, Text } from "@chakra-ui/react";
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

// The changeable and read-only identities share one icon size and control height so the hub
// header does not shift between a draft (dropdown) and an existing session (static label).
const WorkspaceIdentityIcon = () => <Icon as={GitBranch} boxSize="14px" color="fg" />;

const WorkspaceMenuButton = (props: { label: string; disabled?: boolean }) => {
  const { label, disabled = false } = props;

  return (
    <Button variant="ghost" size="xs" px="2xs" minW="0" aria-label="Select workspace" disabled={disabled}>
      <WorkspaceIdentityIcon />
      <Text textStyle="label/XS/medium" color="fg" ml="2xs" truncate>
        {label}
      </Text>
      {!disabled ? <Icon as={ChevronDown} boxSize="14px" color="fg.muted" /> : null}
    </Button>
  );
};

const WorkspaceStaticLabel = (props: { label: string }) => {
  const { label } = props;

  return (
    <Flex align="center" gap="2xs" minW="0" px="2xs" h="7">
      <WorkspaceIdentityIcon />
      <Text textStyle="label/XS/medium" color="fg" truncate>
        {label}
      </Text>
    </Flex>
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
