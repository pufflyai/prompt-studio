export const extensionMarketplace = [
  {
    installName: "harness-claude-code",
    displayName: "Claude Code",
    description: "Contributes the Claude Code agent harness.",
    repositoryPath: "extensions/harness-claude-code",
    scope: "global",
  },
  {
    installName: "harness-codex",
    displayName: "Codex",
    description: "Contributes the Codex agent harness.",
    repositoryPath: "extensions/harness-codex",
    scope: "global",
  },
  {
    installName: "harness-open-code",
    displayName: "OpenCode",
    description: "Contributes the OpenCode agent harness.",
    repositoryPath: "extensions/harness-open-code",
    scope: "global",
  },
  {
    installName: "pstdio-base-themes",
    displayName: "Prompt Studio Base Themes",
    description: "Color themes and the Seti file icon theme.",
    repositoryPath: "extensions/pstdio-base-themes",
    scope: "global",
  },
  {
    installName: "pstdio-planner",
    displayName: "Prompt Studio Planner",
    description: "Tickets, managed attempts, reviews, and templates.",
    repositoryPath: "extensions/pstdio-planner",
    scope: "global",
  },
  {
    installName: "pstdio-planner-loops",
    displayName: "Prompt Studio Planner Automation",
    description: "Repository-owned planner refinement, implementation, reconciliation, and review automation.",
    repositoryPath: ".pstdio/extensions/pstdio-planner-loops",
    scope: "repo",
  },
  {
    installName: "pstdio-reports",
    displayName: "Prompt Studio Reports",
    description: "Workspace reports for agent handoffs.",
    repositoryPath: "extensions/pstdio-reports",
    scope: "global",
  },
  {
    installName: "pstdio-skills",
    displayName: "Prompt Studio Skills",
    description: "Skills for using Prompt Studio and authoring extensions.",
    repositoryPath: "extensions/pstdio-skills",
    scope: "global",
  },
] as const;

const marketplaceInstallNames = new Set<string>(extensionMarketplace.map((extension) => extension.installName));

export const isMarketplaceExtension = (installName: string) => marketplaceInstallNames.has(installName);

export const getMarketplaceExtension = (installName: string) =>
  extensionMarketplace.find((extension) => extension.installName === installName);

export const marketplaceExtensionRepositoryPath = (installName: string) =>
  getMarketplaceExtension(installName)?.repositoryPath ?? `extensions/${installName}`;
