import { Button, Flex, Icon, IconButton, Menu } from "@chakra-ui/react";
import { ListRow } from "@pstdio/ui";
import { ChevronDown, GitMerge, Replace, Undo2 } from "lucide-react";

interface WorkspaceActionControlProps {
  canMerge: boolean;
  isSwapped: boolean;
  isMergeLoading?: boolean;
  isSwitchActionLoading?: boolean;
  onMerge: () => void;
  onSwitchTo: () => void;
  onSwitchBack: () => void;
}

export const WorkspaceActionControl = (props: WorkspaceActionControlProps) => {
  const {
    canMerge,
    isSwapped,
    isMergeLoading = false,
    isSwitchActionLoading = false,
    onMerge,
    onSwitchTo,
    onSwitchBack,
  } = props;
  const isBusy = isMergeLoading || isSwitchActionLoading;
  const switchLabel = isSwapped ? "Switch back" : "Switch to";
  const handleSwitchAction = isSwapped ? onSwitchBack : onSwitchTo;

  return (
    <Flex gap="0" align="center">
      <Button
        size="sm"
        variant="outline"
        borderRightRadius="0"
        onClick={onMerge}
        loading={isMergeLoading}
        disabled={!canMerge || isBusy}
      >
        <GitMerge size={14} />
        Merge
      </Button>

      <Menu.Root>
        <Menu.Trigger asChild>
          <IconButton
            size="sm"
            variant="outline"
            aria-label="More workspace actions"
            borderLeftRadius="0"
            borderLeftWidth="0"
            loading={isSwitchActionLoading}
            disabled={(!canMerge && !isSwapped) || isBusy}
          >
            <ChevronDown size={14} />
          </IconButton>
        </Menu.Trigger>
        <Menu.Positioner>
          <Menu.Content minW="180px" bg="background.primary">
            <Menu.Item value="switch" asChild>
              <ListRow
                asChild
                variant="compact"
                id="switch"
                label={switchLabel}
                icon={<Icon as={isSwapped ? Undo2 : Replace} boxSize="16px" />}
                disabled={(!canMerge && !isSwapped) || isBusy}
                onActivate={handleSwitchAction}
              />
            </Menu.Item>
          </Menu.Content>
        </Menu.Positioner>
      </Menu.Root>
    </Flex>
  );
};
