import type { ChatRendererAction, ChatRendererSnapshot, ResourceRef, ScopedQueryClient } from "@pstdio/sdk/extensions";
import { chatRendererActionResultSchema, chatRendererActionSchema } from "pstdio-api-contracts";
import { classifyApiWrite } from "../../core/registries/mutations/operation-failures";
import type { OperationPreview } from "../../core/registries/mutations/operation-types";
import {
  getWorkbenchOperations,
  operationSubject,
  resourceOperationSubject,
} from "../../core/registries/mutations/operations";

export type TrackedChatAction = Extract<ChatRendererAction, { type: "queue" | "approve" | "stop" }>;
type ChatActionIntent = { resource: string; action: TrackedChatAction; runStartedAt?: number };
export type ChatActionPreview = Omit<OperationPreview, "intent"> & { intent: ChatActionIntent };

const domain = "chat.action";
const titles = { queue: "Update queue", approve: "Respond to approval", stop: "Stop session" } as const;
const keyFor = (intent: ChatActionIntent) => {
  const { action, resource, runStartedAt } = intent;
  const target = action.type === "approve" ? action.id : runStartedAt?.toString();
  return operationSubject(domain, resource, action.type, target);
};

const draftFor = (action: TrackedChatAction) => {
  if (action.type !== "queue") return action;
  const editsPrompt = action.operation === "update" || action.operation === "create";
  return {
    operation: action.operation,
    itemId: action.item.id,
    targetId: action.target?.id,
    prompt: editsPrompt ? (action.prompt ?? action.item.prompt) : action.item.prompt,
    attachments: editsPrompt ? action.attachments : action.item.attachments,
  };
};

export const createChatActionOperations = (queries: ScopedQueryClient, source: ResourceRef, projectId: string) => {
  const operations = getWorkbenchOperations(queries);
  const resource = resourceOperationSubject(source);
  let previous: readonly OperationPreview[] | undefined;
  let snapshot: readonly ChatActionPreview[] = [];
  return {
    subscribe: operations.subscribe,
    getSnapshot() {
      const pending = operations.getSnapshot().pending;
      if (pending === previous) return snapshot;
      previous = pending;
      const relevant = pending.filter(
        (entry) => entry.domain === domain && (entry.intent as ChatActionIntent).resource === resource,
      ) as ChatActionPreview[];
      if (snapshot.length !== relevant.length || relevant.some((entry, index) => entry !== snapshot[index]))
        snapshot = relevant;
      return snapshot;
    },
    async run<T>(action: ChatRendererAction, runStartedAt: number | undefined, execute: () => Promise<T>) {
      if (action.type !== "queue" && action.type !== "stop" && action.type !== "approve") return execute();
      const intent = { resource, action, runStartedAt: action.type === "stop" ? runStartedAt : undefined };
      const subject = keyFor(intent);
      if (operations.getSnapshot().pending.some((entry) => entry.subjects.includes(subject)))
        throw new Error("This conversation action is still pending. See System activity if its result is unconfirmed.");
      return operations.submit({
        domain,
        projectId,
        source,
        title: titles[action.type],
        subjects: [subject],
        draft: draftFor(action),
        intent,
        releaseOnDiscard: true,
        classify: classifyApiWrite,
        write: execute,
      }).result;
    },
  };
};

export type ChatActionOperations = ReturnType<typeof createChatActionOperations>;

const assertChatActionAvailable = (conversation: ChatRendererSnapshot, action: ChatRendererAction) => {
  if (conversation.readOnly && action.type !== "openResource" && action.type !== "openLink")
    throw new Error("This conversation is read-only.");
  if (conversation.queueReadOnly && action.type === "queue")
    throw new Error("This queue is read-only. Refresh it before editing.");
};

export const executeChatAction = async (
  action: ChatRendererAction,
  handler: (action: ChatRendererAction) => Promise<unknown>,
  conversation: ChatRendererSnapshot,
) => {
  assertChatActionAvailable(conversation, action);
  return chatRendererActionResultSchema.parse((await handler(chatRendererActionSchema.parse(action))) ?? {});
};

export const trackChatActionExecution = async <T>(
  operations: ChatActionOperations | undefined,
  action: ChatRendererAction,
  conversation: ChatRendererSnapshot,
  execute: () => Promise<T>,
) => {
  assertChatActionAvailable(conversation, action);
  return operations ? operations.run(action, conversation.streamingStartedAt, execute) : execute();
};
