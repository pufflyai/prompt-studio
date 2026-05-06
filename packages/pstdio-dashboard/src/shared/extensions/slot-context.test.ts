import { describe, expect, test } from "bun:test";
import { buildExtensionCommandRequest, buildExtensionSlotContext } from "./slot-context";

describe("extension slot context", () => {
  test("builds project slot context without shifting resource-less hosts", () => {
    expect(
      buildExtensionSlotContext({ projectId: "project-1", slotId: "project.headerPrimary", kind: "menu" }),
    ).toEqual({
      id: "project.headerPrimary",
      kind: "menu",
      context: { projectId: "project-1" },
    });
  });

  test("includes repo and resource context when invoking a contribution", () => {
    expect(
      buildExtensionCommandRequest({
        projectId: "project-1",
        slotId: "session.headerOverflow",
        kind: "menu",
        params: { mode: "fast" },
        repo: { projectId: "project-1", repoId: "repo-1", path: "/repo", role: "selected" },
        resource: { type: "session", id: "session-1", label: "Session 1" },
      }),
    ).toEqual({
      projectId: "project-1",
      params: { mode: "fast" },
      repo: { projectId: "project-1", repoId: "repo-1", path: "/repo", role: "selected" },
      resource: { type: "session", id: "session-1", label: "Session 1" },
      slot: {
        id: "session.headerOverflow",
        kind: "menu",
        context: { projectId: "project-1", resourceType: "session", resourceId: "session-1" },
      },
      source: "dashboard",
    });
  });
});
