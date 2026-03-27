import { describe, expect, it } from "bun:test";
import type { RepoBranch } from "@/features/project/types";
import { resolveBranchSelection, resolveBranchState } from "./repo-browser.container";

const createBranch = (name: string, options?: { isCurrent?: boolean; isRemote?: boolean }): RepoBranch => ({
  name,
  isCurrent: options?.isCurrent ?? false,
  isRemote: options?.isRemote ?? false,
  lastCommitDate: "2026-03-17T00:00:00.000Z",
});

describe("resolveBranchSelection", () => {
  it("defaults to the current branch when persisted branch is not explicitly selected", () => {
    const branches = [createBranch("main", { isCurrent: true }), createBranch("feature/old")];

    const selectedBranch = resolveBranchSelection({
      branches,
      currentBranch: "main",
      selectedBranch: "feature/old",
      hasUserSelectedBranch: false,
    });

    expect(selectedBranch).toBe("main");
  });

  it("keeps an explicitly selected branch for the run", () => {
    const branches = [createBranch("main", { isCurrent: true }), createBranch("feature/new")];

    const selectedBranch = resolveBranchSelection({
      branches,
      currentBranch: "main",
      selectedBranch: "feature/new",
      hasUserSelectedBranch: true,
    });

    expect(selectedBranch).toBe("feature/new");
  });

  it("keeps the existing behavior of using first branch when no current branch exists", () => {
    const branches = [createBranch("release/1"), createBranch("release/2")];

    const selectedBranch = resolveBranchSelection({
      branches,
      currentBranch: undefined,
      selectedBranch: "",
      hasUserSelectedBranch: false,
    });

    expect(selectedBranch).toBe("release/1");
  });
});

describe("resolveBranchState", () => {
  it("marks auto-resolved branch updates for persistence", () => {
    const branches = [createBranch("main", { isCurrent: true }), createBranch("feature/old")];

    const nextState = resolveBranchState({
      isLocked: false,
      isBranchesPending: false,
      selectedRepositoryId: "repo-1",
      branches,
      currentBranch: "main",
      selectedBranch: "feature/old",
      hasUserSelectedBranch: false,
    });

    expect(nextState).toEqual({
      selectedBranch: "main",
      hasUserSelectedBranch: false,
      shouldPersistBranch: true,
    });
  });
});
