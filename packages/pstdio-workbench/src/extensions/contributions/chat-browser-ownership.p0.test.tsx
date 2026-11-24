import { expect, test } from "bun:test";
import type { ReactElement } from "react";
import { createWorkbench, getWorkbenchRenderers } from "../../core";
import {
  createWorkbenchExtensionChatRendererOwners,
  registerWorkbenchExtensionChatRenderers,
} from "./chat-renderer-contributions";
import type { ChatSession } from "./chat-session";
import { emptyWorkbenchExtensionMetadata } from "./extension-contributions";

test.each([
  false,
  true,
])("a browser submission saves its clear only while it owns the draft (replaced: %s)", async (replaced) => {
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
  const workbench = createWorkbench();
  const owners = createWorkbenchExtensionChatRendererOwners();
  const action = Promise.withResolvers<unknown>();
  const registrations: { dispose(): void }[] = [];
  const releases: (() => void)[] = [];
  const viewId = "acme.chat.view.conversation";
  const open = (emptyTitle: string) => {
    const registration = registerWorkbenchExtensionChatRenderers({
      workbench,
      chatRendererOwners: owners,
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
              browserDraft: {},
              draftKey: "compose",
              queryHandlerId: "chat.query",
              actionHandlerId: "chat.action",
              emptyTitle,
            },
          },
        ],
      },
      executeCommand: async (id) => (id === "chat.action" ? action.promise : {}),
    });
    registrations.push(registration);
    const element = getWorkbenchRenderers(workbench)
      .getRenderer(viewId)!
      .render({
        workbench,
        instance: { instanceId: "main", panelId: viewId, closable: true },
        panel: { id: viewId, title: "Chat", region: "main", rendererId: viewId },
        refresh: () => undefined,
      }) as ReactElement<{ session: ChatSession }>;
    const session = element.props.session;
    releases.push(session.retain());
    return session;
  };
  const submitted = { text: "Send this", attachments: [], values: {} };
  const newer = { text: "Keep newer typing", attachments: [{ id: "new", name: "new.txt" }], values: {} };
  try {
    const first = open("First declaration");
    first.changeDraft(submitted);
    await first.flushDraft();
    const sending = first.run({ type: "submit", ...submitted });
    releases[0]();
    registrations[0].dispose();
    if (replaced) {
      const replacement = open("Replacement declaration");
      expect(replacement).not.toBe(first);
      replacement.changeDraft(newer);
      await replacement.flushDraft();
    } else {
      owners.dispose();
    }
    action.resolve({});
    await sending;
    await first.flushDraft();
    const saved = JSON.parse(records.get([...records.keys()].find((key) => key.includes("chat-draft:"))!)!);
    expect(saved).toEqual(replaced ? newer : { text: "", attachments: [], values: {} });
  } finally {
    action.resolve({});
    for (const release of releases) release();
    for (const registration of registrations.reverse()) registration.dispose();
    owners.dispose();
    await workbench.dispose();
    if (previousStorage) Object.defineProperty(globalThis, "localStorage", previousStorage);
    else Reflect.deleteProperty(globalThis, "localStorage");
  }
});
