/** Layer map and package rules for verify-boundaries.ts. */
// Workspace-internal dependencies each package may declare. Additions here are
// intentional architecture changes — update the docs when this map changes.
export const ALLOWED_WORKSPACE_DEPS: Record<string, string[]> = {
  "pstdio-api-contracts": [],
  "pstdio-file-types": [],
  "pstdio-paths": [],
  "pstdio-logging": ["pstdio-paths"],
  "pstdio-db": ["pstdio-api-contracts", "pstdio-paths"],
  "pstdio-scheduler": [],
  "pstdio-wt": ["pstdio-file-types"],
  "pstdio-storage": ["pstdio-paths"],
  "@pstdio/sdk": ["pstdio-api-contracts"],
  "pstdio-extensions": ["@pstdio/sdk", "pstdio-api-contracts", "pstdio-paths"],
  "pstdio-api-runtime-host": ["pstdio-api-contracts", "pstdio-extensions"],
  // pstdio-api also declares the core extensions its tests install from source,
  // so changing one marks pstdio-api as affected.
  "pstdio-api": [
    "pstdio-api-contracts",
    "pstdio-api-runtime-host",
    "pstdio-db",
    "pstdio-extensions",
    "pstdio-logging",
    "pstdio-paths",
    "pstdio-scheduler",
    "pstdio-storage",
    "pstdio-wt",
    "extension-lab",
    "pstdio-planner",
    "pstdio-skills",
  ],
  pstdio: ["@pstdio/sdk", "pstdio-api", "pstdio-logging", "pstdio-paths", "pstdio-wt"],
  "@pstdio/ui": ["@pstdio/sdk", "pstdio-file-types"],
  "@pstdio/workbench": ["@pstdio/sdk", "@pstdio/ui", "pstdio-api-contracts", "pstdio-extensions"],
  "pstdio-dashboard": ["@pstdio/sdk", "@pstdio/ui", "pstdio-api-contracts", "pstdio-extensions", "@pstdio/workbench"],
  "pstdio-extension-testbench": [
    "@pstdio/sdk",
    "@pstdio/ui",
    "pstdio-api-contracts",
    "pstdio-extensions",
    "@pstdio/workbench",
  ],
  // e2e also declares the extensions it installs at runtime and the dashboard it serves,
  // so changing one marks e2e as affected.
  e2e: [
    "@pstdio/sdk",
    "pstdio",
    "pstdio-api-contracts",
    "pstdio-extensions",
    "pstdio-wt",
    "extension-lab",
    "harness-claude-code",
    "harness-codex",
    "harness-open-code",
    "local-example",
    "pstdio-artifacts",
    "pstdio-base-themes",
    "pstdio-dashboard",
    "pstdio-notes",
    "pstdio-planner",
    "pstdio-reports",
    "pstdio-skills",
    "remote-workspaces",
    "workbench-fixture",
  ],
  "pstdio-scripts": ["pstdio-api-contracts", "pstdio-extensions"],
  "@pstdio/desktop": [
    "@pstdio/ui",
    "pstdio",
    "pstdio-api-contracts",
    "pstdio-logging",
    "pstdio-paths",
    "workbench-fixture",
  ],
  "@pstdio/landing-page": ["@pstdio/ui"],
  "motion-lab": ["@pstdio/sdk", "@pstdio/ui"],
};

// Extensions may only consume the public authoring surface.
export const EXTENSION_ALLOWED_DEPS = ["@pstdio/sdk", "@pstdio/ui"];

// Specifiers a package's sources must never reference or declare.
export const FORBIDDEN_SPECIFIERS: Record<string, string[]> = {
  "@pstdio/ui": ["@tanstack/react-router", "@tanstack/react-query"],
};

// Generated packaging glue that intentionally reaches across package roots.
export const RELATIVE_ESCAPE_ALLOWLIST = ["packages/pstdio/src/_embed-manifest.generated.ts"];

// Folders inside a package that must not reference a specifier, including subpaths and type imports.
export const FORBIDDEN_FOLDER_SPECIFIERS: Record<string, { folder: string; specifiers: string[]; rule: string }> = {
  "@pstdio/workbench": { folder: "src/core", specifiers: ["@pstdio/ui"], rule: "workbench core must not import" },
};

// Private packages expose their internals through subpath exports. Each subpath is a
// way around the package's own API, so the count may only go down. pstdio-api exports
// install internals for the CLI until `pst extensions add` calls the API (PS-504 item 3).
export const DEFAULT_PRIVATE_EXPORT_LIMIT = 2;
export const PRIVATE_EXPORT_LIMITS: Record<string, number> = {
  "pstdio-api": 9,
  "pstdio-api-contracts": 7,
  "pstdio-extensions": 10,
};
