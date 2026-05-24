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

const STATUS_COLORS = ["gray", "red", "orange", "yellow", "green", "teal", "blue", "cyan", "purple", "pink"] as const;

const STATUS_ICONS = [
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

export const getStatusIconComponent = (name: string | null): ComponentType => {
  if (!name) return Circle;
  const entry = STATUS_ICONS.find((i) => i.name === name);
  return entry?.icon ?? Circle;
};

interface StatusIconColorPickerProps {
  color: string;
  icon: string | null;
  onColorChange: (color: string) => void;
  onIconChange: (icon: string | null) => void;
  disabled?: boolean;
}

export const StatusIconColorPicker = (props: StatusIconColorPickerProps) => {
  const { color, icon, onColorChange, onIconChange, disabled } = props;
  const IconComponent = getStatusIconComponent(icon);
  const selectedIconName = icon ?? "circle";

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <IconButton size="2xs" variant="ghost" disabled={disabled} aria-label="Pick color and icon">
          <Icon as={IconComponent} boxSize="14px" color={`${color}.500`} />
        </IconButton>
      </Popover.Trigger>
      <Popover.Positioner>
        <Popover.Content w="320px" p="sm" bg="bg">
          <Text textStyle="label/S" mb="xs">
            Color
          </Text>
          <Grid templateColumns="repeat(10, 1fr)" gap="2xs" mb="md">
            {STATUS_COLORS.map((c) => (
              <GridItem key={c}>
                <IconButton
                  size="2xs"
                  variant={c === color ? "solid" : "ghost"}
                  colorPalette={c}
                  onClick={() => onColorChange(c)}
                  aria-label={c}
                >
                  <Icon as={Circle} boxSize="14px" fill={`${c}.500`} color={`${c}.500`} />
                </IconButton>
              </GridItem>
            ))}
          </Grid>
          <Text textStyle="label/S" mb="xs">
            Icon
          </Text>
          <Grid templateColumns="repeat(5, 1fr)" gap="2xs">
            {STATUS_ICONS.map((entry) => (
              <GridItem key={entry.name}>
                <IconButton
                  size="2xs"
                  variant={entry.name === selectedIconName ? "solid" : "ghost"}
                  onClick={() => onIconChange(entry.name === "circle" ? null : entry.name)}
                  aria-label={entry.name}
                >
                  <Icon as={entry.icon} boxSize="14px" />
                </IconButton>
              </GridItem>
            ))}
          </Grid>
        </Popover.Content>
      </Popover.Positioner>
    </Popover.Root>
  );
};
