import { expect, test } from "bun:test";
import { workspaceIcon, workspaceKind } from "./workspace-kind";

test.each([
  "pstdio.worktree",
  "pstdio.git-workspaces.workspace-type.git",
  "pstdio.workspaces.workspace-type.git",
])("%s retains the Git workspace icon after provider consolidation", (provider_id) => {
  const kind = workspaceKind({ provider_id, execution_kind: "local" });
  expect(kind).toBe("worktree");
  expect(workspaceIcon(kind)).toBe("GitBranch");
});
