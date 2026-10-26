import { Box, chakra, Grid, Popover, Portal, Stack, Text } from "@chakra-ui/react";
import { type IconColorPickerIconOption, optionColors, optionIcons } from "./icon-options";
import { IconPickerGrid } from "./icon-picker-grid";
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
                  <IconPickerGrid
                    value={selectedIcon}
                    options={iconOptions}
                    color={color}
                    onChange={(icon) => onIconChange?.(icon)}
                  />
                </>
              ) : null}
            </Stack>
          </Popover.Content>
        </Popover.Positioner>
      </Portal>
    </Popover.Root>
  );
};
