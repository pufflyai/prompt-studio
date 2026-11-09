import type { ScopedQueryClient } from "@pstdio/sdk/extensions";
import { type ChatRendererAction, type ResourceRef, resourceKey } from "@pstdio/sdk/extensions";
import { text } from "pstdio-extensions/workbench";
import { type ComponentType, createElement } from "react";
import type { WorkbenchCore, WorkbenchPanelRenderInput } from "../../core";
import { getWorkbenchQueries } from "../../core/workbench-queries";
import type { NativeChatHostProps } from "../../react/renderers/chat/native-chat-host";
import { NativeChatView } from "../../react/renderers/chat/native-chat-view";
import type { RegisterWorkbenchExtensionContributionsInput } from "../host/workbench-extension-host-types";
import { createChatCommandBinding } from "./chat-command-binding";
import { createChatLinkHandler } from "./chat-link-handler";
import type { createChatOwnerRetention } from "./chat-owner-retention";
import { createChatRegistrationReplacement } from "./chat-registration-replacement";
import { createChatRendererBindings } from "./chat-renderer-bindings";
import type { ChatRecord } from "./chat-renderer-contributions";
import { observeChatRendererRefresh } from "./chat-renderer-refresh";
import type { ChatSession } from "./chat-session";
import { createChatSessionProvider } from "./chat-session-provider";

interface ChatRendererSessionOwner {
  session: ChatSession;
  render: WorkbenchPanelRenderInput;
  registration: RegisterWorkbenchExtensionContributionsInput;
  presentationKey: string;
  releaseDrafts?(): void;
  bindings?: ReturnType<typeof createChatRendererBindings>;
  untrack?(): void;
}

const createQueryRootKeys = () => {
  const roots = new WeakMap<ScopedQueryClient, number>();
  let nextRoot = 0;
  return (queries: ScopedQueryClient) => {
    if (!roots.has(queries)) roots.set(queries, ++nextRoot);
    return roots.get(queries);
  };
};

export const createChatRendererOwner = (
  initialInput: RegisterWorkbenchExtensionContributionsInput,
  view: ChatRecord,
  retention: ReturnType<typeof createChatOwnerRetention>,
) => {
  let input = initialInput;
  const body = view.body;
  let registrations = 0;
  const hosts = new WeakMap<WorkbenchCore, ComponentType<NativeChatHostProps> | undefined>();
  const sessions = new Map<string, ChatRendererSessionOwner>();
  const replacement = createChatRegistrationReplacement(() => sessions.values());
  const normalizeResource = (resource: ResourceRef | undefined) =>
    resource ? (input.resolveChatResource?.(resource, input.projectId) ?? resource) : undefined;
  const rootKey = createQueryRootKeys();
  const resourceIdentity = (resource: WorkbenchPanelRenderInput["instance"]["resource"]) =>
    JSON.stringify([input.projectId, view.id, resourceKey(normalizeResource(resource)) ?? body.draftKey]);
  const keyFor = (resource: ResourceRef | undefined, queries: ScopedQueryClient) =>
    JSON.stringify([rootKey(queries), resourceIdentity(resource)]);
  const sessionFor = (
    render: WorkbenchPanelRenderInput,
    registration: RegisterWorkbenchExtensionContributionsInput,
    token: object,
  ) => {
    const resource = render.instance.resource;
    const draftKey = resource?.id ?? body.draftKey;
    const queries = registration.queries ?? getWorkbenchQueries(render.workbench);
    const key = keyFor(resource, queries);
    let owner = sessions.get(key);
    if (owner) {
      owner.render = render;
      owner.registration = registration;
      retention.touch(owner.session);
    }
    const binding = () => {
      const current = owner?.render ?? render;
      const calling = owner?.registration ?? registration;
      return createChatCommandBinding(calling, current, view.id, draftKey, (params) => (resource) => {
        const state = owner!.session.getSnapshot();
        const action = params.action as ChatRendererAction | undefined;
        // The command's authorized replacement owns this receipt. Explicit switches,
        // stale results and already displayed targets never inherit another prompt.
        if (
          action?.type !== "submit" ||
          action.questionResponse ||
          !state.pending?.length ||
          state.conversation.messages?.length ||
          sessions.has(keyFor(resource, queries))
        )
          return;
        const target = sessionFor({ ...current, instance: { ...current.instance, resource } }, calling, token);
        owner!.session.transferPending(target.session.receivePending);
        const destination = sessions.get(keyFor(resource, queries))!;
        destination.presentationKey = owner!.presentationKey;
        owner!.presentationKey = crypto.randomUUID();
      });
    };
    if (!owner) {
      const { session, releaseDrafts, isSource } = createChatSessionProvider({
        input: () => owner?.registration ?? registration,
        view,
        render,
        key: resourceIdentity(resource),
        draftKey,
        normalized: normalizeResource(resource),
        binding,
        idle: retention.trim,
      });
      owner = { session, render, registration, presentationKey: crypto.randomUUID(), releaseDrafts };
      sessions.set(key, owner);
      const capturedOwner = owner;
      owner.bindings = createChatRendererBindings({
        session,
        viewId: view.id,
        isSource,
        select: (render, registration) => {
          capturedOwner.render = render;
          capturedOwner.registration = registration;
        },
      });
      owner.untrack = retention.add(queries, session, () => {
        if (sessions.get(key) === capturedOwner) sessions.delete(key);
        capturedOwner.bindings?.dispose();
        void session.retire().then(capturedOwner.releaseDrafts, capturedOwner.releaseDrafts);
        session.query.dispose();
      });
    }
    const { session } = owner;
    owner.bindings!.attach(render, registration, token);
    const { required: run } = binding();
    return {
      session,
      key: owner.presentationKey,
      linkHandler: createChatLinkHandler(session, body, run),
      action: (action: Parameters<ChatSession["run"]>[0]) => run(body.actionHandlerId, { action }),
    };
  };
  return {
    preserveRegistrations: replacement.preserve,
    active: () => registrations > 0 || [...sessions.values()].some((owner) => owner.session.active()),
    register(nextInput: RegisterWorkbenchExtensionContributionsInput) {
      input = nextInput;
      const token = {};
      const slots = new Map<
        string,
        {
          render: WorkbenchPanelRenderInput;
          scope: string;
          resource: string;
          key: string;
          active: number;
          observe(session: ChatSession): () => void;
          resolve(): ReturnType<typeof sessionFor> | undefined;
        }
      >();
      const trimSlots = () => {
        let inactive = [...slots.values()].filter((slot) => !slot.active).length;
        for (const [id, slot] of slots) {
          if (inactive <= 128) break;
          if (!slot.active) {
            slots.delete(id);
            inactive--;
          }
        }
      };
      const stopEvents = observeChatRendererRefresh(nextInput, view, () =>
        [...sessions.values()].filter((owner) => owner.registration === nextInput),
      );
      const registration = input.workbench.views.registerView(
        {
          id: view.id,
          title: text(view.title, view.id),
          icon: view.icon,
          body: {
            kind: "react",
            render: (render) => {
              if (!hosts.has(render.workbench))
                hosts.set(render.workbench, input.createChatHost?.(render.workbench, input.projectId));
              const Host = hosts.get(render.workbench);
              const { session, key, action, linkHandler } = sessionFor(render, nextInput, token);
              const identity = resourceIdentity(render.instance.resource);
              const scope = JSON.stringify(session.query.key.slice(0, 6));
              let slot = slots.get(render.instance.instanceId);
              if (!slot || slot.resource !== identity || slot.scope !== scope) {
                const created = {
                  render,
                  scope,
                  resource: identity,
                  key,
                  active: 0,
                  observe: (session: ChatSession) => {
                    const release = session.retain();
                    created.active++;
                    let closed = false;
                    return () => {
                      if (closed) return;
                      closed = true;
                      created.active--;
                      release();
                      trimSlots();
                    };
                  },
                  resolve: () => {
                    if (!registered) return;
                    const current = sessionFor(created.render, nextInput, token);
                    return JSON.stringify(current.session.query.key.slice(0, 6)) === created.scope
                      ? current
                      : undefined;
                  },
                };
                slot = created;
                slots.set(render.instance.instanceId, slot);
                trimSlots();
              }
              slot.render = render;
              return createElement(NativeChatView, {
                key: slot.key,
                Host,
                session,
                action,
                linkHandler,
                conversationKey: key,
                observe: slot.observe,
                resolve: slot.resolve,
                visible: render.visible,
                extensionId: view.extensionId,
                emptyTitle: body.emptyTitle === undefined ? undefined : text(body.emptyTitle),
                emptyDescription: body.emptyDescription === undefined ? undefined : text(body.emptyDescription),
                renderParamField: input.createChatParamField?.(render.workbench),
              });
            },
          },
        },
        { source: "extension", ownerId: view.extensionId },
      );
      registrations++;
      let registered = true;
      replacement.attach(nextInput, token);
      return {
        dispose() {
          if (!registered) return;
          registered = false;
          registrations--;
          stopEvents();
          slots.clear();
          registration.dispose();
          replacement.detach(token);
        },
      };
    },
    dispose() {
      for (const owner of sessions.values()) {
        owner.untrack?.();
        owner.bindings?.dispose();
        void owner.session.retire().then(owner.releaseDrafts, owner.releaseDrafts);
        owner.session.query.dispose();
      }
      sessions.clear();
    },
  };
};
