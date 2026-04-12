import { describe, expect, it } from "bun:test";
import { buildSessionsSection } from "./ticket-sidebar";

describe("buildSessionsSection", () => {
  it("adds a create action for the selected workspace", () => {
    const events: string[] = [];

    const section = buildSessionsSection([], "A2", (workspaceShorthand) => {
      events.push(workspaceShorthand);
    });

    expect(section.actions).toBeDefined();
    expect(section.actions?.[0]?.id).toBe("create-workspace-session");

    section.actions?.[0]?.onAction?.({ sectionId: "sessions" });
    expect(events).toEqual(["A2"]);
  });
});
