import { Button, Flex, Stack, Text } from "@chakra-ui/react";
import type { useReactTable } from "@tanstack/react-table";

import { NumberInputField, NumberInputRoot } from "@/components/primitives/number-input";
import type { RowData } from "./types";

export function PaginationFooter({ table }: { table: ReturnType<typeof useReactTable<RowData>> }) {
  const totalPages = Math.max(table.getPageCount(), 1);

  return (
    <Flex
      alignItems="center"
      justifyContent="space-between"
      borderTop="1px solid"
      borderColor={"border.subtle"}
      paddingX="xs"
    >
      <Text>{table.getCoreRowModel().rows.length} rows</Text>
      <Stack alignItems="center" direction="row" justifyContent="flex-end" paddingY="xs">
        <Button size="xs" onClick={() => table.setPageIndex(0)} disabled={!table.getCanPreviousPage()}>
          {"<<"}
        </Button>
        <Button size="xs" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>
          {"<"}
        </Button>
        <Button size="xs" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
          {">"}
        </Button>
        <Button
          size="xs"
          onClick={() => table.setPageIndex(table.getPageCount() - 1)}
          disabled={!table.getCanNextPage()}
        >
          {">>"}
        </Button>
        <Flex alignItems="center" height="100%" marginLeft="sm" marginRight="md" gap="xs">
          <Text>Page</Text>
          <NumberInputRoot
            margin="2xs"
            width="3rem"
            size="xs"
            min={1}
            max={totalPages}
            value={`${table.getState().pagination.pageIndex + 1}`}
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
