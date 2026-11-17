import { expect, test } from "bun:test";
import type { ChatDraft } from "@pstdio/sdk/extensions";
import type { ReactElement } from "react";
import { createWorkbench, getWorkbenchRenderers } from "../../core";
import { registerWorkbenchExtensionChatRenderers } from "./chat-renderer-contributions";
import type { ChatSession } from "./chat-session";
import { emptyWorkbenchExtensionMetadata } from "./extension-contributions";

test("registered native chat restores pending files, text and controls before provider hydration after document replacement", async () => {
  const previousStorage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  const records = new Map<string, string>();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => records.get(key) ?? null,
      setItem: (key: string, value: string) => records.set(key, value),
      removeItem: (key: string) => records.delete(key),
    },
  });
  const viewId = "acme.chat.view.conversation";
  const saved: ChatDraft[] = [];
  const open = (projectId = "project", resourceId = "session") => {
    const workbench = createWorkbench();
    const registration = registerWorkbenchExtensionChatRenderers({
      workbench,
      projectId,
      metadata: {
        ...emptyWorkbenchExtensionMetadata,
        views: [
          {
            id: viewId,
            localId: "conversation",
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
        if (id === "chat.load") return new Promise(() => {});
        if (id === "chat.save") saved.push((body.params as { draft: ChatDraft }).draft);
        return {};
      },
    });
    const element = getWorkbenchRenderers(workbench)
      .getRenderer(viewId)!
      .render({
        workbench,
        instance: { instanceId: "side", panelId: viewId, closable: true, resource: { type: "thread", id: resourceId } },
        panel: { id: viewId, title: "Chat", region: "main", rendererId: viewId },
        refresh: () => undefined,
      }) as ReactElement<{ session: ChatSession }>;
    return { workbench, registration, session: element.props.session };
  };
  const documents: ReturnType<typeof open>[] = [];
  try {
    const first = open();
    documents.push(first);
    const release = first.session.retain();
    const draft = {
      text: "Keep immediate reload",
      attachments: [{ id: "uploaded", name: "notes.txt" }],
      values: { agent: { harnessId: "custom", model: "chosen" } },
    };
    first.session.changeDraft(draft);
    expect(saved).toEqual([]);
    expect(records.size).toBe(1);
    release();
    first.registration.dispose();
    await first.workbench.dispose();

    const replacement = open();
    documents.push(replacement);
    expect(replacement.session).not.toBe(first.session);
    expect(replacement.session.getSnapshot().draft).toEqual(draft);
    for (const foreign of [open("other-project"), open("project", "other-session")]) {
      documents.push(foreign);
      expect(foreign.session.getSnapshot().draft.text).toBe("");
    }
  } finally {
    for (const document of documents) {
      document.registration.dispose();
      await document.workbench.dispose();
    }
    if (previousStorage) Object.defineProperty(globalThis, "localStorage", previousStorage);
    else Reflect.deleteProperty(globalThis, "localStorage");
  }
});

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

test("a replaced legacy migration cannot overwrite newer work or acknowledge its skipped transfer", async () => {
  const previousStorage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  const records = new Map<string, string>();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => records.get(key) ?? null,
      setItem: (key: string, value: string) => records.set(key, value),
      removeItem: (key: string) => records.delete(key),
    },
  });
  const empty = (): ChatDraft => ({ text: "", attachments: [], values: {} });
  const delayed = Promise.withResolvers<ChatDraft>();
  let provider = empty();
  let loads = 0;
  let acknowledged = 0;
  const documents: {
    registration: { dispose(): void };
    workbench: ReturnType<typeof createWorkbench>;
    session: ChatSession;
  }[] = [];
  const open = () => {
    const workbench = createWorkbench();
    const id = "acme.chat.view.migrate";
    const registration = registerWorkbenchExtensionChatRenderers({
      workbench,
      projectId: "project",
      metadata: {
        ...emptyWorkbenchExtensionMetadata,
        views: [
          {
            id,
            localId: "migrate",
            extensionId: "acme.chat",
            title: "Chat",
            body: {
              kind: "chat",
              legacySessionDraft: true,
              draftKey: "compose",
              queryHandlerId: "query",
              actionHandlerId: "action",
              loadDraftHandlerId: "load",
              saveDraftHandlerId: "save",
            },
          },
        ],
      },
      readLegacySessionDraft: () =>
        acknowledged
          ? undefined
          : {
              draft: { ...empty(), text: "Legacy source", attachments: [{ id: "legacy", name: "legacy.txt" }] },
              acknowledge: () => {
                acknowledged++;
              },
            },
      executeCommand: async (command, body) => {
        if (command === "load") return ++loads === 1 ? delayed.promise : structuredClone(provider);
        if (command === "save") provider = structuredClone((body.params as { draft: ChatDraft }).draft);
        return {};
      },
    });
    const element = getWorkbenchRenderers(workbench)
      .getRenderer(id)!
      .render({
        workbench,
        instance: { instanceId: "side", panelId: id, closable: true, resource: { type: "thread", id: "saved" } },
        panel: { id, title: "Chat", region: "main", rendererId: id },
        refresh: () => undefined,
      }) as ReactElement<{ session: ChatSession }>;
    const document = { workbench, registration, session: element.props.session };
    documents.push(document);
    return document;
  };
  try {
    const first = open();
    const releaseFirst = first.session.retain();
    first.session.changeDraft({ text: "Old owner" });
    releaseFirst();
    first.registration.dispose();
    const replacement = open();
    const release = replacement.session.retain();
    const newer = { text: "New acknowledged work", attachments: [{ id: "new", name: "new.txt" }], values: {} };
    replacement.session.changeDraft(newer);
    await replacement.session.flushDraft();
    expect(provider).toMatchObject(newer);
    expect(acknowledged).toBe(1);
    delayed.resolve(empty());
    await first.session.flushDraft();
    expect(provider).toMatchObject(newer);
    expect(acknowledged).toBe(1);
    release();
  } finally {
    delayed.resolve(empty());
    for (const document of documents) {
      document.registration.dispose();
      await document.workbench.dispose();
    }
    if (previousStorage) Object.defineProperty(globalThis, "localStorage", previousStorage);
    else Reflect.deleteProperty(globalThis, "localStorage");
  }
});
