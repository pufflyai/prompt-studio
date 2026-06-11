import { resolve } from "node:path";

const repoRoot = resolve(import.meta.dirname, "../../..");

export const PSTDIO_E2E_DEFAULT_EXTENSIONS = JSON.stringify({
  defaultExtensions: [
    {
      source: resolve(repoRoot, "extensions/pstdio-planner"),
      installName: "pstdio-planner",
    },
    {
      source: resolve(repoRoot, "extensions/pstdio-skills"),
      installName: "pstdio-skills",
    },
    {
      source: resolve(repoRoot, "extensions/pstdio-worktree-setup"),
      installName: "pstdio-worktree-setup",
    },
    {
      source: resolve(repoRoot, "extensions/harness-claude-code"),
      installName: "harness-claude-code",
    },
    {
      source: resolve(repoRoot, "extensions/harness-open-code"),
      installName: "harness-open-code",
    },
    {
      source: resolve(repoRoot, "extensions/harness-lab"),
      installName: "harness-lab",
    },
  ],
});
