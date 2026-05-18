import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  BookOpen,
  Bug,
  CheckCircle,
  Circle,
  Clock,
  Eye,
  Flag,
  Flame,
  Gauge,
  Lightbulb,
  Shield,
  Sparkles,
  Star,
  Wrench,
} from "lucide-react";

const TAG_OPTION_ICON_MAP: Record<string, LucideIcon> = {
  circle: Circle,
  bug: Bug,
  sparkles: Sparkles,
  "book-open": BookOpen,
  wrench: Wrench,
  gauge: Gauge,
  "alert-triangle": AlertTriangle,
  star: Star,
  flag: Flag,
  flame: Flame,
  lightbulb: Lightbulb,
  shield: Shield,
  eye: Eye,
  clock: Clock,
  "check-circle": CheckCircle,
};

export const getTagOptionIcon = (icon: string | null | undefined) => {
  if (!icon) {
    return null;
  }

  return TAG_OPTION_ICON_MAP[icon] ?? null;
};
