import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";

export const installed = {
  installName: "pstdio-planner",
  targetPath: "/home/user/.pstdio/extensions/pstdio-planner",
  source: { kind: "named" as const, name: "pstdio-planner", ref: "repo#main:extensions/pstdio-planner" },
  metadata: {
    id: "pstdio.pstdio-planner",
    name: "pstdio-planner",
    displayName: "Prompt Studio Planner",
    version: "0.1.0",
    enginesPstdio: "^1.0.0",
  },
  manifest: { id: "pstdio.pstdio-planner" },
  sourceHash: "hash",
  check: {
    extensionsRoot: "/home/user/.pstdio/extensions",
    extensionsRootExists: true,
    errorCount: 0,
    warningCount: 0,
    extensions: [],
    commands: [],
    middlewares: [],
    hooks: [],
    schedules: [],
    artifactMounts: [],
    commandPaletteContributions: [],
    commandPaletteResources: [],
    themes: [],
    fileIconThemes: [],
    menuContributions: [],
    modes: [],
    pages: [],
    views: [],
    viewMenus: [],
    placements: [],
    resourceKinds: [],
    resourceViews: [],
    resourceHierarchyProviders: [],
    navigationItems: [],
    statusBarItems: [],
    statuses: [],
    activityItems: [],
    settingsSections: [],
    settingsPanels: [],
    keybindings: [],
    settingsDefinitions: [],
    templates: [],
    skills: [],
    diagnostics: [],
    hostCompatibility: {
      status: "verified" as const,
      host: { host: "dashboard" as const, hostVersion: "0.25.2", capabilities: {} },
      diagnostics: [],
    },
  },
};

export const writeExtension = (
  dir: string,
  namespace: string,
  scope?: "repo" | "user",
  apiVersion = EXTENSION_API_VERSION,
) => {
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, "package.json"),
    JSON.stringify({
      name: namespace,
      version: "1.0.0",
      publisher: "pstdio",
      main: "./extension.ts",
      engines: { pstdio: apiVersion },
      ...(scope ? { pstdio: { scope } } : {}),
    }),
  );
  writeFileSync(join(dir, "extension.ts"), "export default {};");
};

export const writeInvalidExtension = (dir: string) => {
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, "extension.ts"),
    `export default {
  broken: true,
};`,
  );
};
