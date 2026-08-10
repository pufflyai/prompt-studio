import {
  Archive,
  Ban,
  Bell,
  Bookmark,
  BookOpen,
  Bot,
  Bug,
  Circle,
  Code,
  Component,
  Cpu,
  Eye,
  Feather,
  FileText,
  Flag,
  Flame,
  Folder,
  GitBranch,
  GitCommitHorizontal,
  Hash,
  Heart,
  History,
  Inbox,
  Kanban,
  Layers,
  Lightbulb,
  Link,
  ListChecks,
  MessageSquare,
  Play,
  Puzzle,
  Rocket,
  Scale,
  Settings,
  Shield,
  Sparkles,
  SquareKanban,
  Star,
  Tag,
  Target,
  Terminal,
  Ticket,
  Timer,
  Users,
  Workflow,
  Wrench,
  Zap,
} from "lucide-react";
import type { ComponentType } from "react";
import { createGlyphIcon } from "./glyph-icon";

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

const glyph = (name: string, label: string) => ({ value: name, label, icon: createGlyphIcon(name) });

// Level bars fill their ink box as a solid square, so they read heavier than the
// round status glyphs at the same size; lucide's own bar marks sit at 18-of-24.
const levelGlyph = (name: string, label: string) => ({
  value: name,
  label,
  icon: createGlyphIcon(name, { scale: 0.82 }),
});

// Ordered exactly like the `cmp/TagAppearancePopover` grid in the design system:
// a leading "none" cell, generic icons, then status rings, levels and concepts.
// Status rings and level bars have no lucide equivalent and ship as glyphs in
// the `prompt-studio-icons` font.
export const optionIcons = [
  { value: null, label: "none", icon: Ban },
  { value: "flag", label: "flag", icon: Flag },
  { value: "bug", label: "bug", icon: Bug },
  { value: "sparkles", label: "sparkles", icon: Sparkles },
  { value: "book-open", label: "book open", icon: BookOpen },
  { value: "wrench", label: "wrench", icon: Wrench },
  { value: "zap", label: "zap", icon: Zap },
  { value: "feather", label: "feather", icon: Feather },
  { value: "scale", label: "scale", icon: Scale },
  { value: "layers", label: "layers", icon: Layers },
  { value: "star", label: "star", icon: Star },
  { value: "flame", label: "flame", icon: Flame },
  { value: "lightbulb", label: "lightbulb", icon: Lightbulb },
  { value: "shield", label: "shield", icon: Shield },
  { value: "eye", label: "eye", icon: Eye },
  // The design draws the clock cell with lucide's timer.
  { value: "clock", label: "clock", icon: Timer },
  { value: "tag", label: "tag", icon: Tag },
  { value: "code", label: "code", icon: Code },
  { value: "rocket", label: "rocket", icon: Rocket },
  { value: "heart", label: "heart", icon: Heart },
  { value: "bookmark", label: "bookmark", icon: Bookmark },
  { value: "target", label: "target", icon: Target },
  { value: "bell", label: "bell", icon: Bell },
  { value: "hash", label: "hash", icon: Hash },
  glyph("status-backlog", "status backlog"),
  glyph("status-todo", "status todo"),
  glyph("status-progress", "status in progress"),
  glyph("status-review", "status in review"),
  glyph("status-done", "status done"),
  glyph("status-canceled", "status canceled"),
  { value: "ticket", label: "ticket", icon: Ticket },
  { value: "git-branch", label: "git branch", icon: GitBranch },
  levelGlyph("level-low", "level low"),
  levelGlyph("level-mid", "level medium"),
  levelGlyph("level-high", "level high"),
  levelGlyph("level-xhigh", "level very high"),
  { value: "bot", label: "bot", icon: Bot },
  { value: "puzzle", label: "puzzle", icon: Puzzle },
  { value: "workflow", label: "workflow", icon: Workflow },
  { value: "kanban", label: "kanban", icon: Kanban },
  { value: "message-square", label: "message square", icon: MessageSquare },
  { value: "folder", label: "folder", icon: Folder },
  { value: "file-text", label: "file text", icon: FileText },
  { value: "history", label: "history", icon: History },
  { value: "play", label: "play", icon: Play },
  { value: "terminal", label: "terminal", icon: Terminal },
  { value: "cpu", label: "CPU", icon: Cpu },
  { value: "users", label: "users", icon: Users },
  // Prompt Studio concepts: the icons its own tickets, boards, workspaces and
  // notifications are drawn with.
  { value: "component", label: "ticket", icon: Component },
  { value: "square-kanban", label: "board", icon: SquareKanban },
  { value: "git-commit-horizontal", label: "workspace", icon: GitCommitHorizontal },
  { value: "inbox", label: "notifications", icon: Inbox },
  { value: "list-checks", label: "checklist", icon: ListChecks },
  { value: "archive", label: "archive", icon: Archive },
  { value: "link", label: "link", icon: Link },
  { value: "settings", label: "settings", icon: Settings },
] satisfies IconColorPickerIconOption[];

export const getIconComponent = (
  name: string | null | undefined,
  iconOptions: readonly IconColorPickerIconOption[] = optionIcons,
): ComponentType => {
  const normalizedName = (name ?? "circle")
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/([a-zA-Z])([0-9])/g, "$1-$2")
    .toLowerCase();
  const entry = iconOptions.find((icon) => icon.value === normalizedName);
  return entry?.icon ?? Circle;
};
