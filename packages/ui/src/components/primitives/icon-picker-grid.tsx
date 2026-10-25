import { chakra, Grid, Icon } from "@chakra-ui/react";
import type { IconColorPickerIconOption } from "./icon-options";

const IconCell = chakra("button", {
  base: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    boxSize: "tag-icon-cell",
    borderRadius: "compact",
    color: "fg.muted",
    cursor: "pointer",
    _hover: { bg: "bg.hover" },
  },
});

export interface IconPickerGridProps {
  value?: string | null;
  options: readonly IconColorPickerIconOption[];
  color?: string;
  disabled?: boolean;
  onChange(value: string | null): void;
}

export const IconPickerGrid = (props: IconPickerGridProps) => {
  const { value, options, color, disabled, onChange } = props;
  const selectedColor = color ? `${color}.500` : "fg";
  const selectedBackground = color ? `${color}.500/15` : "bg.active";
  return (
    <Grid templateColumns="repeat(8, 1fr)" gap="3xs" justifyItems="center">
      {options.map((entry) => {
        const selected = entry.value === value;
        return (
          <IconCell
            key={entry.value ?? "none"}
            type="button"
            disabled={disabled}
            color={selected ? selectedColor : undefined}
            bg={selected ? selectedBackground : undefined}
            _hover={selected ? { bg: selectedBackground } : undefined}
            aria-label={entry.label}
            aria-pressed={selected}
            onClick={() => onChange(entry.value)}
          >
            <Icon as={entry.icon} boxSize="icon-xs" />
          </IconCell>
        );
      })}
    </Grid>
  );
};
