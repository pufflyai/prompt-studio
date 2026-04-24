import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  CircleQuestionMark,
  DotIcon,
  File,
  FileDiff,
  FileDown,
  FilePen,
  FileText,
  FileUp,
  Globe,
  ListTodo,
  ListTree,
  Move,
  Search,
  Terminal,
  Trash2,
} from "lucide-react";
import { normalizeToolName } from "./tool-name";

const toolIconMap = {
  shell: Terminal,
  ls: ListTree,
  read_file: FileText,
  write_file: FilePen,
  delete_file: Trash2,
  patch: FileDiff,
  upload_files: FileUp,
  download_file: FileDown,
  move_file: Move,
} as const satisfies Record<string, LucideIcon>;

const iconMap = {
  dot: DotIcon,
  danger: AlertTriangle,
  search: Search,
  browser: Globe,
  file: File,
  question: CircleQuestionMark,
  todo: ListTodo,
  terminal: Terminal,
  ...toolIconMap,
} as const satisfies Record<string, LucideIcon>;

export type IconName = keyof typeof iconMap;
export type ToolIconName = keyof typeof toolIconMap;

const DEFAULT_TOOL_ICON: IconName = "dot";

const isToolIconName = (value: string): value is ToolIconName => Object.hasOwn(toolIconMap, value);

export const getIconComponent = (name: IconName): LucideIcon => {
  return iconMap[name];
};

export const toolTypeToIconName = (type?: string): IconName => {
  if (!type) return DEFAULT_TOOL_ICON;

  const normalized = normalizeToolName(type);
  if (isToolIconName(normalized)) return normalized;

  const compact = normalized.replace(/_/g, "");

  switch (normalized) {
    case "read":
      return "file";
    case "bash":
      return "terminal";
    case "edit":
      return "write_file";
    case "apply_patch":
      return "patch";
    case "grep":
      return "search";
    case "glob":
      return "file";
    case "todowrite":
      return "todo";
    case "search":
      return "search";
    case "browser":
      return "browser";
    case "question":
      return "question";
    case "fs":
    case "file":
      return "file";
    default:
      return compact === "todowrite" || compact === "todo" ? "todo" : DEFAULT_TOOL_ICON;
  }
};

export { getFileTypeIcon } from "../../../utils/get-file-type-icon";
