import { expect, test } from "bun:test";
import { PstdioConnectionError } from "@pstdio/sdk/client";
import { type ChatDraft, createScopedQueryClient } from "@pstdio/sdk/extensions";
import type { ReactElement } from "react";
import { createWorkbench, getWorkbenchRenderers } from "../../core";
import { getWorkbenchOperations } from "../../core/registries/mutations/operations";
import { registerWorkbenchExtensionChatRenderers } from "./chat-renderer-contributions";
import type { ChatSession } from "./chat-session";
import { emptyWorkbenchExtensionMetadata } from "./extension-contributions";

test("a browser draft acknowledges recovery only after saving every body, with its scoped identity", async () => {
  const previousStorage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  const records = new Map<string, string>();
  let full = true;
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => records.get(key) ?? null,
      setItem: (key: string, value: string) => {
        if (full && key.includes("chat-draft:")) throw new Error("Storage full");
        records.set(key, value);
      },
    },
  });
  const receipts: unknown[] = [];
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
          title: "Chat",
          body: {
            kind: "chat",
            draftKey: "compose",
            browserDraft: { acknowledgeRecoveryHandlerId: "chat.acknowledge" },
            queryHandlerId: "chat.query",
            actionHandlerId: "chat.action",
          },
        },
      ],
    },
    executeCommand: async (id, input) => {
      if (id === "chat.acknowledge") receipts.push(input.params);
      return {};
    },
  });
  const element = getWorkbenchRenderers(workbench)
    .getRenderer(viewId)!
    .render({
      workbench,
      instance: { instanceId: "main", panelId: viewId, closable: true, resource: { type: "thread", id: "saved" } },
      panel: { id: viewId, title: "Chat", region: "main", rendererId: viewId },
      refresh: () => undefined,
    }) as ReactElement<{ session: ChatSession }>;
  const session = element.props.session;
  const release = session.retain();
  const recoverDraft: ChatDraft = {
    text: "",
    attachments: [],
    values: {},
    recovered: [
      { text: "First recovered draft", attachments: [{ id: "file", name: "notes.txt" }], values: {} },
      { text: "Second recovered draft", attachments: [], values: { model: "previous" } },
    ],
  };
  try {
    session.changeDraft({ text: "New typing" });
    session.accept({ revision: 0, recoverDraft });
    await session.flushDraft();
    expect(session.getSnapshot().error).toBe("Storage full");
    expect(receipts).toEqual([]);
    full = false;
    session.accept({ revision: 1, recoverDraft });
    await session.flushDraft();
    expect(session.getSnapshot().draft).toMatchObject({ text: "New typing", recovered: recoverDraft.recovered });
    expect(records.get([...records.keys()].find((key) => key.includes("chat-draft:"))!)).toBe(
      JSON.stringify(session.getSnapshot().draft),
    );
    expect(receipts).toEqual([
      expect.objectContaining({
        draftKey: "saved",
        draftClientId: records.get("pstdio-workbench:chat-draft-client"),
        draft: recoverDraft,
        renderer: expect.objectContaining({ projectId: "project", resource: { type: "thread", id: "saved" } }),
      }),
    ]);
  } finally {
    release();
    registration.dispose();
    await workbench.dispose();
    if (previousStorage) Object.defineProperty(globalThis, "localStorage", previousStorage);
    else Reflect.deleteProperty(globalThis, "localStorage");
  }
});

test("discard after authority retirement reaches the restored browser draft without changing a newer draft", async () => {
  const previousStorage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  const records = new Map<string, string>();
  let full = false;
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => records.get(key) ?? null,
      setItem: (key: string, value: string) => {
        if (full) throw new Error("Storage full");
        records.set(key, value);
      },
    },
  });
  const queries = createScopedQueryClient({ runtimeId: "dashboard", accountId: "a", extensionId: "pstdio" });
  const workbench = createWorkbench({ queries });
  const operations = getWorkbenchOperations(queries);
  const viewId = "pstdio.session-browser.view.conversation";
  const registration = registerWorkbenchExtensionChatRenderers({
    workbench,
    queries,
    projectId: "project",
    metadata: {
      ...emptyWorkbenchExtensionMetadata,
      views: [
        {
          id: viewId,
          localId: "conversation",
          extensionId: "pstdio.session-browser",
          title: "Chat",
          body: {
            kind: "chat",
            draftKey: "compose",
            browserDraft: {},
            queryHandlerId: "chat.query",
            actionHandlerId: "chat.action",
          },
        },
      ],
    },
    executeCommand: async (id) => {
      if (id === "chat.action") throw new PstdioConnectionError(new Error("Response lost"));
      return {};
    },
  });
  const open = () =>
    (
      getWorkbenchRenderers(workbench)
        .getRenderer(viewId)!
        .render({
          workbench,
          instance: { instanceId: "main", panelId: viewId, closable: true, resource: { type: "session", id: "saved" } },
          panel: { id: viewId, title: "Chat", region: "main", rendererId: viewId },
          refresh() {},
        }) as ReactElement<{ session: ChatSession }>
    ).props.session;
  try {
    const first = open();
    await expect(first.run({ type: "submit", text: "Unknown submit", attachments: [], values: {} })).rejects.toThrow(
      "Message delivery could not be confirmed",
    );
    first.changeDraft({ text: "Keep typing" });
    await first.flushDraft();
    const keyA = [...records.keys()].find((key) => key.includes("chat-draft:"))!;
    queries.setAuthority({ accountId: "b" });
    const other = open();
    other.changeDraft({ text: "Account B draft" });
    await other.flushDraft();
    const keyB = [...records.keys()].find((key) => key.includes("chat-draft:") && key !== keyA)!;
    const otherSaved = records.get(keyB);
    queries.setAuthority({ accountId: "a" });
    const restored = open();
    expect(restored).not.toBe(first);
    expect(restored.getSnapshot().draft).toMatchObject({
      text: "Keep typing",
      recovered: [{ text: "Unknown submit" }],
    });
    const retained = operations.getSnapshot().recovery[0]!;
    full = true;
    expect(() => operations.discard(retained.id)).toThrow("Storage full");
    expect(operations.getSnapshot().recovery[0]?.id).toBe(retained.id);
    full = false;
    operations.discard(retained.id);
    await restored.flushDraft();
    expect(operations.getSnapshot().recovery).toEqual([]);
    expect(restored.getSnapshot().draft).toMatchObject({ text: "Keep typing", recovered: [] });
    expect(JSON.parse(records.get(keyA)!)).toMatchObject({ text: "Keep typing", recovered: [] });
    expect(records.get(keyB)).toBe(otherSaved);
  } finally {
    full = false;
    registration.dispose();
    await workbench.dispose();
    queries.dispose();
    if (previousStorage) Object.defineProperty(globalThis, "localStorage", previousStorage);
    else Reflect.deleteProperty(globalThis, "localStorage");
  }
});
