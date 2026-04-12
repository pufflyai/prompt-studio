import { describe, expect, it, mock } from "bun:test";
import type { ActionDescriptor } from "@/features/plugin-actions/api";
import { buildHeaderActionGroups } from "@/features/plugin-actions/components/header-action-groups";
import {
  buildWorkspaceDefaultOverflowActions,
  runWorkspaceArchiveFlow,
  runWorkspaceDeleteFlow,
} from "./workspace-page-actions";

const t = (key: string) => key;

describe("workspace-page-actions", () => {
  it("keeps plugin actions and adds built-in workspace overflow actions", () => {
    const onArchiveWorkspace = mock(() => {});
    const onDeleteWorkspace = mock(() => {});

    const defaultOverflowActions = buildWorkspaceDefaultOverflowActions({
      t,
      hasSelectedWorkspace: true,
      isMutationPending: false,
      onArchiveWorkspace,
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
      expect.arrayContaining(["open-worktree", "archive-workspace", "delete-workspace"]),
    );
  });

  it("disables built-in actions when no workspace is selected", () => {
    const actions = buildWorkspaceDefaultOverflowActions({
      t,
      hasSelectedWorkspace: false,
      isMutationPending: false,
      onArchiveWorkspace: () => {},
      onDeleteWorkspace: () => {},
    });

    expect(actions.every((action) => action.isDisabled)).toBe(true);
  });

  it("disables built-in actions while a mutation is pending", () => {
    const actions = buildWorkspaceDefaultOverflowActions({
      t,
      hasSelectedWorkspace: true,
      isMutationPending: true,
      onArchiveWorkspace: () => {},
      onDeleteWorkspace: () => {},
    });

    expect(actions.every((action) => action.isDisabled)).toBe(true);
  });

  it("does not navigate when archive fails", async () => {
    const navigateToTicket = mock(async () => {});

    await runWorkspaceArchiveFlow({
      selectedWorkspaceId: "ws-1",
      archiveWorkspace: async () => {
        throw new Error("archive failed");
      },
      navigateToTicket,
    });

    expect(navigateToTicket).not.toHaveBeenCalled();
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
