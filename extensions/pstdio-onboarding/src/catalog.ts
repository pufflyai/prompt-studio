import { Code2, SquareKanban } from "lucide-react";
import type { ComponentType } from "react";
import type { OnboardingHarness, OnboardingWorkArea } from "./types";

export const harnessChoices: { id: OnboardingHarness; name: string }[] = [
  { id: "codex", name: "Codex" },
  { id: "open-code", name: "OpenCode" },
  { id: "claude-code", name: "Claude Code" },
  { id: "pi", name: "Pi" },
];
type HarnessIconEntry = { extensionId?: string; icon?: string | null; displayName?: string };
export const resolveHarnessIcons = (inventory?: {
  extensions: readonly HarnessIconEntry[];
  marketplace: readonly HarnessIconEntry[];
}) => {
  const icons: Partial<Record<OnboardingHarness, string>> = {};
  const entries = [...(inventory?.extensions ?? []), ...(inventory?.marketplace ?? [])];
  for (const { id } of harnessChoices) {
    const entry = entries.find(({ extensionId, icon }) => extensionId === `pstdio.harness-${id}` && icon);
    if (entry?.icon) icons[id] = entry.icon;
  }
  return icons;
};

export const workChoices: { id: OnboardingWorkArea; key: string; icon: ComponentType }[] = [
  { id: "coding", key: "coding", icon: Code2 },
  { id: "planning", key: "planning", icon: SquareKanban },
];
export const extensions: Record<string, { name: string; icon?: string }> = {
  "pstdio-home": { name: "Home" },
  "pstdio-onboarding": { name: "Onboarding" },
  "pstdio-base-themes": { name: "Themes" },
  "pstdio-skills": { name: "Prompt Studio Skills" },
  "pstdio-workspaces": { name: "Workspaces" },
  "pstdio-planner": { name: "Project Planner" },
  "pstdio-reports": { name: "Agent Reports" },
  "pstdio-artifacts": { name: "Artifacts" },
  "pstdio-notes": { name: "Notes" },
};
export const resolveExtensionChoices = (inventory?: Parameters<typeof resolveHarnessIcons>[0]) =>
  Object.fromEntries(
    Object.entries(extensions).map(([name, fallback]) => {
      const id = `pstdio.${name}`;
      const installed = inventory?.extensions.find((entry) => entry.extensionId === id);
      const catalog = inventory?.marketplace.find((entry) => entry.extensionId === id);
      return [
        name,
        {
          name: catalog?.displayName ?? installed?.displayName ?? fallback.name,
          icon: installed?.icon || catalog?.icon || undefined,
        },
      ];
    }),
  );
