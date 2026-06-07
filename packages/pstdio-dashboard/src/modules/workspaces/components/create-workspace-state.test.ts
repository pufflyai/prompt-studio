import { describe, expect, test } from "bun:test";
import {
  resolveCreateWorkspaceBranchSelection,
  resolveCreateWorkspaceRepositorySelection,
} from "./create-workspace-state";

describe("create workspace state", () => {
  test("selects the first repository when the current repository is no longer available", () => {
    expect(
      resolveCreateWorkspaceRepositorySelection({
        repositories: [{ id: "repo-1" }, { id: "repo-2" }],
        selectedRepository: "repo-missing",
      }),
    ).toBe("repo-1");
  });

  test("defaults workspace creation to the current branch", () => {
    expect(
      resolveCreateWorkspaceBranchSelection({
        branches: [
          { name: "feature/dashboard", isCurrent: false },
          { name: "main", isCurrent: true },
        ],
        selectedBranch: "",
      }),
    ).toBe("main");
  });

  test("keeps an explicitly selected branch", () => {
    expect(
      resolveCreateWorkspaceBranchSelection({
        branches: [
          { name: "main", isCurrent: true },
          { name: "feature/custom-base", isCurrent: false },
        ],
        selectedBranch: "feature/custom-base",
      }),
    ).toBe("feature/custom-base");
  });
});
