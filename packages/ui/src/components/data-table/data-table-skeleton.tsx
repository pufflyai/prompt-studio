import "./data-table.css";

import { Skeleton, Table, Text } from "@chakra-ui/react";

export interface DataTableSkeletonColumn {
  id: string;
  label: string;
}

interface DataTableSkeletonProps {
  /** Real column headers when the caller already knows them. */
  columns?: DataTableSkeletonColumn[];
  /** Placeholder column count when the headers are still unknown. */
  columnCount?: number;
  rowCount?: number;
}

// Deterministic width variation keeps the shimmer organic without re-rendering
// to a different layout on every mount.
const cellWidths = ["70%", "45%", "60%", "35%", "55%"];

export const DataTableSkeleton = (props: DataTableSkeletonProps) => {
  const { columns, columnCount = 3, rowCount = 5 } = props;
  const headers =
    columns && columns.length > 0
      ? columns
      : Array.from({ length: columnCount }, (_, index) => ({ id: `column-${index + 1}`, label: "" }));

  return (
    <Table.Root className="data-table full-width" width="100%">
      <Table.Header>
        <Table.Row className="data-table-column-header-row" borderRight="1px solid" borderColor="border.subtle">
          {headers.map((column) => (
            <Table.ColumnHeader
              key={column.id}
              textTransform="none"
              borderRight="1px solid"
              _last={{ borderRight: "none" }}
              borderColor="border.subtle"
              paddingX="xs"
              paddingY="xs"
              whiteSpace="nowrap"
            >
              {column.label ? (
                <Text as="div" textStyle="label/S/medium" lineHeight="1.2" truncate>
                  {column.label}
                </Text>
              ) : (
                <Skeleton height="12px" width="4rem" borderRadius="xs" />
              )}
            </Table.ColumnHeader>
          ))}
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {Array.from({ length: rowCount }, (_, rowIndex) => (
          <Table.Row key={rowIndex}>
            {headers.map((column, columnIndex) => (
              <Table.Cell
                key={column.id}
                padding="xs"
                borderRight="1px solid"
                borderColor="border.subtle"
                _last={{ borderRight: "none" }}
                borderBottom="none"
              >
                <Skeleton
                  height="14px"
                  width={cellWidths[(rowIndex + columnIndex) % cellWidths.length]}
                  borderRadius="xs"
                />
              </Table.Cell>
            ))}
          </Table.Row>
        ))}
      </Table.Body>
    </Table.Root>
  );
};
