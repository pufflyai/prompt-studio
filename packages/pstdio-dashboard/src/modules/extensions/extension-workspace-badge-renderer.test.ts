import { describe, expect, test } from "bun:test";
import {
  createWorkspaceBadgeInteractionProps,
  createWorkspaceBadgeResource,
  createWorkspaceBadgeSessionResource,
  normalizeWorkspaceBadgeItems,
} from "./extension-workspace-badge-renderer";

describe("extension workspace badge renderer", () => {
  test("suppresses parent row activation when a workspace badge is activated", () => {
    const calls: string[] = [];
    const props = createWorkspaceBadgeInteractionProps(() => calls.push("open-workspace"));
    const event = {
      stopPropagation: () => calls.push("stop-propagation"),
    };

    props.onPointerDown(event);
    props.onClick(event);
    props.onKeyDown(event);

    expect(calls).toEqual(["stop-propagation", "stop-propagation", "open-workspace", "stop-propagation"]);
  });

  test("normalizes serializable workspace payloads", () => {
    expect(
      normalizeWorkspaceBadgeItems([
        {
          id: "workspace-2",
          name: "Latest attempt",
          shorthand: "T-1_A2",
          type: "current_branch",
          createdAt: "2026-01-03T00:00:00.000Z",
          resourceParent: {
            type: "ticket",
            id: "ticket-1",
            label: "T-1 Ticket",
            metadata: { shorthand: "T-1" },
          },
        },
        { id: "workspace-1", shorthand: "T-1_A1", type: "worktree" },
        { id: "", name: "missing" },
        "not-a-workspace",
      ]),
    ).toEqual([
      {
        id: "workspace-2",
        name: "Latest attempt",
        shorthand: "T-1_A2",
        type: "current_branch",
        createdAt: "2026-01-03T00:00:00.000Z",
        resourceParent: {
          type: "ticket",
          id: "ticket-1",
          label: "T-1 Ticket",
          metadata: { shorthand: "T-1" },
        },
      },
      { id: "workspace-1", name: "T-1_A1", shorthand: "T-1_A1", type: "worktree" },
    ]);
  });

  test("keeps a supported session status on the workspace it belongs to", () => {
    expect(
      normalizeWorkspaceBadgeItems([
        { id: "workspace-2", shorthand: "T-1_A2", type: "worktree", session: { id: "session-2", status: "queued" } },
        { id: "workspace-1", shorthand: "T-1_A1", type: "worktree" },
      ]),
    ).toMatchObject([{ id: "workspace-2", session: { id: "session-2", status: "queued" } }, { id: "workspace-1" }]);
  });

  test("drops session payloads that are not a supported session status", () => {
    const [item] = normalizeWorkspaceBadgeItems([
      { id: "workspace-1", type: "worktree", session: { id: "session-1", status: "archived" } },
    ]);

    expect(item).not.toHaveProperty("session");
  });

  test("drops session payloads without an id", () => {
    const [item] = normalizeWorkspaceBadgeItems([
      { id: "workspace-1", type: "worktree", session: { status: "completed" } },
    ]);

    expect(item).not.toHaveProperty("session");
  });

  test("resolves the badge session to a side-panel session resource", () => {
    const resource = createWorkspaceBadgeSessionResource(
      {
        id: "workspace-2",
        name: "Latest attempt",
        shorthand: "T-1_A2",
        type: "worktree",
        session: { id: "session-2", status: "in_progress" },
      },
      "project-1",
    );

    expect(resource).toMatchObject({
      kind: "session",
      id: "session-2",
      label: "T-1_A2",
      metadata: { sessionSurface: "side" },
    });
  });

  test("creates native workspace resources from badge items", () => {
    const resource = createWorkspaceBadgeResource(
      {
        id: "workspace-2",
        name: "Latest attempt",
        shorthand: "T-1_A2",
        type: "current_branch",
        resourceParent: {
          type: "ticket",
          id: "ticket-child",
          label: "T-2 Child",
          metadata: {
            shorthand: "T-2",
            resourceParent: {
              type: "ticket",
              id: "ticket-parent",
              label: "T-1 Parent",
              metadata: { shorthand: "T-1" },
            },
          },
        },
      },
      "project-1",
    );

    expect(resource).toMatchObject({
      kind: "workspace",
      id: "workspace-2",
      label: "Latest attempt",
      icon: "GitBranch",
      metadata: {
        workspaceId: "workspace-2",
        workspaceShorthand: "T-1_A2",
        workspaceType: "current_branch",
        resourceParent: {
          type: "ticket",
          id: "ticket-child",
          label: "T-2 Child",
          metadata: {
            shorthand: "T-2",
            resourceParent: {
              type: "ticket",
              id: "ticket-parent",
              label: "T-1 Parent",
              metadata: { shorthand: "T-1" },
            },
          },
        },
      },
    });
  });
});
