import { describe, expect, test } from "bun:test";
import type { ResourceRef } from "@pstdio/workbench";
import { dashboardCommandIds } from "@/shared/app/commands";
import type { DashboardSession } from "./data/dashboard-sessions";
import { buildSessionsSidenavSections } from "./sessions-sidenav-tree";

const sessionResource = (id: string) =>
  ({
    kind: "session",
    uri: `dashboard-workbench://session/${id}`,
    id,
    label: id,
  }) satisfies ResourceRef;

const workspaceResource = (id: string) =>
  ({
    kind: "workspace",
    uri: `dashboard-workbench://workspace/${id}`,
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
    resource: sessionResource(input.id),
  };
};

const sessionGroupChildren = (sections: ReturnType<typeof buildSessionsSidenavSections>) =>
  sections.find((section) => section.id === "sessions-wrap")?.nodes.find((node) => node.id === "sessions")?.children ??
  [];

describe("buildSessionsSidenavSections", () => {
  test("models the list as a single collapsible Sessions group", () => {
    const sections = buildSessionsSidenavSections({
      nodeTarget: "side",
      sessions: [session({ id: "session-1" })],
    });

    expect(sections).toHaveLength(1);
    expect(sections[0]?.id).toBe("sessions-wrap");
    expect(sections[0]?.label).toBeUndefined();

    const group = sections[0]?.nodes[0];
    expect(group).toMatchObject({ id: "sessions", label: "Sessions", collapsible: true });
  });

  test("adds a create action to the Sessions group", () => {
    const workspace = workspaceResource("workspace-1");
    const sections = buildSessionsSidenavSections({
      nodeTarget: "side",
      sessions: [session({ id: "session-1", workspaceId: "workspace-1" })],
      workspace,
    });

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

  test("creates an unscoped session from the sessions-mode group", () => {
    const sections = buildSessionsSidenavSections({
      nodeTarget: "resource",
      sessions: [session({ id: "session-1" })],
    });

    expect(sections[0]?.nodes[0]?.actions).toEqual([
      {
        id: "sessions.create",
        label: "New session",
        icon: "Plus",
        commandId: dashboardCommandIds.createSession,
      },
    ]);
  });

  test("keeps the sessions-mode Sessions group out of the hide menu", () => {
    const sections = buildSessionsSidenavSections({
      nodeTarget: "resource",
      sessions: [session({ id: "session-1" })],
    });

    expect(sections[0]?.nodes[0]).toMatchObject({ id: "sessions" });
    expect(sections[0]?.nodes[0]?.canHide).toBeUndefined();
  });

  test("keeps the workspace embedded Sessions group hideable", () => {
    const sections = buildSessionsSidenavSections({
      nodeTarget: "side",
      sessions: [session({ id: "session-1" })],
    });

    expect(sections[0]?.nodes[0]).toMatchObject({ id: "sessions", canHide: true });
  });

  test("uses command targets for embedded session rows", () => {
    const sections = buildSessionsSidenavSections({
      nodeTarget: "side",
      sessions: [session({ id: "session-1" })],
    });
    const children = sessionGroupChildren(sections);

    expect(children.find((node) => node.id === "dashboard-workbench://session/session-1")?.target).toMatchObject({
      kind: "command",
      commandId: dashboardCommandIds.openSessionPanel,
      args: { resource: sessionResource("session-1") },
    });
  });

  test("filters embedded session rows to the current workspace", () => {
    const sections = buildSessionsSidenavSections({
      nodeTarget: "side",
      sessions: [session({ id: "session-1", workspaceId: "workspace-1" }), session({ id: "session-2" })],
      workspace: workspaceResource("workspace-1"),
    });
    const sessionNodeIds = sessionGroupChildren(sections)
      .filter((node) => node.resource || node.target)
      .map((node) => node.id);

    expect(sessionNodeIds).toEqual(["dashboard-workbench://session/session-1"]);
  });

  test("shows an empty placeholder when a workspace has no sessions", () => {
    const sections = buildSessionsSidenavSections({
      nodeTarget: "side",
      sessions: [session({ id: "session-1" })],
      workspace: workspaceResource("workspace-1"),
    });
    const children = sessionGroupChildren(sections);

    expect(children).toEqual([{ id: "sessions-empty", label: "No sessions yet", disabled: true }]);
  });
});
