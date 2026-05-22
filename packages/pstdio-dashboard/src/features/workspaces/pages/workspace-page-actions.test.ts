import { describe, expect, it, mock } from "bun:test";
import { buildWorkspaceDeleteOverflowAction, runWorkspaceDeleteFlow } from "./workspace-page-actions";
import { navigateToCreatedWorkspace, runWorkspaceCreation } from "./workspace-page-helpers";

const t = (key: string) => key;

describe("workspace-page-actions", () => {
  it("disables delete action when no workspace is selected", () => {
    const actions = buildWorkspaceDeleteOverflowAction({
      t,
      hasSelectedWorkspace: false,
      isMutationPending: false,
      onDeleteWorkspace: () => {},
    });

    expect(actions.every((action) => action.isDisabled)).toBe(true);
  });

  it("disables delete action while a mutation is pending", () => {
    const actions = buildWorkspaceDeleteOverflowAction({
      t,
      hasSelectedWorkspace: true,
      isMutationPending: true,
      onDeleteWorkspace: () => {},
    });

    expect(actions.every((action) => action.isDisabled)).toBe(true);
  });

  it("runs delete flow with confirmation side effects", async () => {
    const events: string[] = [];

    await runWorkspaceDeleteFlow({
      selectedWorkspaceId: "ws-1",
      deleteWorkspace: async () => {
        events.push("delete");
      },
      closeDeleteModal: () => {
        events.push("close");
      },
      navigateToTicket: async () => {
        events.push("navigate");
      },
    });

    expect(events).toEqual(["delete", "close", "navigate"]);
  });

  it("does not close modal or navigate when delete fails", async () => {
    const events: string[] = [];

    await expect(
      runWorkspaceDeleteFlow({
        selectedWorkspaceId: "ws-1",
        deleteWorkspace: async () => {
          events.push("delete");
          throw new Error("delete failed");
        },
        closeDeleteModal: () => {
          events.push("close");
        },
        navigateToTicket: async () => {
          events.push("navigate");
        },
      }),
    ).rejects.toThrow("delete failed");

    expect(events).toEqual(["delete"]);
  });

  it("creates a workspace without starting a session", async () => {
    const mutateAsync = mock(async () => ({ workspaceShorthand: "PS-72_A3", sessionId: null }));

    const started = await runWorkspaceCreation({
      ticket: {
        id: "ticket-1",
        shorthand: "PS-72",
      } as never,
      projectId: "project-1",
      project: {
        repositories: [{ id: "repo-1" }],
      } as never,
      createAttempt: {
        isPending: false,
        mutateAsync,
      } as never,
      lastSelectedBranches: ["feature/test"],
      lastSelectedRepo: "repo-2",
      onSuccess: () => {},
    });

    expect(started).toBe(true);
    expect(mutateAsync).toHaveBeenCalledWith({
      ticketId: "ticket-1",
      repoId: "repo-2",
      branch: "feature/test",
      prompt: null,
      startSession: false,
    });
  });

  it("navigates to a created workspace and clears the selected session", () => {
    const navigate = mock(() => {});
    const setSelectedSessionId = mock(() => {});

    navigateToCreatedWorkspace({
      navigate: navigate as never,
      setSelectedSessionId,
      projectId: "project-1",
      ticketShorthand: "PS-72",
      workspaceShorthand: "PS-72_A5",
      tab: "checks",
    });

    expect(setSelectedSessionId).toHaveBeenCalledWith(null);
    expect(navigate).toHaveBeenCalledWith({
      to: "/projects/$projectId/tickets/$ticketShorthand/workspaces/$workspaceShorthand",
      params: { projectId: "project-1", ticketShorthand: "PS-72", workspaceShorthand: "PS-72_A5" },
      search: { tab: "checks" },
    });
  });
});
