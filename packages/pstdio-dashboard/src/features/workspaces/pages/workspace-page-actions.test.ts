import { describe, expect, it, mock } from "bun:test";
import type { ActionDescriptor } from "@/features/plugin-actions/api";
import { buildHeaderActionGroups } from "@/features/plugin-actions/components/header-action-groups";
import { buildWorkspaceDeleteOverflowAction, runWorkspaceDeleteFlow } from "./workspace-page-actions";
import { navigateToCreatedWorkspace, runWorkspaceAttempt, runWorkspaceCreation } from "./workspace-page-helpers";

const t = (key: string) => key;

describe("workspace-page-actions", () => {
  it("keeps plugin actions and adds built-in delete action", () => {
    const onDeleteWorkspace = mock(() => {});

    const defaultOverflowActions = buildWorkspaceDeleteOverflowAction({
      t,
      hasSelectedWorkspace: true,
      isMutationPending: false,
      onDeleteWorkspace,
    });

    const pluginActions: ActionDescriptor[] = [
      { key: "run-review", label: "Run review", placement: "secondary", targetType: "workspace" },
      { key: "open-worktree", label: "Open in IDE", placement: "overflow", targetType: "workspace" },
    ];

    const groups = buildHeaderActionGroups({
      pluginActions,
      defaultOverflowActions,
      onPluginAction: () => {},
    });

    expect(groups.secondary.map((action) => action.key)).toContain("run-review");
    expect(groups.overflow.map((action) => action.key)).toEqual(
      expect.arrayContaining(["open-worktree", "delete-workspace"]),
    );
  });

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
      lastSelectedAgent: "opencode",
      lastSelectedModels: ["gpt-5.4"],
      lastSelectedBranches: ["feature/test"],
      lastSelectedRepo: "repo-2",
      startSession: false,
      onSuccess: () => {},
    });

    expect(started).toBe(true);
    expect(mutateAsync).toHaveBeenCalledWith({
      ticketId: "ticket-1",
      agent: "opencode",
      repoId: "repo-2",
      branch: "feature/test",
      model: "gpt-5.4",
      prompt: null,
      startSession: false,
    });
  });

  it("keeps run attempt behavior by starting a session with the implement prompt", async () => {
    const onSuccess = mock(() => {});
    const mutateAsync = mock(async () => ({ workspaceShorthand: "PS-72_A4", sessionId: "session-1" }));

    const started = await runWorkspaceAttempt({
      ticket: {
        id: "ticket-1",
        shorthand: "PS-72",
      },
      projectId: "project-1",
      project: {
        repositories: [{ id: "repo-1" }],
      } as never,
      createAttempt: {
        isPending: false,
        mutateAsync,
      } as never,
      lastSelectedAgent: "opencode",
      lastSelectedModels: ["gpt-5.4"],
      lastSelectedBranches: ["feature/test"],
      lastSelectedRepo: "repo-2",
      onSuccess,
    });

    expect(started).toBe(true);
    expect(mutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        ticketId: "ticket-1",
        startSession: true,
        prompt: expect.stringContaining("PS-72"),
      }),
    );
    expect(onSuccess).toHaveBeenCalledWith({ workspaceShorthand: "PS-72_A4", sessionId: "session-1" });
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
