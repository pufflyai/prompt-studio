import { expect, test } from "bun:test";
import type { ChatDraft } from "@pstdio/sdk/extensions";
import type { ReactElement } from "react";
import { createWorkbench, getWorkbenchRenderers } from "../../core";
import { registerWorkbenchExtensionChatRenderers } from "./chat-renderer-contributions";
import type { ChatSession } from "./chat-session";
import { emptyWorkbenchExtensionMetadata } from "./extension-contributions";

test("closing the registered view still persists the clear from its already-started successful submission", async () => {
  const workbench = createWorkbench();
  const viewId = "acme.chat.view.held";
  let provider: ChatDraft = { text: "", attachments: [], values: {} };
  const action = Promise.withResolvers<unknown>();
  const registration = registerWorkbenchExtensionChatRenderers({
    workbench,
    projectId: "project",
    metadata: {
      ...emptyWorkbenchExtensionMetadata,
      views: [
        {
          id: viewId,
          localId: "held",
          extensionId: "acme.chat",
          title: "Chat",
          body: {
            kind: "chat",
            draftKey: "compose",
            queryHandlerId: "chat.query",
            actionHandlerId: "chat.action",
            loadDraftHandlerId: "chat.load",
            saveDraftHandlerId: "chat.save",
          },
        },
      ],
    },
    executeCommand: async (id, body) => {
      if (id === "chat.action") return action.promise;
      if (id === "chat.load") return provider;
      if (id === "chat.save") provider = structuredClone((body.params as { draft: ChatDraft }).draft);
      return {};
    },
  });
  const { session } = (
    getWorkbenchRenderers(workbench)
      .getRenderer(viewId)!
      .render({
        workbench,
        instance: { instanceId: "main", panelId: viewId, closable: true },
        panel: { id: viewId, title: "Chat", region: "main", rendererId: viewId },
        refresh: () => undefined,
      }) as ReactElement<{ session: ChatSession }>
  ).props;
  const release = session.retain();
  try {
    await new Promise((done) => setTimeout(done, 0));
    const draft = { text: "Send exactly once", attachments: [{ id: "A", name: "A.txt" }], values: {} };
    session.changeDraft(draft);
    await session.flushDraft();
    expect(provider).toEqual(draft);
    const sending = session.run({ type: "submit", ...draft });
    release();
    registration.dispose();
    action.resolve({});
    await sending;
    await session.flushDraft();
    expect(provider.text).toBe("");
    expect(provider.attachments).toEqual([]);
  } finally {
    action.resolve({});
    release();
    registration.dispose();
    await workbench.dispose();
  }
});

test("an independent native chat opts into browser drafts without changing provider-managed views", async () => {
  const previousStorage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  const profile = () => {
    const records = new Map<string, string>();
    return {
      getItem: (key: string) => records.get(key) ?? null,
      setItem: (key: string, value: string) => records.set(key, value),
      removeItem: (key: string) => records.delete(key),
    };
  };
  const firstProfile = profile();
  const secondProfile = profile();
  const commands: { id: string; params: unknown }[] = [];
  const open = (storage: ReturnType<typeof profile>) => {
    Object.defineProperty(globalThis, "localStorage", { configurable: true, value: storage });
    const workbench = createWorkbench();
    const viewId = "acme.chat.view.conversation";
    const registration = registerWorkbenchExtensionChatRenderers({
      workbench,
      projectId: "project",
      metadata: {
        ...emptyWorkbenchExtensionMetadata,
        views: [
          {
            id: viewId,
            localId: "conversation",
            extensionId: "acme.chat",
            title: "Session",
            body: {
              kind: "chat",
              draftKey: "draft",
              browserDraft: {},
              queryHandlerId: "chat.query",
              actionHandlerId: "chat.action",
            },
          },
        ],
      },
      executeCommand: async (id, body) => {
        commands.push({ id, params: body.params });
        return {};
      },
    });
    const element = getWorkbenchRenderers(workbench)
      .getRenderer(viewId)!
      .render({
        workbench,
        instance: {
          instanceId: "main",
          panelId: viewId,
          closable: true,
          resource: { type: "session", id: "laptop-session" },
        },
        panel: { id: viewId, title: "Session", region: "main", rendererId: viewId },
        refresh: () => undefined,
      }) as ReactElement<{ session: ChatSession }>;
    const session = element.props.session;
    const release = session.retain();
    return {
      session,
      close: async () => {
        release();
        registration.dispose();
        await workbench.dispose();
      },
    };
  };
  const documents: ReturnType<typeof open>[] = [];
  try {
    const first = open(firstProfile);
    documents.push(first);
    const draft = {
      text: "First browser's draft",
      attachments: [{ id: "uploaded", name: "notes.txt" }],
      values: { device: "laptop" },
    };
    first.session.changeDraft(draft);
    await first.session.flushDraft();
    const second = open(secondProfile);
    documents.push(second);
    expect(second.session.getSnapshot().draft.text).toBe("");
    const reply = { text: "Send to Laptop", attachments: [], values: {} };
    second.session.changeDraft(reply);
    await second.session.run({ type: "submit", ...reply });
    expect(second.session.getSnapshot().draft.text).toBe("");
    expect(first.session.getSnapshot().draft).toEqual(draft);
    await documents.shift()?.close();
    const reopened = open(firstProfile);
    documents.push(reopened);
    expect(reopened.session.getSnapshot().draft).toEqual(draft);
    expect(commands.filter(({ id }) => id === "chat.action")).toEqual([
      {
        id: "chat.action",
        params: expect.objectContaining({
          action: { type: "submit", ...reply },
          renderer: expect.objectContaining({ resource: { type: "session", id: "laptop-session" } }),
        }),
      },
    ]);
  } finally {
    for (const doc of documents.reverse()) await doc.close();
    if (previousStorage) Object.defineProperty(globalThis, "localStorage", previousStorage);
    else Reflect.deleteProperty(globalThis, "localStorage");
  }
});
