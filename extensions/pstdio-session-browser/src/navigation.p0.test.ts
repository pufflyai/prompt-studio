import { expect, test } from "bun:test";
import { createMemoryStorage, makeCommandContext } from "@pstdio/sdk/testing";
import { sessionBrowser } from "../refs";
import { archive, create, open, remove, switchConversation } from "./navigation";

test("new drafts keep explicit and contextual workspace, harness and device identity", async () => {
  const opened: unknown[] = [];
  const ctx = makeCommandContext({
    storage: createMemoryStorage(),
    params: {},
    overrides: {
      resource: {
        type: "workspace",
        id: "workspace",
        device: { id: "laptop", ownerId: "owner", name: "Laptop" },
      },
      navigation: { open: (target) => opened.push(target) },
    },
  });
  await create.run(ctx, { harnessId: "remote-agent", side: true });
  expect(opened[0]).toMatchObject({
    kind: "panel",
    panel: sessionBrowser.panels.conversation,
    open: "pin",
    resource: {
      type: "session-draft",
      extensionId: "pstdio",
      metadata: { workspaceId: "workspace", agent: "remote-agent", deviceId: "laptop" },
    },
  });
});

test("opening a saved conversation into its invoking viewer preserves page and panel context", async () => {
  const opened: unknown[] = [];
  const from = { type: "session", id: "previous", extensionId: "pstdio" };
  const ctx = makeCommandContext({
    storage: createMemoryStorage(),
    params: {},
    overrides: {
      resource: from,
      sessions: { get: async () => ({ id: "next", title: "Next", status: "completed" }) as never },
      navigation: { open: (target) => opened.push(target) },
    },
  });
  await open.run(ctx, { sessionId: "next", replace: true });
  expect(opened[0]).toMatchObject({
    kind: "viewer",
    operation: "switch",
    from,
    page: sessionBrowser.pages.session,
    resource: { id: "next", extensionId: "pstdio" },
  });
});

test("typed Switch uses the invoking viewer while canonical lifecycle mutations stay core owned", async () => {
  const opened: unknown[] = [];
  const mutated: string[] = [];
  const from = { type: "session", id: "source", extensionId: "pstdio" };
  const ctx = makeCommandContext({
    storage: createMemoryStorage(),
    params: {},
    overrides: {
      resource: from,
      sessions: {
        get: async () => ({ id: "selected", title: "Selected", status: "completed" }) as never,
        archive: async (id) => {
          mutated.push(`archive:${id}`);
          return {} as never;
        },
        delete: async (id) => {
          mutated.push(`delete:${id}`);
        },
      },
      resources: {
        removed: async () => {
          throw new Error("Resource belongs to another extension.");
        },
      },
      navigation: {
        open: (target) => {
          opened.push(target);
        },
      },
    },
  });
  await switchConversation.run(ctx, { session: { type: "session", extensionId: "pstdio", id: "selected" } });
  expect(opened).toEqual([
    expect.objectContaining({
      kind: "viewer",
      operation: "switch",
      from,
      resource: expect.objectContaining({ id: "selected", extensionId: "pstdio" }),
    }),
  ]);
  await archive.run(ctx, { sessionId: "selected" });
  await remove.run(ctx, { sessionId: "selected" });
  expect(mutated).toEqual(["archive:selected", "delete:selected"]);
});

test("typed Switch refuses foreign kind, owner and project references before reading a session", async () => {
  let reads = 0;
  const ctx = makeCommandContext({
    storage: createMemoryStorage(),
    params: {},
    overrides: {
      sessions: {
        get: async () => {
          reads++;
          return { id: "s", title: "Saved", status: "completed" } as never;
        },
      },
      navigation: { open: () => {} },
    },
  });
  for (const session of [
    { type: "note", extensionId: "pstdio", id: "s" },
    { type: "session", extensionId: "foreign.tool", id: "s" },
    { type: "session", extensionId: "pstdio", projectId: "foreign-project", id: "s" },
  ])
    await expect(Promise.resolve().then(() => switchConversation.run(ctx, { session }))).rejects.toThrow();
  expect(reads).toBe(0);
  await switchConversation.run(ctx, {
    session: { type: "session", extensionId: "pstdio", projectId: ctx.projectId, id: "s" },
  });
  expect(reads).toBe(1);
});
