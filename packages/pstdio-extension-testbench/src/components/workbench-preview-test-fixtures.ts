import type { CommandExecutionResult } from "@pstdio/sdk/api";
import type { ExtensionBenchLoadResponse } from "../lib/api-contract";

export const baseBench = {
  benchId: "bench-1",
  inventory: { fileIconThemes: [], skills: [], templateTypes: [], templates: [], themes: [] },
  metadata: {
    commands: [],
    commandPaletteContributions: [],
    diagnostics: [],
    extensions: [{ id: "lab", name: "lab", displayName: "Lab", sourcePath: "" }],
    menuContributions: [],
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
    activityItems: [],
    settingsSections: [],
    settingsDefinitions: [],
    settingsPanels: [],
    commandPaletteResources: [],
    keybindings: [],
  },
  projectId: "project-1",
  resources: [],
  sourcePath: "./extensions/extension-lab",
  summary: {
    commands: 0,
    diagnostics: 0,
    extensions: 1,
    keybindings: 0,
    skills: 0,
    templateTypes: 0,
    templates: 0,
    treeViews: 0,
    views: 0,
  },
} satisfies ExtensionBenchLoadResponse;

export const defaultExecuteCommand = async (commandId: string) =>
  ({
    commandId,
    extensionId: "lab",
    outcome: { ok: true, status: "success", value: null },
  }) satisfies CommandExecutionResult;
