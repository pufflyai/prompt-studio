import { expect, test } from "bun:test";
import { type ChatDraft, createScopedQueryClient } from "@pstdio/sdk/extensions";
import type { ReactElement } from "react";
import { createWorkbench, getWorkbenchRenderers, type WorkbenchCore } from "../../core";
import {
  createWorkbenchExtensionChatRendererOwners,
  registerWorkbenchExtensionChatRenderers,
} from "./chat-renderer-contributions";
import { type ChatSession, createChatSession } from "./chat-session";
import { emptyWorkbenchExtensionMetadata } from "./extension-contributions";

const tick = () => Bun.sleep(0);
const view = {
  id: "acme.chat.view.chat",
  localId: "chat",
  extensionId: "acme.chat",
  title: "Chat",
  body: { kind: "chat" as const, draftKey: "draft", queryHandlerId: "query", actionHandlerId: "action" },
};
const metadata = { ...emptyWorkbenchExtensionMetadata, views: [view] };
const render = (core: WorkbenchCore, resource = "thread") =>
  getWorkbenchRenderers(core)
    .getRenderer(view.id)!
    .render({
      workbench: core,
      instance: { instanceId: resource, panelId: view.id, closable: true, resource: { type: "session", id: resource } },
      panel: { id: view.id, title: "Chat", region: "main", rendererId: view.id },
      refresh() {},
    }) as ReactElement<{ session: ChatSession; Host: { boundCore: WorkbenchCore } }>;

test("clean chat returns reuse accepted empty data and reconcile one hidden invalidation", async () => {
  let reads = 0;
  const session = createChatSession({
    query: async () => {
      reads++;
      return { messages: [] };
    },
    action: async () => ({}),
  });
  const first = session.retain();
  await tick();
  first();
  const second = session.retain();
  await tick();
  second();
  expect(reads).toBe(1);
  session.reconnect();
  const third = session.retain();
  await tick();
  expect(reads).toBe(2);
  third();
  await session.dispose();
});

test("project reconciliation retains other project chats and bounds inactive resource owners", async () => {
  const core = createWorkbench();
  const owners = createWorkbenchExtensionChatRendererOwners();
  let reads = 0;
  const register = (projectId: string) => {
    owners.reconcile(projectId, metadata);
    return registerWorkbenchExtensionChatRenderers({
      chatRendererOwners: owners,
      workbench: core,
      projectId,
      metadata,
      executeCommand: async () => {
        reads++;
        return {};
      },
    });
  };
  const a = register("A"),
    first = render(core).props.session;
  const release = first.retain();
  await tick();
  release();
  a.dispose();
  const b = register("B");
  b.dispose();
  const back = register("A");
  expect(render(core).props.session).toBe(first);
  const returned = first.retain();
  await tick();
  returned();
  expect(reads).toBe(1);
  for (let index = 0; index < 130; index++) {
    const session = render(core, String(index)).props.session;
    const close = session.retain();
    await session.query.read();
    close();
  }
  expect(render(core).props.session).not.toBe(first);
  back.dispose();
  owners.dispose();
  await core.dispose();
});

test("core disposal waits for an entered draft save", async () => {
  const core = createWorkbench();
  const entered = Promise.withResolvers<void>(),
    finish = Promise.withResolvers<void>();
  let closed = false;
  core.registerModule({
    id: "chat",
    activate: (workbench) =>
      registerWorkbenchExtensionChatRenderers({
        workbench,
        projectId: "A",
        metadata: { ...metadata, views: [{ ...view, body: { ...view.body, saveDraftHandlerId: "save" } }] },
        executeCommand: async (id) => {
          if (id === "save") {
            entered.resolve();
            await finish.promise;
          }
          return {};
        },
      }),
  });
  const session = render(core).props.session;
  const release = session.retain();
  await tick();
  session.changeDraft({ text: "Accepted" });
  await entered.promise;
  const closing = core.dispose().then(() => {
    closed = true;
  });
  await tick();
  expect(closed).toBe(false);
  finish.resolve();
  await closing;
  release();
});

test("drafts admitted behind hydration keep their command authority after a registration rebind", async () => {
  const owners = createWorkbenchExtensionChatRendererOwners();
  const queries = createScopedQueryClient({ runtimeId: "runtime", extensionId: "host" });
  const oldCore = createWorkbench(),
    newCore = createWorkbench();
  const hydration = Promise.withResolvers<ChatDraft>();
  const writes: string[] = [];
  const register = (workbench: WorkbenchCore, label: string) =>
    registerWorkbenchExtensionChatRenderers({
      chatRendererOwners: owners,
      queries,
      workbench,
      projectId: "A",
      metadata: {
        ...metadata,
        views: [{ ...view, body: { ...view.body, loadDraftHandlerId: "load", saveDraftHandlerId: "save" } }],
      },
      createChatHost: (boundCore) => Object.assign(() => null, { boundCore }),
      executeCommand: async (id) => {
        if (id === "load") return hydration.promise;
        if (id === "save") writes.push(label);
        return {};
      },
    });
  const first = register(oldCore, "old"),
    element = render(oldCore);
  const session = element.props.session,
    release = session.retain();
  session.changeDraft({ text: "Accepted before rebinding" });
  release();
  first.dispose();
  await oldCore.dispose();
  const next = register(newCore, "new"),
    replacement = render(newCore);
  expect(replacement.props.Host.boundCore).toBe(newCore);
  hydration.resolve({ text: "", attachments: [], values: {} });
  await session.flushDraft();
  expect(writes).toEqual(["old"]);
  next.dispose();
  owners.dispose();
  await newCore.dispose();
  queries.dispose();
});

test("closing a core drains the final draft clear derived from its accepted submission", async () => {
  const core = createWorkbench();
  const reply = Promise.withResolvers<unknown>(),
    saved = Promise.withResolvers<void>(),
    finish = Promise.withResolvers<void>();
  let closing = false;
  let draft: unknown;
  const registration = registerWorkbenchExtensionChatRenderers({
    workbench: core,
    projectId: "A",
    metadata: { ...metadata, views: [{ ...view, body: { ...view.body, saveDraftHandlerId: "save" } }] },
    executeCommand: async (id, input) => {
      if (id === "action") return reply.promise;
      if (id === "save" && (input.params?.draft as ChatDraft).text === "") {
        draft = input.params?.draft;
        saved.resolve();
        await finish.promise;
      }
      return {};
    },
  });
  const session = render(core).props.session;
  session.changeDraft({ text: "Send" });
  await session.flushDraft();
  const submission = session.run({ type: "submit", text: "Send", attachments: [], values: {} });
  const disposed = core.dispose().then(() => {
    closing = true;
  });
  reply.resolve({});
  await saved.promise;
  await tick();
  expect(closing).toBe(false);
  expect(draft).toMatchObject({ text: "", attachments: [] });
  finish.resolve();
  await submission;
  await disposed;
  registration.dispose();
});

test("authority retirement clears retained private chat state and partitions pending draft recovery", async () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  const values = new Map<string, string>();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    },
  });
  const core = createWorkbench(),
    owners = createWorkbenchExtensionChatRendererOwners();
  const queries = createScopedQueryClient({
    runtimeId: "runtime",
    accountId: "one",
    accountOrigin: "manager",
    extensionId: "host",
  });
  const registration = registerWorkbenchExtensionChatRenderers({
    workbench: core,
    chatRendererOwners: owners,
    queries,
    projectId: "A",
    metadata: {
      ...metadata,
      views: [{ ...view, body: { ...view.body, loadDraftHandlerId: "load", saveDraftHandlerId: "save" } }],
    },
    executeCommand: async (id) =>
      id === "load"
        ? new Promise(() => {})
        : { messages: [{ id: "m", role: "user", parts: [{ type: "text", text: "Private" }] }] },
  });
  try {
    const first = render(core).props.session;
    const release = first.retain();
    await first.query.read();
    first.changeDraft({ text: "Private pending text" });
    release();
    queries.setAuthority({ accountId: "two", accountOrigin: "manager" });
    expect(first.getSnapshot().messages).toEqual([]);
    expect(first.getSnapshot().draft.text).toBe("");
    const next = render(core).props.session;
    expect(next).not.toBe(first);
    expect(next.getSnapshot().draft.text).toBe("");
    await expect(first.run({ type: "stop" })).rejects.toThrow("authority is closed");
    expect(values.size).toBe(1);
  } finally {
    registration.dispose();
    owners.dispose();
    queries.dispose();
    await core.dispose();
    if (previous) Object.defineProperty(globalThis, "localStorage", previous);
    else Reflect.deleteProperty(globalThis, "localStorage");
  }
});

test("known project and resource changes reconcile one retained chat without waking its siblings", async () => {
  const core = createWorkbench(),
    owners = createWorkbenchExtensionChatRendererOwners();
  const queries = createScopedQueryClient({ runtimeId: "runtime", extensionId: "host" });
  const reads = new Map<string, number>();
  const registration = registerWorkbenchExtensionChatRenderers({
    workbench: core,
    queries,
    chatRendererOwners: owners,
    projectId: "A",
    metadata: { ...metadata, views: [{ ...view, body: { ...view.body, refreshEventIds: ["changed"] } }] },
    executeCommand: async (_id, input) => {
      const id = input.resource!.id;
      reads.set(id, (reads.get(id) ?? 0) + 1);
      return {};
    },
  });
  const first = render(core, "one").props.session,
    second = render(core, "two").props.session;
  const a = first.retain(),
    b = second.retain();
  await Promise.all([first.query.read(), second.query.read()]);
  a();
  for (let index = 0; index < 100; index++)
    queries.invalidate({ type: "changed", id: "changed", projectId: "A", resourceIds: ["one"] });
  queries.invalidate({ type: "changed", id: "changed", projectId: "B" });
  await tick();
  expect(Object.fromEntries(reads)).toEqual({ one: 1, two: 1 });
  const returned = first.retain();
  await first.query.read();
  expect(Object.fromEntries(reads)).toEqual({ one: 2, two: 1 });
  returned();
  b();
  registration.dispose();
  owners.dispose();
  queries.dispose();
  await core.dispose();
});

test("independent live query roots cannot reuse another authority's retained chat", async () => {
  const one = createScopedQueryClient({ runtimeId: "one", accountId: "one", extensionId: "host" });
  const two = createScopedQueryClient({ runtimeId: "two", accountId: "two", extensionId: "host" });
  const oldCore = createWorkbench({ queries: one }),
    newCore = createWorkbench({ queries: two });
  const owners = createWorkbenchExtensionChatRendererOwners();
  const register = (workbench: WorkbenchCore, queries: typeof one, label: string) =>
    registerWorkbenchExtensionChatRenderers({
      workbench,
      queries,
      chatRendererOwners: owners,
      projectId: "A",
      metadata,
      executeCommand: async () => ({ notice: label }),
    });
  const old = register(oldCore, one, "Private one"),
    first = render(oldCore).props.session;
  const a = first.retain();
  await first.query.read();
  a();
  old.dispose();
  const current = register(newCore, two, "Private two"),
    next = render(newCore).props.session;
  const b = next.retain();
  await next.query.read();
  expect(next).not.toBe(first);
  expect(next.getSnapshot().conversation.notice).toBe("Private two");
  expect(next.query.key[2]).toBe("two");
  b();
  current.dispose();
  owners.dispose();
  await oldCore.dispose();
  await newCore.dispose();
  one.dispose();
  two.dispose();
});

test("retired recovery controls cannot admit new writes while accepted work drains", async () => {
  const queries = createScopedQueryClient({ runtimeId: "runtime", accountId: "one", extensionId: "host" });
  const core = createWorkbench({ queries });
  const reply = Promise.withResolvers<unknown>();
  const writes: string[] = [];
  const registration = registerWorkbenchExtensionChatRenderers({
    queries,
    workbench: core,
    projectId: "A",
    metadata: { ...metadata, views: [{ ...view, body: { ...view.body, saveDraftHandlerId: "save" } }] },
    executeCommand: async (id, input) => {
      if (id === "action") return reply.promise;
      if (id === "save") writes.push((input.params?.draft as ChatDraft).text);
      return {};
    },
  });
  const session = render(core).props.session,
    release = session.retain();
  await session.query.read();
  session.changeDraft({ text: "Current", recovered: [{ text: "Private recovery", attachments: [], values: {} }] });
  await session.flushDraft();
  const action = session.run({ type: "stop" });
  queries.setAuthority({ accountId: "two" });
  session.restoreDraft(0);
  session.restoreSubmission("retired");
  await session.flushDraft();
  expect(writes).toEqual(["Current"]);
  reply.resolve({});
  await action;
  release();
  registration.dispose();
  await core.dispose();
  queries.dispose();
});

test("disposing an older registration leaves its peer core's chat observation live", async () => {
  const queries = createScopedQueryClient({ runtimeId: "runtime", extensionId: "host" }, { maxInactive: 0 });
  const first = createWorkbench({ queries }),
    second = createWorkbench({ queries });
  const owners = createWorkbenchExtensionChatRendererOwners();
  let reads = 0,
    starts = 0,
    stops = 0;
  const register = (workbench: WorkbenchCore) =>
    registerWorkbenchExtensionChatRenderers({
      queries,
      workbench,
      chatRendererOwners: owners,
      projectId: "A",
      metadata: {
        ...metadata,
        views: [
          {
            ...view,
            body: {
              ...view.body,
              refreshEventIds: ["changed"],
              stream: { kind: "command", extensionId: "acme.chat", id: "watch" },
            },
          },
        ],
      },
      executeCommand: async () => {
        reads++;
        return {};
      },
      streamChatCommand: (_id, _input, signal) =>
        (async function* () {
          starts++;
          await new Promise<void>((resolve) =>
            signal.addEventListener(
              "abort",
              () => {
                stops++;
                resolve();
              },
              { once: true },
            ),
          );
        })(),
    });
  const old = register(first),
    session = render(first).props.session;
  const a = session.retain();
  await session.query.read();
  const peer = register(second),
    same = render(second).props.session;
  const b = same.retain();
  expect(same).toBe(session);
  a();
  old.dispose();
  await first.dispose();
  queries.invalidate({ type: "changed", id: "changed", projectId: "A" });
  await session.query.read();
  expect(reads).toBe(2);
  expect(starts - stops).toBe(1);
  expect(session.query.active()).toBe(true);
  b();
  peer.dispose();
  owners.dispose();
  await second.dispose();
  queries.dispose();
});
