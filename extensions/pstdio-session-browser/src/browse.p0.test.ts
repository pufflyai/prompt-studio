import { expect, test } from "bun:test";
import { createMemoryStorage, makeCommandContext } from "@pstdio/sdk/testing";
import { browse, browseChildren, search } from "./browse";

test("browsing and search use bounded public queries, workspace scope and lazy continuation", async () => {
  const queries: unknown[] = [];
  const ctx = makeCommandContext({
    storage: createMemoryStorage(),
    params: {},
    overrides: {
      sessions: {
        query: async (input) => {
          queries.push(input);
          return { items: [], nextCursor: input?.cursor ? null : "next" };
        },
      },
    },
  });
  const renderer = { rendererId: "list", resource: { type: "workspace", id: "workspace" } };
  const sections = await browse(ctx, { renderer, filter: "needle" });
  expect(queries).toEqual([{ limit: 50, orderBy: "lastActivity", workspaceId: "workspace", search: "needle" }]);
  const more = sections[0].nodes[0]?.children?.find((node) => node.metadata?.cursor);
  expect(more).toBeDefined();
  await browseChildren(ctx, { renderer, filter: "needle", node: more! });
  expect(queries.at(-1)).toEqual({
    limit: 50,
    orderBy: "lastActivity",
    workspaceId: "workspace",
    search: "needle",
    cursor: "next",
  });
  await search.query(ctx, { query: "exact", limit: 5, providerId: "sessions", renderer });
  expect(queries.at(-1)).toEqual({ limit: 5, orderBy: "lastActivity", search: "exact" });
  expect(queries).toHaveLength(3);
});

test("workspace sessions keep the contextual page and open chat in shared Side preview", async () => {
  const ctx = makeCommandContext({
    storage: createMemoryStorage(),
    params: {},
    overrides: {
      sessions: {
        query: async () => ({
          items: [
            { id: "s", title: "Saved", status: "completed", updatedAt: new Date().toISOString(), workspaceId: "w" },
          ] as never,
          nextCursor: null,
        }),
      },
    },
  });
  const sections = await browse(ctx, { renderer: { rendererId: "list", resource: { type: "workspace", id: "w" } } });
  const group = sections[0]!.nodes.find((node) => node.id === "workspace-sessions");
  expect(group).toMatchObject({ collapsible: true, canHide: true });
  expect(group?.children?.find((node) => node.resource?.id === "s")).toMatchObject({
    target: { kind: "panel", open: "preview", resource: { extensionId: "pstdio", id: "s" } },
  });
});
