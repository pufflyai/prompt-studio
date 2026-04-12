import { describe, expect, it, mock } from "bun:test";
import type { ActionDescriptor } from "@/features/plugin-actions/api";
import { buildHeaderActionGroups } from "@/features/plugin-actions/components/header-action-groups";
import { buildWorkspaceDeleteOverflowAction, runWorkspaceDeleteFlow } from "./workspace-page-actions";

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
});
