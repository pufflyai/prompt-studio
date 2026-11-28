import type {
  ChatQueuedRequest,
  ChatRendererAction,
  ChatRendererSnapshot,
  ResourceRef,
  ScopedQueryClient,
} from "@pstdio/sdk/extensions";
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

// Queue changes for one conversation run one after another, across every view of it.
const queueTails = new Map<string, Promise<boolean>>();
let queueSequence = 0;

const sameFiles = (left: ChatQueuedRequest, right: ChatQueuedRequest) =>
  (left.attachments ?? []).map((file) => file.id).join() === (right.attachments ?? []).map((file) => file.id).join();

/** The queue addresses messages by position and revision, which change after every move. */
const findQueuedRequest = (item: ChatQueuedRequest, queue: readonly ChatQueuedRequest[]) => {
  if (queue.some((entry) => entry.position === item.position && entry.revision === item.revision)) return item;
  const matches = queue.filter((entry) => entry.prompt === item.prompt && sameFiles(entry, item));
  if (matches.length !== 1) throw new Error("The queue changed. Try again.");
  return matches[0]!;
};

const rebaseQueueAction = <A extends Extract<ChatRendererAction, { type: "queue" }>>(
  action: A,
  queue: readonly ChatQueuedRequest[],
): A => {
  // A new item is created from the request's content; it addresses no existing message.
  if (!queue.length || action.operation === "create") return action;
  return {
    ...action,
    item: findQueuedRequest(action.item, queue),
    ...(action.target ? { target: findQueuedRequest(action.target, queue) } : {}),
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
    async run<T>(
      action: ChatRendererAction,
      runStartedAt: number | undefined,
      execute: (action: ChatRendererAction) => Promise<T>,
      readQueue: () => readonly ChatQueuedRequest[] = () => [],
    ) {
      if (action.type !== "queue" && action.type !== "stop" && action.type !== "approve") return execute(action);
      const intent = { resource, action, runStartedAt: action.type === "stop" ? runStartedAt : undefined };
      if (action.type === "queue") {
        // Each queue change shows at once and waits for the one before it, then finds its
        // message again in the queue that change returned.
        const waiting = queueTails.get(resource);
        const previous = waiting ?? Promise.resolve(true);
        const settled = Promise.withResolvers<boolean>();
        queueTails.set(resource, settled.promise);
        const result = operations.submit({
          domain,
          projectId,
          source,
          title: titles.queue,
          subjects: [operationSubject(domain, resource, "queue", `${++queueSequence}`)],
          draft: draftFor(action),
          intent,
          releaseOnDiscard: true,
          classify: classifyApiWrite,
          write: async () => {
            if (!(await previous)) throw new Error("An earlier queue change did not go through. Try again.");
            // Only a change that waited behind another one can address a moved message.
            return execute(waiting ? rebaseQueueAction(action, readQueue()) : action);
          },
        }).result;
        // A lost response counts as failed for the changes waiting behind it.
        result.then(
          () => settled.resolve(true),
          () => settled.resolve(false),
        );
        void settled.promise.then(() => {
          if (queueTails.get(resource) === settled.promise) queueTails.delete(resource);
        });
        return result;
      }
      const subject = keyFor(intent);
      // A second approval or Stop for the same target is refused.
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
        write: () => execute(action),
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
  execute: (action: ChatRendererAction) => Promise<T>,
  readQueue?: () => readonly ChatQueuedRequest[],
) => {
  assertChatActionAvailable(conversation, action);
  return operations ? operations.run(action, conversation.streamingStartedAt, execute, readQueue) : execute(action);
};
