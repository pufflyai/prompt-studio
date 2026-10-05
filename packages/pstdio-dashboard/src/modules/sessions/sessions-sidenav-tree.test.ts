import { describe, expect, test } from "bun:test";
import { resourceKey, workbenchPages } from "@pstdio/sdk/extensions";
import type { ResourceRef } from "@pstdio/workbench";
import { dashboardCommandIds } from "@/shared/app/commands";
import type { DashboardSession } from "./data/dashboard-sessions";
import { buildSessionsLevelSections, buildWorkspaceSessionsSections } from "./sessions-sidenav-tree";

const sessionResource = (id: string) =>
  ({
    type: "session",
    id,
    label: id,
  }) satisfies ResourceRef;
const workspaceResource = (id: string) =>
  ({
    type: "workspace",
    id,
    label: id,
  }) satisfies ResourceRef;
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
    anchors: [],
    resource: sessionResource(input.id),
  };
};
const sessionGroupChildren = (sections: ReturnType<typeof buildWorkspaceSessionsSections>) =>
  sections.find((section) => section.id === "sessions-wrap")?.nodes.find((node) => node.id === "workspace-sessions")
    ?.children ?? [];
describe("buildSessionsLevelSections", () => {
  test("keeps the session action resource in both navigation locations", () => {
    const entry = session({ id: "inactive-session", workspaceId: "workspace-1" });
    entry.resource.metadata = { projectId: "project-1", status: "completed" };
    const rows = [
      ...buildSessionsLevelSections([entry])[0]!.nodes,
      ...sessionGroupChildren(buildWorkspaceSessionsSections([entry], workspaceResource("workspace-1"))),
    ];
    for (const row of rows.filter((node) => node.target)) {
      expect(row.resource).toBe(entry.resource);
      expect(row.target).toMatchObject({ resource: entry.resource });
    }
    for (const row of rows.filter((node) => node.disabled)) expect(row.resource).toBeUndefined();
  });
  test("lists sessions by day in one fixed Sessions section", () => {
    const sections = buildSessionsLevelSections([
      session({ id: "session-1", updatedAt: "2026-06-02T10:00:00.000Z" }),
      session({ id: "session-2", updatedAt: "2026-06-01T10:00:00.000Z" }),
    ]);
    expect(sections).toHaveLength(1);
    expect(sections[0]).toMatchObject({ id: "session-list", label: "Sessions", collapsible: false });
    expect(sections[0]?.nodes.map((node) => node.id)).toEqual([
      "sessions-date-2026-6-2",
      resourceKey(sessionResource("session-1")),
      "sessions-date-2026-6-1",
      resourceKey(sessionResource("session-2")),
    ]);
    expect(sections[0]?.nodes[1]?.target).toEqual({
      kind: "page",
      page: workbenchPages.session,
      resource: sessionResource("session-1"),
    });
  });
  test("creates an unscoped session from the Sessions section", () => {
    expect(buildSessionsLevelSections([])[0]?.actions).toEqual([
      { id: "sessions.create", label: "New session", icon: "Plus", commandId: dashboardCommandIds.createSession },
    ]);
  });
});
describe("buildWorkspaceSessionsSections", () => {
  test("models the workspace list as a single hideable, collapsible Sessions group", () => {
    const sections = buildWorkspaceSessionsSections([session({ id: "session-1" })]);
    expect(sections).toHaveLength(1);
    expect(sections[0]?.id).toBe("sessions-wrap");
    expect(sections[0]?.label).toBeUndefined();
    expect(sections[0]?.nodes[0]).toMatchObject({
      id: "workspace-sessions",
      label: "Sessions",
      collapsible: true,
      canHide: true,
    });
  });
  test("adds a workspace create action to the Sessions group", () => {
    const workspace = workspaceResource("workspace-1");
    const sections = buildWorkspaceSessionsSections(
      [session({ id: "session-1", workspaceId: "workspace-1" })],
      workspace,
    );
    expect(sections[0]?.nodes[0]?.actions).toEqual([
      {
        id: "sessions.create",
        label: "New session",
        icon: "Plus",
        commandId: dashboardCommandIds.createSession,
        args: { workspace },
      },
    ]);
  });
  test("uses the explicit project Session Panel for embedded session rows", () => {
    const children = sessionGroupChildren(buildWorkspaceSessionsSections([session({ id: "session-1" })]));
    expect(
      children.find((node) => node.id === resourceKey({ type: "session", id: "session-1" }))?.target,
    ).toMatchObject({
      kind: "panel",
      panel: { extensionId: "pstdio", kind: "placement", id: "project-session" },
      resource: { type: "session", id: "session-1" },
      open: "preview",
    });
  });
  test("filters embedded session rows to the current workspace", () => {
    const sections = buildWorkspaceSessionsSections(
      [session({ id: "session-1", workspaceId: "workspace-1" }), session({ id: "session-2" })],
      workspaceResource("workspace-1"),
    );
    const sessionNodeIds = sessionGroupChildren(sections)
      .filter((node) => node.resource || node.target)
      .map((node) => node.id);
    expect(sessionNodeIds).toEqual([resourceKey({ type: "session", id: "session-1" })]);
  });
  test("shows an empty placeholder when a workspace has no sessions", () => {
    const sections = buildWorkspaceSessionsSections([session({ id: "session-1" })], workspaceResource("workspace-1"));
    expect(sessionGroupChildren(sections)).toEqual([
      { id: "sessions-empty", label: "No sessions yet", disabled: true },
    ]);
  });
});
