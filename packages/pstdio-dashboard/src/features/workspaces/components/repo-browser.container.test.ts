import { describe, expect, it } from "bun:test";
import type { RepoBranch } from "@/features/project/types";
import { resolveBranchSelection, resolveBranchSelectorLockedState, resolveBranchState } from "./repo-browser.container";

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

  it("returns null when the selector is locked in sessions", () => {
    const branches = [createBranch("main", { isCurrent: true })];

    const nextState = resolveBranchState({
      isLocked: true,
      isBranchesPending: false,
      selectedRepositoryId: "repo-1",
      branches,
      currentBranch: "main",
      selectedBranch: "main",
      hasUserSelectedBranch: false,
    });

    expect(nextState).toBeNull();
  });
});

describe("resolveBranchSelectorLockedState", () => {
  it("locks branch selection when a session id is present", () => {
    expect(resolveBranchSelectorLockedState({ sessionId: "session-1", lockedBranch: null })).toBe(true);
  });

  it("keeps branch selection unlocked outside sessions without a locked branch", () => {
    expect(resolveBranchSelectorLockedState({ sessionId: null, lockedBranch: null })).toBe(false);
  });
});
