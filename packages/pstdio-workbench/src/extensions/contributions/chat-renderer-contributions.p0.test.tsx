import { expect, test } from "bun:test";
import type { ChatLinkHandler } from "@pstdio/ui/chat-ui";
import type { ReactElement } from "react";
import { createWorkbench, getWorkbenchRenderers, type WorkbenchPanelRenderInput } from "../../core";
import { registerWorkbenchExtensionChatRenderers } from "./chat-renderer-contributions";
import type { ChatSession } from "./chat-session";
import { emptyWorkbenchExtensionMetadata } from "./extension-contributions";

test("native chat renders before commands and binds callbacks to their project, resource and renderer", async () => {
  const workbench = createWorkbench();
  const calls: Array<{ id: string; body: unknown }> = [];
  const viewId = "acme.chat.view.chat";
  const registered = registerWorkbenchExtensionChatRenderers({
    workbench,
    projectId: "project-one",
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
            draftKey: "compose",
            initial: { messages: [] },
            queryHandlerId: "chat.query",
            actionHandlerId: "chat.action",
          },
        },
      ],
    },
    executeCommand: async (id, body) => {
      calls.push({ id, body });
      return id === "chat.query" ? { messages: [] } : {};
    },
  });
  const render = getWorkbenchRenderers(workbench).getRenderer(viewId)!.render;
  const renderInput: WorkbenchPanelRenderInput = {
    workbench,
    instance: {
      instanceId: "main",
      panelId: viewId,
      closable: true,
      resource: { type: "session", id: "session-one" },
    },
    panel: { id: viewId, title: "Chat", region: "main", rendererId: viewId },
    refresh: () => undefined,
  };
  const element = render(renderInput) as ReactElement<{
    session: ChatSession;
    action: (action: { type: "stop" }) => Promise<unknown>;
    visible?: boolean;
  }>;
  expect(element.props.session.getSnapshot().draft.text).toBe("");
  expect(calls).toEqual([]);
  const hidden = render({ ...renderInput, visible: false }) as typeof element;
  expect(hidden.props.visible).toBe(false);
  expect(hidden.props.session).toBe(element.props.session);
  expect((render({ ...renderInput, visible: true }) as typeof element).props.visible).toBe(true);
  const release = element.props.session.retain();
  await element.props.session.run({ type: "stop" });
  expect(calls).toContainEqual(
    expect.objectContaining({
      id: "chat.action",
      body: expect.objectContaining({
        projectId: "project-one",
        resource: { type: "session", id: "session-one" },
        params: expect.objectContaining({
          draftKey: "session-one",
          renderer: expect.objectContaining({ rendererId: viewId, projectId: "project-one" }),
        }),
      }),
    }),
  );
  const converted = render({
    ...renderInput,
    instance: {
      ...renderInput.instance,
      instanceId: "side",
      pageContext: { page: { kind: "page", extensionId: "acme.chat", id: "page" }, params: { filter: "recent" } },
    },
  }) as typeof element;
  expect(converted.props.session).toBe(element.props.session);
  await converted.props.action({ type: "stop" });
  expect(calls.at(-1)?.body).toMatchObject({ params: { renderer: { pageParams: { filter: "recent" } } } });
  release();
  registered.dispose();
  expect(workbench.views.getView(viewId)).toBeUndefined();
  await workbench.dispose();
});

test("shared chat reads, watches and draft persistence follow the current placement", async () => {
  const workbench = createWorkbench();
  const calls: Array<{ id: string; body: unknown }> = [];
  const viewId = "acme.chat.view.chat";
  const registered = registerWorkbenchExtensionChatRenderers({
    workbench,
    projectId: "project-one",
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
            draftKey: "compose",
            queryHandlerId: "chat.query",
            actionHandlerId: "chat.action",
            loadDraftHandlerId: "chat.load",
            saveDraftHandlerId: "chat.save",
            stream: { kind: "command", extensionId: "acme.chat", id: "watch" },
          },
        },
      ],
    },
    executeCommand: async (id, body) => {
      calls.push({ id, body });
      return id === "chat.load" ? { text: "", attachments: [], values: {} } : {};
    },
    streamChatCommand: (id, body, signal) => {
      calls.push({ id, body });
      return (async function* () {
        await new Promise<void>((done) => signal.addEventListener("abort", () => done(), { once: true }));
      })();
    },
  });
  const render = getWorkbenchRenderers(workbench).getRenderer(viewId)!.render;
  const renderInput: WorkbenchPanelRenderInput = {
    workbench,
    instance: { instanceId: "first", panelId: viewId, closable: true },
    panel: { id: viewId, title: "Chat", region: "main", rendererId: viewId },
    refresh: () => undefined,
  };
  const first = render(renderInput) as ReactElement<{ session: ChatSession }>;
  const moved = render({
    ...renderInput,
    instance: {
      ...renderInput.instance,
      instanceId: "side",
      pageContext: { page: { kind: "page", extensionId: "acme.chat", id: "page" }, params: { filter: "recent" } },
    },
  }) as typeof first;
  expect(moved.props.session).toBe(first.props.session);
  const release = moved.props.session.retain();
  moved.props.session.changeDraft({ text: "Keep this" });
  await moved.props.session.flushDraft();
  await moved.props.session.run({ type: "stop" });
  moved.props.session.reconnect();
  expect(new Set(calls.map(({ id }) => id))).toEqual(
    new Set(["chat.query", "chat.load", "chat.save", "chat.action", "acme.chat.command.watch"]),
  );
  for (const { body } of calls)
    expect(body).toMatchObject({ params: { renderer: { pageParams: { filter: "recent" } } } });
  release();
  registered.dispose();
  await workbench.dispose();
});

test("native host owns page validation while provider callbacks and external links remain available", async () => {
  const previousWindow = globalThis.window;
  const origin = "http://127.0.0.1:3200";
  globalThis.window = { location: { origin } } as Window & typeof globalThis;
  const workbench = createWorkbench();
  const viewId = "acme.chat.view.links";
  const registered = registerWorkbenchExtensionChatRenderers({
    workbench,
    projectId: "project-one",
    metadata: {
      ...emptyWorkbenchExtensionMetadata,
      views: [
        {
          id: viewId,
          localId: "links",
          extensionId: "acme.chat",
          title: "Chat",
          body: {
            kind: "chat",
            draftKey: "compose",
            initial: { messages: [], nativeLinks: true },
            queryHandlerId: "chat.query",
            actionHandlerId: "chat.action",
            resolveLinkHandlerId: "chat.link",
            resolveImageHandlerId: "chat.image",
          },
        },
      ],
    },
    executeCommand: async (id) =>
      id === "chat.link" ? { href: "custom:owned", label: "Owned" } : "data:image/png;base64,owned",
  });
  try {
    const element = getWorkbenchRenderers(workbench)
      .getRenderer(viewId)!
      .render({
        workbench,
        instance: { instanceId: "main", panelId: viewId, closable: true },
        panel: { id: viewId, title: "Chat", region: "main", rendererId: viewId },
        refresh: () => undefined,
      }) as ReactElement<{ session: ChatSession; linkHandler: ChatLinkHandler }>;
    const { session, linkHandler } = element.props;
    const page = { source: `${origin}/projects/project-one/unknown`, origin: "markdown" as const };
    expect(linkHandler.resolveHref(page)).toBeNull();
    expect(linkHandler.resolveHref({ ...page, source: "/projects/project-one/unknown" })).toBeNull();
    expect(linkHandler.resolveHref({ ...page, source: "https://example.com/" })).toBeNull();
    for (const source of ["mailto:person@example.com", "sms:+1234", "tel:+1234"])
      expect(linkHandler.resolveHref({ ...page, source })).toBe(source);
    expect(await linkHandler.resolveResource?.({ ...page, source: "custom:owned" })).toEqual({
      href: "custom:owned",
      label: "Owned",
    });
    expect(await linkHandler.resolveImageSource?.("custom:image")).toBe("data:image/png;base64,owned");
    session.accept({ revision: 1, snapshot: { nativeLinks: false } });
    expect(linkHandler.resolveHref(page)).toBe(page.source);
    expect(linkHandler.resolveHref({ ...page, source: "https://example.com/" })).toBe("https://example.com/");
    session.accept({ revision: 2, snapshot: { nativeLinks: true } });
    expect(linkHandler.resolveHref(page)).toBeNull();
  } finally {
    registered.dispose();
    await workbench.dispose();
    globalThis.window = previousWindow;
  }
});
