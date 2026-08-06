import { Button, Icon as ChakraIcon, Flex, IconButton, Menu, Portal, Stack, Text } from "@chakra-ui/react";
import { X } from "lucide-react";
import { ListRow } from "../list-row/list-row";
import type { DataTableSelectionAction, RowData } from "./types";

interface SelectionToolbarProps {
  selectedCount: number;
  totalCount: number;
  onClearSelection: () => void;
  onSelectAll: () => void;
  actions: DataTableSelectionAction[];
  selectedRows: RowData[];
}

export function SelectionToolbar(props: SelectionToolbarProps) {
  const { selectedCount, totalCount, onClearSelection, onSelectAll, actions, selectedRows } = props;
  const actionLabel = actions.length === 1 ? actions[0]?.label : "Actions";

  return (
    <Flex position="absolute" insetX="sm" bottom="sm" zIndex="popover" justifyContent="center" pointerEvents="none">
      <Stack
        role="toolbar"
        aria-label="Selection actions"
        direction="row"
        alignItems="center"
        layerStyle="floatingBar"
        pointerEvents="auto"
        maxWidth="100%"
        overflowX="auto"
      >
        <IconButton aria-label="clear-selection" onClick={onClearSelection} size="xs">
          <ChakraIcon as={X} boxSize="16px" />
        </IconButton>
        <Text>{selectedCount} rows selected</Text>
        {selectedCount !== totalCount && (
          <Button size="xs" onClick={onSelectAll}>
            Select all {totalCount} rows
          </Button>
        )}
        {actions.length === 1 && actions[0] ? (
          <Button size="xs" onClick={() => actions[0]?.onSelect(selectedRows)}>
            {actionLabel}
          </Button>
        ) : null}
        {actions.length > 1 ? (
          <Menu.Root>
            <Menu.Trigger asChild>
              <Button size="xs">{actionLabel}</Button>
            </Menu.Trigger>
            <Portal>
              <Menu.Positioner>
                <Menu.Content bg="bg">
                  {actions.map((action) => (
                    <Menu.Item key={action.label} value={action.label} asChild>
                      <ListRow
                        asChild
                        variant="full-width"
                        tone={action.destructive ? "danger" : "default"}
                        label={action.label}
                        icon={action.icon}
                        onActivate={() => action.onSelect(selectedRows)}
                      />
                    </Menu.Item>
                  ))}
                </Menu.Content>
              </Menu.Positioner>
            </Portal>
          </Menu.Root>
        ) : null}
      </Stack>
    </Flex>
  );
}
