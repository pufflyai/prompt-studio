import { Flex, IconButton, Menu, Stack, Text } from "@chakra-ui/react";
import { MenuItem, Tooltip } from "@pstdio/ui";
import { Plus } from "lucide-react";

interface WorkspaceListItem {
  id: string;
  label: string;
  shorthand: string;
  sessionId: string;
  updatedAt: string;
  worktreePath: string | null;
}

interface WorkspaceListPanelProps {
  workspaces: WorkspaceListItem[];
  selectedWorkspaceShorthand: string;
  onSelectWorkspace: (shorthand: string) => void;
  onCreateAttempt?: () => void;
}

const formatRelativeDate = (dateStr: string) => {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60_000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
};

export type { WorkspaceListItem };

export const WorkspaceListPanel = (props: WorkspaceListPanelProps) => {
  const { workspaces, selectedWorkspaceShorthand, onSelectWorkspace, onCreateAttempt } = props;

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
        <Stack gap="0" px="xs" py="xs">
          {workspaces.map((workspace) => (
            <MenuItem
              key={workspace.id}
              primaryLabel={workspace.shorthand}
              secondaryLabel={formatRelativeDate(workspace.updatedAt)}
              variant="compact"
              isSelected={workspace.shorthand === selectedWorkspaceShorthand}
              onClick={() => onSelectWorkspace(workspace.shorthand)}
            />
          ))}

          {workspaces.length === 0 ? (
            <Text textStyle="paragraph/XS/regular" color="foreground.tertiary" px="xs" py="sm">
              No workspaces yet.
            </Text>
          ) : null}
        </Stack>
      </Menu.Root>
    </Stack>
  );
};
