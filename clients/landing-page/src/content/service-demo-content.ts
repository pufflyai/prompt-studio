import { Bot, ChartNoAxesCombined, FileCode, Shapes, Terminal } from "lucide-react";

export const SEARCH_DEMO_ENTRIES = [
  { id: "icons", label: "Icon set editor", detail: "Tool", icon: Shapes },
  { id: "shader", label: "icon-rain.frag", detail: "Shader file", icon: FileCode },
  { id: "export", label: "Export icon set", detail: "Command", icon: Terminal },
  { id: "formulas", label: "Compound growth", detail: "Financial formula", icon: ChartNoAxesCombined },
];

export const DEMO_NOTIFICATIONS = [
  {
    id: "review",
    title: "Shader controls are ready to review",
    description: "Coding agent dashboard · Just now",
    icon: Bot,
  },
  { id: "export", title: "24 icons exported", description: "Icon set editor · 2 minutes ago", icon: Shapes },
  {
    id: "glossary",
    title: "Financial glossary updated",
    description: "Formula glossary · 5 minutes ago",
    icon: ChartNoAxesCombined,
  },
];

export const DEMO_EXTENSIONS = [
  { id: "icons", name: "Icon set editor", icon: Shapes },
  { id: "shader", name: "Shader editor", icon: FileCode },
  { id: "agents", name: "Coding agent dashboard", icon: Bot },
] as const;

export const DEMO_TOOL_TABS = [
  { id: "icons", label: "Icons" },
  { id: "shader", label: "Shader" },
  { id: "formulas", label: "Formulas" },
];
