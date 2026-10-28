/** Layer map and package rules for verify-boundaries.ts. */
// Workspace-internal dependencies each package may declare. Additions here are
// intentional architecture changes — update the docs when this map changes.
export const ALLOWED_WORKSPACE_DEPS: Record<string, string[]> = {
  "pstdio-service-telemetry": [],
  // The benchmark result writer is a dependency-free leaf. Packages declare it only as a development
  // dependency for their benchmark files.
  "pstdio-benchmarks": [],
  "pstdio-account-manager": ["pstdio-sync-contracts", "pstdio-service-telemetry"],
  "pstdio-psx": ["pstdio-extensions"],
  "pstdio-relay": [
    "pstdio-account-manager",
    "pstdio-sync",
    "pstdio-sync-contracts",
    "pstdio-service-telemetry",
    "pstdio-benchmarks",
  ],
  "pstdio-api-contracts": ["pstdio-sync-contracts"],
  "pstdio-diagnostics": ["pstdio-api-contracts"],
  "pstdio-sync-contracts": [],
  "storage-scale-fixture": [],
  "pstdio-sync": ["pstdio-sync-contracts", "storage-scale-fixture"],
  "pstdio-file-types": [],
  "pstdio-paths": [],
  "pstdio-logging": ["pstdio-paths"],
  "pstdio-db": [
    "pstdio-api-contracts",
    "pstdio-paths",
    "pstdio-sync",
    "pstdio-sync-contracts",
    "pstdio-relay",
    "pstdio-benchmarks",
    "storage-scale-fixture",
  ],
  "pstdio-scheduler": [],
  "pstdio-wt": ["pstdio-file-types"],
  "pstdio-storage": ["pstdio-paths", "pstdio-sync-contracts"],
  "@pstdio/sdk": ["pstdio-api-contracts", "pstdio-sync", "pstdio-sync-contracts"],
  // pstdio-extensions also declares extension-lab, whose documented examples its tests load,
  // so changing an example marks pstdio-extensions as affected.
  "pstdio-extensions": ["@pstdio/sdk", "pstdio-api-contracts", "pstdio-paths", "extension-lab"],
  "pstdio-api-runtime-host": ["pstdio-api-contracts", "pstdio-extensions", "pstdio-benchmarks"],
  // pstdio-api also declares the extensions and fixtures its tests install from source,
  // so changing one marks pstdio-api as affected.
  "pstdio-api": [
    "pstdio-sync",
    "pstdio-sync-contracts",
    "@pstdio/sdk",
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
    "pstdio-base-themes",
    "pstdio-planner",
    "pstdio-skills",
    "workbench-fixture",
    "pstdio-benchmarks",
  ],
  pstdio: [
    "pstdio-api-contracts",
    "pstdio-diagnostics",
    "pstdio-extensions",
    "@pstdio/sdk",
    "pstdio-api",
    "pstdio-logging",
    "pstdio-paths",
    "pstdio-wt",
  ],
  "@pstdio/ui": ["@pstdio/sdk", "pstdio-api-contracts", "pstdio-file-types", "pstdio-benchmarks"],
  "@pstdio/workbench": [
    "@pstdio/sdk",
    "@pstdio/ui",
    "pstdio-api-contracts",
    "pstdio-extensions",
    "pstdio-sync-contracts",
    "pstdio-benchmarks",
  ],
  "pstdio-dashboard": ["@pstdio/sdk", "@pstdio/ui", "pstdio-api-contracts", "pstdio-extensions", "@pstdio/workbench"],
  // The testbench also declares the extensions its tests load from source,
  // so changing one marks the testbench as affected.
  "pstdio-extension-testbench": [
    "@pstdio/sdk",
    "@pstdio/ui",
    "pstdio-api-contracts",
    "pstdio-extensions",
    "@pstdio/workbench",
    "pstdio-base-themes",
    "pstdio-planner",
  ],
  // e2e also declares the extensions it installs at runtime and the dashboard it serves,
  // so changing one marks e2e as affected.
  e2e: [
    "@pstdio/sdk",
    "pstdio",
    "pstdio-api-contracts",
    "pstdio-diagnostics",
    "pstdio-extensions",
    "pstdio-sync",
    "pstdio-wt",
    "extension-lab",
    "harness-claude-code",
    "harness-codex",
    "harness-open-code",
    "harness-pi",
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
    "pstdio-benchmarks",
    "storage-scale-fixture",
    "pstdio-scripts",
  ],
  "storybook-tests": ["@pstdio/ui", "@pstdio/workbench", "pstdio-dashboard"],
  "pstdio-scripts": ["pstdio-api-contracts", "pstdio-extensions"],
  "@pstdio/desktop": [
    "@pstdio/ui",
    "pstdio",
    "pstdio-api-contracts",
    "pstdio-diagnostics",
    "pstdio-logging",
    "pstdio-paths",
    "workbench-fixture",
    "pstdio-benchmarks",
    "pstdio-scripts",
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

// Private packages expose their internals through export entries. Each entry is a way
// around the package's own API, so the count may only go down; the checker asks for a
// lower limit as soon as an entry is removed. The API exposes only its app and runtime.
export const DEFAULT_PRIVATE_EXPORT_LIMIT = 2;
export const PRIVATE_EXPORT_LIMITS: Record<string, number> = {
  "pstdio-api": 2,
  "pstdio-api-contracts": 7,
  "pstdio-extensions": 12,
};
