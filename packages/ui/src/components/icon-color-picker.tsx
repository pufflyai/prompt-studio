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

export interface IconColorPickerIconOption {
  value: string | null;
  label: string;
  icon: ComponentType;
}

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

export const optionIcons = [
  { value: null, label: "circle", icon: Circle },
  { value: "bug", label: "bug", icon: Bug },
  { value: "sparkles", label: "sparkles", icon: Sparkles },
  { value: "book-open", label: "book open", icon: BookOpen },
  { value: "wrench", label: "wrench", icon: Wrench },
  { value: "gauge", label: "gauge", icon: Gauge },
  { value: "alert-triangle", label: "alert triangle", icon: AlertTriangle },
  { value: "star", label: "star", icon: Star },
  { value: "flag", label: "flag", icon: Flag },
  { value: "flame", label: "flame", icon: Flame },
  { value: "lightbulb", label: "lightbulb", icon: Lightbulb },
  { value: "shield", label: "shield", icon: Shield },
  { value: "eye", label: "eye", icon: Eye },
  { value: "clock", label: "clock", icon: Clock },
  { value: "check-circle", label: "check circle", icon: CheckCircle },
  { value: "tag", label: "tag", icon: Tag },
  { value: "code", label: "code", icon: Code },
  { value: "chart-column-increasing", label: "chart column increasing", icon: ChartColumnIncreasing },
  { value: "circle-question-mark", label: "circle question mark", icon: CircleQuestionMark },
  { value: "shield-alert", label: "shield alert", icon: ShieldAlert },
] satisfies IconColorPickerIconOption[];

export const getIconComponent = (
  name: string | null | undefined,
  iconOptions: readonly IconColorPickerIconOption[] = optionIcons,
): ComponentType => {
  const entry = iconOptions.find((icon) => icon.value === (name ?? null));
  return entry?.icon ?? Circle;
};

export interface IconColorPickerProps {
  color: string;
  colorOptions?: readonly string[];
  icon?: string | null;
  iconOptions?: readonly IconColorPickerIconOption[];
  onColorChange: (color: string) => void;
  onIconChange?: (icon: string | null) => void;
  disabled?: boolean;
  showIcons?: boolean;
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
    "aria-label": ariaLabel = "Pick color and icon",
  } = props;
  const IconComponent = showIcons ? getIconComponent(icon, iconOptions) : Circle;
  const selectedIcon = icon ?? null;

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
            {colorOptions.map((optionColor) => (
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
                {iconOptions.map((entry) => (
                  <GridItem key={entry.value ?? "none"}>
                    <IconButton
                      size="2xs"
                      variant={entry.value === selectedIcon ? "solid" : "ghost"}
                      onClick={() => onIconChange?.(entry.value)}
                      aria-label={entry.label}
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
