import { expect, test } from "bun:test";
import type { ExtensionSession } from "@pstdio/sdk/extensions";
import { createMemoryStorage, makeCommandContext } from "@pstdio/sdk/testing";
import { browse, browsePage } from "./browse";
import { markSessionSeen, pinSession, readSessionAttention, sessionAttentionIndex } from "./session-attention";

test("new activity becomes unread again after a session was seen", async () => {
  const storage = createMemoryStorage({ indexes: [sessionAttentionIndex] });
  const ctx = makeCommandContext({ storage, params: {} });
  const session = {
    id: "s",
    updatedAt: "2026-11-10T10:00:00Z",
    title: "Session",
    status: "completed",
  } as ExtensionSession;
  expect((await readSessionAttention(ctx, [session])).get("s")?.unread).toBe(true);
  await markSessionSeen(ctx, session);
  expect((await readSessionAttention(ctx, [session])).get("s")?.unread).toBe(false);
  expect((await readSessionAttention(ctx, [{ ...session, updatedAt: "2026-11-10T11:00:00Z" }])).get("s")?.unread).toBe(
    true,
  );
});

test("a pinned older session appears above recent results and can be unpinned", async () => {
  const old = { id: "old", title: "Old", updatedAt: "2026-10-01T10:00:00Z", status: "completed" } as ExtensionSession;
  const recent = { ...old, id: "recent", title: "Recent", updatedAt: "2026-11-10T10:00:00Z" };
  const ctx = makeCommandContext({
    storage: createMemoryStorage({ indexes: [sessionAttentionIndex] }),
    params: {},
    overrides: {
      sessions: { get: async () => old as never, query: async () => ({ items: [recent] as never, nextCursor: null }) },
    },
  });
  await pinSession.run(ctx, { sessionId: "old", pinned: true });
  const sections = await browse(ctx, { renderer: { rendererId: "sessions" } });
  expect(sections[0]?.nodes[0]?.resource?.id).toBe("old");
  expect(sections[1]?.nodes.find((n) => n.resource)?.resource?.id).toBe("recent");
  await pinSession.run(ctx, { sessionId: "old", pinned: false });
  expect((await browse(ctx, { renderer: { rendererId: "sessions" } }))[0]?.id).toBe("sessions");
});

test("pinned sessions paginate, respect workspace search, and keep seen state when unpinned", async () => {
  const sessions = Array.from(
    { length: 55 },
    (_, i) =>
      ({
        id: String(i).padStart(2, "0"),
        title: `Session ${i}`,
        workspaceId: "workspace",
        updatedAt: "2026-11-10T10:00:00Z",
        status: "completed",
      }) as ExtensionSession,
  );
  const ctx = makeCommandContext({
    storage: createMemoryStorage({ indexes: [sessionAttentionIndex] }),
    params: {},
    overrides: {
      sessions: {
        get: async (id) => sessions.find((s) => s.id === id) as never,
        query: async () => ({ items: [], nextCursor: null }),
      },
    },
  });
  for (const session of sessions) await pinSession.run(ctx, { sessionId: session.id, pinned: true });
  const renderer = { rendererId: "sessions" };
  const sections = await browse(ctx, { renderer });
  expect(sections[0].nodes).toHaveLength(50);
  const second = await browsePage(ctx, {
    renderer,
    parent: { kind: "section", id: "pinned" },
    cursor: sections[0].nextCursor!,
  });
  expect(second.nodes).toHaveLength(5);
  expect(second.nextCursor).toBeUndefined();
  expect((await browse(ctx, { renderer, filter: "Session 10" }))[0].nodes[0].resource?.id).toBe("10");
  expect(
    (await browse(ctx, { renderer: { ...renderer, resource: { type: "workspace", id: "another" } } }))[0].nodes,
  ).toEqual([]);
  await markSessionSeen(ctx, sessions[0]);
  await pinSession.run(ctx, { sessionId: sessions[0].id, pinned: false });
  expect((await readSessionAttention(ctx, [sessions[0]])).get(sessions[0].id)).toEqual({
    pinned: false,
    unread: false,
  });
});
