import { expect, test } from "bun:test";
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
  const element = render({
    workbench,
    instance: { resource: { type: "session", id: "session-one" } },
  } as WorkbenchPanelRenderInput) as ReactElement<{
    session: ChatSession;
    action: (action: { type: "stop" }) => Promise<unknown>;
  }>;
  expect(element.props.session.getSnapshot().draft.text).toBe("");
  expect(calls).toEqual([]);
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
    workbench,
    instance: {
      resource: { type: "session", id: "session-one" },
      pageContext: { pageId: "page", params: { filter: "recent" } },
    },
  } as WorkbenchPanelRenderInput) as typeof element;
  expect(converted.props.session).toBe(element.props.session);
  await converted.props.action({ type: "stop" });
  expect(calls.at(-1)?.body).toMatchObject({ params: { renderer: { pageParams: { filter: "recent" } } } });
  release();
  registered.dispose();
  expect(workbench.views.getView(viewId)).toBeUndefined();
  await workbench.dispose();
});
