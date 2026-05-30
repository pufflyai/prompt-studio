import { Grid, GridItem, Icon, IconButton, Popover, Text } from "@chakra-ui/react";
import {
  AlertTriangle,
  BookOpen,
  Bug,
  ChartColumnIncreasing,
  CheckCircle,
  Circle,
  CircleQuestionMark,
  Clock,
  Code,
  Eye,
  Flag,
  Flame,
  Gauge,
  Lightbulb,
  Shield,
  ShieldAlert,
  Sparkles,
  Star,
  Tag,
  Wrench,
} from "lucide-react";
import type { ComponentType } from "react";

export const optionColors = [
  "gray",
  "red",
  "orange",
  "yellow",
  "green",
  "teal",
  "blue",
  "cyan",
  "purple",
  "pink",
] as const;

const optionIcons = [
  { name: "circle", icon: Circle },
  { name: "bug", icon: Bug },
  { name: "sparkles", icon: Sparkles },
  { name: "book-open", icon: BookOpen },
  { name: "wrench", icon: Wrench },
  { name: "gauge", icon: Gauge },
  { name: "alert-triangle", icon: AlertTriangle },
  { name: "star", icon: Star },
  { name: "flag", icon: Flag },
  { name: "flame", icon: Flame },
  { name: "lightbulb", icon: Lightbulb },
  { name: "shield", icon: Shield },
  { name: "eye", icon: Eye },
  { name: "clock", icon: Clock },
  { name: "check-circle", icon: CheckCircle },
  { name: "tag", icon: Tag },
  { name: "code", icon: Code },
  { name: "chart-column-increasing", icon: ChartColumnIncreasing },
  { name: "circle-question-mark", icon: CircleQuestionMark },
  { name: "shield-alert", icon: ShieldAlert },
] as const;

export const getIconComponent = (name: string | null | undefined): ComponentType => {
  if (!name) return Circle;
  const entry = optionIcons.find((icon) => icon.name === name);
  return entry?.icon ?? Circle;
};

export interface IconColorPickerProps {
  color: string;
  icon?: string | null;
  onColorChange: (color: string) => void;
  onIconChange?: (icon: string | null) => void;
  disabled?: boolean;
  showIcons?: boolean;
  "aria-label"?: string;
}

export const IconColorPicker = (props: IconColorPickerProps) => {
  const {
    color,
    icon,
    onColorChange,
    onIconChange,
    disabled,
    showIcons = true,
    "aria-label": ariaLabel = "Pick color and icon",
  } = props;
  const IconComponent = showIcons ? getIconComponent(icon) : Circle;
  const selectedIconName = icon ?? "circle";

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <IconButton size="2xs" variant="ghost" disabled={disabled} aria-label={ariaLabel}>
          <Icon
            as={IconComponent}
            boxSize="14px"
            color={`${color}.500`}
            fill={showIcons ? undefined : `${color}.500`}
          />
        </IconButton>
      </Popover.Trigger>
      <Popover.Positioner>
        <Popover.Content w={showIcons ? "320px" : "220px"} p="sm" bg="bg">
          <Text textStyle="label/S" mb="xs">
            Color
          </Text>
          <Grid
            templateColumns={showIcons ? "repeat(10, 1fr)" : "repeat(5, 1fr)"}
            gap="2xs"
            mb={showIcons ? "md" : "0"}
          >
            {optionColors.map((optionColor) => (
              <GridItem key={optionColor}>
                <IconButton
                  size="2xs"
                  variant={optionColor === color ? "solid" : "ghost"}
                  colorPalette={optionColor}
                  onClick={() => onColorChange(optionColor)}
                  aria-label={optionColor}
                >
                  <Icon as={Circle} boxSize="14px" fill={`${optionColor}.500`} color={`${optionColor}.500`} />
                </IconButton>
              </GridItem>
            ))}
          </Grid>
          {showIcons ? (
            <>
              <Text textStyle="label/S" mb="xs">
                Icon
              </Text>
              <Grid templateColumns="repeat(5, 1fr)" gap="2xs">
                {optionIcons.map((entry) => (
                  <GridItem key={entry.name}>
                    <IconButton
                      size="2xs"
                      variant={entry.name === selectedIconName ? "solid" : "ghost"}
                      onClick={() => onIconChange?.(entry.name === "circle" ? null : entry.name)}
                      aria-label={entry.name}
                    >
                      <Icon as={entry.icon} boxSize="14px" />
                    </IconButton>
                  </GridItem>
                ))}
              </Grid>
            </>
          ) : null}
        </Popover.Content>
      </Popover.Positioner>
    </Popover.Root>
  );
};
