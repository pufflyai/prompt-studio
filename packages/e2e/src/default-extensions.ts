import { resolve } from "node:path";

const repoRoot = resolve(import.meta.dirname, "../../..");

const e2eExtension = (name: string) => ({
  source: resolve(repoRoot, `extensions/${name}`),
  installName: name,
  skipInstall: true,
});

export const PSTDIO_E2E_DEFAULT_EXTENSIONS = JSON.stringify({
  defaultExtensions: [
    e2eExtension("pstdio-base-themes"),
    e2eExtension("pstdio-planner"),
    e2eExtension("pstdio-reports"),
    e2eExtension("pstdio-skills"),
    e2eExtension("harness-claude-code"),
    e2eExtension("harness-codex"),
    e2eExtension("harness-open-code"),
    e2eExtension("extension-lab"),
  ],
});

export const PSTDIO_E2E_PLANNER_EXTENSION = JSON.stringify({
  defaultExtensions: [e2eExtension("pstdio-planner")],
});

// Build a PSTDIO_DEFAULT_EXTENSIONS payload that installs only the named extensions, so a CLI
// test's first `projects create` skips the npm install of extensions it never exercises.
export const e2eExtensions = (...names: string[]) => JSON.stringify({ defaultExtensions: names.map(e2eExtension) });
