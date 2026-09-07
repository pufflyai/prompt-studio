import type { ExtensionHostCapabilities, ExtensionsCheckResponse } from "pstdio-api-contracts";
import { dashboardExtensionHostCapabilities } from "pstdio-extensions";

export const emptyCheck = (
  extensionsRoot: string,
  exists: boolean,
  hostCapabilities: ExtensionHostCapabilities | null = dashboardExtensionHostCapabilities,
) => {
  const check: ExtensionsCheckResponse = {
    extensionsRoot,
    extensionsRootExists: exists,
    errorCount: 0,
    warningCount: 0,
    extensions: [],
    commands: [],
    middlewares: [],
    hooks: [],
    schedules: [],
    artifactMounts: [],
    themes: [],
    fileIconThemes: [],
    menuContributions: [],
    commandPaletteContributions: [],
    modes: [],
    pages: [],
    views: [],
    viewMenus: [],
    placements: [],
    resourceKinds: [],
    resourceHierarchyProviders: [],
    navigationItems: [],
    navigationTrees: [],
    statusBarItems: [],
    statuses: [],
    activityItems: [],
    settingsSections: [],
    keybindings: [],
    settingsPanels: [],
    commandPaletteResources: [],
    settingsDefinitions: [],
    templates: [],
    skills: [],
    diagnostics: [],
    hostCompatibility: hostCapabilities
      ? { status: "verified", host: hostCapabilities, diagnostics: [] }
      : { status: "unverified", diagnostics: [] },
  };
  return check;
};
