import { resolve } from "node:path";

const repoRoot = resolve(import.meta.dirname, "../../..");

export const PSTDIO_E2E_DEFAULT_EXTENSIONS = JSON.stringify({
  defaultExtensions: [
    {
      source: resolve(repoRoot, "extensions/pstdio-base-themes"),
      installName: "pstdio-base-themes",
    },
    {
      source: resolve(repoRoot, "extensions/pstdio-planner"),
      installName: "pstdio-planner",
    },
    {
      source: resolve(repoRoot, "extensions/pstdio-skills"),
      installName: "pstdio-skills",
    },
    {
      source: resolve(repoRoot, "extensions/harness-claude-code"),
      installName: "harness-claude-code",
    },
    {
      source: resolve(repoRoot, "extensions/harness-codex"),
      installName: "harness-codex",
    },
    {
      source: resolve(repoRoot, "extensions/harness-open-code"),
      installName: "harness-open-code",
    },
    {
      source: resolve(repoRoot, "extensions/extension-lab"),
      installName: "extension-lab",
    },
  ],
});

export const PSTDIO_E2E_PLANNER_EXTENSION = JSON.stringify({
  defaultExtensions: [{ source: resolve(repoRoot, "extensions/pstdio-planner"), installName: "pstdio-planner" }],
});

const e2eExtension = (name: string) => ({ source: resolve(repoRoot, `extensions/${name}`), installName: name });

// Build a PSTDIO_DEFAULT_EXTENSIONS payload that installs only the named extensions, so a CLI
// test's first `projects create` skips the npm install of extensions it never exercises.
export const e2eExtensions = (...names: string[]) => JSON.stringify({ defaultExtensions: names.map(e2eExtension) });
