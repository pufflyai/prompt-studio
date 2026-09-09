import { Bell, Blocks, Navigation, Palette, Search } from "lucide-react";

export const WORKBENCH_SERVICES = [
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
    id: "extensions",
    name: "Extension management",
    description: "Install, enable, and manage the tools in your workbench.",
    icon: Blocks,
  },
  {
    id: "themes",
    name: "Themes",
    description: "Use light, dark, or your own theme across all your tools.",
    icon: Palette,
  },
] as const;
