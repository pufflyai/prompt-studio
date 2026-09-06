import { describe, expect, test } from "bun:test";
import { workbenchPages } from "@pstdio/sdk/extensions";
import { createWorkbench } from "@pstdio/workbench";
import { selectDashboardProject } from "@/shared/app/project-context";
import { createWorkspacesModule } from "../../workspaces/module";
import type { DashboardSessionView } from "../data/dashboard-sessions";
import { openReviewWorkspace, openSelectedWorkspace } from "./session-chat-panel";

const localWorkspace = {
  id: "workspace-1",
  title: "Dashboard workbench datalayer",
  shorthand: "PS-307_A1",
  branch: "workspace/PS-307_A1",
  type: "worktree" as const,
  isDefault: false,
  executionKind: "local" as const,
  providerState: "ready",
  supportsFiles: true,
  supportsDiff: true,
  supportsArchive: true,
  supportsDelete: true,
  workspacePath: "/repo/.pstdio/workspaces/PS-307_A1",
  updatedAt: "2026-05-22T08:55:00Z",
};

const sessionView = {
  id: "session-1",
  draftKey: "session-1",
  sessionId: "session-1",
  workspaceTitle: "Dashboard workbench datalayer",
  workspaceId: "workspace-1",
  workspaceBranch: "workspace/PS-307_A1",
  workspaceShorthand: "PS-307_A1",
  agent: null,
  lastSelectedModel: null,
  additions: 12,
  deletions: 3,
  messages: [],
} satisfies DashboardSessionView;

describe("openReviewWorkspace", () => {
  test("opens the linked workspace resource for review changes", async () => {
    const workbench = createWorkbench();

    workbench.registerModule(createWorkspacesModule());
    selectDashboardProject(workbench, { id: "project-1", name: "Prompt Studio" });

    await openReviewWorkspace({ workbench }, sessionView, [localWorkspace]);

    expect(workbench.commandPalette.isOpen()).toBe(false);
    expect(workbench.modes.getActiveModeId()).toBe("project");
    expect(workbench.pages.store.getState().location).toMatchObject({
      page: workbenchPages.workspace,
      resource: {
        type: "workspace",
        id: "workspace-1",
        label: "Dashboard workbench datalayer",
      },
    });
    expect(workbench.getPrimaryResource()).toMatchObject({
      type: "workspace",
      id: "workspace-1",
      label: "Dashboard workbench datalayer",
      metadata: {
        workspaceId: "workspace-1",
        workspaceBranch: "workspace/PS-307_A1",
        workspaceShorthand: "PS-307_A1",
      },
    });
  });
});

describe("openSelectedWorkspace", () => {
  test("opens the selected workspace dropdown option", async () => {
    const workbench = createWorkbench();

    workbench.registerModule(createWorkspacesModule());
    selectDashboardProject(workbench, { id: "project-1", name: "Prompt Studio" });

    await openSelectedWorkspace(
      { workbench },
      {
        id: "workspace-2",
        title: "Second attempt",
        shorthand: "PS-307_A2",
        branch: "workspace/PS-307_A2",
        type: "worktree",
        isDefault: false,
        executionKind: "local",
        providerState: "ready",
        supportsFiles: true,
        supportsDiff: true,
        supportsArchive: true,
        supportsDelete: true,
        workspacePath: "/repo/.pstdio/workspaces/PS-307_A2",
        updatedAt: "2026-05-22T08:55:00Z",
      },
      "project-1",
    );

    expect(workbench.modes.getActiveModeId()).toBe("project");
    expect(workbench.pages.store.getState().location).toMatchObject({
      page: workbenchPages.workspace,
      resource: {
        type: "workspace",
        id: "workspace-2",
        label: "Second attempt",
      },
    });
    expect(workbench.getPrimaryResource()).toMatchObject({
      type: "workspace",
      id: "workspace-2",
      label: "Second attempt",
      metadata: {
        workspaceId: "workspace-2",
        workspaceBranch: "workspace/PS-307_A2",
        workspaceShorthand: "PS-307_A2",
        workspaceIsDefault: false,
        workspaceSupportsArchive: true,
        workspaceSupportsDelete: true,
        workspacePath: "/repo/.pstdio/workspaces/PS-307_A2",
      },
    });
  });
});
