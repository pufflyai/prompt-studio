import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  DotIcon,
  File,
  FileDiff,
  FileDown,
  FilePen,
  FileText,
  FileUp,
  Globe,
  ListTree,
  Move,
  Search,
  Terminal,
  Trash2,
} from "lucide-react";

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

  const normalized = type.replace(/^tool-/, "");
  if (isToolIconName(normalized)) return normalized;

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
      return "ls";
    case "search":
      return "search";
    case "browser":
      return "browser";
    case "fs":
    case "file":
      return "file";
    default:
      return DEFAULT_TOOL_ICON;
  }
};

export { getFileTypeIcon } from "../../../utils/get-file-type-icon";
