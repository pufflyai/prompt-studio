import { describe, expect, test } from "bun:test";
import type { ResourceRef } from "@pstdio/workbench";
import type { DashboardSession } from "../data/dashboard-sessions";
import { buildSessionBubbleGroups } from "./session-bubble-groups";

const session = (input: { id: string; workspaceId?: string | null; updatedAt?: string }): DashboardSession => {
  const updatedAt = input.updatedAt ?? "2026-06-02T10:00:00.000Z";
  return {
    id: input.id,
    title: input.id,
    status: "completed",
    agent: null,
    lastSelectedModel: null,
    updatedAt,
    lastActivityAt: updatedAt,
    workspaceId: input.workspaceId ?? null,
    workspaceBranch: null,
    workspaceShorthand: "",
    ticketId: null,
    resource: { kind: "session", uri: `dashboard-workbench://session/${input.id}`, id: input.id, label: input.id },
  } satisfies DashboardSession & { resource: ResourceRef };
};

const groupIds = (groups: ReturnType<typeof buildSessionBubbleGroups>, groupId: string) =>
  groups.find((group) => group.id === groupId)?.sessions.map((session) => session.id) ?? [];

describe("buildSessionBubbleGroups", () => {
  test("leads with the workspace sessions and keeps others below", () => {
    const groups = buildSessionBubbleGroups({
      sessions: [
        session({ id: "session-1", workspaceId: "workspace-1" }),
        session({ id: "session-2", workspaceId: "workspace-2" }),
        session({ id: "session-3" }),
      ],
      workspaceId: "workspace-1",
      workspaceLabel: "PS-307_A1",
      limit: 6,
    });

    expect(groups.map((group) => group.id)).toEqual(["workspace", "other"]);
    expect(groups[0]).toMatchObject({ label: "PS-307_A1" });
    expect(groupIds(groups, "workspace")).toEqual(["session-1"]);
    expect(groupIds(groups, "other")).toEqual(["session-2", "session-3"]);
  });

  test("orders each group by most recent activity and applies the limit per group", () => {
    const groups = buildSessionBubbleGroups({
      sessions: [
        session({ id: "ws-old", workspaceId: "workspace-1", updatedAt: "2026-06-01T10:00:00.000Z" }),
        session({ id: "ws-new", workspaceId: "workspace-1", updatedAt: "2026-06-03T10:00:00.000Z" }),
        session({ id: "other-a", workspaceId: "workspace-2", updatedAt: "2026-06-02T10:00:00.000Z" }),
        session({ id: "other-b", workspaceId: "workspace-2", updatedAt: "2026-06-04T10:00:00.000Z" }),
      ],
      workspaceId: "workspace-1",
      limit: 1,
    });

    expect(groupIds(groups, "workspace")).toEqual(["ws-new"]);
    expect(groupIds(groups, "other")).toEqual(["other-b"]);
  });

  test("drops empty groups so a workspace with no sessions still shows the others", () => {
    const groups = buildSessionBubbleGroups({
      sessions: [session({ id: "session-1", workspaceId: "workspace-2" })],
      workspaceId: "workspace-1",
      limit: 6,
    });

    expect(groups.map((group) => group.id)).toEqual(["other"]);
  });

  test("uses a single unlabeled group when no workspace is active", () => {
    const groups = buildSessionBubbleGroups({
      sessions: [session({ id: "session-1", workspaceId: "workspace-1" }), session({ id: "session-2" })],
      workspaceId: null,
      limit: 6,
    });

    expect(groups).toHaveLength(1);
    expect(groups[0]?.id).toBe("all");
    expect(groups[0]?.label).toBeUndefined();
    expect(groupIds(groups, "all")).toEqual(["session-1", "session-2"]);
  });
});
