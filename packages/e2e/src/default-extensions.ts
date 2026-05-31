import { resolve } from "node:path";

const repoRoot = resolve(import.meta.dirname, "../../..");

export const PSTDIO_E2E_DEFAULT_EXTENSIONS = JSON.stringify({
  defaultExtensions: [
    {
      source: resolve(repoRoot, "extensions/pstdio-core-skills"),
      installName: "pstdio-core-skills",
    },
    {
      source: resolve(repoRoot, "extensions/pstdio-core-templates"),
      installName: "pstdio-core-templates",
    },
    {
      source: resolve(repoRoot, "extensions/pstdio-core-tickets"),
      installName: "pstdio-core-tickets",
    },
    {
      source: resolve(repoRoot, "extensions/pstdio-core-workspace-automations"),
      installName: "pstdio-core-workspace-automations",
    },
    {
      source: resolve(repoRoot, "extensions/pstdio-core-worktree-automation"),
      installName: "pstdio-core-worktree-automation",
    },
  ],
});
