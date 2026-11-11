import { resolve } from "node:path";

const WORKING_TREE_EXTENSIONS = [
  ["pstdio-cloud", "extensions/pstdio-cloud"],
  ["pstdio-home", "extensions/pstdio-home"],
  ["pstdio-session-browser", "extensions/pstdio-session-browser"],
  ["pstdio-workspaces", "extensions/pstdio-workspaces"],
  ["harness-claude-code", "extensions/harness-claude-code"],
  ["harness-codex", "extensions/harness-codex"],
  ["harness-open-code", "extensions/harness-open-code"],
  ["pstdio-base-themes", "extensions/pstdio-base-themes"],
  ["pstdio-notes", "extensions/pstdio-notes"],
  ["pstdio-performance", "extensions/pstdio-performance"],
  ["github", "extensions/github"],
  ["pstdio-planner", "extensions/pstdio-planner"],
  ["pstdio-skills", "extensions/pstdio-skills"],
  ["extension-lab", "extensions/extension-lab"],
  ["local-example", "infra/local/extensions/local-example"],
] as const;

export const resolveWorkingTreeDefaultExtensions = (repoRoot: string, resolvePath = resolve) => ({
  defaultExtensions: WORKING_TREE_EXTENSIONS.map(([installName, source]) => ({
    force: true,
    installName,
    skipInstall: true,
    source: resolvePath(repoRoot, source),
  })),
});
