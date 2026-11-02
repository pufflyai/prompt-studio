import { expect, test } from "bun:test";
import type { ExtensionContextBase } from "@pstdio/sdk/extensions";
import { readHome } from "./data";

test("Home reads the selected project's five most recently updated conversations and setup state", async () => {
  const queries: unknown[] = [];
  const ctx = {
    projectId: "project-1",
    project: { id: "project-1", name: "First project", shorthand: "P" },
    sessions: {
      query: async (query: unknown) => {
        queries.push(query);
        return {
          items: [{ id: "session-1", title: "Resume work", updatedAt: "2026-11-02T12:00:00Z" }],
          nextCursor: null,
        };
      },
    },
    workspaces: { getDefault: async () => ({ setupError: "Setup failed" }) },
  } as unknown as ExtensionContextBase;
  const home = await readHome(ctx);
  expect(queries).toEqual([{ orderBy: "updated", limit: 5 }]);
  expect(home.project).toEqual(ctx.project);
  expect(home.setupError).toBe("Setup failed");
  expect(home.recent[0]).toMatchObject({
    title: "Resume work",
    resource: { id: "session-1", type: "session", extensionId: "pstdio", projectId: "project-1" },
  });
});
