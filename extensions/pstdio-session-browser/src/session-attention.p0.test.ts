import { expect, test } from "bun:test";
import { type EventRef, type ExtensionSession, viewDataEvents } from "@pstdio/sdk/extensions";
import { createMemoryStorage, makeCommandContext } from "@pstdio/sdk/testing";
import { browse, browsePage } from "./browse";
import { nativeSubmissionIndex, readNativeSubmissions, saveNativeSubmission } from "./native-submission";
import { markSessionSeen, pinSession, readSessionAttention, sessionAttentionIndex } from "./session-attention";

test("only activity newer than the last opening is unread", async () => {
  const storage = createMemoryStorage({ indexes: [sessionAttentionIndex] });
  const ctx = makeCommandContext({ storage, params: {} });
  const session = {
    id: "s",
    updatedAt: "2026-11-10T10:00:00Z",
    title: "Session",
    status: "completed",
  } as ExtensionSession;
  expect((await readSessionAttention(ctx, [session])).get("s")?.unread).toBe(false);
  await markSessionSeen(ctx, session);
  expect((await readSessionAttention(ctx, [session])).get("s")?.unread).toBe(false);
  expect((await readSessionAttention(ctx, [{ ...session, updatedAt: "2026-11-10T11:00:00Z" }])).get("s")?.unread).toBe(
    true,
  );
  const updated = { ...session, updatedAt: "2026-11-10T11:00:00Z" };
  await markSessionSeen(ctx, updated);
  // An older viewer cannot move the last-seen activity backwards.
  await markSessionSeen(ctx, session);
  expect((await readSessionAttention(ctx, [updated])).get("s")?.unread).toBe(false);
  expect((await readSessionAttention(ctx, [{ ...updated, id: "never-opened" }])).get("never-opened")?.unread).toBe(
    false,
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

test("pinning a session preserves its native conversation inputs", async () => {
  const session = { id: "s", title: "Session", status: "completed" } as ExtensionSession;
  const ctx = makeCommandContext({
    storage: createMemoryStorage({ indexes: [sessionAttentionIndex, nativeSubmissionIndex] }),
    params: {},
    overrides: { sessions: { get: async () => session as never } },
  });
  await pinSession.run(ctx, { sessionId: session.id, pinned: true });
  expect(await readNativeSubmissions(ctx, session.id)).toEqual([]);
  const draft = { text: "Keep this input", attachments: [], values: {} };
  await saveNativeSubmission(
    ctx,
    session.id,
    { draft, operation: { kind: "command", text: `/compact ${draft.text}` } },
    null,
    false,
  );
  expect((await readNativeSubmissions(ctx, session.id))[0]?.body.draft).toEqual(draft);
  await pinSession.run(ctx, { sessionId: session.id, pinned: false });
  expect((await readNativeSubmissions(ctx, session.id))[0]?.body.draft).toEqual(draft);
});

test("viewing and pinning a resource update its project-wide navigation state", async () => {
  const storage = createMemoryStorage({ indexes: [sessionAttentionIndex] });
  const session = {
    id: "scoped",
    title: "Scoped",
    status: "completed",
    updatedAt: "2026-11-11T18:00:00Z",
  } as ExtensionSession;
  const overrides = { sessions: { get: async () => session as never } };
  const browseContext = makeCommandContext({ storage, params: {}, overrides });
  const resourceContext = makeCommandContext({
    storage: storage.scope({ type: "resource", resource: { type: "session", id: session.id } }),
    params: {},
    overrides,
  });
  await markSessionSeen(resourceContext, session);
  expect((await readSessionAttention(browseContext, [session])).get(session.id)?.unread).toBe(false);
  await pinSession.run(resourceContext, { sessionId: session.id, pinned: true });
  expect((await readSessionAttention(browseContext, [session])).get(session.id)?.pinned).toBe(true);
});

test("browse marks only sessions changed since opening and clears them on reopen", async () => {
  const sessions = ["changed", "unchanged", "never-opened"].map(
    (id) =>
      ({
        id,
        title: id,
        status: "completed",
        updatedAt: "2026-11-10T10:00:00Z",
      }) as ExtensionSession,
  );
  const ctx = makeCommandContext({
    storage: createMemoryStorage({ indexes: [sessionAttentionIndex] }),
    params: {},
    overrides: { sessions: { query: async () => ({ items: sessions as never, nextCursor: null }) } },
  });
  await markSessionSeen(ctx, sessions[0]);
  await markSessionSeen(ctx, sessions[1]);
  sessions[0].updatedAt = "2026-11-10T11:00:00Z";
  const nodes = (await browse(ctx, { renderer: { rendererId: "sessions" } }))[0].nodes;
  expect(nodes.filter((node) => node.indicator).map((node) => node.id)).toEqual(["changed"]);
  await markSessionSeen(ctx, sessions[0]);
  expect((await browse(ctx, { renderer: { rendererId: "sessions" } }))[0].nodes.every((node) => !node.indicator)).toBe(
    true,
  );
});

test("attention changes do not announce conversation changes", async () => {
  const session = { id: "s", title: "Session", updatedAt: "2026-11-10T10:00:00Z" } as ExtensionSession;
  const events: (string | EventRef)[] = [];
  const ctx = makeCommandContext({
    storage: createMemoryStorage({ indexes: [sessionAttentionIndex] }),
    params: {},
    overrides: {
      sessions: { get: async () => session as never },
      events: {
        emit: async (event) => {
          events.push(event);
          return { delivered: 0 };
        },
      },
    },
  });
  await pinSession.run(ctx, { sessionId: session.id, pinned: true });
  await pinSession.run(ctx, { sessionId: session.id, pinned: false });
  await markSessionSeen(ctx, session);
  expect(events).toHaveLength(3);
  expect(events).not.toContainEqual(viewDataEvents.sessionsChanged);
  expect(
    events.every((event) => typeof event !== "string" && event.extensionId === "pstdio.pstdio-session-browser"),
  ).toBe(true);
});
