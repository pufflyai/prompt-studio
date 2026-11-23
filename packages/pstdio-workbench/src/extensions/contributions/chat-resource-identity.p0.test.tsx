import { expect, test } from "bun:test";
import { PstdioConnectionError } from "@pstdio/sdk/client";
import type { ResourceRef } from "@pstdio/sdk/extensions";
import type { ReactElement } from "react";
import { createWorkbench, getWorkbenchRenderers } from "../../core";
import { registerWorkbenchExtensionChatRenderers } from "./chat-renderer-contributions";
import type { ChatSession } from "./chat-session";
import { emptyWorkbenchExtensionMetadata } from "./extension-contributions";

test("host-normalized native resources share drafts and a watch without aliasing explicit foreign scopes", async () => {
  const workbench = createWorkbench();
  const watches: ResourceRef[] = [];
  const viewId = "acme.chat.view.chat";
  const registration = registerWorkbenchExtensionChatRenderers({
    workbench,
    projectId: "project",
    resolveChatResource: (resource) => ({
      ...resource,
      extensionId: resource.extensionId ?? "pstdio",
      projectId: resource.projectId ?? "project",
    }),
    metadata: {
      ...emptyWorkbenchExtensionMetadata,
      views: [
        {
          id: viewId,
          localId: "chat",
          extensionId: "acme.chat",
          title: "Chat",
          body: {
            kind: "chat",
            draftKey: "new",
            queryHandlerId: "query",
            actionHandlerId: "act",
            stream: { kind: "command", extensionId: "acme.chat", id: "watch" },
          },
        },
      ],
    },
    executeCommand: async () => ({}),
    streamChatCommand: (_id, body, signal) =>
      (async function* () {
        watches.push(body.resource!);
        await new Promise<void>((resolve) => signal.addEventListener("abort", () => resolve(), { once: true }));
      })(),
  });
  const render = (resource: ResourceRef, instanceId = "main") =>
    (
      getWorkbenchRenderers(workbench)
        .getRenderer(viewId)!
        .render({
          workbench,
          instance: { instanceId, panelId: viewId, closable: true, resource },
          panel: { id: viewId, title: "Chat", region: "main", rendererId: viewId },
          refresh: () => {},
        }) as ReactElement<{ session: ChatSession }>
    ).props.session;
  const canonical = { type: "session", id: "same", extensionId: "pstdio", projectId: "project" };
  try {
    const main = render({ type: "session", id: "same" });
    main.changeDraft({ text: "Unsent work" });
    const side = render({ ...canonical, label: "Session" }, "side");
    expect(side).toBe(main);
    expect(side.getSnapshot().draft.text).toBe("Unsent work");
    const releaseMain = main.retain();
    const releaseSide = side.retain();
    await Bun.sleep(0);
    expect(watches).toEqual([expect.objectContaining(canonical)]);
    expect(render({ ...canonical, extensionId: "foreign" })).not.toBe(main);
    expect(render({ ...canonical, projectId: "foreign" })).not.toBe(main);
    expect(render({ ...canonical, type: "ticket" })).not.toBe(main);
    releaseMain();
    releaseSide();
  } finally {
    registration.dispose();
    await workbench.dispose();
  }
});

test("an unconfirmed native follow-up stays attached to its conversation across views", async () => {
  const workbench = createWorkbench();
  const extensionId = "pstdio.session-browser";
  const viewId = `${extensionId}.view.session`;
  const actionEntered = Promise.withResolvers<void>();
  const lost = Promise.withResolvers<void>();
  const writes: string[] = [];
  const registration = registerWorkbenchExtensionChatRenderers({
    workbench,
    projectId: "project",
    metadata: {
      ...emptyWorkbenchExtensionMetadata,
      views: [
        {
          id: viewId,
          localId: "session",
          extensionId,
          title: "Session",
          body: {
            kind: "chat",
            draftKey: "new",
            initial: { streaming: true },
            queryHandlerId: "query",
            actionHandlerId: "act",
          },
        },
      ],
    },
    executeCommand: async (id, request) => {
      if (id !== "act") return { streaming: true };
      writes.push(request.resource!.id);
      if (request.resource?.id === "thread") {
        actionEntered.resolve();
        await lost.promise;
        throw new PstdioConnectionError(new Error("Response lost"));
      }
      return {};
    },
  });
  const render = (id: string, instanceId: string) =>
    (
      getWorkbenchRenderers(workbench)
        .getRenderer(viewId)!
        .render({
          workbench,
          instance: { instanceId, panelId: viewId, closable: true, resource: { type: "session", id } },
          panel: { id: viewId, title: "Session", region: "main", rendererId: viewId },
          refresh: () => {},
        }) as ReactElement<{ session: ChatSession }>
    ).props.session;
  const action = { type: "submit" as const, text: "Follow up", attachments: [], values: {} };
  try {
    const main = render("thread", "main");
    const release = main.retain();
    const send = main.run(action);
    await actionEntered.promise;
    release();
    const reopened = render("thread", "side");
    expect(reopened.getSnapshot().sending).toBe(true);
    expect(reopened.getSnapshot().queuedFollowUps?.some((item) => item.prompt === action.text)).toBe(true);
    const seen = new Set<boolean>();
    const stop = reopened.subscribeSubmissions(() => seen.add(reopened.hasUnresolvedSubmission()));
    lost.resolve();
    await expect(send).rejects.toThrow("Message delivery could not be confirmed");
    expect(reopened.hasUnresolvedSubmission()).toBe(true);
    expect(seen.has(true)).toBe(true);
    stop();
    await expect(reopened.run(action)).rejects.toThrow("Message delivery could not be confirmed");
    await render("other-thread", "other").run(action);
    expect(writes).toEqual(["thread", "other-thread"]);
  } finally {
    lost.resolve();
    registration.dispose();
    await workbench.dispose();
  }
});
