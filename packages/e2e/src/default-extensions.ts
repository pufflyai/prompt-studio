import { resolve } from "node:path";

const repoRoot = resolve(import.meta.dirname, "../../..");

export const PSTDIO_E2E_DEFAULT_EXTENSIONS = JSON.stringify([
  {
    source: resolve(repoRoot, "extensions/pstdio-core-skills"),
    installName: "pstdio-core-skills",
    skipInstall: true,
  },
  {
    source: resolve(repoRoot, "extensions/pstdio-core-templates"),
    installName: "pstdio-core-templates",
    skipInstall: true,
  },
  {
    source: resolve(repoRoot, "extensions/pstdio-core-ticket-automations"),
    installName: "pstdio-core-ticket-automations",
    skipInstall: true,
  },
  {
    source: resolve(repoRoot, "extensions/pstdio-core-workspace-automations"),
    installName: "pstdio-core-workspace-automations",
    skipInstall: true,
  },
  {
    source: resolve(repoRoot, "extensions/pstdio-core-worktree-automation"),
    installName: "pstdio-core-worktree-automation",
    skipInstall: true,
  },
]);
