import { expect, test } from "bun:test";
import { createMemoryStorage, makeCommandContext } from "@pstdio/sdk/testing";
import { browse, browsePage, search } from "./browse";

test("recent sessions retain Today and Yesterday groups alongside older calendar dates", async () => {
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const earlier = new Date(today);
  earlier.setDate(earlier.getDate() - 5);
  const ctx = makeCommandContext({
    storage: createMemoryStorage(),
    params: {},
    overrides: {
      sessions: {
        query: async () => ({
          items: [today, yesterday, earlier].map((date, index) => ({
            id: `s${index}`,
            title: `Saved ${index}`,
            status: "completed",
            updatedAt: date.toISOString(),
          })) as never,
          nextCursor: null,
        }),
      },
    },
  });
  const sections = await browse(ctx, { renderer: { rendererId: "list" } });
  const groups = sections[0]!.nodes.filter((node) => node.disabled);
  expect(groups[0]?.label).toMatchObject({ default: "Today" });
  expect(groups[1]?.label).toMatchObject({ default: "Yesterday" });
  expect(groups[2]?.label).toBe(
    earlier.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: earlier.getFullYear() === today.getFullYear() ? undefined : "numeric",
    }),
  );
  expect(new Set(groups.map((node) => node.id)).size).toBe(3);
});

test("browsing and search use bounded public queries, workspace scope and cursor pages", async () => {
  const queries: unknown[] = [];
  const ctx = makeCommandContext({
    storage: createMemoryStorage(),
    params: {},
    overrides: {
      sessions: {
        query: async (input) => {
          queries.push(input);
          return { items: [], nextCursor: input?.workspaceId && !input?.cursor ? "next" : null };
        },
      },
    },
  });
  const renderer = { rendererId: "list", resource: { type: "workspace", id: "workspace" } };
  const sections = await browse(ctx, { renderer, filter: "needle" });
  expect(queries).toEqual([{ limit: 50, orderBy: "lastActivity", workspaceId: "workspace", search: "needle" }]);
  const group = sections[0]!.nodes[0]!;
  expect(group.nextCursor).toBe("next");
  const page = await browsePage(ctx, {
    renderer,
    filter: "needle",
    cursor: group.nextCursor!,
    parent: { kind: "node", node: group },
  });
  expect(page).toEqual({ nodes: [], nextCursor: undefined });
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

test("project history pages preserve ordering and date identities through exhaustion", async () => {
  const sessions = Array.from({ length: 121 }, (_, index) => ({
    id: `s${index}`,
    title: `Session ${index}`,
    status: "completed",
    updatedAt: "2026-11-09T10:00:00Z",
  }));
  const ctx = makeCommandContext({
    storage: createMemoryStorage(),
    params: {},
    overrides: {
      sessions: {
        query: async (input = {}) => {
          expect(input.limit).toBe(50);
          const start = Number(input.cursor ?? 0);
          return {
            items: sessions.slice(start, start + 50) as never,
            nextCursor: start + 50 < sessions.length ? `${start + 50}` : null,
          };
        },
      },
    },
  });
  const renderer = { rendererId: "list" };
  const first = (await browse(ctx, { renderer }))[0]!;
  expect(first.nextCursor).toBe("50");
  const second = await browsePage(ctx, {
    renderer,
    cursor: first.nextCursor!,
    parent: { kind: "section", id: first.id },
  });
  const third = await browsePage(ctx, {
    renderer,
    cursor: second.nextCursor!,
    parent: { kind: "section", id: first.id },
  });
  expect(third.nextCursor).toBeUndefined();
  expect(
    [first, second, third].flatMap((page) => page.nodes.filter((node) => node.resource).map((node) => node.id)),
  ).toEqual(sessions.map((session) => session.id));
  expect(first.nodes[0]!.id).toBe(second.nodes[0]!.id);
  expect(second.nodes[0]!.id).toBe(third.nodes[0]!.id);
});

test("session resource search follows cursors beyond the public 200-row page limit", async () => {
  const queries: Array<{ limit?: number; cursor?: string; search?: string; orderBy?: string }> = [];
  const sessions = Array.from({ length: 301 }, (_, index) => ({
    id: `s${index}`,
    title: `History ${index}`,
    status: "completed",
    updatedAt: "2026-11-06T00:00:00Z",
  }));
  const ctx = makeCommandContext({
    storage: createMemoryStorage(),
    params: {},
    overrides: {
      sessions: {
        query: async (input = {}) => {
          queries.push(input);
          const start = Number(input.cursor ?? 0);
          const end = Math.min(start + Math.min(200, input.limit ?? 50), sessions.length);
          return { items: sessions.slice(start, end) as never, nextCursor: end < sessions.length ? `${end}` : null };
        },
      },
    },
  });
  const result = await search.query(ctx, {
    query: "history",
    limit: 300,
    providerId: "sessions",
    renderer: { rendererId: "list" },
  });
  expect(result.items).toHaveLength(300);
  expect(result.items.at(-1)?.id).toBe("s299");
  expect(queries).toEqual([
    { limit: 200, orderBy: "lastActivity", search: "history" },
    { limit: 100, orderBy: "lastActivity", search: "history", cursor: "200" },
  ]);
});

test("session rows preserve status colors and singular resource identity alongside the Sessions collection", async () => {
  const statuses = ["completed", "failed", "cancelled", "disconnected", "queued", "in_progress", "awaiting_input"];
  const ctx = makeCommandContext({
    storage: createMemoryStorage(),
    params: {},
    overrides: {
      sessions: {
        query: async () => ({
          items: statuses.map((status, index) => ({
            id: `s${index}`,
            title: status,
            status,
            updatedAt: new Date().toISOString(),
          })) as never,
          nextCursor: null,
        }),
      },
    },
  });
  const sections = await browse(ctx, { renderer: { rendererId: "list" } });
  const rows = sections[0].nodes.filter((row) => row.resource);
  expect(rows.map((row) => row.iconColor)).toEqual([
    "fg.success",
    "fg.error",
    "fg.warning",
    "fg.warning",
    "fg.info",
    "fg.muted",
    "fg.muted",
  ]);
  expect(rows.every((row) => row.resource?.icon === "message-circle")).toBe(true);
  const result = await search.query(ctx, {
    query: "",
    limit: 10,
    providerId: "sessions",
    renderer: { rendererId: "list" },
  });
  expect(result.items.every((item) => item.icon === "message-circle")).toBe(true);
});
