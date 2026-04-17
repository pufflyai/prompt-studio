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

const TAG_ICONS: Record<string, ComponentType> = {
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
  tag: Tag,
  code: Code,
  "chart-column-increasing": ChartColumnIncreasing,
  "circle-question-mark": CircleQuestionMark,
  "shield-alert": ShieldAlert,
};

export const getIconComponent = (name: string | null): ComponentType => {
  if (!name) return Circle;
  return TAG_ICONS[name] ?? Circle;
};
