import { createGlyphIcon } from "@pstdio/ui";
import { Code2, FileText, NotebookPen, Palette, Pi, Shapes, SquareKanban, SquareTerminal } from "lucide-react";
import type { OnboardingHarness, OnboardingWorkArea } from "pstdio-api-contracts";
import type { ComponentType } from "react";

export const harnessChoices: { id: OnboardingHarness; name: string; icon: ComponentType }[] = [
  { id: "codex", name: "Codex", icon: createGlyphIcon("logo-openai", { scale: 1.4 }) },
  { id: "open-code", name: "OpenCode", icon: SquareTerminal },
  { id: "claude-code", name: "Claude Code", icon: createGlyphIcon("logo-anthropic", { scale: 1.4 }) },
  { id: "pi", name: "Pi", icon: Pi },
];
export const workChoices: { id: OnboardingWorkArea; key: string; icon: ComponentType }[] = [
  { id: "coding", key: "coding", icon: Code2 },
  { id: "planning", key: "planning", icon: SquareKanban },
];
export const extensions: Record<string, { name: string; icon: ComponentType }> = {
  "pstdio-base-themes": { name: "Base Themes", icon: Palette },
  "pstdio-skills": { name: "Prompt Studio Skills", icon: Shapes },
  "pstdio-planner": { name: "Project Planner", icon: SquareKanban },
  "pstdio-reports": { name: "Reports", icon: FileText },
  "pstdio-artifacts": { name: "Artifacts", icon: Shapes },
  "pstdio-notes": { name: "Notes", icon: NotebookPen },
};
