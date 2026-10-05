import { chakra, Icon, Table, Text } from "@chakra-ui/react";
import { ChevronDown, ChevronRight } from "lucide-react";

export interface DataTableGroupRowProps {
  label: string;
  count: number;
  collapsed: boolean;
  columnCount: number;
  onToggle: () => void;
}

/** One row per group value. Collapsing it is screen state and is never saved. */
export const DataTableGroupRow = (props: DataTableGroupRowProps) => {
  const { label, count, collapsed, columnCount, onToggle } = props;
  return (
    <Table.Row data-testid="data-table-group-row" bg="bg.subtle" borderBottom="1px solid" borderColor="border.subtle">
      <Table.Cell colSpan={columnCount} paddingX="xs" paddingY="2xs" borderBottom="none">
        <chakra.button
          type="button"
          aria-expanded={!collapsed}
          display="flex"
          alignItems="center"
          gap="xs"
          height="1.5rem"
          onClick={onToggle}
        >
          <Icon as={collapsed ? ChevronRight : ChevronDown} boxSize="0.875rem" color="fg.muted" />
          <Text as="span" textStyle="label/S/medium">
            {label}
          </Text>
          <Text as="span" textStyle="label/XS" color="fg.muted">
            {count}
          </Text>
        </chakra.button>
      </Table.Cell>
    </Table.Row>
  );
};
