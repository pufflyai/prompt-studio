import type { LucideIcon } from "lucide-react";
import { BadgeCheck, LayoutGrid, PanelsTopLeft, Scale, Sparkles } from "lucide-react";

export const SITE_LINKS = {
  github: "https://github.com/pufflyai/prompt-studio",
  readme: "https://github.com/pufflyai/prompt-studio/blob/main/README.md",
  issues: "https://github.com/pufflyai/prompt-studio/issues",
  discord: "https://discord.gg/3RxwUEk8fW",
  harnessClaudeCode: "https://github.com/pufflyai/prompt-studio/tree/main/extensions/harness-claude-code",
  harnessCodex: "https://github.com/pufflyai/prompt-studio/tree/main/extensions/harness-codex",
  harnessOpenCode: "https://github.com/pufflyai/prompt-studio/tree/main/extensions/harness-open-code",
};

/** In-app views rendered inside the workbench main area. */
export type LandingView = "start" | "what-is-prompt-studio" | "examples" | "features" | "privacy" | "terms";

export interface ViewMeta {
  label: string;
  icon: LucideIcon;
}

export const VIEW_META: Record<LandingView, ViewMeta> = {
  start: { label: "Start Here", icon: Sparkles },
  "what-is-prompt-studio": { label: "What is Prompt Studio", icon: BadgeCheck },
  examples: { label: "Examples", icon: PanelsTopLeft },
  features: { label: "Features", icon: LayoutGrid },
  privacy: { label: "Privacy policy", icon: Scale },
  terms: { label: "Terms of service", icon: Scale },
};

/** Views the sidebar lists, in order. */
export const SIDEBAR_VIEWS: LandingView[] = ["start", "what-is-prompt-studio", "examples", "features"];
