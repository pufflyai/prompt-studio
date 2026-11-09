import { Button } from "@chakra-ui/react";
import { SearchableMenu } from "@pstdio/ui";

interface IconSetChooserProps {
  value: string;
  disabled: boolean;
  onChange(value: string): void;
}
const sets = [
  { id: "all", label: "Prompt Studio" },
  { id: "custom", label: "Custom icons" },
];
export const IconSetChooser = (props: IconSetChooserProps) => {
  const { value, disabled, onChange } = props;
  return (
    <SearchableMenu
      trigger={
        <Button variant="outline" disabled={disabled} aria-label="Choose icon set">
          {sets.find((set) => set.id === value)?.label}
        </Button>
      }
      items={sets.map((set) => ({ ...set, isSelected: value === set.id, onSelect: () => onChange(set.id) }))}
      showSearch={false}
      searchPlaceholder="Choose icon set"
      emptyState={null}
    />
  );
};
