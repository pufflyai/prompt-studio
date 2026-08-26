import type { LucideIcon } from "lucide-react";
import {
  BadgeCheck,
  Blocks,
  BookOpen,
  Bot,
  Boxes,
  Braces,
  Columns3,
  Command,
  Compass,
  FileText,
  FolderGit2,
  GitBranch,
  LayoutPanelLeft,
  MessagesSquare,
  Package,
  Plug,
  Scale,
  Server,
  Settings2,
  Sparkles,
  SquareTerminal,
  Ticket,
  Webhook,
  Workflow,
} from "lucide-react";

export const INSTALL_COMMANDS = ["bun add --global pstdio@latest", "pst"];

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
  | "why-prompt-studio"
  | "gallery"
  | "concepts"
  | "documentation"
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
  /** Parent navigation group, rendered as a breadcrumb and tree nesting. */
  parent?: NavigationGroupId;
}

export const VIEW_META: Record<LandingView, ViewMeta> = {
  start: { label: "Start here", icon: Sparkles, parent: "explore" },
  "why-prompt-studio": { label: "Why Prompt Studio", icon: BadgeCheck, parent: "explore" },
  gallery: { label: "Extension gallery", icon: Blocks, parent: "explore" },
  concepts: { label: "Concepts", icon: BookOpen },
  documentation: { label: "Documentation", icon: BookOpen },
  "guide-getting-started": { label: "Quickstart", icon: SquareTerminal, parent: "guides" },
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
  blog: { label: "Blog", icon: FileText },
  privacy: { label: "Privacy policy", icon: FileText },
  terms: { label: "Terms of service", icon: Scale },
};

export type NavigationGroupId = "explore" | "guides" | "cli-reference" | "sdk-reference";

export interface NavigationGroupMeta {
  label: string;
  icon: LucideIcon;
  overview?: LandingView;
}

export const NAVIGATION_GROUP_META: Record<NavigationGroupId, NavigationGroupMeta> = {
  explore: { label: "Explore", icon: Compass, overview: "start" },
  guides: { label: "Guides", icon: BookOpen },
  "cli-reference": { label: "CLI reference", icon: SquareTerminal, overview: "cli-reference" },
  "sdk-reference": { label: "SDK reference", icon: Braces, overview: "sdk-reference" },
};

export interface ProjectTab {
  id: ProjectTabId;
  label: string;
  icon: LucideIcon;
}

export type ProjectTabId = "docs" | "agentic-kanban";

export const PROJECT_TABS: ProjectTab[] = [
  { id: "docs", label: "Prompt Studio Docs", icon: BookOpen },
  { id: "agentic-kanban", label: "Project Roadmap", icon: Columns3 },
];

export interface ChangelogEntry {
  version: string;
  date: string;
  highlights: string[];
}

// curated digest of packages/pstdio/CHANGELOG.md
export const CHANGELOG_ENTRIES: ChangelogEntry[] = [
  {
    version: "0.29.0",
    date: "2026-08-25",
    highlights: [
      "Typed webview clients and React Query hooks for extension authors.",
      "Marketplace upgrades now replace installed extensions cleanly.",
    ],
  },
  {
    version: "0.28.0",
    date: "2026-08-24",
    highlights: [
      "Workspace file browsing, Monaco editing, and diff review in the workbench.",
      "Install and upgrade extensions directly from Git repositories.",
    ],
  },
  {
    version: "0.27.0",
    date: "2026-08-21",
    highlights: [
      "Editable Markdown tables and a broader extension API alpha.",
      "Extension-owned workbench composition, refresh controls, and attempt orchestration.",
    ],
  },
  {
    version: "0.26.2",
    date: "2026-08-16",
    highlights: ["Authenticated extension webviews and more reliable runtime shutdown."],
  },
];
