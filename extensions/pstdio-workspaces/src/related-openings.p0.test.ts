import { expect, test } from "bun:test";
import { relatedOpenings } from "./related-openings";

test("Workspaces declares its latest scoped session as an optional Side preview", async () => {
  const queries: unknown[] = [];
  const ctx = {
    project: { id: "project" },
    resource: { type: "workspace", extensionId: "pstdio", projectId: "project", id: "workspace" },
    sessions: {
      query: async (input: unknown) => {
        queries.push(input);
        return { items: [{ id: "latest", title: "Latest session" }], nextCursor: null };
      },
    },
  } as unknown as Parameters<typeof relatedOpenings.run>[0];
  expect(await relatedOpenings.run(ctx, {})).toEqual([
    {
      resource: { type: "session", extensionId: "pstdio", projectId: "project", id: "latest", label: "Latest session" },
      autoOpen: true,
      region: "side",
      open: "preview",
    },
  ]);
  expect(queries).toEqual([{ workspaceId: "workspace", limit: 1, orderBy: "lastActivity" }]);
  expect(await relatedOpenings.run({ ...ctx, resource: undefined }, {})).toEqual([]);
});
