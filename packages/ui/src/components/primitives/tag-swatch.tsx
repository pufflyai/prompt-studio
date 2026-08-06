import { Box, Center, type CenterProps, Icon } from "@chakra-ui/react";
import { getIconComponent, type IconColorPickerIconOption } from "./icon-options";

export interface TagSwatchProps extends Omit<CenterProps, "color"> {
  color: string;
  icon?: string | null;
  iconOptions?: readonly IconColorPickerIconOption[];
  /** Renders the icon glyph instead of a plain colour dot when the value carries an icon. */
  showIcon?: boolean;
}

// The planner writes "circle" as its no-icon default, so both it and a missing
// icon render as the design's plain colour dot instead of a lucide ring.
const hasGlyph = (icon?: string | null) => Boolean(icon) && icon !== "circle";

export const TagSwatch = (props: TagSwatchProps) => {
  const { color, icon, iconOptions, showIcon = true, ...rest } = props;
  const IconComponent = getIconComponent(icon, iconOptions);

  return (
    <Center boxSize="tag-swatch" flexShrink={0} borderRadius="compact" bg={`${color}.500/15`} {...rest}>
      {showIcon && hasGlyph(icon) ? (
        <Icon as={IconComponent} boxSize="icon-xs" color={`${color}.500`} />
      ) : (
        <Box boxSize="tag-swatch-dot" borderRadius="full" bg={`${color}.500`} />
      )}
    </Center>
  );
};
