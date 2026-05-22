import { describe, expect, test } from "bun:test";
import extension from "./extension";

describe("pstdio-core-workspace-automations", () => {
  test("mounts workspace-scoped actions in workspace header slots", () => {
    expect(extension.commands?.runReview?.menus).toEqual([{ slot: expect.any(Object), label: "Run review" }]);
    expect(extension.commands?.runReview?.menus?.[0]?.slot.id).toBe("workspace.headerPrimary");
  });

  test("runReview uses the workspace resource when launched from the dashboard", async () => {
    const sessions: unknown[] = [];

    await extension.commands?.runReview?.run({
      params: {},
      resource: {
        type: "workspace",
        id: "workspace-1",
        label: "PS-304_A1",
        metadata: { ticket: "PS-304" },
      },
      sessions: {
        create: async (input: unknown) => {
          sessions.push(input);
          return { id: "session-1" };
        },
      },
    } as never);

    expect(sessions).toEqual([
      {
        workspaceId: "workspace-1",
        title: "Code review: PS-304",
        harness: undefined,
        template: "review-code",
        vars: { ticket: "PS-304" },
      },
    ]);
  });
});
