import { Bell, Blocks, Navigation, Palette, Search } from "lucide-react";

export const WORKBENCH_SERVICES = [
  {
    name: "Search",
    description: "Find commands and jump to what you need.",
    icon: Search,
    example: "Search your workbench",
    shortcut: true,
  },
  {
    name: "Notifications",
    description: "Know when work finishes or needs your attention.",
    icon: Bell,
    example: "Font build complete",
  },
  {
    name: "Navigation",
    description: "Open your tools and arrange them side by side.",
    icon: Navigation,
    example: "Font editor / Coding agents",
  },
  {
    name: "Extension management",
    description: "Install, enable, and manage the tools in your workbench.",
    icon: Blocks,
    example: "Font editor · Enabled",
  },
  {
    name: "Themes",
    description: "Give your tools a consistent look that feels like yours.",
    icon: Palette,
    example: "Light · Dark · Your own theme",
  },
];
