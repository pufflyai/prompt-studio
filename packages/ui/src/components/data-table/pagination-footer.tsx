import { Button, Icon as ChakraIcon, Flex, IconButton, Menu, Portal, Stack, Text } from "@chakra-ui/react";
import type { useReactTable } from "@tanstack/react-table";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";

import { NumberInputField, NumberInputRoot } from "@/components/primitives/number-input";
import { ListRow } from "../list-row/list-row";
import type { RowData } from "./types";

export function PaginationFooter({
  table,
  pageIndex,
  pageSize,
  pageSizeOptions,
}: {
  table: ReturnType<typeof useReactTable<RowData>>;
  pageIndex: number;
  pageSize: number;
  pageSizeOptions: number[];
}) {
  const totalPages = Math.max(table.getPageCount(), 1);
  const canGoBack = pageIndex > 0;
  const canGoForward = pageIndex < totalPages - 1;

  return (
    <Flex
      alignItems="center"
      justifyContent="space-between"
      borderTop="1px solid"
      borderColor={"border.subtle"}
      paddingX="xs"
    >
      <Text textStyle="label/S/regular">{table.getCoreRowModel().rows.length} rows</Text>
      <Stack alignItems="center" direction="row" justifyContent="flex-end" paddingY="xs">
        <Flex alignItems="center" gap="xs" marginRight="sm">
          <Text textStyle="label/S/regular">Rows per page</Text>
          <Menu.Root>
            <Menu.Trigger asChild>
              <Button size="xs" variant="outline">
                {pageSize}
              </Button>
            </Menu.Trigger>
            <Portal>
              <Menu.Positioner>
                <Menu.Content zIndex="popover" bg="bg">
                  {pageSizeOptions.map((option) => (
                    <Menu.Item key={option} value={`${option}`} asChild>
                      <ListRow
                        asChild
                        variant="full-width"
                        label={`${option}`}
                        isSelected={option === pageSize}
                        onActivate={() => table.setPageSize(option)}
                      />
                    </Menu.Item>
                  ))}
                </Menu.Content>
              </Menu.Positioner>
            </Portal>
          </Menu.Root>
        </Flex>
        <IconButton size="xs" aria-label="Go to first page" onClick={() => table.setPageIndex(0)} disabled={!canGoBack}>
          <ChakraIcon as={ChevronsLeft} boxSize="14px" />
        </IconButton>
        <IconButton
          size="xs"
          aria-label="Go to previous page"
          onClick={() => table.setPageIndex(pageIndex - 1)}
          disabled={!canGoBack}
        >
          <ChakraIcon as={ChevronLeft} boxSize="14px" />
        </IconButton>
        <IconButton
          size="xs"
          aria-label="Go to next page"
          onClick={() => table.setPageIndex(pageIndex + 1)}
          disabled={!canGoForward}
        >
          <ChakraIcon as={ChevronRight} boxSize="14px" />
        </IconButton>
        <IconButton
          size="xs"
          aria-label="Go to last page"
          onClick={() => table.setPageIndex(table.getPageCount() - 1)}
          disabled={!canGoForward}
        >
          <ChakraIcon as={ChevronsRight} boxSize="14px" />
        </IconButton>
        <Flex alignItems="center" height="100%" marginLeft="sm" marginRight="md" gap="xs">
          <Text>Page</Text>
          <NumberInputRoot
            margin="2xs"
            width="3rem"
            size="xs"
            min={1}
            max={totalPages}
            value={`${pageIndex + 1}`}
            onValueChange={(details) => {
              const next = Number.isNaN(details.valueAsNumber) ? 1 : details.valueAsNumber;
              const clamped = Math.min(totalPages, Math.max(1, next));
              table.setPageIndex(clamped - 1);
            }}
          >
            <NumberInputField className="nodrag" />
          </NumberInputRoot>
          <Text>of {totalPages}</Text>
        </Flex>
      </Stack>
    </Flex>
  );
}
