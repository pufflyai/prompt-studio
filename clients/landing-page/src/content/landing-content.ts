import type { LucideIcon } from "lucide-react";
import { BadgeCheck, LayoutGrid, PanelsTopLeft, Sparkles } from "lucide-react";
import { siteMetadata } from "../config/site-metadata";

export const SITE_LINKS = {
  github: siteMetadata.repositoryUrl,
  issues: `${siteMetadata.repositoryUrl}/issues`,
  discord: "https://discord.gg/3RxwUEk8fW",
  install: "/docs/guides/getting-started/install/",
  harnessClaudeCode: "/docs/extensions/claude-code/",
  harnessCodex: "/docs/extensions/codex/",
  harnessOpenCode: "/docs/extensions/opencode/",
};

/** What the workbench main area renders for a page. */
export type LandingView =
  | "start"
  | "what-is-prompt-studio"
  | "examples"
  | "features"
  | "legal"
  | "docs"
  | "doc"
  | "blog"
  | "post";

/** Views the Prompt Studio sidebar lists, in order. */
export type SidebarView = "start" | "what-is-prompt-studio" | "examples" | "features";

export interface ViewMeta {
  label: string;
  icon: LucideIcon;
}

export const VIEW_META: Record<SidebarView, ViewMeta> = {
  start: { label: "Home", icon: Sparkles },
  "what-is-prompt-studio": { label: "What is Prompt Studio", icon: BadgeCheck },
  examples: { label: "Examples", icon: PanelsTopLeft },
  features: { label: "Features", icon: LayoutGrid },
};

export const SIDEBAR_VIEWS: SidebarView[] = ["start", "what-is-prompt-studio", "examples", "features"];
