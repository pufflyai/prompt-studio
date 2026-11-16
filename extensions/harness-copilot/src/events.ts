import type { SessionEvent } from "@github/copilot-sdk";
import type { ReasoningPart, SessionMessage, SessionMessagePart, ToolPart } from "@pstdio/sdk/extensions";

type EventOf<T extends SessionEvent["type"]> = Extract<SessionEvent, { type: T }>;
type ToolCall = { toolCallId: string; name: string; arguments?: unknown };

/**
 * Rebuilds conversation messages from Copilot's session event log. Live turns and saved history
 * both go through here, so a message keeps the same id while it streams and after it settles.
 */
class Conversation {
  readonly messages: SessionMessage[] = [];
  private readonly tools = new Map<string, ToolPart>();
  private readonly drafts = new Map<string, SessionMessage>();
  // Reasoning already placed in a message: its later events update that part instead of repeating it.
  private readonly placed = new Map<string, ReasoningPart>();
  // Messages opened to show reasoning before Copilot names the message the reasoning belongs to.
  private readonly unnamed = new Set<SessionMessage>();
  private assistant: SessionMessage | undefined;
  // Copilot reports a model call's usage just before the message that call produced.
  private usage: SessionMessagePart[] = [];
  /** Position in the log of the event that started each message. */
  readonly starts = new Map<string, number>();
  private position = -1;

  constructor(private readonly offset: number) {}

  apply(event: SessionEvent) {
    this.position++;
    // Subagent traffic belongs to its parent tool call; the parent's result already summarizes it.
    if (isSubagent(event)) return;
    if (event.type === "user.message") this.user(event);
    else if (event.type === "assistant.reasoning_delta")
      this.think(event, event.data.reasoningId, event.data.deltaContent, true);
    else if (event.type === "assistant.reasoning") this.think(event, event.data.reasoningId, event.data.content, false);
    else if (event.type === "assistant.message_delta") this.stream(event);
    else if (event.type === "assistant.message") this.reply(event);
    else if (event.type === "tool.execution_start")
      this.addTool(this.current(event), {
        toolCallId: event.data.toolCallId,
        name: event.data.toolName,
        arguments: event.data.arguments,
      });
    else if (event.type === "tool.execution_complete") this.completeTool(event);
    else if (event.type === "permission.completed") this.denyTool(event);
    else if (event.type === "assistant.usage") this.usage.push(usagePart(event));
    else if (event.type === "session.error")
      this.current(event).parts.push(...this.takeUsage(), {
        type: "error",
        errorType: "other",
        message: event.data.message,
      });
    // A turn ends here, so its unfinished tools were interrupted, even if a later turn follows.
    else if (TURN_ENDS.has(event.type)) this.settle();
  }

  /** Tools still running when the turn ended were interrupted by an abort, crash, or restart. */
  settle() {
    for (const tool of this.tools.values()) if (tool.status === "running") tool.status = "failed";
    this.assistant?.parts.push(...this.takeUsage());
  }

  private takeUsage() {
    const parts = this.usage;
    this.usage = [];
    return parts;
  }

  private push(message: Omit<SessionMessage, "index">) {
    const indexed = { ...message, index: this.offset + this.messages.length } satisfies SessionMessage;
    this.messages.push(indexed);
    this.starts.set(indexed.id, this.position);
    return indexed;
  }

  private current(event: SessionEvent) {
    this.assistant ??= this.push({
      id: `copilot-${event.id}`,
      role: "assistant",
      createdAt: Date.parse(event.timestamp),
      parts: [],
    });
    return this.assistant;
  }

  private user(event: EventOf<"user.message">) {
    // Copilot inserts hidden prompts, such as a loaded skill's text, that the person never wrote.
    if (isHiddenInput(event)) return;
    this.assistant = undefined;
    this.push({
      // Steered input carries the host's delivery id as its turn id, so recovery can match it.
      id: event.data.clientTurnId ?? `copilot-${event.id}`,
      role: "user",
      createdAt: Date.parse(event.timestamp),
      parts: [{ type: "text", text: event.data.content }],
    });
  }

  /** Reasoning shows as it arrives, in the message being written or a new one that its reply later names. */
  private think(event: SessionEvent, id: string, text: string, delta: boolean) {
    const placed = this.placed.get(id);
    if (placed) {
      placed.text = delta ? placed.text + text : text;
      return;
    }
    let target = this.assistant && this.unnamed.has(this.assistant) ? this.assistant : undefined;
    if (!target) {
      target = this.push({
        id: `copilot-${event.id}`,
        role: "assistant",
        createdAt: Date.parse(event.timestamp),
        parts: [],
      });
      this.unnamed.add(target);
      this.assistant = target;
    }
    const part: ReasoningPart = { type: "reasoning", text };
    this.placed.set(id, part);
    target.parts.push(part);
  }

  /** Give the message opened for reasoning the id of the reply it belongs to, as saved history does. */
  private name(messageId: string) {
    const message = this.assistant && this.unnamed.has(this.assistant) ? this.assistant : undefined;
    if (!message) return undefined;
    this.unnamed.delete(message);
    const start = this.starts.get(message.id);
    this.starts.delete(message.id);
    message.id = `copilot-${messageId}`;
    if (start !== undefined) this.starts.set(message.id, start);
    return message;
  }

  private stream(event: EventOf<"assistant.message_delta">) {
    let draft = this.drafts.get(event.data.messageId);
    if (!draft) {
      draft =
        this.name(event.data.messageId) ??
        this.push({
          id: `copilot-${event.data.messageId}`,
          role: "assistant",
          createdAt: Date.parse(event.timestamp),
          parts: [],
        });
      draft.parts.push({ type: "text", text: "" });
      this.drafts.set(event.data.messageId, draft);
      this.assistant = draft;
    }
    const text = draft.parts.findLast((part) => part.type === "text");
    if (text?.type === "text") text.text += event.data.deltaContent;
  }

  private reply(event: EventOf<"assistant.message">) {
    const draft = this.drafts.get(event.data.messageId) ?? this.name(event.data.messageId);
    this.drafts.delete(event.data.messageId);
    const parts: SessionMessagePart[] = draft?.parts.filter((part) => part.type === "reasoning") ?? [];
    if (event.data.content) parts.push({ type: "text", text: event.data.content });
    const message = {
      id: `copilot-${event.data.messageId}`,
      role: "assistant" as const,
      createdAt: Date.parse(event.timestamp),
      modelId: event.data.model,
      parts,
    };
    this.assistant = draft ? Object.assign(draft, message) : this.push(message);
    for (const call of event.data.toolRequests ?? []) this.addTool(this.assistant, call);
    this.assistant.parts.push(...this.takeUsage());
  }

  private addTool(target: SessionMessage, call: ToolCall) {
    if (this.tools.has(call.toolCallId)) return;
    // Copilot's ask_user becomes the shared question tool, so the chat shows its question form.
    const asks = call.name === ASK_USER;
    const part: ToolPart = {
      type: "tool",
      tool: asks ? "question" : call.name,
      callId: call.toolCallId,
      status: "running",
      state: { input: asks ? questionInput(call.arguments) : call.arguments },
    };
    this.tools.set(call.toolCallId, part);
    target.parts.push(part);
  }

  private completeTool(event: EventOf<"tool.execution_complete">) {
    const tool = this.tools.get(event.data.toolCallId);
    if (!tool) return;
    tool.status = event.data.success ? "completed" : "failed";
    tool.state = {
      ...tool.state,
      output: event.data.result?.content,
      ...(event.data.error ? { errorText: event.data.error.message } : {}),
    };
  }

  private denyTool(event: EventOf<"permission.completed">) {
    const tool = event.data.toolCallId ? this.tools.get(event.data.toolCallId) : undefined;
    if (tool && event.data.result.kind.startsWith("denied")) tool.status = "denied";
  }
}

const usagePart = (event: EventOf<"assistant.usage">): SessionMessagePart => ({
  type: "token_usage",
  inputTokens: event.data.inputTokens ?? 0,
  outputTokens: event.data.outputTokens ?? 0,
  cacheReadTokens: event.data.cacheReadTokens,
  cacheWriteTokens: event.data.cacheWriteTokens,
});

const SETTLED = new Set(["session.idle", "session.shutdown", "abort"]);
const TURN_ENDS = SETTLED;

export const ASK_USER = "ask_user";

/** ask_user's question and choices in the question form's shape. Unknown shapes pass through unchanged. */
const questionInput = (args: unknown) => {
  const value = (args && typeof args === "object" ? args : {}) as Record<string, unknown>;
  if (typeof value.question !== "string") return args;
  const choices = Array.isArray(value.choices) ? value.choices.filter((choice) => typeof choice === "string") : [];
  const freeform = value.allow_freeform ?? value.allowFreeform;
  return {
    questions: [{ question: value.question, options: choices.map((label) => ({ label })), custom: freeform !== false }],
  };
};

/** Events a subagent produced inside a parent tool call. The deprecated `parentToolCallId` is the older marker. */
export const isSubagent = (event: SessionEvent) =>
  Boolean(event.agentId) || Boolean("parentToolCallId" in event.data && event.data.parentToolCallId);

const isHiddenInput = (event: EventOf<"user.message">) =>
  !event.data.clientTurnId && event.data.source !== undefined && event.data.source !== "user";

const replay = (events: readonly SessionEvent[], offset: number, ended = false) => {
  const conversation = new Conversation(offset);
  for (const event of events) conversation.apply(event);
  const last = events.findLast((event) => !isSubagent(event) && (!event.ephemeral || event.type === "session.idle"));
  if (ended || (last && SETTLED.has(last.type))) conversation.settle();
  return conversation;
};

/** `ended` marks a turn the host knows is over, so tools still running were interrupted. */
export const normalizeCopilotEvents = (events: readonly SessionEvent[], offset = 0, ended = false) =>
  replay(events, offset, ended).messages;

/**
 * The first event a fork through `messageId` must leave out: the start of the next user message or
 * model call. Undefined keeps the whole log. Throws when the message is not in this session.
 */
export const forkBoundary = (events: readonly SessionEvent[], messageId: string) => {
  const start = replay(events, 0).starts.get(messageId);
  if (start === undefined) throw new Error(`Message ${messageId} is not in this Copilot session.`);
  return events.find(
    (event, position) =>
      position > start &&
      !event.ephemeral &&
      !isSubagent(event) &&
      ((event.type === "user.message" && !isHiddenInput(event)) || event.type === "assistant.turn_start"),
  )?.id;
};
