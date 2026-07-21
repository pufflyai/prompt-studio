import type { LucideIcon } from "lucide-react";
import { Asterisk, Columns3, FileChartColumn, GraduationCap, Palette, SquareTerminal } from "lucide-react";

export type ExtensionCategory = "Workflows" | "Agent harnesses" | "Developer tools" | "Themes";

export const EXTENSION_CATEGORIES: ExtensionCategory[] = ["Workflows", "Agent harnesses", "Developer tools", "Themes"];

export interface ExtensionEntry {
  id: string;
  name: string;
  description: string;
  version: string;
  category: ExtensionCategory;
  icon: LucideIcon | "openai";
}

// mirrors the real extensions shipped in this repo (extensions/*)
export const EXTENSIONS: ExtensionEntry[] = [
  {
    id: "pstdio-planner",
    name: "Planner",
    description: "Turn your projects into agent-ready tickets, boards, and reusable templates.",
    version: "0.7.0",
    category: "Workflows",
    icon: Columns3,
  },
  {
    id: "pstdio-reports",
    name: "Reports",
    description: "Capture implementation, review, and validation reports when agents hand off work.",
    version: "0.1.1",
    category: "Workflows",
    icon: FileChartColumn,
  },
  {
    id: "pstdio-skills",
    name: "Skills",
    description: "Instruction packs that teach agents how to use Prompt Studio and author extensions.",
    version: "0.2.5",
    category: "Developer tools",
    icon: GraduationCap,
  },
  {
    id: "pstdio-base-themes",
    name: "Base themes",
    description: "Restyle the whole workbench: Monokai, Solarized, and Dracula themes plus Seti file icons.",
    version: "0.2.3",
    category: "Themes",
    icon: Palette,
  },
  {
    id: "harness-claude-code",
    name: "Claude Code harness",
    description: "Connect Anthropic's Claude Code so it can plan and build inside your projects.",
    version: "0.3.3",
    category: "Agent harnesses",
    icon: Asterisk,
  },
  {
    id: "harness-codex",
    name: "Codex harness",
    description: "Connect OpenAI's Codex agent to run sessions in your projects.",
    version: "0.2.3",
    category: "Agent harnesses",
    icon: "openai",
  },
  {
    id: "harness-open-code",
    name: "OpenCode harness",
    description: "Connect the open-source OpenCode agent and its models to your projects.",
    version: "0.3.3",
    category: "Agent harnesses",
    icon: SquareTerminal,
  },
];
