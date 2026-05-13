import type { LucideIcon } from "lucide-react";
import { CircleHelp, Palette, Plus, SettingsIcon, Terminal } from "lucide-react";

const shellIconByName: Record<string, LucideIcon> = {
  help: CircleHelp,
  palette: Palette,
  plus: Plus,
  settings: SettingsIcon,
  terminal: Terminal,
};

export const getShellIcon = (icon?: string) => (icon ? (shellIconByName[icon] ?? Terminal) : Terminal);
