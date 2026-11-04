import type { CommandExecuteRequest, WorkbenchExtensionMetadata } from "@pstdio/sdk/api";
import { commandRefId, resourceKey } from "@pstdio/sdk/extensions";
import { text } from "pstdio-extensions/workbench";
import { createElement } from "react";
import { getWorkbenchRenderers, type WorkbenchCore, type WorkbenchPanelRenderInput } from "../../core";
import type { CommandParamFieldRenderer } from "../../react/command-palette/command-param-field";
import { NativeChatView } from "../../react/renderers/chat/native-chat-view";
import { executeWorkbenchExtensionCommand } from "../host/workbench-extension-command";
import type { RegisterWorkbenchExtensionContributionsInput } from "../host/workbench-extension-host-types";
import { type ChatSession, createChatSession } from "./chat-session";

export interface ChatCommandTransport {
  streamChatCommand?(commandId: string, body: CommandExecuteRequest, signal: AbortSignal): AsyncIterable<unknown>;
  createChatParamField?: (workbench: WorkbenchCore) => CommandParamFieldRenderer;
}
type ChatRecord = WorkbenchExtensionMetadata["views"][number] & {
  body: Extract<WorkbenchExtensionMetadata["views"][number]["body"], { kind: "chat" }>;
};

const registerChat = (input: RegisterWorkbenchExtensionContributionsInput, view: ChatRecord) => {
  const body = view.body;
  const sessions = new Map<string, ChatSession>();
  const sessionFor = (render: WorkbenchPanelRenderInput) => {
    const resource = render.instance.resource;
    const draftKey = resource?.id ?? body.draftKey;
    const key = JSON.stringify([input.projectId, view.id, resourceKey(resource) ?? draftKey]);
    let session = sessions.get(key);
    const binding = () => {
      const renderer = {
        rendererId: view.id,
        projectId: input.projectId,
        resource,
        pageParams: render.instance.pageContext?.params,
        modeId: input.workbench.modes.getActiveModeId(),
        invocation: { placement: "visible" },
      };
      const slot = {
        id: view.id,
        kind: "renderer" as const,
        context: { projectId: input.projectId, rendererId: view.id },
      };
      const run = (commandId: string, params: Record<string, unknown>, signal?: AbortSignal) =>
        executeWorkbenchExtensionCommand(input, commandId, {
          params: { renderer, draftKey, ...params },
          resource,
          slot,
          signal,
          placement: render.instance.placementIdentity,
        });
      return { renderer, slot, run };
    };
    const { renderer, slot, run } = binding();
    if (!session) {
      session = createChatSession({
        initial: body.initial,
        query: (signal) => run(body.queryHandlerId, {}, signal),
        action: (action) => run(body.actionHandlerId, { action }),
        loadDraft: body.loadDraftHandlerId ? () => run(body.loadDraftHandlerId!, {}) : undefined,
        saveDraft: body.saveDraftHandlerId ? (draft) => run(body.saveDraftHandlerId!, { draft }) : undefined,
        watch: body.stream
          ? (signal) => {
              if (!input.streamChatCommand) throw new Error("This host cannot stream native conversations.");
              return input.streamChatCommand(
                commandRefId(body.stream!),
                {
                  projectId: input.projectId,
                  resource,
                  slot,
                  params: { renderer, draftKey },
                  source: "dashboard",
                },
                signal,
              );
            }
          : undefined,
      });
      sessions.set(key, session);
    }
    return {
      session,
      key,
      action: (action: Parameters<ChatSession["run"]>[0]) => run(body.actionHandlerId, { action }),
    };
  };
  const registration = input.workbench.views.registerView(
    {
      id: view.id,
      title: text(view.title, view.id),
      icon: view.icon,
      body: {
        kind: "react",
        render: (render) => {
          const { session, key, action } = sessionFor(render);
          return createElement(NativeChatView, {
            key,
            session,
            action,
            conversationKey: key,
            refreshKey: getWorkbenchRenderers(render.workbench).store.getState().refreshKeys[view.id],
            emptyTitle: text(body.emptyTitle),
            emptyDescription: text(body.emptyDescription),
            renderParamField: input.createChatParamField?.(render.workbench),
          });
        },
      },
    },
    { source: "extension", ownerId: view.extensionId },
  );
  return {
    dispose() {
      registration.dispose();
      for (const session of sessions.values()) session.dispose();
      sessions.clear();
    },
  };
};

export const registerWorkbenchExtensionChatRenderers = (input: RegisterWorkbenchExtensionContributionsInput) => {
  const registrations = input.metadata.views.flatMap((view) =>
    view.body.kind === "chat" ? [registerChat(input, view as ChatRecord)] : [],
  );
  return {
    dispose() {
      for (const registration of registrations.reverse()) registration.dispose();
    },
  };
};
