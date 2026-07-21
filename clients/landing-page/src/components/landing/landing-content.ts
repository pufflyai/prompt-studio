import type { LucideIcon } from "lucide-react";
import {
  Blocks,
  BookOpen,
  Bot,
  Boxes,
  Braces,
  ChartNoAxesCombined,
  Columns3,
  Command,
  FileText,
  FolderGit2,
  GitBranch,
  LayoutPanelLeft,
  MessagesSquare,
  Package,
  PenTool,
  Plug,
  Rss,
  Scale,
  Server,
  Settings2,
  Sparkles,
  SquareTerminal,
  Ticket,
  Webhook,
  Workflow,
} from "lucide-react";

export const INSTALL_COMMANDS = ["bun add -g pstdio@latest && pst"];

export const SITE_LINKS = {
  github: "https://github.com/pufflyai/prompt-studio",
  discord: "https://discord.gg/3RxwUEk8fW",
  changelog: "https://github.com/pufflyai/prompt-studio/blob/main/packages/pstdio/CHANGELOG.md",
  harnessClaudeCode: "https://github.com/pufflyai/prompt-studio/tree/main/extensions/harness-claude-code",
  harnessCodex: "https://github.com/pufflyai/prompt-studio/tree/main/extensions/harness-codex",
  harnessOpenCode: "https://github.com/pufflyai/prompt-studio/tree/main/extensions/harness-open-code",
};

/** In-app views rendered inside the workbench main area. */
export type LandingView =
  | "start"
  | "gallery"
  | "concepts"
  | "guide-getting-started"
  | "guide-create-ticket"
  | "guide-implement-ticket"
  | "guide-create-proposal"
  | "guide-create-sub-tickets"
  | "guide-refine-ticket"
  | "guide-create-extension"
  | "cli-reference"
  | "cli-projects"
  | "cli-workspaces"
  | "cli-agents"
  | "cli-sessions"
  | "cli-extensions"
  | "cli-planner"
  | "cli-configuration"
  | "sdk-reference"
  | "sdk-commands"
  | "sdk-views"
  | "sdk-hooks"
  | "sdk-client"
  | "sdk-assets"
  | "blog"
  | "privacy"
  | "terms";

export interface ViewMeta {
  label: string;
  icon: LucideIcon;
  /** Parent documentation group, rendered as a breadcrumb and tree nesting. */
  parent?: DocumentationGroupId;
}

export const VIEW_META: Record<LandingView, ViewMeta> = {
  start: { label: "Start here", icon: Sparkles },
  gallery: { label: "Extension gallery", icon: Blocks },
  concepts: { label: "Concepts", icon: BookOpen },
  "guide-getting-started": { label: "Set up Prompt Studio", icon: SquareTerminal, parent: "guides" },
  "guide-create-ticket": { label: "Create a ticket", icon: Ticket, parent: "guides" },
  "guide-implement-ticket": { label: "Implement a ticket", icon: Ticket, parent: "guides" },
  "guide-create-proposal": { label: "Write a proposal", icon: FileText, parent: "guides" },
  "guide-create-sub-tickets": { label: "Create sub-tickets", icon: GitBranch, parent: "guides" },
  "guide-refine-ticket": { label: "Refine a ticket", icon: Workflow, parent: "guides" },
  "guide-create-extension": { label: "Build an extension", icon: Blocks, parent: "guides" },
  "cli-reference": { label: "CLI reference", icon: SquareTerminal },
  "cli-projects": { label: "Projects", icon: FolderGit2, parent: "cli-reference" },
  "cli-workspaces": { label: "Workspaces", icon: Boxes, parent: "cli-reference" },
  "cli-agents": { label: "Agents", icon: Bot, parent: "cli-reference" },
  "cli-sessions": { label: "Sessions", icon: MessagesSquare, parent: "cli-reference" },
  "cli-extensions": { label: "Extensions & serve", icon: Server, parent: "cli-reference" },
  "cli-planner": { label: "Planner extension", icon: Ticket, parent: "cli-reference" },
  "cli-configuration": { label: "Configuration", icon: Settings2, parent: "cli-reference" },
  "sdk-reference": { label: "SDK reference", icon: Braces },
  "sdk-commands": { label: "Extension commands", icon: Command, parent: "sdk-reference" },
  "sdk-views": { label: "Views & renderers", icon: LayoutPanelLeft, parent: "sdk-reference" },
  "sdk-hooks": { label: "Hooks & schedules", icon: Webhook, parent: "sdk-reference" },
  "sdk-client": { label: "Client & types", icon: Plug, parent: "sdk-reference" },
  "sdk-assets": { label: "Assets & catalog", icon: Package, parent: "sdk-reference" },
  blog: { label: "Blog", icon: Rss },
  privacy: { label: "Privacy policy", icon: FileText },
  terms: { label: "Terms of service", icon: Scale },
};

export type DocumentationGroupId = "guides" | "cli-reference" | "sdk-reference";

export interface DocumentationGroupMeta {
  label: string;
  icon: LucideIcon;
  overview?: LandingView;
}

export const DOCUMENTATION_GROUP_META: Record<DocumentationGroupId, DocumentationGroupMeta> = {
  guides: { label: "Guides", icon: BookOpen },
  "cli-reference": { label: "CLI reference", icon: SquareTerminal, overview: "cli-reference" },
  "sdk-reference": { label: "SDK reference", icon: Braces, overview: "sdk-reference" },
};

export interface ProjectTab {
  id: ProjectTabId;
  label: string;
  icon: LucideIcon;
}

export type ProjectTabId = "docs" | "agentic-kanban" | "agentic-design" | "agentic-data-analysis" | "workflow-builder";

export const PROJECT_TABS: ProjectTab[] = [
  { id: "docs", label: "Docs", icon: BookOpen },
  { id: "agentic-kanban", label: "Agentic kanban", icon: Columns3 },
  { id: "agentic-design", label: "Agentic design", icon: PenTool },
  { id: "agentic-data-analysis", label: "Agentic data analysis", icon: ChartNoAxesCombined },
  { id: "workflow-builder", label: "Workflow builder", icon: Workflow },
];

export interface ChangelogEntry {
  version: string;
  date: string;
  highlights: string[];
}

// curated digest of packages/pstdio/CHANGELOG.md
export const CHANGELOG_ENTRIES: ChangelogEntry[] = [
  {
    version: "0.24.0",
    date: "2026-07-09",
    highlights: [
      "Workbench terminal tabs with workspace-scoped PTY sessions.",
      "Extensions contribute command-backed control panels rendered through the ParamEditor.",
      "React xterm.js terminal surface shipped as @pstdio/ui/terminal.",
    ],
  },
  {
    version: "0.23.0",
    date: "2026-06-28",
    highlights: [
      "Durable notification center and inbox workflows.",
      "Mode-reactive sidebar composed from extension contributions.",
    ],
  },
  {
    version: "0.22.0",
    date: "2026-06-23",
    highlights: ["Create a project with no coding agents installed; add them later in Settings."],
  },
  {
    version: "0.21.0",
    date: "2026-06-17",
    highlights: [
      "Extensions contribute file icon themes: Monokai, Solarized, Dracula, and Seti.",
      "Project templates can override extension templates per project.",
    ],
  },
];
