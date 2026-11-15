import { resolve } from "node:path";

const WORKING_TREE_EXTENSIONS = [
  ["cloud", "extensions/pstdio-cloud"],
  ["home", "extensions/pstdio-home"],
  ["session-browser", "extensions/pstdio-session-browser"],
  ["workspaces", "extensions/pstdio-workspaces"],
  ["harness-claude-code", "extensions/harness-claude-code"],
  ["harness-codex", "extensions/harness-codex"],
  ["harness-open-code", "extensions/harness-open-code"],
  ["base-themes", "extensions/pstdio-base-themes"],
  ["notes", "extensions/pstdio-notes"],
  ["performance", "extensions/pstdio-performance"],
  ["planner", "extensions/pstdio-planner"],
  ["skills", "extensions/pstdio-skills"],
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
