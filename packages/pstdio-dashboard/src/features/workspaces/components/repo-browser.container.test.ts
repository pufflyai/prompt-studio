import { describe, expect, it } from "bun:test";
import type { RepoBranch } from "@/features/project/types";
import {
  resolveBranchSelection,
  resolveBranchSelectorDisabledState,
  resolveBranchState,
  resolveLockedBranch,
} from "./repo-browser.container";

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
      isSessionContext: false,
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
      isSessionContext: true,
      isBranchesPending: false,
      selectedRepositoryId: "repo-1",
      branches,
      currentBranch: "main",
      selectedBranch: "main",
      hasUserSelectedBranch: false,
    });

    expect(nextState).toBeNull();
  });

  it("resolves the current branch in session context without persisting it", () => {
    const branches = [createBranch("main", { isCurrent: true }), createBranch("feature/old")];

    const nextState = resolveBranchState({
      isLocked: false,
      isSessionContext: true,
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
      shouldPersistBranch: false,
    });
  });
});

describe("resolveBranchSelectorDisabledState", () => {
  it("disables branch selection in session context", () => {
    expect(resolveBranchSelectorDisabledState({ isSessionContext: true, isDisabled: false, isLocked: false })).toBe(
      true,
    );
  });

  it("keeps branch selection enabled outside sessions when not otherwise disabled", () => {
    expect(resolveBranchSelectorDisabledState({ isSessionContext: false, isDisabled: false, isLocked: false })).toBe(
      false,
    );
  });
});

describe("resolveLockedBranch", () => {
  it("prefers the session workspace branch when available", () => {
    expect(resolveLockedBranch({ sessionWorkspaceBranch: "workspace/PS-70_A1", workspaceBranch: "main" })).toBe(
      "workspace/PS-70_A1",
    );
  });

  it("falls back to the explicit workspace branch for new workspace sessions", () => {
    expect(resolveLockedBranch({ sessionWorkspaceBranch: null, workspaceBranch: "workspace/PS-70_A1" })).toBe(
      "workspace/PS-70_A1",
    );
  });
});
