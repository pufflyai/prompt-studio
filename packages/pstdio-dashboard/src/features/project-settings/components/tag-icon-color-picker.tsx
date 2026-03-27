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
import type { TicketStatusColor } from "@/features/ticket-list/types";

const TAG_COLORS: TicketStatusColor[] = [
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
];

const TAG_ICONS = [
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

export const getIconComponent = (name: string | null): ComponentType => {
  if (!name) return Circle;
  const entry = TAG_ICONS.find((i) => i.name === name);
  return entry?.icon ?? Circle;
};

interface TagIconColorPickerProps {
  color: TicketStatusColor;
  icon: string | null;
  onColorChange: (color: TicketStatusColor) => void;
  onIconChange: (icon: string | null) => void;
  disabled?: boolean;
}

export const TagIconColorPicker = (props: TagIconColorPickerProps) => {
  const { color, icon, onColorChange, onIconChange, disabled } = props;
  const IconComponent = getIconComponent(icon);
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
            {TAG_COLORS.map((c) => (
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
            {TAG_ICONS.map((entry) => (
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
