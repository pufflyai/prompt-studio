import { Button, Icon as ChakraIcon, Flex, IconButton, Stack, Text } from "@chakra-ui/react";

interface SelectionToolbarProps {
  selectedCount: number;
  totalCount: number;
  onClearSelection: () => void;
  onSelectAll: () => void;
  onCSVDownload: () => void;
}

export function SelectionToolbar(props: SelectionToolbarProps) {
  const { selectedCount, totalCount, onClearSelection, onSelectAll, onCSVDownload } = props;

  return (
    <Flex alignItems="center" paddingY="2xs" paddingX="sm">
      <Stack direction="row" alignItems="center">
        <IconButton aria-label="clear-selection" onClick={onClearSelection} size="xs">
          <ChakraIcon boxSize="16px" />
        </IconButton>
        <Text>{selectedCount} rows selected</Text>
        {selectedCount !== totalCount && (
          <Button size="xs" onClick={onSelectAll}>
            Select all {totalCount} rows
          </Button>
        )}
        <Button size="xs" onClick={onCSVDownload}>
          Download CSV
        </Button>
      </Stack>
    </Flex>
  );
}
