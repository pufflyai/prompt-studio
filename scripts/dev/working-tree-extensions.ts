import { resolve } from "node:path";

const WORKING_TREE_EXTENSIONS = [
  ["harness-claude-code", "extensions/harness-claude-code"],
  ["harness-codex", "extensions/harness-codex"],
  ["harness-open-code", "extensions/harness-open-code"],
  ["pstdio-base-themes", "extensions/pstdio-base-themes"],
  ["pstdio-planner", "extensions/pstdio-planner"],
  ["pstdio-planner-loops", ".pstdio/extensions/pstdio-planner-loops"],
  ["pstdio-reports", "extensions/pstdio-reports"],
  ["pstdio-skills", "extensions/pstdio-skills"],
  ["extension-lab", "extensions/extension-lab"],
  ["local-example", "infra/local/extensions/local-example"],
] as const;

export const resolveWorkingTreeDefaultExtensions = (repoRoot: string) => ({
  defaultExtensions: WORKING_TREE_EXTENSIONS.map(([installName, source]) => ({
    force: true,
    installName,
    skipInstall: true,
    source: resolve(repoRoot, source),
  })),
});
