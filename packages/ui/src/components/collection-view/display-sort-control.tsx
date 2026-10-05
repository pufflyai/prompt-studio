import { HStack, Stack, Text } from "@chakra-ui/react";
import type { ViewSort } from "@pstdio/sdk/extensions";
import type { AttributeDescriptor } from "../kanban-renderer/types";
import { fieldIcon } from "./collection-view-field-icon";
import { canSortField, findField } from "./collection-view-fields";
import { sortDirectionLabel } from "./collection-view-labels";
import { RuleSelect } from "./rule-select";

export interface DisplaySortControlProps {
  fields: AttributeDescriptor[];
  sorts: ViewSort[];
  onSortsChange: (sorts: ViewSort[]) => void;
}

/** Display settings and table headers edit the same single sort. */
export const DisplaySortControl = (props: DisplaySortControlProps) => {
  const { fields, sorts, onSortsChange } = props;
  const sort = sorts[0];
  const field = sort ? findField(fields, sort.attributeId) : undefined;
  return (
    <Stack data-testid="display-sort-control" gap="1px">
      <HStack paddingX="xs" minH="7" gap="xs">
        <Text textStyle="label/S/regular" flex="1">
          Ordering
        </Text>
        <RuleSelect
          aria-label="Ordering"
          width="9rem"
          value={sort ? `field:${sort.attributeId}` : "none"}
          options={[
            { value: "none", label: "None" },
            ...fields
              .filter(canSortField)
              .map((entry) => ({ value: `field:${entry.id}`, label: entry.label, icon: fieldIcon(entry) })),
          ]}
          onSelect={(choice) =>
            onSortsChange(
              choice === "none" ? [] : [{ attributeId: choice.slice(6), direction: sort?.direction ?? "asc" }],
            )
          }
        />
      </HStack>
      {sort ? (
        <HStack paddingX="xs" minH="7" gap="xs">
          <Text textStyle="label/S/regular" flex="1">
            Direction
          </Text>
          <RuleSelect
            aria-label="Sort direction"
            width="9rem"
            value={sort.direction}
            options={[
              { value: "asc", label: sortDirectionLabel(field, "asc") },
              { value: "desc", label: sortDirectionLabel(field, "desc") },
            ]}
            onSelect={(direction) => onSortsChange([{ ...sort, direction: direction as ViewSort["direction"] }])}
          />
        </HStack>
      ) : null}
    </Stack>
  );
};
