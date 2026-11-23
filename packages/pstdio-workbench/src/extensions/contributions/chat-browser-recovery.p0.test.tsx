import { expect, test } from "bun:test";
import type { ChatDraft } from "@pstdio/sdk/extensions";
import type { ReactElement } from "react";
import { createWorkbench, getWorkbenchRenderers } from "../../core";
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
