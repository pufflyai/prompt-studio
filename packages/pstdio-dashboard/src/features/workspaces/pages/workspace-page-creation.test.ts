import { describe, expect, it, mock } from "bun:test";
import { createWorkspacePageCreationActions } from "./workspace-page-helpers";

describe("createWorkspacePageCreationActions", () => {
  it("keeps run-attempt and create-workspace entry points separate", async () => {
    const openRunAttemptModal = mock(() => {});
    const openCreateWorkspaceModal = mock(() => {});
    const runAttempt = mock(async () => true);
    const createEmptyWorkspace = mock(async () => true);

    const actions = createWorkspacePageCreationActions({
      openRunAttemptModal,
      openCreateWorkspaceModal,
      runAttempt,
      createEmptyWorkspace,
    });

    actions.openRunAttempt();
    actions.openCreateWorkspace();
    await actions.runAttempt();
    await actions.createEmptyWorkspace();

    expect(openRunAttemptModal).toHaveBeenCalled();
    expect(openCreateWorkspaceModal).toHaveBeenCalled();
    expect(runAttempt).toHaveBeenCalled();
    expect(createEmptyWorkspace).toHaveBeenCalled();
  });
});
