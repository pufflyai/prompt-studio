import { describe, expect, test } from "bun:test";
import type { ResourceRef } from "pstdio-workbench/core";
import { dashboardCommandIds } from "@/shared/app/commands";
import type { DashboardSession } from "./data/dashboard-sessions";
import { buildSessionsSidebarSections } from "./sessions-sidebar-tree";

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

const session = (input: { id: string; workspaceId?: string | null; updatedAt?: string }): DashboardSession => ({
  id: input.id,
  title: input.id,
  status: "completed",
  agent: null,
  lastSelectedModel: null,
  updatedAt: input.updatedAt ?? "2026-06-02T10:00:00.000Z",
  workspaceId: input.workspaceId ?? null,
  workspaceBranch: null,
  workspaceShorthand: "",
  resource: sessionResource(input.id),
});

describe("buildSessionsSidebarSections", () => {
  test("uses command targets for embedded session rows", () => {
    const sections = buildSessionsSidebarSections({
      includeNewSession: true,
      nodeTarget: "floating",
      sessions: [session({ id: "session-1" })],
    });
    const nodes = sections.flatMap((section) => section.nodes);

    expect(nodes.find((node) => node.id === "new-session")?.target).toMatchObject({
      kind: "command",
      commandId: dashboardCommandIds.createSession,
    });
    expect(nodes.find((node) => node.id === "dashboard-workbench://session/session-1")?.target).toMatchObject({
      kind: "command",
      commandId: dashboardCommandIds.openFloatingSession,
      args: { resource: sessionResource("session-1") },
    });
  });

  test("filters embedded session rows to the current workspace", () => {
    const sections = buildSessionsSidebarSections({
      nodeTarget: "floating",
      sessions: [session({ id: "session-1", workspaceId: "workspace-1" }), session({ id: "session-2" })],
      workspace: workspaceResource("workspace-1"),
    });
    const nodeIds = sections.flatMap((section) => section.nodes).map((node) => node.id);

    expect(nodeIds).toEqual(["dashboard-workbench://session/session-1"]);
  });
});
