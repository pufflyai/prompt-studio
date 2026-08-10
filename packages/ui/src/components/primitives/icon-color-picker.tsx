import { Box, chakra, Grid, Icon, Popover, Portal, Stack, Text } from "@chakra-ui/react";
import { type IconColorPickerIconOption, optionColors, optionIcons } from "./icon-options";
import { TagSwatch } from "./tag-swatch";

const SwatchTrigger = chakra("button", {
  base: {
    display: "inline-flex",
    borderRadius: "compact",
    cursor: "pointer",
    focusVisibleRing: "outside",
    _disabled: { cursor: "not-allowed", opacity: 0.5 },
  },
});

const ColorDot = chakra("button", {
  base: {
    boxSize: "tag-color-dot",
    borderRadius: "full",
    cursor: "pointer",
    outlineStyle: "solid",
    outlineWidth: "selection",
    outlineOffset: "3xs",
    outlineColor: "transparent",
    _selected: { outlineColor: "fg" },
  },
});

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

export interface IconColorPickerProps {
  color: string;
  colorOptions?: readonly string[];
  icon?: string | null;
  iconOptions?: readonly IconColorPickerIconOption[];
  onColorChange: (color: string) => void;
  onIconChange?: (icon: string | null) => void;
  disabled?: boolean;
  showIcons?: boolean;
  colorLabel?: string;
  iconLabel?: string;
  "aria-label"?: string;
}

export const IconColorPicker = (props: IconColorPickerProps) => {
  const {
    color,
    colorOptions = optionColors,
    icon,
    iconOptions = optionIcons,
    onColorChange,
    onIconChange,
    disabled,
    showIcons = true,
    colorLabel = "Color",
    iconLabel = "Icon",
    "aria-label": ariaLabel = "Pick color and icon",
  } = props;
  const selectedIcon = icon === "circle" ? null : (icon ?? null);

  return (
    <Popover.Root positioning={{ placement: "bottom-start" }}>
      <Popover.Trigger asChild>
        <SwatchTrigger type="button" disabled={disabled} aria-label={ariaLabel}>
          <TagSwatch color={color} icon={icon} iconOptions={iconOptions} showIcon={showIcons} />
        </SwatchTrigger>
      </Popover.Trigger>
      <Portal>
        <Popover.Positioner>
          <Popover.Content width={showIcons ? "tag-picker" : "tag-picker-color-only"} bg="bg.elevated">
            <Stack gap="compact" p="sm">
              <Text textStyle="label/S/medium" color="fg.muted">
                {colorLabel}
              </Text>
              <Grid templateColumns={`repeat(${showIcons ? 10 : 5}, 1fr)`} gap="2xs" justifyItems="center">
                {colorOptions.map((optionColor) => (
                  <ColorDot
                    key={optionColor}
                    type="button"
                    bg={`${optionColor}.500`}
                    aria-label={optionColor}
                    aria-pressed={optionColor === color}
                    data-selected={optionColor === color ? "" : undefined}
                    onClick={() => onColorChange(optionColor)}
                  />
                ))}
              </Grid>
              {showIcons ? (
                <>
                  <Box borderTop="subtle" />
                  <Text textStyle="label/S/medium" color="fg.muted">
                    {iconLabel}
                  </Text>
                  <Grid templateColumns="repeat(8, 1fr)" gap="3xs" justifyItems="center">
                    {iconOptions.map((entry) => {
                      const selected = entry.value === selectedIcon;
                      return (
                        <IconCell
                          key={entry.value ?? "none"}
                          type="button"
                          color={selected ? `${color}.500` : undefined}
                          bg={selected ? `${color}.500/15` : undefined}
                          _hover={selected ? { bg: `${color}.500/15` } : undefined}
                          aria-label={entry.label}
                          aria-pressed={selected}
                          onClick={() => onIconChange?.(entry.value)}
                        >
                          <Icon as={entry.icon} boxSize="icon-xs" />
                        </IconCell>
                      );
                    })}
                  </Grid>
                </>
              ) : null}
            </Stack>
          </Popover.Content>
        </Popover.Positioner>
      </Portal>
    </Popover.Root>
  );
};
