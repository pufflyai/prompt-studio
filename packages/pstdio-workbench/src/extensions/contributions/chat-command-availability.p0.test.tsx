import { expect, test } from "bun:test";
import type { ReactElement } from "react";
import { createWorkbench, getWorkbenchRenderers } from "../../core";
import {
  createWorkbenchExtensionChatRendererOwners,
  registerWorkbenchExtensionChatRenderers,
} from "./chat-renderer-contributions";
import type { ChatSession } from "./chat-session";
import { emptyWorkbenchExtensionMetadata } from "./extension-contributions";

test("retained chats restart their provider watch when optional commands become unavailable", async () => {
  const workbench = createWorkbench();
  const owners = createWorkbenchExtensionChatRendererOwners();
  const viewId = "example.chat.view.conversation";
  let watches = 0;
  let stops = 0;
  const metadata = {
    ...emptyWorkbenchExtensionMetadata,
    commands: [{ id: "optional.command.presentation", extensionId: "optional", title: "Presentation" }],
    views: [
      {
        id: viewId,
        localId: "conversation",
        extensionId: "example.chat",
        title: "Conversation",
        body: {
          kind: "chat" as const,
          draftKey: "draft",
          queryHandlerId: "query",
          actionHandlerId: "action",
          stream: { kind: "command" as const, extensionId: "example.chat", id: "watch" },
        },
      },
    ],
  };
  const input = {
    workbench,
    chatRendererOwners: owners,
    projectId: "p",
    metadata,
    executeCommand: async () => ({}),
    streamChatCommand: (_id: string, _body: unknown, signal: AbortSignal) =>
      (async function* () {
        watches++;
        await new Promise<void>((resolve) => {
          if (signal.aborted) resolve();
          else signal.addEventListener("abort", () => resolve(), { once: true });
        });
        stops++;
      })(),
  };
  let registration = registerWorkbenchExtensionChatRenderers(input);
  const render = () =>
    (
      getWorkbenchRenderers(workbench)
        .getRenderer(viewId)!
        .render({
          workbench,
          instance: { instanceId: "main", panelId: viewId, closable: true },
          panel: { id: viewId, title: "Conversation", region: "main", rendererId: viewId },
          refresh() {},
        }) as ReactElement<{ session: ChatSession }>
    ).props.session;
  const session = render();
  const release = session.retain();
  try {
    await Bun.sleep(0);
    expect(watches).toBe(1);
    registration.dispose();
    registration = registerWorkbenchExtensionChatRenderers({ ...input, metadata: { ...metadata } });
    await Bun.sleep(0);
    expect(watches).toBe(1);
    session.changeDraft({ text: "Keep my draft" });
    registration.dispose();
    registration = registerWorkbenchExtensionChatRenderers({ ...input, metadata: { ...metadata, commands: [] } });
    await Bun.sleep(0);
    expect(render()).toBe(session);
    expect(session.getSnapshot().draft.text).toBe("Keep my draft");
    expect(watches).toBe(2);
    expect(stops).toBe(1);
    registration.dispose();
    registration = registerWorkbenchExtensionChatRenderers(input);
    await Bun.sleep(0);
    expect(watches).toBe(3);
    expect(render()).toBe(session);
  } finally {
    release();
    registration.dispose();
    owners.dispose();
    await workbench.dispose();
  }
});
