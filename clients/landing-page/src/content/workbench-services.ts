import {
  Bell,
  Blocks,
  Bot,
  GitBranch,
  Keyboard,
  Link2,
  Navigation,
  Palette,
  Search,
  Settings2,
  ShieldCheck,
  SquareTerminal,
} from "lucide-react";

export const WORKBENCH_SERVICES = [
  {
    id: "agents",
    name: "Agents",
    description: "Hand any task to Claude Code, Codex, or OpenCode, right inside your tool.",
    icon: Bot,
  },
  {
    id: "command-line",
    name: "Command line",
    description: "Every action in your tool also works from the terminal and for agents.",
    icon: SquareTerminal,
  },
  {
    id: "workspaces",
    name: "Workspaces",
    description: "Agents work in their own copy of your project, so nothing breaks while they try things.",
    icon: GitBranch,
  },
  {
    id: "search",
    name: "Search",
    description: "Find files, open tools, and run commands from one search.",
    icon: Search,
  },
  {
    id: "notifications",
    name: "Notifications",
    description: "Know when work finishes or needs your attention.",
    icon: Bell,
  },
  {
    id: "navigation",
    name: "Navigation",
    description: "Switch between your tools and keep useful views open.",
    icon: Navigation,
  },
  {
    id: "links",
    name: "Links between tools",
    description: "Connect a ticket to its pull request, or a report to its data, across tools.",
    icon: Link2,
  },
  {
    id: "safety",
    name: "Privacy and safety",
    description: "Tools never see your secrets and only touch what you allow.",
    icon: ShieldCheck,
  },
  {
    id: "extensions",
    name: "Extension management",
    description: "Install, enable, and manage the tools in your workbench.",
    icon: Blocks,
  },
  {
    id: "shortcuts",
    name: "Keyboard shortcuts",
    description: "Shared shortcuts to create and go to things work the same in every tool.",
    icon: Keyboard,
  },
  {
    id: "settings",
    name: "Settings",
    description: "Each tool gets a settings page without building one.",
    icon: Settings2,
  },
  {
    id: "themes",
    name: "Themes",
    description: "Use light, dark, or your own theme across all your tools.",
    icon: Palette,
  },
] as const;
