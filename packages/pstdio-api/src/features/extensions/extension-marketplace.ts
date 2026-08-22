export const extensionMarketplace = [
  {
    installName: "harness-claude-code",
    displayName: "Claude Code",
    description: "Contributes the Claude Code agent harness.",
  },
  {
    installName: "harness-codex",
    displayName: "Codex",
    description: "Contributes the Codex agent harness.",
  },
  {
    installName: "harness-open-code",
    displayName: "OpenCode",
    description: "Contributes the OpenCode agent harness.",
  },
  {
    installName: "pstdio-base-themes",
    displayName: "Prompt Studio Base Themes",
    description: "Color themes and the Seti file icon theme.",
  },
  {
    installName: "pstdio-planner",
    displayName: "Prompt Studio Planner",
    description: "Tickets, managed attempts, reviews, and templates.",
  },
  {
    installName: "pstdio-reports",
    displayName: "Prompt Studio Reports",
    description: "Workspace reports for agent handoffs.",
  },
  {
    installName: "pstdio-skills",
    displayName: "Prompt Studio Skills",
    description: "Skills for using Prompt Studio and authoring extensions.",
  },
] as const;

const marketplaceInstallNames = new Set<string>(extensionMarketplace.map((extension) => extension.installName));

export const isMarketplaceExtension = (installName: string) => marketplaceInstallNames.has(installName);
