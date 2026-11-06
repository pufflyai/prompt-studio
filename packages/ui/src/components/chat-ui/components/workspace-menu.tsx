import { Box, Button, HStack, Icon, IconButton, Menu, Text } from "@chakra-ui/react";
import { ArrowUpRight, ChevronDown, GitBranch } from "lucide-react";
import { ListRow } from "@/components/list-row/list-row";
import { SearchableMenu, type SearchableMenuItem } from "@/components/overlays/searchable-menu";
import { Tooltip } from "@/components/primitives/tooltip";
export interface ChatWorkspaceOption {
  id: string;
  title: string;
  shorthand?: string;
  branch?: string | null;
  disabled?: boolean;
}

interface ChatWorkspaceMenuProps {
  workspaces: ChatWorkspaceOption[];
  selectedWorkspaceId: string;
  selectedWorkspaceLabel: string;
  onSelectWorkspace: (workspaceId: string) => void;
  onOpenWorkspace?: () => void;
  isDisabled?: boolean;
  createItem?: SearchableMenuItem;
}

const buildWorkspaceItems = (
  workspaces: ChatWorkspaceOption[],
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
      isDisabled: workspace.disabled,
      onSelect: () => {
        if (!workspace.disabled) onSelectWorkspace(workspace.id);
      },
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

export const ChatWorkspaceMenu = (props: ChatWorkspaceMenuProps) => {
  const {
    workspaces,
    selectedWorkspaceId,
    selectedWorkspaceLabel,
    onSelectWorkspace,
    onOpenWorkspace,
    isDisabled = false,
    createItem,
  } = props;
  const selectedLabel = selectedWorkspaceLabel || "Select workspace";

  if (isDisabled) {
    return (
      <Tooltip content="Open workspace" disabled={!onOpenWorkspace}>
        <Box minW="0">
          <WorkspaceMenuButton
            label={selectedLabel}
            opensWorkspace={Boolean(onOpenWorkspace)}
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
              <WorkspaceMenuButton label={selectedLabel} disabled={workspaces.length === 0 && !createItem} />
            </Tooltip>
          </Box>
        }
        items={[
          ...buildWorkspaceItems(workspaces, selectedWorkspaceId, onSelectWorkspace),
          ...(createItem ? [createItem] : []),
        ]}
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
