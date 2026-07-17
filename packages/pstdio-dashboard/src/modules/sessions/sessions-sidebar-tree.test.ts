import { describe, expect, test } from "bun:test";
import type { ResourceRef } from "@pstdio/workbench/core";
import type { DashboardSession } from "./data/dashboard-sessions";
import { buildSessionsSidebarSections } from "./sessions-sidebar-tree";

const sessionResource = (id: string) =>
  ({
    kind: "session",
    uri: `dashboard-workbench://session/${id}`,
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

const sessionGroupChildren = (sections: ReturnType<typeof buildSessionsSidebarSections>) =>
  sections.find((section) => section.id === "sessions-wrap")?.nodes.find((node) => node.id === "sessions")?.children ??
  [];

describe("buildSessionsSidebarSections", () => {
  test("models the list as a single collapsible Sessions group", () => {
    const sections = buildSessionsSidebarSections({
      sessions: [session({ id: "session-1" })],
    });

    expect(sections).toHaveLength(1);
    expect(sections[0]?.id).toBe("sessions-wrap");
    expect(sections[0]?.label).toBeUndefined();

    const group = sections[0]?.nodes[0];
    expect(group).toMatchObject({ id: "sessions", label: "Sessions", collapsible: true });
  });

  test("keeps the sessions-mode Sessions group out of the hide menu", () => {
    const sections = buildSessionsSidebarSections({
      sessions: [session({ id: "session-1" })],
    });

    expect(sections[0]?.nodes[0]).toMatchObject({ id: "sessions" });
    expect(sections[0]?.nodes[0]?.canHide).toBeUndefined();
  });

  test("shows an empty placeholder when there are no sessions", () => {
    const sections = buildSessionsSidebarSections({
      sessions: [],
    });
    const children = sessionGroupChildren(sections);

    expect(children).toEqual([{ id: "sessions-empty", label: "No sessions yet", disabled: true }]);
  });
});
