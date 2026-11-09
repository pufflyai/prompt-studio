import { Button, Text } from "@chakra-ui/react";
import { SearchableMenu } from "@pstdio/ui";
import { ChevronDown } from "lucide-react";

interface IconSetChooserProps {
  value: string;
  family: string;
  disabled: boolean;
  onChange(value: string): void;
}
export const IconSetChooser = (props: IconSetChooserProps) => {
  const { value, family, disabled, onChange } = props;
  const sets = [
    { id: "all", label: family },
    { id: "custom", label: "Custom icons" },
  ];
  return (
    <SearchableMenu
      trigger={
        <Button variant="ghost" maxW="full" disabled={disabled} aria-label="Choose icon set">
          <Text truncate>{sets.find((set) => set.id === value)?.label}</Text>
          <ChevronDown />
        </Button>
      }
      items={sets.map((set) => ({ ...set, isSelected: value === set.id, onSelect: () => onChange(set.id) }))}
      showSearch={false}
      searchPlaceholder="Choose icon set"
      emptyState={null}
    />
  );
};
