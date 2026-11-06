import { Button } from "@chakra-ui/react";
import { SearchableMenu } from "@pstdio/ui";
import type { KanbanRendererCreateField } from "@pstdio/ui/kanban-renderer";
import { ChevronDown } from "lucide-react";

interface Props {
  field: KanbanRendererCreateField;
  value: unknown;
  onChange: (value: string) => void;
}
export function BookSelect(props: Props) {
  const { field, value, onChange } = props;
  const options = field.options ?? [];
  return (
    <SearchableMenu
      lazyMount
      trigger={
        <Button aria-label={field.label} variant="outline" justifyContent="space-between">
          {options.find((option) => option.value === String(value))?.label ?? "Choose…"}
          <ChevronDown />
        </Button>
      }
      items={options.map((option) => ({
        id: option.value,
        label: option.label,
        isSelected: option.value === String(value),
        onSelect: () => onChange(option.value),
      }))}
      showSearch={false}
      searchPlaceholder={field.label}
      emptyState="No options"
    />
  );
}
