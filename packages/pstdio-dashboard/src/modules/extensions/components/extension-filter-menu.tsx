import { Button, Icon } from "@chakra-ui/react";
import { SearchableMenu } from "@pstdio/ui";
import { ChevronDown } from "lucide-react";

interface ExtensionFilterMenuProps {
  label: string;
  value: string;
  options: { value: string; label: string; count: number }[];
  onChange: (value: string) => void;
}

export const ExtensionFilterMenu = ({ label, value, options, onChange }: ExtensionFilterMenuProps) => (
  <SearchableMenu
    showSearch={false}
    searchPlaceholder={label}
    emptyState={null}
    trigger={
      <Button
        variant="outline"
        size="xs"
        aria-label={`${label}: ${options.find((option) => option.value === value)?.label ?? value}`}
      >
        {options.find((option) => option.value === value)?.label ?? value}
        <Icon as={ChevronDown} boxSize="3" />
      </Button>
    }
    items={options.map((option) => ({
      id: option.value,
      label: `${option.label} · ${option.count}`,
      isSelected: option.value === value,
      onSelect: () => onChange(option.value),
    }))}
  />
);
